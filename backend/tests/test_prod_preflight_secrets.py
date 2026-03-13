from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
PREFLIGHT_SCRIPT = REPO_ROOT / "scripts" / "prod_preflight.py"


def _run_preflight(root_env: Path, backend_env: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(PREFLIGHT_SCRIPT),
            "--base-url",
            "https://frpclient.ru",
            "--root-env",
            str(root_env),
            "--backend-env",
            str(backend_env),
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )


def _write_root_env(path: Path, *, backend_env: Path, backend_secrets: Path, frontend_secrets: Path) -> None:
    path.write_text(
        "\n".join(
            [
                "VITE_TELEGRAM_BOT_USERNAME=ClientFRP_bot",
                "VITE_BRAND_SUPPORT_TG=@frpnnow",
                "FRONTEND_PORT_BIND=127.0.0.1:8080:80",
                "VITE_SITE_URL=https://frpclient.ru",
                f"BACKEND_ENV_FILE={backend_env}",
                f"BACKEND_SECRETS_FILE={backend_secrets}",
                f"FRONTEND_BUILD_SECRETS_FILE={frontend_secrets}",
                "",
            ]
        ),
        encoding="utf-8",
    )


def _write_backend_base_env(path: Path, *, leaked_secret_key: str = "") -> None:
    path.write_text(
        "\n".join(
            [
                f"SECRET_KEY={leaked_secret_key}",
                "DEBUG=0",
                "ALLOWED_HOSTS=frpclient.ru,127.0.0.1,localhost",
                "ADMIN_HOST=admin.frpclient.ru",
                "POSTGRES_DB=frpclient",
                "POSTGRES_USER=frpuser",
                "POSTGRES_PASSWORD=",
                "CORS_ALLOWED_ORIGINS=https://frpclient.ru",
                "CSRF_TRUSTED_ORIGINS=https://frpclient.ru",
                "TELEGRAM_LOGIN_BOT_USERNAME=ClientFRP_bot",
                "TELEGRAM_CLIENT_BOT_FRONTEND_URL=https://frpclient.ru",
                "OAUTH_FRONTEND_URL=https://frpclient.ru",
                "GOOGLE_OAUTH_CLIENT_ID=test-google-id",
                "GOOGLE_OAUTH_CLIENT_SECRET=",
                "GOOGLE_OAUTH_REDIRECT_URI=https://frpclient.ru/api/auth/oauth/google/callback/",
                "YANDEX_OAUTH_CLIENT_ID=",
                "YANDEX_OAUTH_CLIENT_SECRET=",
                "YANDEX_OAUTH_REDIRECT_URI=",
                "VK_OAUTH_CLIENT_ID=",
                "VK_OAUTH_CLIENT_SECRET=",
                "VK_OAUTH_REDIRECT_URI=",
                "REDIS_URL=redis://redis:6379/1",
                "RUSTDESK_ENCRYPTION_KEYS=",
                "MEDIA_STORAGE_PROVIDER=filesystem",
                "MEDIA_STORAGE_BUCKET_NAME=",
                "MEDIA_STORAGE_REGION_NAME=auto",
                "MEDIA_STORAGE_ENDPOINT_URL=",
                "MEDIA_STORAGE_PREFIX=media",
                "MEDIA_STORAGE_SIGNATURE_VERSION=s3v4",
                "MEDIA_STORAGE_ADDRESSING_STYLE=virtual",
                "MEDIA_STORAGE_QUERYSTRING_EXPIRE=1800",
                "OFFSITE_BACKUP_ENABLED=0",
                "OFFSITE_BACKUP_PROVIDER=r2",
                "OFFSITE_BACKUP_BUCKET=",
                "OFFSITE_BACKUP_REGION=auto",
                "OFFSITE_BACKUP_ENDPOINT_URL=",
                "OFFSITE_BACKUP_PREFIX=frpclient/prod",
                "SECURE_HSTS_SECONDS=31536000",
                "PASSWORD_RESET_URL=https://frpclient.ru/login",
                "",
            ]
        ),
        encoding="utf-8",
    )


def _write_backend_secrets(path: Path) -> None:
    path.write_text(
        "\n".join(
            [
                "SECRET_KEY=test-secret-key-not-default-1234567890",
                "POSTGRES_PASSWORD=test-postgres-password",
                "GOOGLE_OAUTH_CLIENT_SECRET=test-google-secret",
                "RUSTDESK_ENCRYPTION_KEYS=test-rustdesk-key",
                "MEDIA_STORAGE_ACCESS_KEY_ID=",
                "MEDIA_STORAGE_SECRET_ACCESS_KEY=",
                "OFFSITE_BACKUP_ACCESS_KEY_ID=",
                "OFFSITE_BACKUP_SECRET_ACCESS_KEY=",
                "SENTRY_DSN=",
                "",
            ]
        ),
        encoding="utf-8",
    )


