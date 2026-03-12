#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


ARTIFACT_TYPES = {"postgres", "media"}


@dataclass(frozen=True, slots=True)
class OffsiteConfig:
    enabled: bool
    provider: str
    bucket: str
    region: str
    endpoint_url: str
    prefix: str
    access_key_id: str
    secret_access_key: str
    cli_image: str


@dataclass(frozen=True, slots=True)
class StoredObjectInfo:
    key: str
    size: int
    metadata: dict[str, str]
    last_modified: dt.datetime


class StorageClient(Protocol):
    def put_object_file(self, *, key: str, local_path: Path, metadata: dict[str, str], content_type: str) -> None: ...
    def put_object_bytes(self, *, key: str, payload: bytes, metadata: dict[str, str], content_type: str) -> None: ...
    def head_object(self, *, key: str) -> StoredObjectInfo: ...
    def get_object_bytes(self, *, key: str) -> bytes: ...
    def list_objects(self, *, prefix: str) -> list[StoredObjectInfo]: ...
    def delete_object(self, *, key: str) -> None: ...


def _env_bool(name: str, default: bool = False, *, env: dict[str, str] | None = None) -> bool:
    value = (env or os.environ).get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def load_offsite_config(*, env: dict[str, str] | None = None, require_enabled: bool = False) -> OffsiteConfig:
    source = env or os.environ
    enabled = _env_bool("OFFSITE_BACKUP_ENABLED", False, env=source)
    config = OffsiteConfig(
        enabled=enabled,
        provider=(source.get("OFFSITE_BACKUP_PROVIDER") or "r2").strip().lower(),
        bucket=(source.get("OFFSITE_BACKUP_BUCKET") or "").strip(),
        region=(source.get("OFFSITE_BACKUP_REGION") or "auto").strip(),
        endpoint_url=(source.get("OFFSITE_BACKUP_ENDPOINT_URL") or "").strip(),
        prefix=(source.get("OFFSITE_BACKUP_PREFIX") or "frpclient/prod").strip().strip("/"),
        access_key_id=(source.get("OFFSITE_BACKUP_ACCESS_KEY_ID") or "").strip(),
        secret_access_key=(source.get("OFFSITE_BACKUP_SECRET_ACCESS_KEY") or "").strip(),
        cli_image=(source.get("OFFSITE_BACKUP_AWS_CLI_IMAGE") or "amazon/aws-cli:2.31.1").strip(),
    )

    if require_enabled and not config.enabled:
        raise RuntimeError("OFFSITE_BACKUP_ENABLED=1 is required for this command")

    if not config.enabled:
        return config

    missing = [
        key
        for key, value in {
            "OFFSITE_BACKUP_BUCKET": config.bucket,
            "OFFSITE_BACKUP_PREFIX": config.prefix,
            "OFFSITE_BACKUP_ACCESS_KEY_ID": config.access_key_id,
            "OFFSITE_BACKUP_SECRET_ACCESS_KEY": config.secret_access_key,
        }.items()
        if not value
    ]
    if config.provider != "s3" and not config.endpoint_url:
        missing.append("OFFSITE_BACKUP_ENDPOINT_URL")
    if missing:
        raise RuntimeError(f"offsite backup config incomplete: missing {', '.join(missing)}")
    return config


def normalize_artifact_type(raw_value: str) -> str:
    artifact_type = (raw_value or "").strip().lower()
    if artifact_type not in ARTIFACT_TYPES:
        raise RuntimeError(f"unsupported artifact type: {raw_value}")
    return artifact_type


def archive_prefix(config: OffsiteConfig, artifact_type: str) -> str:
    return f"{config.prefix}/{normalize_artifact_type(artifact_type)}/archives"


def latest_manifest_key(config: OffsiteConfig, artifact_type: str) -> str:
    return f"{config.prefix}/{normalize_artifact_type(artifact_type)}/latest.json"


def archive_key(config: OffsiteConfig, artifact_type: str, filename: str) -> str:
    return f"{archive_prefix(config, artifact_type)}/{filename}"


def content_type_for_path(path: Path) -> str:
    name = path.name.lower()
    if name.endswith(".sql.gz"):
        return "application/gzip"
    if name.endswith(".tar.gz"):
        return "application/gzip"
    return "application/octet-stream"


def compute_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def iso_now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_storage_timestamp(raw_value: str) -> dt.datetime:
    parsed = dt.datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def build_manifest(*, artifact_type: str, local_path: Path, object_key: str, sha256_hex: str, uploaded_at: str) -> dict[str, object]:
    stat_result = local_path.stat()
    return {
        "schema_version": 1,
        "artifact_type": normalize_artifact_type(artifact_type),
        "filename": local_path.name,
        "object_key": object_key,
        "size_bytes": int(stat_result.st_size),
        "sha256": sha256_hex,
        "uploaded_at": uploaded_at,
        "local_path": str(local_path),
    }


