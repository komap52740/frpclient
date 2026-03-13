from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ops.common.env_chain import load_env_chain, parse_env_file


DEFAULT_SECRET_KEYS = {"", "change-me", "change-me-super-secret-key-32-chars"}
VK_ID_AUTHORIZE_URL = "https://id.vk.com/authorize"
VK_ID_TOKEN_URL = "https://id.vk.com/oauth2/auth"
VK_ID_USERINFO_URL = "https://id.vk.com/oauth2/user_info"
SENSITIVE_BACKEND_KEYS = {
    "SECRET_KEY",
    "POSTGRES_PASSWORD",
    "TELEGRAM_BOT_TOKEN",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "YANDEX_OAUTH_CLIENT_SECRET",
    "VK_OAUTH_CLIENT_SECRET",
    "EMAIL_HOST_PASSWORD",
    "SENTRY_DSN",
    "RUSTDESK_ENCRYPTION_KEYS",
    "MEDIA_STORAGE_ACCESS_KEY_ID",
    "MEDIA_STORAGE_SECRET_ACCESS_KEY",
    "OFFSITE_BACKUP_ACCESS_KEY_ID",
    "OFFSITE_BACKUP_SECRET_ACCESS_KEY",
}
SENSITIVE_FRONTEND_KEYS = {
    "VITE_SENTRY_DSN",
}


def normalize_origin(value: str) -> str:
    value = value.strip().rstrip("/")
    return value


def normalize_host(value: str) -> str:
    candidate = value.strip()
    if not candidate:
        return ""
    if candidate == "*":
        return candidate
    if "://" in candidate:
        parsed = urlparse(candidate)
        return parsed.hostname or ""
    if "/" in candidate:
        candidate = candidate.split("/", 1)[0].strip()
    if ":" in candidate and candidate.count(":") == 1:
        candidate = candidate.split(":", 1)[0].strip()
    return candidate


def admin_origin_from_env(admin_host: str) -> str:
    host = normalize_host(admin_host)
    if not host:
        return ""
    if host in {"127.0.0.1", "localhost"}:
        return f"http://{host}"
    return f"https://{host}"


def split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def is_path_outside_repo(path: Path, repo_root: Path) -> bool:
    try:
        path.resolve().relative_to(repo_root.resolve())
        return False
    except ValueError:
        return True


class Preflight:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.ok_messages: list[str] = []

    def ok(self, message: str) -> None:
        self.ok_messages.append(message)

    def require(self, condition: bool, message: str) -> None:
        if condition:
            self.ok(message)
        else:
            self.errors.append(message)

    def warn(self, condition: bool, message: str) -> None:
        if not condition:
            self.warnings.append(message)


def validate_provider(preflight: Preflight, *, name: str, env: dict[str, str], base_url: str, callback_path: str) -> None:
    client_id = env.get(f"{name}_OAUTH_CLIENT_ID", "").strip()
    client_secret = env.get(f"{name}_OAUTH_CLIENT_SECRET", "").strip()
    redirect_uri = env.get(f"{name}_OAUTH_REDIRECT_URI", "").strip()
    configured = any((client_id, client_secret, redirect_uri))

    if not configured:
        return

    preflight.require(bool(client_id), f"{name}: client id is configured")
    preflight.require(bool(client_secret), f"{name}: client secret is configured")
    preflight.require(redirect_uri == f"{base_url}{callback_path}", f"{name}: redirect URI matches {callback_path}")


def require_external_secret_file(preflight: Preflight, *, repo_root: Path, path_value: str, label: str) -> Path | None:
    candidate = Path(path_value).expanduser() if path_value else None
    preflight.require(bool(path_value), f"{label} is configured")
    if not candidate:
        return None
    preflight.require(candidate.is_file(), f"{label} exists")
    preflight.require(is_path_outside_repo(candidate, repo_root), f"{label} lives outside repo")
    return candidate