def _write_frontend_secrets(path: Path) -> None:
    path.write_text(
        "\n".join(
            [
                "VITE_SENTRY_DSN=",
                "VITE_SENTRY_ENVIRONMENT=production",
                "VITE_SENTRY_RELEASE=",
                "VITE_SENTRY_TRACES_SAMPLE_RATE=0",
                "",
            ]
        ),
        encoding="utf-8",
    )


def test_prod_preflight_accepts_external_secret_files() -> None:
    temp_root = REPO_ROOT.parent / ".pytest-secret-preflight"
    temp_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=temp_root) as temp_dir:
        tmp = Path(temp_dir)
        root_env = tmp / ".env"
        backend_env = tmp / "backend.env"
        backend_secrets = tmp / "backend.secrets.env"
        frontend_secrets = tmp / "frontend.build.secrets.env"

        _write_root_env(root_env, backend_env=backend_env, backend_secrets=backend_secrets, frontend_secrets=frontend_secrets)
        _write_backend_base_env(backend_env)
        _write_backend_secrets(backend_secrets)
        _write_frontend_secrets(frontend_secrets)

        result = _run_preflight(root_env, backend_env)

    assert result.returncode == 0, result.stderr
    assert "Preflight passed." in result.stdout


def test_prod_preflight_rejects_secret_in_base_backend_env() -> None:
    temp_root = REPO_ROOT.parent / ".pytest-secret-preflight"
    temp_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=temp_root) as temp_dir:
        tmp = Path(temp_dir)
        root_env = tmp / ".env"
        backend_env = tmp / "backend.env"
        backend_secrets = tmp / "backend.secrets.env"
        frontend_secrets = tmp / "frontend.build.secrets.env"

        _write_root_env(root_env, backend_env=backend_env, backend_secrets=backend_secrets, frontend_secrets=frontend_secrets)
        _write_backend_base_env(backend_env, leaked_secret_key="leaked-secret-value")
        _write_backend_secrets(backend_secrets)
        _write_frontend_secrets(frontend_secrets)

        result = _run_preflight(root_env, backend_env)

    assert result.returncode != 0
    assert "backend base env file does not contain rotated secrets" in result.stdout


def test_prod_preflight_requires_offsite_credentials_when_enabled() -> None:
    temp_root = REPO_ROOT.parent / ".pytest-secret-preflight"
    temp_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=temp_root) as temp_dir:
        tmp = Path(temp_dir)
        root_env = tmp / ".env"
        backend_env = tmp / "backend.env"
        backend_secrets = tmp / "backend.secrets.env"
        frontend_secrets = tmp / "frontend.build.secrets.env"

        _write_root_env(root_env, backend_env=backend_env, backend_secrets=backend_secrets, frontend_secrets=frontend_secrets)
        _write_backend_base_env(backend_env)
        backend_env.write_text(backend_env.read_text(encoding="utf-8").replace("OFFSITE_BACKUP_ENABLED=0", "OFFSITE_BACKUP_ENABLED=1"), encoding="utf-8")
        _write_backend_secrets(backend_secrets)
        _write_frontend_secrets(frontend_secrets)

        result = _run_preflight(root_env, backend_env)

    assert result.returncode != 0
    assert "OFFSITE_BACKUP_ENDPOINT_URL is configured" in result.stdout


def test_prod_preflight_requires_media_storage_credentials_when_remote_media_enabled() -> None:
    temp_root = REPO_ROOT.parent / ".pytest-secret-preflight"
    temp_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=temp_root) as temp_dir:
        tmp = Path(temp_dir)
        root_env = tmp / ".env"
        backend_env = tmp / "backend.env"
        backend_secrets = tmp / "backend.secrets.env"
        frontend_secrets = tmp / "frontend.build.secrets.env"

        _write_root_env(root_env, backend_env=backend_env, backend_secrets=backend_secrets, frontend_secrets=frontend_secrets)
        _write_backend_base_env(backend_env)
        backend_env.write_text(
            backend_env.read_text(encoding="utf-8").replace(
                "MEDIA_STORAGE_PROVIDER=filesystem",
                "MEDIA_STORAGE_PROVIDER=r2",
            ).replace(
                "MEDIA_STORAGE_BUCKET_NAME=",
                "MEDIA_STORAGE_BUCKET_NAME=frpclient-media",
            ).replace(
                "MEDIA_STORAGE_ENDPOINT_URL=",
                "MEDIA_STORAGE_ENDPOINT_URL=https://r2.example.invalid",
            ).replace(
                "MEDIA_STORAGE_PREFIX=media",
                "MEDIA_STORAGE_PREFIX=prod/media",
            ),
            encoding="utf-8",
        )
        _write_backend_secrets(backend_secrets)
        _write_frontend_secrets(frontend_secrets)

        result = _run_preflight(root_env, backend_env)

    assert result.returncode != 0
    assert "MEDIA_STORAGE_ACCESS_KEY_ID is configured" in result.stdout
