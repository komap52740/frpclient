from __future__ import annotations

import json
from datetime import datetime, timezone as dt_timezone
from pathlib import Path

from django.conf import settings
from django.utils import timezone


JOB_STATUS_SPECS: dict[str, dict[str, object]] = {
    "public_smoke": {"stale_after_seconds": 1800},
    "runtime_audit": {"stale_after_seconds": 3600},
    "managed_acceptance": {"stale_after_seconds": 129600},
    "deploy": {"stale_after_seconds": 2592000},
    "postgres_backup": {"stale_after_seconds": 129600},
    "postgres_verify": {"stale_after_seconds": 129600},
    "media_backup": {"stale_after_seconds": 129600},
    "media_verify": {"stale_after_seconds": 129600},
    "certbot_dry_run": {"stale_after_seconds": 864000},
    "django_housekeeping": {"stale_after_seconds": 129600},
    "platform_metrics_refresh": {"stale_after_seconds": 7200},
}

ROLLBACK_REQUIRED_KEYS = (
    "COMPOSE_PROJECT_NAME",
    "IMAGE_BACKEND",
    "IMAGE_BACKEND_WS",
    "IMAGE_FRONTEND",
)
RELEASE_STATE_STALE_AFTER_SECONDS = 2592000
RELEASE_HISTORY_LIMIT = 5
ROLLBACK_STATUS_STALE_AFTER_SECONDS = 2592000


def _project_dir() -> Path:
    base_dir = Path(getattr(settings, "BASE_DIR", Path(__file__).resolve().parents[2]))
    return base_dir.parent


def _runtime_state_dir() -> Path:
    configured_path = getattr(settings, "RUNTIME_STATE_DIR", "")
    if configured_path:
        return Path(configured_path)

    base_dir = Path(getattr(settings, "BASE_DIR", Path(__file__).resolve().parents[2]))
    container_runtime_state_dir = base_dir / "runtime-state"
    if container_runtime_state_dir.exists():
        return container_runtime_state_dir
    return _project_dir() / ".deploy"


def _job_status_dir() -> Path:
    return Path(getattr(settings, "JOB_STATUS_DIR", _runtime_state_dir() / "status"))


def _release_state_dir() -> Path:
    return Path(getattr(settings, "RELEASE_STATE_DIR", _runtime_state_dir() / "release"))


def _read_metadata(path: Path) -> tuple[dict[str, str], str]:
    if not path.exists():
        return {}, f"metadata missing: {path}"

    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as exc:
        return {}, str(exc)

    data: dict[str, str] = {}
    for line in raw.splitlines():
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip()
    return data, ""


def _parse_timestamp(raw_value: str) -> tuple[datetime | None, str]:
    if not raw_value:
        return None, "timestamp missing"

    try:
        parsed = datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
    except ValueError:
        return None, f"invalid timestamp: {raw_value}"

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt_timezone.utc)
    return parsed.astimezone(dt_timezone.utc), ""


