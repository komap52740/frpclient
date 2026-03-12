#!/usr/bin/env sh

release_state_write() {
    action=$1
    project_dir=${PROJECT_DIR:-$(pwd)}
    release_dir=${RELEASE_STATE_DIR:-$project_dir/.deploy/release}
    current_file=$release_dir/current.json
    history_dir=$release_dir/history
    keep_count=${RELEASE_HISTORY_KEEP_COUNT:-20}
    source_metadata_script=${SOURCE_METADATA_SCRIPT:-$project_dir/ops/common/source_metadata.py}
    tmp_file=$current_file.tmp.$$

    if ! command -v python3 >/dev/null 2>&1; then
        echo "python3 is required to write release state" >&2
        return 1
    fi

    mkdir -p "$release_dir" "$history_dir" 2>/dev/null || return 1

    python3 - \
        "$action" \
        "$project_dir" \
        "$tmp_file" \
        "$history_dir" \
        "$keep_count" \
        "$source_metadata_script" \
        "${RELEASE_STATE_BASE_URL:-}" \
        "${RELEASE_STATE_WITH_BOT:-0}" \
        "${RELEASE_STATE_STARTED_AT:-}" \
        "${RELEASE_STATE_LABEL:-}" \
        "${RELEASE_STATE_ROLLBACK_SNAPSHOT_LABEL:-}" \
        "${RELEASE_STATE_RESTORED_SNAPSHOT_LABEL:-}" \
        "${RELEASE_STATE_SOURCE_AUTHORITATIVE:-0}" \
        "${RELEASE_STATE_SOURCE_GIT_COMMIT:-}" \
        "${RELEASE_STATE_SOURCE_GIT_BRANCH:-}" \
        "${RELEASE_STATE_SOURCE_GIT_TAG:-}" \
        "${RELEASE_STATE_SOURCE_FINGERPRINT:-}" <<'PY'
import json
import os
import socket
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def run_text(args, cwd=None):
    try:
        return subprocess.check_output(args, cwd=cwd, stderr=subprocess.DEVNULL, text=True).strip()
    except Exception:
        return ""


def inspect_container(container_name):
    try:
        raw = subprocess.check_output(["docker", "inspect", container_name], stderr=subprocess.DEVNULL, text=True)
    except Exception:
        return {}

    try:
        items = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if not items:
        return {}

    item = items[0]
    state = item.get("State") or {}
    health = state.get("Health") or {}
    image_id = str(item.get("Image") or "")
    return {
        "container_name": container_name,
        "container_id": str(item.get("Id") or "")[:12],
        "image_id": image_id,
        "image_id_short": image_id.replace("sha256:", "")[:12],
        "image_name": str((item.get("Config") or {}).get("Image") or ""),
        "status": str(state.get("Status") or ""),
        "health": str(health.get("Status") or ""),
    }


def load_tree_source_metadata(source_script, project_dir):
    if not source_script:
        return {}

    try:
        raw = subprocess.check_output(
            [
                sys.executable,
                source_script,
                "--mode",
                "tree",
                "--project-dir",
                project_dir,
                "--format",
                "json",
            ],
            stderr=subprocess.DEVNULL,
            text=True,
        )
    except Exception:
        return {}

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


(
    action,
    project_dir,
    tmp_file,
    history_dir,
    keep_count_raw,
    source_script,
    base_url,
    with_bot_raw,
    started_at,
    release_label,
    rollback_snapshot_label,
    restored_snapshot_label,
    source_authoritative_raw,
    source_git_commit,
    source_git_branch,
    source_git_tag,
    source_fingerprint,
) = sys.argv[1:18]
finished_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
started_at = started_at or finished_at
with_bot = with_bot_raw.strip() == "1"
source_authoritative = source_authoritative_raw.strip() == "1"
release_label = release_label or finished_at.replace("-", "").replace(":", "")
try:
    keep_count = max(0, int(keep_count_raw or "20"))
except ValueError:
    keep_count = 20

if not source_authoritative:
    source_metadata = load_tree_source_metadata(source_script, project_dir)
    if not source_git_commit:
        source_git_commit = str(source_metadata.get("git_commit") or "")
    if not source_git_branch:
        source_git_branch = str(source_metadata.get("git_branch") or "")
    if not source_git_tag:
        source_git_tag = str(source_metadata.get("git_tag") or "")
    if not source_fingerprint:
        source_fingerprint = str(source_metadata.get("source_fingerprint") or "")

source_fingerprint_short = source_fingerprint[:12] if source_fingerprint else ""

backend_container_name = os.getenv("BACKEND_CONTAINER_NAME", "frp-backend")
backend_ws_container_name = os.getenv("BACKEND_WS_CONTAINER_NAME", "frp-backend-ws")
frontend_container_name = os.getenv("FRONTEND_CONTAINER_NAME", "frp-frontend")
telegram_bot_container_name = os.getenv("TELEGRAM_BOT_CONTAINER_NAME", "frp-telegram-bot")

containers = {
    "backend": inspect_container(backend_container_name),
    "backend_ws": inspect_container(backend_ws_container_name),
    "frontend": inspect_container(frontend_container_name),
}
if with_bot:
    containers["telegram_bot"] = inspect_container(telegram_bot_container_name)

duration_seconds = 0.0
try:
    started = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
    finished = datetime.fromisoformat(finished_at.replace("Z", "+00:00"))
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    if finished.tzinfo is None:
        finished = finished.replace(tzinfo=timezone.utc)
    duration_seconds = max(0.0, (finished - started).total_seconds())
except ValueError:
    duration_seconds = 0.0

payload = {
    "action": action,
    "release_label": release_label,
    "base_url": base_url,
    "with_bot": with_bot,
    "rollback_snapshot_label": rollback_snapshot_label,
    "restored_snapshot_label": restored_snapshot_label,
    "started_at": started_at,
    "finished_at": finished_at,
    "updated_at": finished_at,
    "duration_seconds": duration_seconds,
    "host": socket.gethostname() or "unknown",
    "git_commit": source_git_commit,
    "git_branch": source_git_branch,
    "git_tag": source_git_tag,
    "source_fingerprint": source_fingerprint,
    "source_fingerprint_short": source_fingerprint_short,
    "containers": containers,
}

Path(tmp_file).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
history_path = Path(history_dir) / f"{release_label}-{action}.json"
history_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

if keep_count > 0:
    history_entries = sorted(Path(history_dir).glob("*.json"), reverse=True)
    for obsolete_path in history_entries[keep_count:]:
        try:
            obsolete_path.unlink()
        except OSError:
            pass
PY

    mv "$tmp_file" "$current_file" 2>/dev/null || {
        rm -f "$tmp_file" 2>/dev/null || true
        return 1
    }
    return 0
}