class AwsCliStorageClient:
    def __init__(self, config: OffsiteConfig) -> None:
        self.config = config

    def _run(self, args: list[str], *, mounts: list[tuple[Path, str, str]] | None = None) -> subprocess.CompletedProcess[str]:
        command = [
            "docker",
            "run",
            "--rm",
            "-e",
            f"AWS_ACCESS_KEY_ID={self.config.access_key_id}",
            "-e",
            f"AWS_SECRET_ACCESS_KEY={self.config.secret_access_key}",
            "-e",
            f"AWS_DEFAULT_REGION={self.config.region}",
        ]
        for host_path, container_path, mode in mounts or []:
            command.extend(["-v", f"{host_path}:{container_path}:{mode}"])
        command.append(self.config.cli_image)
        if self.config.endpoint_url:
            command.extend(["--endpoint-url", self.config.endpoint_url])
        command.extend(args)
        return subprocess.run(command, capture_output=True, text=True, check=True)

    def put_object_file(self, *, key: str, local_path: Path, metadata: dict[str, str], content_type: str) -> None:
        metadata_value = ",".join(f"{item_key}={item_value}" for item_key, item_value in metadata.items())
        self._run(
            [
                "s3api",
                "put-object",
                "--bucket",
                self.config.bucket,
                "--key",
                key,
                "--body",
                f"/input/{local_path.name}",
                "--content-type",
                content_type,
                "--metadata",
                metadata_value,
            ],
            mounts=[(local_path.parent.resolve(), "/input", "ro")],
        )

    def put_object_bytes(self, *, key: str, payload: bytes, metadata: dict[str, str], content_type: str) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir) / "payload.bin"
            temp_path.write_bytes(payload)
            self.put_object_file(key=key, local_path=temp_path, metadata=metadata, content_type=content_type)

    def head_object(self, *, key: str) -> StoredObjectInfo:
        result = self._run(
            [
                "s3api",
                "head-object",
                "--bucket",
                self.config.bucket,
                "--key",
                key,
                "--output",
                "json",
            ]
        )
        payload = json.loads(result.stdout or "{}")
        return StoredObjectInfo(
            key=key,
            size=int(payload.get("ContentLength") or 0),
            metadata={str(k): str(v) for k, v in (payload.get("Metadata") or {}).items()},
            last_modified=parse_storage_timestamp(str(payload.get("LastModified") or iso_now())),
        )

    def get_object_bytes(self, *, key: str) -> bytes:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "object.bin"
            self._run(
                [
                    "s3api",
                    "get-object",
                    "--bucket",
                    self.config.bucket,
                    "--key",
                    key,
                    f"/output/{output_path.name}",
                    "--output",
                    "json",
                ],
                mounts=[(Path(temp_dir).resolve(), "/output", "rw")],
            )
            return output_path.read_bytes()

    def list_objects(self, *, prefix: str) -> list[StoredObjectInfo]:
        continuation_token = ""
        objects: list[StoredObjectInfo] = []
        while True:
            args = [
                "s3api",
                "list-objects-v2",
                "--bucket",
                self.config.bucket,
                "--prefix",
                prefix,
                "--output",
                "json",
            ]
            if continuation_token:
                args.extend(["--continuation-token", continuation_token])
            result = self._run(args)
            payload = json.loads(result.stdout or "{}")
            for item in payload.get("Contents") or []:
                objects.append(
                    StoredObjectInfo(
                        key=str(item.get("Key") or ""),
                        size=int(item.get("Size") or 0),
                        metadata={},
                        last_modified=parse_storage_timestamp(str(item.get("LastModified") or iso_now())),
                    )
                )
            if not payload.get("IsTruncated"):
                break
            continuation_token = str(payload.get("NextContinuationToken") or "")
            if not continuation_token:
                break
        return objects

    def delete_object(self, *, key: str) -> None:
        self._run(["s3api", "delete-object", "--bucket", self.config.bucket, "--key", key])


def prune_remote_archives(
    client: StorageClient,
    *,
    config: OffsiteConfig,
    artifact_type: str,
    keep_count: int,
    retention_days: int,
    protect_key: str,
) -> list[str]:
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=max(0, retention_days))
    objects = sorted(
        client.list_objects(prefix=archive_prefix(config, artifact_type)),
        key=lambda item: item.last_modified,
        reverse=True,
    )
    protected = {protect_key}
    deleted: list[str] = []
    for index, item in enumerate(objects):
        if item.key in protected:
            continue
        if index < max(0, keep_count):
            continue
        if item.last_modified > cutoff and index < max(0, keep_count * 2):
            continue
        client.delete_object(key=item.key)
        deleted.append(item.key)
    return deleted