def _format_timestamp(value: datetime | None) -> str:
    if value is None:
        return ""
    return value.astimezone(dt_timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _build_state_payload(
    *,
    path: Path,
    active: bool,
    metadata_path: Path,
    timestamp_key: str,
    stale_after_seconds: int,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "active": active,
        "stale": False,
        "stale_after_seconds": stale_after_seconds,
        "reason": "",
        "path": str(path),
        "age_seconds": None,
        "error": "",
        timestamp_key: "",
    }
    if not active:
        return payload

    metadata, metadata_error = _read_metadata(metadata_path)
    if metadata_error:
        payload["error"] = metadata_error
        payload["stale"] = True
        return payload

    payload["reason"] = metadata.get("reason", "")
    raw_timestamp = metadata.get(timestamp_key, "")
    payload[timestamp_key] = raw_timestamp

    parsed_timestamp, timestamp_error = _parse_timestamp(raw_timestamp)
    if timestamp_error:
        payload["error"] = timestamp_error
        payload["stale"] = True
        return payload

    age_seconds = max(0, int((timezone.now() - parsed_timestamp).total_seconds()))
    payload["age_seconds"] = age_seconds
    payload["stale"] = age_seconds > stale_after_seconds
    if payload["stale"]:
        payload["error"] = f"state age exceeds {stale_after_seconds} seconds"
    return payload


def _read_job_status(path: Path, stale_after_seconds: int) -> dict[str, object]:
    payload: dict[str, object] = {
        "status": "missing",
        "summary": "",
        "started_at": "",
        "finished_at": "",
        "updated_at": "",
        "duration_seconds": 0.0,
        "age_seconds": None,
        "stale": False,
        "healthy": False,
        "path": str(path),
        "error": "",
    }
    if not path.exists():
        payload["error"] = f"status file missing: {path}"
        return payload

    try:
        raw_data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        payload["status"] = "invalid"
        payload["error"] = str(exc)
        return payload

    payload["status"] = str(raw_data.get("status") or "unknown")
    payload["summary"] = str(raw_data.get("summary") or "")
    payload["started_at"] = str(raw_data.get("started_at") or "")
    payload["finished_at"] = str(raw_data.get("finished_at") or "")
    payload["updated_at"] = str(raw_data.get("updated_at") or "")

    try:
        payload["duration_seconds"] = float(raw_data.get("duration_seconds") or 0.0)
    except (TypeError, ValueError):
        payload["duration_seconds"] = 0.0

    reference_timestamp = payload["finished_at"] or payload["updated_at"] or payload["started_at"]
    parsed_timestamp, timestamp_error = _parse_timestamp(reference_timestamp)
    if timestamp_error:
        payload["error"] = timestamp_error
        payload["healthy"] = False
        return payload

    age_seconds = max(0, int((timezone.now() - parsed_timestamp).total_seconds()))
    payload["age_seconds"] = age_seconds
    payload["stale"] = age_seconds > stale_after_seconds
    payload["healthy"] = payload["status"] in {"success", "skipped"} and not payload["stale"]
    if payload["stale"]:
        payload["error"] = f"job status age exceeds {stale_after_seconds} seconds"
    elif payload["status"] not in {"success", "skipped"}:
        payload["error"] = f"job status is {payload['status']}"
    return payload


def _read_rollback_manifest(path: Path) -> tuple[dict[str, str], list[str], str]:
    metadata, metadata_error = _read_metadata(path)
    if metadata_error:
        return {}, [], metadata_error

    missing_keys = [key for key in ROLLBACK_REQUIRED_KEYS if not metadata.get(key)]
    return metadata, missing_keys, ""


def _read_release_state(path: Path, stale_after_seconds: int | None) -> dict[str, object]:
    payload: dict[str, object] = {
        "available": False,
        "healthy": False,
        "stale": False,
        "source_metadata_available": False,
        "action": "",
        "release_label": "",
        "base_url": "",
        "with_bot": False,
        "started_at": "",
        "finished_at": "",
        "updated_at": "",
        "duration_seconds": 0.0,
        "age_seconds": None,
        "git_commit": "",
        "git_branch": "",
        "git_tag": "",
        "source_fingerprint": "",
        "source_fingerprint_short": "",
        "rollback_snapshot_label": "",
        "restored_snapshot_label": "",
        "containers": {},
        "path": str(path),
        "error": "",
    }
    if not path.exists():
        payload["error"] = f"release state missing: {path}"
        return payload

    try:
        raw_data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        payload["error"] = str(exc)
        return payload

    payload["available"] = True
    payload["action"] = str(raw_data.get("action") or "")
    payload["release_label"] = str(raw_data.get("release_label") or "")
    payload["base_url"] = str(raw_data.get("base_url") or "")
    payload["with_bot"] = bool(raw_data.get("with_bot"))
    payload["started_at"] = str(raw_data.get("started_at") or "")
    payload["finished_at"] = str(raw_data.get("finished_at") or "")
    payload["updated_at"] = str(raw_data.get("updated_at") or "")
    payload["git_commit"] = str(raw_data.get("git_commit") or "")
    payload["git_branch"] = str(raw_data.get("git_branch") or "")
    payload["git_tag"] = str(raw_data.get("git_tag") or "")
    payload["source_fingerprint"] = str(raw_data.get("source_fingerprint") or "")
    payload["source_fingerprint_short"] = str(raw_data.get("source_fingerprint_short") or "")
    if not payload["source_fingerprint_short"] and payload["source_fingerprint"]:
        payload["source_fingerprint_short"] = payload["source_fingerprint"][:12]
    payload["source_metadata_available"] = bool(payload["source_fingerprint"] or payload["git_commit"] or payload["git_tag"])
    payload["rollback_snapshot_label"] = str(raw_data.get("rollback_snapshot_label") or "")
    payload["restored_snapshot_label"] = str(raw_data.get("restored_snapshot_label") or "")
    payload["containers"] = raw_data.get("containers") if isinstance(raw_data.get("containers"), dict) else {}

    try:
        payload["duration_seconds"] = float(raw_data.get("duration_seconds") or 0.0)
    except (TypeError, ValueError):
        payload["duration_seconds"] = 0.0

    reference_timestamp = payload["finished_at"] or payload["updated_at"] or payload["started_at"]
    parsed_timestamp, timestamp_error = _parse_timestamp(reference_timestamp)
    if timestamp_error:
        payload["error"] = timestamp_error
        return payload

    age_seconds = max(0, int((timezone.now() - parsed_timestamp).total_seconds()))
    payload["age_seconds"] = age_seconds
    if stale_after_seconds is None:
        payload["healthy"] = bool(payload["action"])
        return payload

    payload["stale"] = age_seconds > stale_after_seconds
    payload["healthy"] = bool(payload["action"]) and bool(payload["source_metadata_available"]) and not payload["stale"]
    if not payload["action"]:
        payload["error"] = "release state action missing"
    elif not payload["source_metadata_available"]:
        payload["error"] = "release state missing source metadata"
    elif not payload["healthy"]:
        payload["error"] = f"release state age exceeds {stale_after_seconds} seconds"
    return payload


def _read_release_history(history_dir: Path, recent_limit: int) -> list[dict[str, object]]:
    if not history_dir.exists() or not history_dir.is_dir():
        return []

    payload: list[dict[str, object]] = []
    for history_path in sorted(history_dir.glob("*.json"), reverse=True)[:recent_limit]:
        history_entry = _read_release_state(history_path, None)
        if history_entry["available"]:
            payload.append(history_entry)
    return payload


def get_deploy_lock_state() -> dict[str, object]:
    lock_dir = Path(getattr(settings, "DEPLOY_LOCK_DIR", _runtime_state_dir() / "active.lock"))
    stale_after_seconds = int(getattr(settings, "OPS_DEPLOY_LOCK_STALE_AFTER_SECONDS", 7200))
    return _build_state_payload(
        path=lock_dir,
        active=lock_dir.is_dir(),
        metadata_path=lock_dir / "metadata",
        timestamp_key="locked_at",
        stale_after_seconds=stale_after_seconds,
    )


def get_maintenance_mode_state() -> dict[str, object]:
    marker_path = Path(getattr(settings, "MAINTENANCE_MARKER_PATH", _runtime_state_dir() / "maintenance-mode"))
    stale_after_seconds = int(getattr(settings, "OPS_MAINTENANCE_STALE_AFTER_SECONDS", 1800))
    return _build_state_payload(
        path=marker_path,
        active=marker_path.is_file(),
        metadata_path=marker_path,
        timestamp_key="enabled_at",
        stale_after_seconds=stale_after_seconds,
    )


def get_release_state() -> dict[str, object]:
    release_dir = _release_state_dir()
    path = release_dir / "current.json"
    stale_after_seconds = int(
        getattr(settings, "RELEASE_STATE_STALE_AFTER_SECONDS", RELEASE_STATE_STALE_AFTER_SECONDS)
    )
    payload = _read_release_state(path, stale_after_seconds)
    payload["history"] = _read_release_history(
        release_dir / "history",
        max(1, int(getattr(settings, "RELEASE_HISTORY_LIMIT", RELEASE_HISTORY_LIMIT))),
    )
    return payload


def get_rollback_inventory() -> dict[str, object]:
    manifest_dir = Path(getattr(settings, "ROLLBACK_MANIFEST_DIR", _runtime_state_dir() / "rollback" / "manifests"))
    status_dir = _job_status_dir()
    recent_limit = max(1, int(getattr(settings, "ROLLBACK_RECENT_LIMIT", 5)))
    payload: dict[str, object] = {
        "healthy": False,
        "path": str(manifest_dir),
        "available_count": 0,
        "invalid_count": 0,
        "latest_label": "",
        "latest_created_at": "",
        "latest_age_seconds": None,
        "latest_with_bot": False,
        "latest_git_commit": "",
        "latest_git_branch": "",
        "latest_git_tag": "",
        "latest_source_fingerprint": "",
        "latest_source_fingerprint_short": "",
        "latest_source_metadata_available": False,
        "recent_labels": [],
        "last_run": _read_job_status(
            status_dir / "rollback.json",
            int(getattr(settings, "ROLLBACK_STATUS_STALE_AFTER_SECONDS", ROLLBACK_STATUS_STALE_AFTER_SECONDS)),
        ),
        "error": "",
    }

    if not manifest_dir.exists():
        payload["error"] = f"rollback manifest dir missing: {manifest_dir}"
        return payload
    if not manifest_dir.is_dir():
        payload["error"] = f"rollback manifest dir is not a directory: {manifest_dir}"
        return payload

    manifests = sorted(manifest_dir.glob("*.env"), reverse=True)
    payload["available_count"] = len(manifests)
    payload["recent_labels"] = [manifest_path.stem for manifest_path in manifests[:recent_limit]]
    if not manifests:
        payload["error"] = "no rollback manifests available"
        return payload

    invalid_count = 0
    latest_path = manifests[0]
    latest_metadata: dict[str, str] = {}
    latest_missing_keys: list[str] = []
    latest_error = ""

    for index, manifest_path in enumerate(manifests):
        metadata, missing_keys, metadata_error = _read_rollback_manifest(manifest_path)
        if metadata_error or missing_keys:
            invalid_count += 1
            if index == 0:
                latest_metadata = metadata
                latest_missing_keys = missing_keys
                latest_error = metadata_error
            continue

        if index == 0:
            latest_metadata = metadata

    payload["invalid_count"] = invalid_count
    payload["latest_label"] = str(latest_metadata.get("SNAPSHOT_LABEL") or latest_path.stem)
    payload["latest_with_bot"] = str(latest_metadata.get("WITH_BOT") or "").strip() == "1"
    payload["latest_git_commit"] = str(latest_metadata.get("SOURCE_GIT_COMMIT") or "")
    payload["latest_git_branch"] = str(latest_metadata.get("SOURCE_GIT_BRANCH") or "")
    payload["latest_git_tag"] = str(latest_metadata.get("SOURCE_GIT_TAG") or "")
    payload["latest_source_fingerprint"] = str(latest_metadata.get("SOURCE_FINGERPRINT") or "")
    payload["latest_source_fingerprint_short"] = str(latest_metadata.get("SOURCE_FINGERPRINT_SHORT") or "")
    if not payload["latest_source_fingerprint_short"] and payload["latest_source_fingerprint"]:
        payload["latest_source_fingerprint_short"] = payload["latest_source_fingerprint"][:12]
    payload["latest_source_metadata_available"] = bool(
        payload["latest_source_fingerprint"] or payload["latest_git_commit"] or payload["latest_git_tag"]
    )

    try:
        latest_created_at = datetime.fromtimestamp(latest_path.stat().st_mtime, tz=dt_timezone.utc)
    except OSError as exc:
        latest_created_at = None
        if not latest_error:
            latest_error = str(exc)

    payload["latest_created_at"] = _format_timestamp(latest_created_at)
    if latest_created_at is not None:
        payload["latest_age_seconds"] = max(0, int((timezone.now() - latest_created_at).total_seconds()))

    if latest_error:
        payload["error"] = latest_error
        return payload
    if latest_missing_keys:
        payload["error"] = f"latest rollback manifest missing keys: {', '.join(latest_missing_keys)}"
        return payload

    payload["healthy"] = True
    return payload


def get_job_statuses() -> dict[str, dict[str, object]]:
    status_dir = _job_status_dir()
    payload: dict[str, dict[str, object]] = {}
    for job_name, spec in JOB_STATUS_SPECS.items():
        stale_after_seconds = int(spec.get("stale_after_seconds", 3600))
        payload[job_name] = _read_job_status(status_dir / f"{job_name}.json", stale_after_seconds)
    return payload
