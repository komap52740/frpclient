#!/usr/bin/env python3
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


REPO_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_DIR / "backend"
RUNTIME_DIR = Path(os.getenv("PLAYWRIGHT_RUNTIME_DIR", REPO_DIR / ".playwright-runtime"))


def build_env() -> dict[str, str]:
    db_path = RUNTIME_DIR / "db.sqlite3"
    media_root = RUNTIME_DIR / "media"
    static_root = RUNTIME_DIR / "staticfiles"
    frontend_url = os.getenv("PLAYWRIGHT_FRONTEND_URL", "http://127.0.0.1:4173")

    env = os.environ.copy()
    env.update(
        {
            "PYTHONUNBUFFERED": "1",
            "DB_ENGINE": "sqlite",
            "SQLITE_PATH": str(db_path),
            "MEDIA_ROOT": str(media_root),
            "STATIC_ROOT": str(static_root),
            "DEBUG": "1",
            "SECRET_KEY": "playwright-dev-secret-key-1234567890",
            "ALLOWED_HOSTS": "127.0.0.1,localhost",
            "ADMIN_ALLOWED_HOSTS": "127.0.0.1,localhost,admin.localhost",
            "CSRF_TRUSTED_ORIGINS": f"{frontend_url},http://localhost:4173",
            "CORS_ALLOWED_ORIGINS": f"{frontend_url},http://localhost:4173",
            "OAUTH_FRONTEND_URL": frontend_url,
            "PASSWORD_RESET_URL": f"{frontend_url}/login",
            "RUSTDESK_ENCRYPTION_KEYS": "playwright-rustdesk-key",
            "EMAIL_BACKEND": "django.core.mail.backends.locmem.EmailBackend",
            "REDIS_URL": "",
        }
    )
    return env


def run_command(command: list[str], *, env: dict[str, str]) -> None:
    subprocess.run(command, cwd=BACKEND_DIR, env=env, check=True)


def main() -> int:
    host = os.getenv("PLAYWRIGHT_BACKEND_HOST", "127.0.0.1")
    port = os.getenv("PLAYWRIGHT_BACKEND_PORT", "8000")
    username = os.getenv("PLAYWRIGHT_SMOKE_USERNAME", "playwright_b2b_client")
    password = os.getenv("PLAYWRIGHT_SMOKE_PASSWORD", "PlaywrightPass123!")
    email = os.getenv("PLAYWRIGHT_SMOKE_EMAIL", "playwright-b2b@example.invalid")
    admin_username = os.getenv("PLAYWRIGHT_ADMIN_USERNAME", "playwright_admin")
    admin_password = os.getenv("PLAYWRIGHT_ADMIN_PASSWORD", "PlaywrightAdmin123!")
    admin_email = os.getenv("PLAYWRIGHT_ADMIN_EMAIL", "playwright-admin@example.invalid")
    keep_runtime = os.getenv("PLAYWRIGHT_KEEP_RUNTIME", "").strip().lower() in {"1", "true", "yes", "on"}
    env = build_env()

    if not keep_runtime and RUNTIME_DIR.exists():
        shutil.rmtree(RUNTIME_DIR)
    (RUNTIME_DIR / "media").mkdir(parents=True, exist_ok=True)
    (RUNTIME_DIR / "staticfiles").mkdir(parents=True, exist_ok=True)

    run_command([sys.executable, "manage.py", "migrate", "--noinput"], env=env)
    run_command(
        [
            sys.executable,
            "manage.py",
            "seed_playwright_smoke",
            "--username",
            username,
            "--password",
            password,
            "--email",
            email,
            "--admin-username",
            admin_username,
            "--admin-password",
            admin_password,
            "--admin-email",
            admin_email,
            "--reset-appointments",
        ],
        env=env,
    )

    os.chdir(BACKEND_DIR)
    os.execve(
        sys.executable,
        [
            sys.executable,
            "-m",
            "daphne",
            "-b",
            host,
            "-p",
            port,
            "config.asgi:application",
        ],
        env,
    )


if __name__ == "__main__":
    raise SystemExit(main())
