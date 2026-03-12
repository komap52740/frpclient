from __future__ import annotations

import importlib.util
import sys
import tempfile
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "ops" / "backup" / "media_object_storage.py"
SPEC = importlib.util.spec_from_file_location("media_object_storage_module", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class FakePaginator:
    def __init__(self, client) -> None:
        self.client = client

    def paginate(self, *, Bucket: str, Prefix: str):
        contents = [{"Key": key} for key in sorted(self.client.objects) if key.startswith(Prefix)]
        yield {"Contents": contents}


class FakeS3Client:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def get_paginator(self, name: str):
        assert name == "list_objects_v2"
        return FakePaginator(self)

    def download_fileobj(self, bucket: str, key: str, handle) -> None:
        handle.write(self.objects[key])

    def upload_fileobj(self, handle, bucket: str, key: str, ExtraArgs=None) -> None:
        self.objects[key] = handle.read()

    def delete_object(self, *, Bucket: str, Key: str) -> None:
        self.objects.pop(Key, None)


def test_load_media_storage_config_accepts_r2_env() -> None:
    config = MODULE.load_media_storage_config(
        env={
            "MEDIA_STORAGE_PROVIDER": "r2",
            "MEDIA_STORAGE_BUCKET_NAME": "frpclient-media",
            "MEDIA_STORAGE_REGION_NAME": "auto",
            "MEDIA_STORAGE_ENDPOINT_URL": "https://r2.example.invalid",
            "MEDIA_STORAGE_PREFIX": "prod/media",
            "MEDIA_STORAGE_ACCESS_KEY_ID": "key",
            "MEDIA_STORAGE_SECRET_ACCESS_KEY": "secret",
        },
        require_remote=True,
    )

    assert config is not None
    assert config.provider == "r2"
    assert config.bucket_name == "frpclient-media"
    assert config.prefix == "prod/media"


def test_build_s3_client_reports_missing_boto3_cleanly(monkeypatch: pytest.MonkeyPatch) -> None:
    config = MODULE.MediaStorageConfig(
        provider="r2",
        bucket_name="frpclient-media",
        region_name="auto",
        endpoint_url="https://r2.example.invalid",
        prefix="prod/media",
        access_key_id="key",
        secret_access_key="secret",
        signature_version="s3v4",
        addressing_style="virtual",
    )

    def fake_import_module(name: str):
        if name == "boto3":
            raise ModuleNotFoundError("No module named 'boto3'")
        raise AssertionError(f"unexpected import: {name}")

    monkeypatch.setattr(MODULE.importlib, "import_module", fake_import_module)

    with pytest.raises(RuntimeError, match="boto3 is required for remote media storage operations"):
        MODULE.build_s3_client(config)


def test_export_media_tree_downloads_remote_files_into_app_media() -> None:
    client = FakeS3Client()
    client.objects["prod/media/messages/file.txt"] = b"hello"
    client.objects["prod/media/profile/avatar.jpg"] = b"image"
    config = MODULE.MediaStorageConfig(
        provider="r2",
        bucket_name="frpclient-media",
        region_name="auto",
        endpoint_url="https://r2.example.invalid",
        prefix="prod/media",
        access_key_id="key",
        secret_access_key="secret",
        signature_version="s3v4",
        addressing_style="virtual",
    )

    with tempfile.TemporaryDirectory() as temp_dir:
        result = MODULE.export_media_tree(client, config, Path(temp_dir))
        media_root = Path(temp_dir) / "app" / "media"

        assert (media_root / "messages" / "file.txt").read_bytes() == b"hello"
        assert (media_root / "profile" / "avatar.jpg").read_bytes() == b"image"
        assert result == {"object_count": 2, "total_bytes": 10}


def test_import_media_tree_replaces_remote_prefix_when_requested() -> None:
    client = FakeS3Client()
    client.objects["prod/media/old.txt"] = b"old"
    config = MODULE.MediaStorageConfig(
        provider="r2",
        bucket_name="frpclient-media",
        region_name="auto",
        endpoint_url="https://r2.example.invalid",
        prefix="prod/media",
        access_key_id="key",
        secret_access_key="secret",
        signature_version="s3v4",
        addressing_style="virtual",
    )

    with tempfile.TemporaryDirectory() as temp_dir:
        source_root = Path(temp_dir) / "app" / "media"
        source_root.mkdir(parents=True, exist_ok=True)
        (source_root / "messages").mkdir(parents=True, exist_ok=True)
        (source_root / "messages" / "new.txt").write_bytes(b"new")

        result = MODULE.import_media_tree(client, config, source_root, wipe_remote=True)

    assert result == {"object_count": 1, "total_bytes": 3}
    assert client.objects == {"prod/media/messages/new.txt": b"new"}