def upload_artifact(
    client: StorageClient,
    *,
    config: OffsiteConfig,
    artifact_type: str,
    local_path: Path,
    keep_count: int,
    retention_days: int,
    uploaded_at: str | None = None,
) -> dict[str, object]:
    artifact_type = normalize_artifact_type(artifact_type)
    if not local_path.is_file():
        raise RuntimeError(f"local backup missing: {local_path}")

    uploaded_timestamp = uploaded_at or iso_now()
    sha256_hex = compute_sha256(local_path)
    object_key = archive_key(config, artifact_type, local_path.name)
    metadata = {
        "sha256": sha256_hex,
        "artifact_type": artifact_type,
        "uploaded_at": uploaded_timestamp,
    }

    client.put_object_file(
        key=object_key,
        local_path=local_path,
        metadata=metadata,
        content_type=content_type_for_path(local_path),
    )

    remote_object = client.head_object(key=object_key)
    if remote_object.size != local_path.stat().st_size:
        raise RuntimeError(
            f"offsite upload size mismatch: key={object_key} local={local_path.stat().st_size} remote={remote_object.size}"
        )
    if remote_object.metadata.get("sha256", "") != sha256_hex:
        raise RuntimeError(f"offsite upload metadata mismatch: key={object_key}")

    manifest = build_manifest(
        artifact_type=artifact_type,
        local_path=local_path,
        object_key=object_key,
        sha256_hex=sha256_hex,
        uploaded_at=uploaded_timestamp,
    )
    client.put_object_bytes(
        key=latest_manifest_key(config, artifact_type),
        payload=json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8"),
        metadata={"artifact_type": artifact_type, "uploaded_at": uploaded_timestamp},
        content_type="application/json",
    )
    deleted_keys = prune_remote_archives(
        client,
        config=config,
        artifact_type=artifact_type,
        keep_count=keep_count,
        retention_days=retention_days,
        protect_key=object_key,
    )
    manifest["deleted_keys"] = deleted_keys
    return manifest


def verify_latest_artifact(
    client: StorageClient,
    *,
    config: OffsiteConfig,
    artifact_type: str,
    local_path: Path | None = None,
) -> dict[str, object]:
    artifact_type = normalize_artifact_type(artifact_type)
    manifest_bytes = client.get_object_bytes(key=latest_manifest_key(config, artifact_type))
    manifest = json.loads(manifest_bytes.decode("utf-8"))
    object_key = str(manifest.get("object_key") or "")
    if not object_key:
        raise RuntimeError(f"latest offsite manifest missing object_key for {artifact_type}")

    remote_object = client.head_object(key=object_key)
    expected_size = int(manifest.get("size_bytes") or 0)
    expected_sha256 = str(manifest.get("sha256") or "")
    if remote_object.size != expected_size:
        raise RuntimeError(
            f"offsite verify size mismatch: artifact={artifact_type} manifest={expected_size} remote={remote_object.size}"
        )
    if remote_object.metadata.get("sha256", "") != expected_sha256:
        raise RuntimeError(f"offsite verify sha256 metadata mismatch: artifact={artifact_type}")

    if local_path is not None:
        if not local_path.is_file():
            raise RuntimeError(f"local backup missing for offsite verify: {local_path}")
        local_size = local_path.stat().st_size
        local_sha256 = compute_sha256(local_path)
        if local_size != expected_size:
            raise RuntimeError(
                f"offsite verify local size mismatch: artifact={artifact_type} local={local_size} manifest={expected_size}"
            )
        if local_sha256 != expected_sha256:
            raise RuntimeError(f"offsite verify local sha256 mismatch: artifact={artifact_type}")

    return {
        "artifact_type": artifact_type,
        "object_key": object_key,
        "size_bytes": expected_size,
        "sha256": expected_sha256,
        "uploaded_at": str(manifest.get("uploaded_at") or ""),
    }


def build_storage_client(config: OffsiteConfig) -> StorageClient:
    return AwsCliStorageClient(config)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload and verify FRP Client backups in R2/S3 compatible storage.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    upload_parser = subparsers.add_parser("upload")
    upload_parser.add_argument("--artifact-type", required=True, choices=sorted(ARTIFACT_TYPES))
    upload_parser.add_argument("--local-path", required=True)
    upload_parser.add_argument("--keep-count", type=int, default=10)
    upload_parser.add_argument("--retention-days", type=int, default=14)

    verify_parser = subparsers.add_parser("verify")
    verify_parser.add_argument("--artifact-type", required=True, choices=sorted(ARTIFACT_TYPES))
    verify_parser.add_argument("--local-path", default="")

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        config = load_offsite_config(require_enabled=True)
        client = build_storage_client(config)

        if args.command == "upload":
            manifest = upload_artifact(
                client,
                config=config,
                artifact_type=args.artifact_type,
                local_path=Path(args.local_path).resolve(),
                keep_count=max(1, int(args.keep_count)),
                retention_days=max(0, int(args.retention_days)),
            )
            print(
                "offsite upload ok:",
                f"artifact_type={manifest['artifact_type']}",
                f"key={manifest['object_key']}",
                f"size_bytes={manifest['size_bytes']}",
                f"deleted={len(manifest.get('deleted_keys') or [])}",
            )
            return 0

        if args.command == "verify":
            result = verify_latest_artifact(
                client,
                config=config,
                artifact_type=args.artifact_type,
                local_path=Path(args.local_path).resolve() if args.local_path else None,
            )
            print(
                "offsite verify ok:",
                f"artifact_type={result['artifact_type']}",
                f"key={result['object_key']}",
                f"size_bytes={result['size_bytes']}",
            )
            return 0
    except Exception as exc:
        print(str(exc), file=os.sys.stderr)
        return 1
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