def ensure_secret_free_file(preflight: Preflight, *, label: str, env_data: dict[str, str], secret_keys: set[str]) -> None:
    leaked_keys = sorted(key for key in secret_keys if env_data.get(key, "").strip())
    preflight.require(not leaked_keys, f"{label} does not contain rotated secrets")


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate production env before deploying FRP Client.")
    parser.add_argument("--base-url", default="", help="Expected public base URL, for example https://frpclient.ru")
    parser.add_argument("--root-env", default=".env", help="Path to project root .env file")
    parser.add_argument("--backend-env", default="", help="Path to backend .env file")
    args = parser.parse_args()

    preflight = Preflight()

    root_env_path = Path(args.root_env)
    root_env = parse_env_file(root_env_path)

    backend_env_path = Path(
        args.backend_env
        or root_env.get("BACKEND_ENV_FILE", "").strip()
        or os.getenv("BACKEND_ENV_FILE", "").strip()
        or "backend/.env"
    )
    backend_base_env = parse_env_file(backend_env_path)

    backend_secrets_path_value = (
        root_env.get("BACKEND_SECRETS_FILE", "").strip()
        or os.getenv("BACKEND_SECRETS_FILE", "").strip()
    )
    frontend_secrets_path_value = (
        root_env.get("FRONTEND_BUILD_SECRETS_FILE", "").strip()
        or os.getenv("FRONTEND_BUILD_SECRETS_FILE", "").strip()
    )

    backend_secrets_path = require_external_secret_file(
        preflight,
        repo_root=REPO_ROOT,
        path_value=backend_secrets_path_value,
        label="BACKEND_SECRETS_FILE",
    )
    frontend_secrets_path = require_external_secret_file(
        preflight,
        repo_root=REPO_ROOT,
        path_value=frontend_secrets_path_value,
        label="FRONTEND_BUILD_SECRETS_FILE",
    )

    if preflight.errors:
        for message in preflight.errors:
            print(f"[error] {message}")
        return 1

    backend_env = load_env_chain([backend_env_path, backend_secrets_path])
    root_env = load_env_chain([root_env_path, frontend_secrets_path], allow_missing=False)

    ensure_secret_free_file(preflight, label="backend base env file", env_data=backend_base_env, secret_keys=SENSITIVE_BACKEND_KEYS)
    ensure_secret_free_file(preflight, label="root env file", env_data=parse_env_file(root_env_path), secret_keys=SENSITIVE_FRONTEND_KEYS)

    base_url = normalize_origin(args.base_url or root_env.get("VITE_SITE_URL", "") or backend_env.get("OAUTH_FRONTEND_URL", ""))
    parsed_base = urlparse(base_url)
    domain = parsed_base.hostname or ""

    preflight.require(bool(base_url), "base URL is defined")
    preflight.require(parsed_base.scheme == "https", "base URL uses https")
    preflight.require(bool(domain), "base URL host is valid")

    if preflight.errors:
        for message in preflight.errors:
            print(f"[error] {message}")
        return 1

    allowed_hosts = {normalize_host(item) for item in split_csv(backend_env.get("ALLOWED_HOSTS", ""))}
    cors_origins = {normalize_origin(item) for item in split_csv(backend_env.get("CORS_ALLOWED_ORIGINS", ""))}
    csrf_origins = {normalize_origin(item) for item in split_csv(backend_env.get("CSRF_TRUSTED_ORIGINS", ""))}
    admin_origin = admin_origin_from_env(backend_env.get("ADMIN_HOST", ""))
    effective_csrf_origins = set(csrf_origins)
    if admin_origin:
        effective_csrf_origins.add(admin_origin)

    preflight.require(backend_env.get("DEBUG") == "0", "DEBUG=0 in backend env")
    secret_key = backend_env.get("SECRET_KEY", "")
    preflight.require(secret_key not in DEFAULT_SECRET_KEYS and len(secret_key) >= 32, "SECRET_KEY is non-default and at least 32 chars")
    preflight.require("*" not in allowed_hosts, "ALLOWED_HOSTS does not contain wildcard")
    preflight.require(domain in allowed_hosts, f"ALLOWED_HOSTS contains {domain}")
    preflight.require(base_url in cors_origins, f"CORS_ALLOWED_ORIGINS contains {base_url}")
    preflight.require(base_url in effective_csrf_origins, f"CSRF_TRUSTED_ORIGINS contains {base_url}")
    if admin_origin:
        preflight.require(
            admin_origin in effective_csrf_origins,
            f"effective CSRF trusted origins contain admin host {admin_origin}",
        )
    preflight.require(bool(backend_env.get("REDIS_URL", "").strip()), "REDIS_URL is configured")
    preflight.require(normalize_origin(backend_env.get("OAUTH_FRONTEND_URL", "")) == base_url, "OAUTH_FRONTEND_URL matches base URL")
    media_storage_provider = (backend_env.get("MEDIA_STORAGE_PROVIDER", "filesystem") or "filesystem").strip().lower()
    if media_storage_provider in {"r2", "s3"}:
        preflight.require(bool(backend_env.get("MEDIA_STORAGE_BUCKET_NAME", "").strip()), "MEDIA_STORAGE_BUCKET_NAME is configured")
        if media_storage_provider != "s3":
            preflight.require(bool(backend_env.get("MEDIA_STORAGE_ENDPOINT_URL", "").strip()), "MEDIA_STORAGE_ENDPOINT_URL is configured")
        preflight.require(bool(backend_env.get("MEDIA_STORAGE_PREFIX", "").strip()), "MEDIA_STORAGE_PREFIX is configured")
        preflight.require(bool(backend_env.get("MEDIA_STORAGE_ACCESS_KEY_ID", "").strip()), "MEDIA_STORAGE_ACCESS_KEY_ID is configured")
        preflight.require(bool(backend_env.get("MEDIA_STORAGE_SECRET_ACCESS_KEY", "").strip()), "MEDIA_STORAGE_SECRET_ACCESS_KEY is configured")

    site_url = normalize_origin(root_env.get("VITE_SITE_URL", ""))
    frontend_bind = root_env.get("FRONTEND_PORT_BIND", "").strip()
    preflight.require(site_url == base_url, "VITE_SITE_URL matches base URL")
    preflight.require(frontend_bind.startswith("127.0.0.1:") and frontend_bind.endswith(":80"), "FRONTEND_PORT_BIND stays loopback-only on port 80 in container")

    backend_tg = backend_env.get("TELEGRAM_LOGIN_BOT_USERNAME", "").strip()
    frontend_tg = root_env.get("VITE_TELEGRAM_BOT_USERNAME", "").strip()
    if backend_tg or frontend_tg:
        preflight.require(backend_tg == frontend_tg, "Telegram bot username matches between backend and frontend env")

    tg_frontend_url = normalize_origin(backend_env.get("TELEGRAM_CLIENT_BOT_FRONTEND_URL", ""))
    if tg_frontend_url:
        preflight.require(tg_frontend_url == base_url, "TELEGRAM_CLIENT_BOT_FRONTEND_URL matches base URL")

    email_verification_url = backend_env.get("EMAIL_VERIFICATION_URL", "").strip()
    if email_verification_url:
        preflight.require(
            email_verification_url == f"{base_url}/api/auth/verify-email/",
            "EMAIL_VERIFICATION_URL matches public verify-email callback",
        )

    validate_provider(preflight, name="GOOGLE", env=backend_env, base_url=base_url, callback_path="/api/auth/oauth/google/callback/")
    validate_provider(preflight, name="YANDEX", env=backend_env, base_url=base_url, callback_path="/api/auth/oauth/yandex/callback/")
    validate_provider(preflight, name="VK", env=backend_env, base_url=base_url, callback_path="/api/auth/oauth/vk/callback/")
    validate_provider(preflight, name="MAX", env=backend_env, base_url=base_url, callback_path="/api/auth/oauth/max/callback/")

    if any(
        (
            backend_env.get("VK_OAUTH_CLIENT_ID", "").strip(),
            backend_env.get("VK_OAUTH_CLIENT_SECRET", "").strip(),
            backend_env.get("VK_OAUTH_REDIRECT_URI", "").strip(),
        )
    ):
        preflight.require(backend_env.get("VK_OAUTH_AUTHORIZE_URL", "").strip() == VK_ID_AUTHORIZE_URL, "VK uses id.vk.com authorize URL")
        preflight.require(backend_env.get("VK_OAUTH_TOKEN_URL", "").strip() == VK_ID_TOKEN_URL, "VK uses id.vk.com token URL")
        preflight.require(backend_env.get("VK_OAUTH_USERINFO_URL", "").strip() == VK_ID_USERINFO_URL, "VK uses id.vk.com user info URL")

    secure_hsts_seconds = backend_env.get("SECURE_HSTS_SECONDS", "").strip()
    if secure_hsts_seconds:
        preflight.warn(secure_hsts_seconds.isdigit() and int(secure_hsts_seconds) > 0, "SECURE_HSTS_SECONDS is positive")
    else:
        preflight.warnings.append("SECURE_HSTS_SECONDS is not explicitly set; Django default will be used")

    if backend_env.get("OFFSITE_BACKUP_ENABLED", "").strip() in {"1", "true", "yes", "on"}:
        offsite_provider = (backend_env.get("OFFSITE_BACKUP_PROVIDER", "r2") or "r2").strip().lower()
        preflight.require(bool(backend_env.get("OFFSITE_BACKUP_BUCKET", "").strip()), "OFFSITE_BACKUP_BUCKET is configured")
        if offsite_provider != "s3":
            preflight.require(bool(backend_env.get("OFFSITE_BACKUP_ENDPOINT_URL", "").strip()), "OFFSITE_BACKUP_ENDPOINT_URL is configured")
        preflight.require(bool(backend_env.get("OFFSITE_BACKUP_PREFIX", "").strip()), "OFFSITE_BACKUP_PREFIX is configured")
        preflight.require(bool(backend_env.get("OFFSITE_BACKUP_ACCESS_KEY_ID", "").strip()), "OFFSITE_BACKUP_ACCESS_KEY_ID is configured")
        preflight.require(bool(backend_env.get("OFFSITE_BACKUP_SECRET_ACCESS_KEY", "").strip()), "OFFSITE_BACKUP_SECRET_ACCESS_KEY is configured")

    for message in preflight.ok_messages:
        print(f"[ok] {message}")
    for message in preflight.warnings:
        print(f"[warn] {message}")
    for message in preflight.errors:
        print(f"[error] {message}")

    if preflight.errors:
        print(f"Preflight failed with {len(preflight.errors)} error(s).")
        return 1

    if preflight.warnings:
        print(f"Preflight passed with {len(preflight.warnings)} warning(s).")
    else:
        print("Preflight passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
