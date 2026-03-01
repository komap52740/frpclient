import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("SECRET_KEY", "change-me")
DEBUG = os.getenv("DEBUG", "1") == "1"


def _normalize_host(value: str) -> str:
    host = value.strip()
    if not host:
        return ""
    if host == "*":
        return host
    if "://" in host:
        parsed = urlparse(host)
        return parsed.hostname or ""
    if "/" in host:
        host = host.split("/", 1)[0].strip()
    if ":" in host and host.count(":") == 1:
        host = host.split(":", 1)[0].strip()
    return host


_raw_allowed_hosts = os.getenv("ALLOWED_HOSTS", "*")
_internal_allowed_hosts = ("127.0.0.1", "localhost", "frp-backend")
ALLOWED_HOSTS = [
    host
    for host in (_normalize_host(item) for item in _raw_allowed_hosts.split(","))
    if host
]
if "*" not in ALLOWED_HOSTS:
    for host in _internal_allowed_hosts:
        if host not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(host)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",
    "django_filters",
    "apps.accounts",
    "apps.appointments",
    "apps.chat",
    "apps.reviews",
    "apps.adminpanel",
    "apps.common",
    "apps.platform",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DB_ENGINE = os.getenv("DB_ENGINE", "postgres").lower()
if DB_ENGINE == "sqlite":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB", "frpclient"),
            "USER": os.getenv("POSTGRES_USER", "frpuser"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", "frppass"),
            "HOST": os.getenv("POSTGRES_HOST", "localhost"),
            "PORT": int(os.getenv("POSTGRES_PORT", "5432")),
        }
    }

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "ru-ru"
TIME_ZONE = "Europe/Berlin"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

try:  # pragma: no cover - depends on environment packages
    import whitenoise  # noqa: F401

    MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
    STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
except ImportError:
    STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "30"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "30"))),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()
]
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.getenv("CSRF_TRUSTED_ORIGINS", "http://localhost:5173").split(",") if o.strip()
]

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_LOGIN_BOT_USERNAME = os.getenv("TELEGRAM_LOGIN_BOT_USERNAME", "")
TELEGRAM_AUTH_MAX_AGE_SECONDS = int(os.getenv("TELEGRAM_AUTH_MAX_AGE_SECONDS", "86400"))
TELEGRAM_CLIENT_BOT_FRONTEND_URL = os.getenv("TELEGRAM_CLIENT_BOT_FRONTEND_URL", "")

REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME", "refresh_token")
REFRESH_COOKIE_SECURE = os.getenv("REFRESH_COOKIE_SECURE", "0") == "1"
REFRESH_COOKIE_SAMESITE = os.getenv("REFRESH_COOKIE_SAMESITE", "Lax")

DEFAULT_ADMIN_PAYMENT_BANK = os.getenv("DEFAULT_ADMIN_PAYMENT_BANK", "")
DEFAULT_ADMIN_PAYMENT_CRYPTO = os.getenv("DEFAULT_ADMIN_PAYMENT_CRYPTO", "")
DEFAULT_ADMIN_PAYMENT_INSTRUCTIONS = os.getenv("DEFAULT_ADMIN_PAYMENT_INSTRUCTIONS", "")
DEFAULT_SLA_RESPONSE_MINUTES = int(os.getenv("DEFAULT_SLA_RESPONSE_MINUTES", "15"))
DEFAULT_SLA_COMPLETION_HOURS = int(os.getenv("DEFAULT_SLA_COMPLETION_HOURS", "24"))
