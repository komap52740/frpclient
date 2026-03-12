from __future__ import annotations

import datetime as dt
import importlib.util
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "ops" / "backup" / "offsite_backup.py"
SPEC = importlib.util.spec_from_file_location("offsite_backup_module", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class FakeStorageClient:
    def __init__(self) -> None:
        self.objects: dict[str, dict[str, object]] = {}

    def put_object_file(self, *, key: str, local_path: Path, metadata: dict[str, str], content_type: str) -> None:
        self.objects[key] = {
            "payload": local_path.read_bytes(),
            "metadata": dict(metadata),
            "content_type": content_type,
            "last_modified": dt.datetime.now(dt.timezone.utc),
        }

    def put_object_bytes(self, *, key: str, payload: bytes, metadata: dict[str, str], content_type: str) -> None:
        self.objects[key] = {
            "payload": payload,
            "metadata": dict(metadata),
            "content_type": content_type,
            "last_modified": dt.datetime.now(dt.timezone.utc),
        }

    def head_object(self, *, key: str):
        item = self.objects[key]
        return MODULE.StoredObjectInfo(
            key=key,
            size=len(item["payload"]),
            metadata=dict(item["metadata"]),
            last_modified=item["last_modified"],
        )

    def get_object_bytes(self, *, key: str) -> bytes:
        return bytes(self.objects[key]["payload"])

    def list_objects(self, *, prefix: str):
        objects = []
        for key, item in self.objects.items():
            if not key.startswith(prefix) or key.endswith("latest.json"):
                continue
            objects.append(
                MODULE.StoredObjectInfo(
                    key=key,
                    size=len(item["payload"]),
                    metadata=dict(item["metadata"]),
                    last_modified=item["last_modified"],
                )
            )
        return objects

    def delete_object(self, *, key: str) -> None:
        self.objects.pop(key, None)


def test_load_offsite_config_accepts_enabled_env() -> None:
    config = MODULE.load_offsite_config(
        env={
            "OFFSITE_BACKUP_ENABLED": "1",
            "OFFSITE_BACKUP_PROVIDER": "r2",
            "OFFSITE_BACKUP_BUCKET": "frpclient",
            "OFFSITE_BACKUP_REGION": "auto",
            "OFFSITE_BACKUP_ENDPOINT_URL": "https://r2.example.invalid",
            "OFFSITE_BACKUP_PREFIX": "frpclient/prod",
            "OFFSITE_BACKUP_ACCESS_KEY_ID": "key",
            "OFFSITE_BACKUP_SECRET_ACCESS_KEY": "secret",
        },
        require_enabled=True,
    )

    assert config.enabled is True
    assert config.bucket == "frpclient"
    assert config.prefix == "frpclient/prod"


def test_upload_and_verify_artifact_with_fake_storage() -> None:
    client = FakeStorageClient()
    config = MODULE.OffsiteConfig(
        enabled=True,
        provider="r2",
        bucket="frpclient",
        region="auto",
        endpoint_url="https://r2.example.invalid",
        prefix="frpclient/prod",
        access_key_id="key",
        secret_access_key="secret",
        cli_image="amazon/aws-cli:2.31.1",
    )

    with tempfile.TemporaryDirectory() as temp_dir:
        local_path = Path(temp_dir) / "frpclient-postgres-test.sql.gz"
        local_path.write_bytes(b"backup-bytes-v1")

        manifest = MODULE.upload_artifact(
            client,
            config=config,
            artifact_type="postgres",
            local_path=local_path,
            keep_count=1,
            retention_days=14,
            uploaded_at="2026-03-12T10:00:00Z",
        )

        assert manifest["artifact_type"] == "postgres"
        assert manifest["filename"] == local_path.name
        assert manifest["object_key"].endswith(local_path.name)

        verification = MODULE.verify_latest_artifact(
            client,
            config=config,
            artifact_type="postgres",
            local_path=local_path,
        )

    assert verification["artifact_type"] == "postgres"
    assert verification["size_bytes"] == len(b"backup-bytes-v1")


def test_remote_prune_keeps_latest_archive() -> None:
    client = FakeStorageClient()
    config = MODULE.OffsiteConfig(
        enabled=True,
        provider="r2",
        bucket="frpclient",
        region="auto",
        endpoint_url="https://r2.example.invalid",
        prefix="frpclient/prod",
        access_key_id="key",
        secret_access_key="secret",
        cli_image="amazon/aws-cli:2.31.1",
    )

    old_timestamp = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=30)
    client.objects["frpclient/prod/media/archives/old.tar.gz"] = {
        "payload": b"old",
        "metadata": {"sha256": "old"},
        "content_type": "application/gzip",
        "last_modified": old_timestamp,
    }
    client.objects["frpclient/prod/media/archives/new.tar.gz"] = {
        "payload": b"new",
        "metadata": {"sha256": "new"},
        "content_type": "application/gzip",
        "last_modified": dt.datetime.now(dt.timezone.utc),
    }

    deleted = MODULE.prune_remote_archives(
        client,
        config=config,
        artifact_type="media",
        keep_count=1,
        retention_days=14,
        protect_key="frpclient/prod/media/archives/new.tar.gz",
    )

    assert deleted == ["frpclient/prod/media/archives/old.tar.gz"]
    assert "frpclient/prod/media/archives/new.tar.gz" in client.objects
