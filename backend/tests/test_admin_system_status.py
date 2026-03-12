from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile

from django.conf import settings
from django.test import override_settings
import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_admin_system_status_reports_ops_state():
    admin = User.objects.create_user(
        username="ops-admin",
        password="x",
        role=RoleChoices.ADMIN,
        is_staff=True,
    )
    temp_root = Path(settings.BASE_DIR).parent / ".pytest-tmp"
    temp_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=temp_root) as temp_dir:
        tmp_path = Path(temp_dir)
        lock_dir = tmp_path / ".deploy" / "active.lock"
        lock_dir.mkdir(parents=True)
        (lock_dir / "metadata").write_text(
            "reason=deploy\nlocked_at=2000-01-01T00:00:00Z\n",
            encoding="utf-8",
        )
        maintenance_marker = tmp_path / ".maintenance-mode"
        maintenance_marker.write_text(
            "reason=manual\nenabled_at=2000-01-01T00:00:00Z\n",
            encoding="utf-8",
        )
        status_dir = tmp_path / "status"
        status_dir.mkdir()
        (status_dir / "public_smoke.json").write_text(
            json.dumps(
                {
                    "job": "public_smoke",
                    "status": "success",
                    "summary": "ok",
                    "started_at": "2000-01-01T00:00:00Z",
                    "finished_at": "2000-01-01T00:05:00Z",
                    "updated_at": "2000-01-01T00:05:00Z",
                    "duration_seconds": 300.0,
                }
            ),
            encoding="utf-8",
        )
        (status_dir / "rollback.json").write_text(
            json.dumps(
                {
                    "job": "rollback",
                    "status": "success",
                    "summary": "rollback completed label=20260312T030757Z",
                    "started_at": "2000-01-01T00:00:00Z",
                    "finished_at": "2000-01-01T00:10:00Z",
                    "updated_at": "2000-01-01T00:10:00Z",
                    "duration_seconds": 600.0,
                }
            ),
            encoding="utf-8",
        )
        release_dir = tmp_path / "release"
        release_dir.mkdir()
        (release_dir / "current.json").write_text(
            json.dumps(
                {
                    "action": "deploy",
                    "release_label": "20260312T034500Z",
                    "base_url": "https://frpclient.ru",
                    "with_bot": True,
                    "rollback_snapshot_label": "20260312T033909Z",
                    "restored_snapshot_label": "",
                    "started_at": "2000-01-01T00:00:00Z",
                    "finished_at": "2000-01-01T00:15:00Z",
                    "updated_at": "2000-01-01T00:15:00Z",
                    "duration_seconds": 900.0,
                    "git_commit": "abc1234",
                    "git_branch": "main",
                    "git_tag": "v1.0.0",
                    "source_fingerprint": "feedface0123456789feedface0123456789feedface0123456789feedface",
                    "containers": {
                        "backend": {
                            "container_name": "frp-backend",
                            "image_id_short": "deadbeef1234",
                        },
                        "frontend": {
                            "container_name": "frp-frontend",
                            "image_id_short": "facefeed5678",
                        },
                    },
                }
            ),
            encoding="utf-8",
        )
        release_history_dir = release_dir / "history"
        release_history_dir.mkdir()
        (release_history_dir / "20260312T034500Z-deploy.json").write_text(
            json.dumps(
                {
                    "action": "deploy",
                    "release_label": "20260312T034500Z",
                    "base_url": "https://frpclient.ru",
                    "with_bot": True,
                    "rollback_snapshot_label": "20260312T033909Z",
                    "restored_snapshot_label": "",
                    "started_at": "2000-01-01T00:00:00Z",
                    "finished_at": "2000-01-01T00:15:00Z",
                    "updated_at": "2000-01-01T00:15:00Z",
                    "duration_seconds": 900.0,
                    "git_commit": "abc1234",
                    "git_branch": "main",
                    "git_tag": "v1.0.0",
                    "source_fingerprint": "feedface0123456789feedface0123456789feedface0123456789feedface",
                    "containers": {},
                }
            ),
            encoding="utf-8",
        )
        (release_history_dir / "20260312T035600Z-rollback.json").write_text(
            json.dumps(
                {
                    "action": "rollback",
                    "release_label": "20260312T035600Z",
                    "base_url": "https://frpclient.ru",
                    "with_bot": True,
                    "rollback_snapshot_label": "",
                    "restored_snapshot_label": "20260312T033909Z",
                    "started_at": "2000-01-01T00:20:00Z",
                    "finished_at": "2000-01-01T00:25:00Z",
                    "updated_at": "2000-01-01T00:25:00Z",
                    "duration_seconds": 300.0,
                    "git_commit": "abc1234",
                    "git_branch": "main",
                    "git_tag": "v0.9.9",
                    "source_fingerprint": "c0ffee000123456789abc0ffee000123456789abc0ffee000123456789abcd",
                    "containers": {},
                }
            ),
            encoding="utf-8",
        )
        manifest_dir = tmp_path / "rollback" / "manifests"
        manifest_dir.mkdir(parents=True)
        latest_manifest = manifest_dir / "20260312T030757Z.env"
        latest_manifest.write_text(
            "\n".join(
                [
                    "SNAPSHOT_LABEL=20260312T030757Z",
                    "WITH_BOT=1",
                    "COMPOSE_PROJECT_NAME=frpclient",
                    "SOURCE_GIT_COMMIT=abc1234",
                    "SOURCE_GIT_BRANCH=main",
                    "SOURCE_GIT_TAG=v1.0.0",
                    "SOURCE_FINGERPRINT=feedface0123456789feedface0123456789feedface0123456789feedface",
                    "IMAGE_BACKEND=frpclient_backend:rollback-20260312T030757Z",
                    "IMAGE_BACKEND_WS=frpclient_backend-ws:rollback-20260312T030757Z",
                    "IMAGE_FRONTEND=frpclient_frontend:rollback-20260312T030757Z",
                    "IMAGE_TELEGRAM_BOT=frpclient_telegram-bot:rollback-20260312T030757Z",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        os.utime(latest_manifest, (946684800, 946684800))
        (manifest_dir / "20260311T010203Z.env").write_text(
            "\n".join(
                [
                    "SNAPSHOT_LABEL=20260311T010203Z",
                    "COMPOSE_PROJECT_NAME=frpclient",
                    "IMAGE_BACKEND=frpclient_backend:rollback-20260311T010203Z",
                    "",
                ]
            ),
            encoding="utf-8",
        )

        with override_settings(
            DEPLOY_LOCK_DIR=str(lock_dir),
            MAINTENANCE_MARKER_PATH=str(maintenance_marker),
            JOB_STATUS_DIR=str(status_dir),
            RELEASE_STATE_DIR=str(release_dir),
            ROLLBACK_MANIFEST_DIR=str(manifest_dir),
            OPS_DEPLOY_LOCK_STALE_AFTER_SECONDS=60,
            OPS_MAINTENANCE_STALE_AFTER_SECONDS=60,
            RELEASE_STATE_STALE_AFTER_SECONDS=999999999,
        ):
            response = auth_as(admin).get("/api/admin/system/status/")

    assert response.status_code == 200
    assert response.data["operations"]["deploy_lock"]["active"] is True
    assert response.data["operations"]["deploy_lock"]["reason"] == "deploy"
    assert response.data["operations"]["deploy_lock"]["stale"] is True
    assert response.data["operations"]["deploy_lock"]["locked_at"] == "2000-01-01T00:00:00Z"
    assert response.data["operations"]["maintenance_mode"]["active"] is True
    assert response.data["operations"]["maintenance_mode"]["reason"] == "manual"
    assert response.data["operations"]["maintenance_mode"]["stale"] is True
    assert response.data["operations"]["maintenance_mode"]["enabled_at"] == "2000-01-01T00:00:00Z"
    assert response.data["operations"]["release"]["available"] is True
    assert response.data["operations"]["release"]["healthy"] is True
    assert response.data["operations"]["release"]["action"] == "deploy"
    assert response.data["operations"]["release"]["release_label"] == "20260312T034500Z"
    assert response.data["operations"]["release"]["git_commit"] == "abc1234"
    assert response.data["operations"]["release"]["git_tag"] == "v1.0.0"
    assert response.data["operations"]["release"]["source_fingerprint_short"] == "feedface0123"
    assert response.data["operations"]["release"]["rollback_snapshot_label"] == "20260312T033909Z"
    assert response.data["operations"]["release"]["containers"]["backend"]["container_name"] == "frp-backend"
    assert [entry["action"] for entry in response.data["operations"]["release"]["history"]] == [
        "rollback",
        "deploy",
    ]
    assert response.data["operations"]["release"]["history"][0]["restored_snapshot_label"] == "20260312T033909Z"
    assert response.data["operations"]["release"]["history"][0]["git_tag"] == "v0.9.9"
    assert response.data["operations"]["release"]["history"][0]["source_fingerprint_short"] == "c0ffee000123"
    assert response.data["operations"]["rollback"]["healthy"] is True
    assert response.data["operations"]["rollback"]["available_count"] == 2
    assert response.data["operations"]["rollback"]["invalid_count"] == 1
    assert response.data["operations"]["rollback"]["latest_label"] == "20260312T030757Z"
    assert response.data["operations"]["rollback"]["latest_with_bot"] is True
    assert response.data["operations"]["rollback"]["latest_git_commit"] == "abc1234"
    assert response.data["operations"]["rollback"]["latest_git_branch"] == "main"
    assert response.data["operations"]["rollback"]["latest_git_tag"] == "v1.0.0"
    assert response.data["operations"]["rollback"]["latest_source_fingerprint_short"] == "feedface0123"
    assert response.data["operations"]["rollback"]["latest_source_metadata_available"] is True
    assert response.data["operations"]["rollback"]["latest_created_at"] == "2000-01-01T00:00:00Z"
    assert response.data["operations"]["rollback"]["recent_labels"] == [
        "20260312T030757Z",
        "20260311T010203Z",
    ]
    assert response.data["operations"]["rollback"]["last_run"]["status"] == "success"
    assert response.data["operations"]["rollback"]["last_run"]["summary"] == "rollback completed label=20260312T030757Z"
    assert response.data["operations"]["rollback"]["last_run"]["stale"] is True
    assert response.data["operations"]["jobs"]["public_smoke"]["status"] == "success"
    assert response.data["operations"]["jobs"]["public_smoke"]["stale"] is True
    assert response.data["operations"]["jobs"]["runtime_audit"]["status"] == "missing"


@pytest.mark.django_db
def test_admin_system_status_marks_release_without_source_metadata_unhealthy():
    admin = User.objects.create_user(
        username="ops-admin-source-gap",
        password="x",
        role=RoleChoices.ADMIN,
        is_staff=True,
    )
    temp_root = Path(settings.BASE_DIR).parent / ".pytest-tmp"
    temp_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=temp_root) as temp_dir:
        tmp_path = Path(temp_dir)
        release_dir = tmp_path / "release"
        release_dir.mkdir()
        (release_dir / "current.json").write_text(
            json.dumps(
                {
                    "action": "deploy",
                    "release_label": "20260312T050000Z",
                    "base_url": "https://frpclient.ru",
                    "with_bot": True,
                    "started_at": "2000-01-01T00:00:00Z",
                    "finished_at": "2000-01-01T00:15:00Z",
                    "updated_at": "2000-01-01T00:15:00Z",
                    "duration_seconds": 900.0,
                    "containers": {},
                }
            ),
            encoding="utf-8",
        )
        status_dir = tmp_path / "status"
        status_dir.mkdir()
        rollback_dir = tmp_path / "rollback" / "manifests"
        rollback_dir.mkdir(parents=True)
        with override_settings(
            JOB_STATUS_DIR=str(status_dir),
            RELEASE_STATE_DIR=str(release_dir),
            ROLLBACK_MANIFEST_DIR=str(rollback_dir),
            RELEASE_STATE_STALE_AFTER_SECONDS=999999999,
        ):
            response = auth_as(admin).get("/api/admin/system/status/")

    assert response.status_code == 200
    assert response.data["operations"]["release"]["available"] is True
    assert response.data["operations"]["release"]["healthy"] is False
    assert response.data["operations"]["release"]["source_metadata_available"] is False
    assert response.data["operations"]["release"]["error"] == "release state missing source metadata"
