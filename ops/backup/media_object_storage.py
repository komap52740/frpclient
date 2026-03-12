#!/usr/bin/env python3
from __future__ import annotations

import argparse
import mimetypes
import os
import shutil
from dataclasses import dataclass
from pathlib import Path

import boto3
from botocore.client import Config


@dataclass(frozen=True, slots=True)
class MediaStorageConfig:
    provider: str
    bucket_name: str
    region_name: str
    endpoint_url: str
    prefix: str
    access_key_id: str
    secret_access_key: str
    signature_version: str
    addressing_style: str


def load_media_storage_config(*, env: dict[str, str] | None = None, require_remote: bool = False) -> MediaStorageConfig | None:
    source = env or os.environ
    provider = (source.get("MEDIA_STORAGE_PROVIDER", "filesystem") or "filesystem").strip().lower()
    if provider in {"", "filesystem", "local"}:
        if require_remote:
            raise RuntimeError("MEDIA_STORAGE_PROVIDER must be set to r2 for remote media operations")
        return None
    if provider not in {"r2", "s3"}:
        raise RuntimeError(f"unsupported MEDIA_STORAGE_PROVIDER: {provider}")

    bucket_name = (source.get("MEDIA_STORAGE_BUCKET_NAME", "") or "").strip()
    region_name = (source.get("MEDIA_STORAGE_REGION_NAME", "auto") or "auto").strip()
    endpoint_url = (source.get("MEDIA_STORAGE_ENDPOINT_URL", "") or "").strip()
    prefix = (source.get("MEDIA_STORAGE_PREFIX", "media") or "media").strip().strip("/")
    access_key_id = (source.get("MEDIA_STORAGE_ACCESS_KEY_ID", "") or "").strip()
    secret_access_key = (source.get("MEDIA_STORAGE_SECRET_ACCESS_KEY", "") or "").strip()
    signature_version = (source.get("MEDIA_STORAGE_SIGNATURE_VERSION", "s3v4") or "s3v4").strip()
    addressing_style = (source.get("MEDIA_STORAGE_ADDRESSING_STYLE", "virtual") or "virtual").strip()

    if not bucket_name:
        raise RuntimeError("MEDIA_STORAGE_BUCKET_NAME is required when MEDIA_STORAGE_PROVIDER is remote")
    if provider != "s3" and not endpoint_url:
        raise RuntimeError("MEDIA_STORAGE_ENDPOINT_URL is required for R2 media storage")
    if not access_key_id or not secret_access_key:
        raise RuntimeError("MEDIA_STORAGE_ACCESS_KEY_ID and MEDIA_STORAGE_SECRET_ACCESS_KEY are required")

    return MediaStorageConfig(
        provider=provider,
        bucket_name=bucket_name,
        region_name=region_name,
        endpoint_url=endpoint_url,
        prefix=prefix,
        access_key_id=access_key_id,
        secret_access_key=secret_access_key,
        signature_version=signature_version,
        addressing_style=addressing_style,
    )


def build_s3_client(config: MediaStorageConfig):
    return boto3.client(
        "s3",
        endpoint_url=config.endpoint_url or None,
        region_name=config.region_name,
        aws_access_key_id=config.access_key_id,
        aws_secret_access_key=config.secret_access_key,
        config=Config(signature_version=config.signature_version, s3={"addressing_style": config.addressing_style}),
    )


def _full_key(config: MediaStorageConfig, relative_path: str) -> str:
    normalized = relative_path.lstrip("/").replace("\\", "/")
    if not config.prefix:
        return normalized
    if not normalized:
        return config.prefix
    return f"{config.prefix}/{normalized}"


def _relative_key(config: MediaStorageConfig, key: str) -> str:
    normalized = key.lstrip("/").replace("\\", "/")
    if config.prefix and normalized.startswith(f"{config.prefix}/"):
        return normalized[len(config.prefix) + 1 :]
    return normalized


def list_remote_objects(client, config: MediaStorageConfig) -> list[str]:
    paginator = client.get_paginator("list_objects_v2")
    keys: list[str] = []
    prefix = f"{config.prefix.rstrip('/')}/" if config.prefix else ""
    for page in paginator.paginate(Bucket=config.bucket_name, Prefix=prefix):
        for item in page.get("Contents", []):
            key = str(item.get("Key") or "")
            if key and not key.endswith("/"):
                keys.append(key)
    return sorted(keys)


def export_media_tree(client, config: MediaStorageConfig, destination_root: Path) -> dict[str, int]:
    app_media_root = destination_root / "app" / "media"
    app_media_root.mkdir(parents=True, exist_ok=True)
    object_count = 0
    total_bytes = 0
    for key in list_remote_objects(client, config):
        relative_key = _relative_key(config, key)
        target_path = app_media_root / Path(relative_key)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with target_path.open("wb") as handle:
            client.download_fileobj(config.bucket_name, key, handle)
        object_count += 1
        total_bytes += target_path.stat().st_size
    return {"object_count": object_count, "total_bytes": total_bytes}


def import_media_tree(client, config: MediaStorageConfig, source_root: Path, *, wipe_remote: bool) -> dict[str, int]:
    if wipe_remote:
        for key in list_remote_objects(client, config):
            client.delete_object(Bucket=config.bucket_name, Key=key)

    object_count = 0
    total_bytes = 0
    for file_path in sorted(source_root.rglob("*")):
        if not file_path.is_file():
            continue
        relative_path = file_path.relative_to(source_root).as_posix()
        extra_args = {"CacheControl": "private, no-store"}
        content_type = mimetypes.guess_type(file_path.name)[0]
        if content_type:
            extra_args["ContentType"] = content_type
        with file_path.open("rb") as handle:
            client.upload_fileobj(handle, config.bucket_name, _full_key(config, relative_path), ExtraArgs=extra_args)
        object_count += 1
        total_bytes += file_path.stat().st_size
    return {"object_count": object_count, "total_bytes": total_bytes}


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("mode")

    export_parser = subparsers.add_parser("export")
    export_parser.add_argument("--destination", required=True, help="Directory where app/media tree will be written.")

    import_parser = subparsers.add_parser("import")
    import_parser.add_argument("--source", required=True, help="Path to extracted app/media directory.")
    import_parser.add_argument("--wipe-remote", action="store_true")

    args = parser.parse_args()

    if args.command == "mode":
        config = load_media_storage_config()
        print(config.provider if config else "filesystem")
        return 0

    config = load_media_storage_config(require_remote=True)
    if config is None:
        raise RuntimeError("remote media storage is not configured")
    client = build_s3_client(config)

    if args.command == "export":
        destination = Path(args.destination).resolve()
        if destination.exists():
            shutil.rmtree(destination)
        destination.mkdir(parents=True, exist_ok=True)
        result = export_media_tree(client, config, destination)
    else:
        source = Path(args.source).resolve()
        if not source.is_dir():
            raise RuntimeError(f"source directory not found: {source}")
        result = import_media_tree(client, config, source, wipe_remote=bool(args.wipe_remote))

    print(f"objects={result['object_count']} total_bytes={result['total_bytes']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
