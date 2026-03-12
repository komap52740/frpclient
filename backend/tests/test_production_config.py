from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _import_settings_with_env(**overrides: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.update(
        {
            "PYTHONPATH": str(BACKEND_ROOT),
            "DB_ENGINE": "sqlite",
            **overrides,
        }
    )
    return subprocess.run(
        [sys.executable, "-c", "import config.settings"],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )


def test_production_settings_require_non_default_secret_key() -> None:
    result = _import_settings_with_env(
        DEBUG="0",
        SECRET_KEY="change-me-super-secret-key-32-chars",
        ALLOWED_HOSTS="frpclient.ru",
        REDIS_URL="redis://redis:6379/1",
    )

    assert result.returncode != 0
    assert "SECRET_KEY must be set to a non-default value when DEBUG=0" in result.stderr


def test_production_settings_require_restricted_allowed_hosts() -> None:
    result = _import_settings_with_env(
        DEBUG="0",
        SECRET_KEY="test-secret-key-not-default",
        ALLOWED_HOSTS="*",
        REDIS_URL="redis://redis:6379/1",
    )

    assert result.returncode != 0
    assert "ALLOWED_HOSTS must not contain '*'" in result.stderr


def test_production_settings_require_redis_url() -> None:
    result = _import_settings_with_env(
        DEBUG="0",
        SECRET_KEY="test-secret-key-not-default",
        ALLOWED_HOSTS="frpclient.ru,127.0.0.1,localhost",
    )

    assert result.returncode != 0
    assert "REDIS_URL must be set when DEBUG=0" in result.stderr


def test_production_settings_require_rustdesk_encryption_keys() -> None:
    result = _import_settings_with_env(
        DEBUG="0",
        SECRET_KEY="test-secret-key-not-default",
        ALLOWED_HOSTS="frpclient.ru,127.0.0.1,localhost",
        REDIS_URL="redis://redis:6379/1",
    )

    assert result.returncode != 0
    assert "RUSTDESK_ENCRYPTION_KEYS must be set when DEBUG=0" in result.stderr


def test_production_settings_accept_valid_values() -> None:
    result = _import_settings_with_env(
        DEBUG="0",
        SECRET_KEY="test-secret-key-not-default",
        ALLOWED_HOSTS="frpclient.ru,127.0.0.1,localhost",
        REDIS_URL="redis://redis:6379/1",
        RUSTDESK_ENCRYPTION_KEYS="test-rustdesk-key",
    )

    assert result.returncode == 0, result.stderr
