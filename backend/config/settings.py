import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

from django.core.exceptions import ImproperlyConfigured

from config.observability import configure_logging, configure_sentry

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


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


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

ADMIN_HOST = _normalize_host(os.getenv("ADMIN_HOST", "admin.frpclient.ru"))
_raw_admin_allowed_hosts = os.getenv("ADMIN_ALLOWED_HOSTS", ADMIN_HOST or "")
ADMIN_ALLOWED_HOSTS = [
    host
    for host in (_normalize_host(item) for item in _raw_admin_allowed_hosts.split(","))
    if host
]
for host in (ADMIN_HOST, "127.0.0.1", "localhost"):
    if host and host not in ADMIN_ALLOWED_HOSTS:
        ADMIN_ALLOWED_HOSTS.append(host)
    if host and host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(host)

if not DEBUG:
    if SECRET_KEY in {"", "change-me", "change-me-super-secret-key-32-chars"}:
        raise ImproperlyConfigured("SECRET_KEY must be set to a non-default value when DEBUG=0")
    if "*" in ALLOWED_HOSTS:
        raise ImproperlyConfigured("ALLOWED_HOSTS must not contain '*' when DEBUG=0")
    if not os.getenv("REDIS_URL", "").strip():
        raise ImproperlyConfigured("REDIS_URL must be set when DEBUG=0")
    if not ADMIN_ALLOWED_HOSTS:
        raise ImproperlyConfigured("ADMIN_ALLOWED_HOSTS must not be empty when DEBUG=0")

INSTALLED_APPS = [
    "config.admin_apps.FRPAdminConfig",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django_otp",
    "django_otp.plugins.otp_static",
    "django_otp.plugins.otp_totp",
    "channels",
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
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
    "config.request_id.RequestIdMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "config.admin_access.AdminHostMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django_otp.middleware.OTPMiddleware",
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
PASSWORD_MIN_LENGTH = int(os.getenv("PASSWORD_MIN_LENGTH", "10"))
AUTH_LOCKOUT_FAILURE_LIMIT = int(os.getenv("AUTH_LOCKOUT_FAILURE_LIMIT", "5"))
AUTH_LOCKOUT_SECONDS = int(os.getenv("AUTH_LOCKOUT_SECONDS", "900"))
PASSWORD_RESET_TTL_HOURS = int(os.getenv("PASSWORD_RESET_TTL_HOURS", "2"))
PASSWORD_RESET_URL = os.getenv("PASSWORD_RESET_URL", "")
DEFAULT_API_LIST_LIMIT = int(os.getenv("DEFAULT_API_LIST_LIMIT", "100"))
MAX_API_LIST_LIMIT = int(os.getenv("MAX_API_LIST_LIMIT", "200"))
ADMIN_API_LIST_LIMIT = int(os.getenv("ADMIN_API_LIST_LIMIT", "100"))
ADMIN_API_MAX_LIST_LIMIT = int(os.getenv("ADMIN_API_MAX_LIST_LIMIT", "500"))
API_LIST_MAX_OFFSET = int(os.getenv("API_LIST_MAX_OFFSET", "5000"))
CHAT_MESSAGES_LIST_LIMIT = int(os.getenv("CHAT_MESSAGES_LIST_LIMIT", "100"))
CHAT_MESSAGES_MAX_LIST_LIMIT = int(os.getenv("CHAT_MESSAGES_MAX_LIST_LIMIT", "200"))
APPOINTMENT_EVENTS_LIST_LIMIT = int(os.getenv("APPOINTMENT_EVENTS_LIST_LIMIT", "100"))
APPOINTMENT_EVENTS_MAX_LIST_LIMIT = int(os.getenv("APPOINTMENT_EVENTS_MAX_LIST_LIMIT", "200"))

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
MEDIA_STORAGE_PROVIDER = (os.getenv("MEDIA_STORAGE_PROVIDER", "filesystem") or "filesystem").strip().lower()
MEDIA_STORAGE_BUCKET_NAME = os.getenv("MEDIA_STORAGE_BUCKET_NAME", "").strip()
MEDIA_STORAGE_REGION_NAME = (os.getenv("MEDIA_STORAGE_REGION_NAME", "auto") or "auto").strip()
MEDIA_STORAGE_ENDPOINT_URL = os.getenv("MEDIA_STORAGE_ENDPOINT_URL", "").strip()
MEDIA_STORAGE_PREFIX = (os.getenv("MEDIA_STORAGE_PREFIX", "media") or "media").strip().strip("/")
MEDIA_STORAGE_ACCESS_KEY_ID = os.getenv("MEDIA_STORAGE_ACCESS_KEY_ID", "").strip()
MEDIA_STORAGE_SECRET_ACCESS_KEY = os.getenv("MEDIA_STORAGE_SECRET_ACCESS_KEY", "").strip()
MEDIA_STORAGE_SIGNATURE_VERSION = (os.getenv("MEDIA_STORAGE_SIGNATURE_VERSION", "s3v4") or "s3v4").strip()
MEDIA_STORAGE_ADDRESSING_STYLE = (os.getenv("MEDIA_STORAGE_ADDRESSING_STYLE", "virtual") or "virtual").strip()
MEDIA_STORAGE_QUERYSTRING_EXPIRE = int(os.getenv("MEDIA_STORAGE_QUERYSTRING_EXPIRE", os.getenv("SECURE_MEDIA_URL_TTL_SECONDS", "1800")))
DEFAULT_FILE_STORAGE = (
    "apps.common.storage_backends.PrivateR2MediaStorage"
    if MEDIA_STORAGE_PROVIDER in {"r2", "s3"}
    else os.getenv("DEFAULT_FILE_STORAGE", "django.core.files.storage.FileSystemStorage")
)

STORAGES = {
    "default": {
        "BACKEND": DEFAULT_FILE_STORAGE,
    },
    "staticfiles": {
        "BACKEND": STATICFILES_STORAGE,
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"
HEALTH_SERVICE_NAME = os.getenv("HEALTH_SERVICE_NAME", "frpclient-backend").strip() or "frpclient-backend"
INTERNAL_HEALTH_INCLUDE_DEBUG = _env_bool("INTERNAL_HEALTH_INCLUDE_DEBUG", True)
OPENAPI_TITLE = os.getenv("OPENAPI_TITLE", "FRP Client API").strip() or "FRP Client API"
OPENAPI_VERSION = os.getenv("OPENAPI_VERSION", "1.0.0").strip() or "1.0.0"
OPENAPI_DESCRIPTION = (
    os.getenv(
        "OPENAPI_DESCRIPTION",
        (
            "Production API schema for FRP Client. "
            "Primary auth is Bearer JWT for REST requests; browser session auth is used for "
            "same-origin websocket connections after login."
        ),
    ).strip()
    or "Production API schema for FRP Client."
)

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
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_RATES": {
        "auth_bootstrap_status": "60/min",
        "auth_bootstrap_admin": "5/hour",
        "auth_login": "20/hour",
        "auth_register": "10/hour",
        "auth_register_resend": "10/hour",
        "auth_verify_email": "60/hour",
        "auth_password_reset_request": "10/hour",
        "auth_password_reset_confirm": "20/hour",
        "auth_telegram": "20/hour",
        "auth_oauth_start": "30/hour",
        "auth_oauth_callback": "60/hour",
        "auth_logout": "60/hour",
        "auth_refresh": "120/hour",
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": OPENAPI_TITLE,
    "DESCRIPTION": OPENAPI_DESCRIPTION,
    "VERSION": OPENAPI_VERSION,
    "SCHEMA_PATH_PREFIX": r"/api",
    "SCHEMA_COERCE_PATH_PK_SUFFIX": True,
    "SERVE_INCLUDE_SCHEMA": False,
    "SERVE_PERMISSIONS": ["rest_framework.permissions.AllowAny"],
    "SERVE_AUTHENTICATION": [],
    "COMPONENT_SPLIT_REQUEST": True,
    "SORT_OPERATIONS": True,
    "SORT_OPERATION_PARAMETERS": True,
    "APPEND_COMPONENTS": {
        "securitySchemes": {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
            },
            "SessionCookieAuth": {
                "type": "apiKey",
                "in": "cookie",
                "name": os.getenv("SESSION_COOKIE_NAME", "sessionid"),
            },
        }
    },
    "SECURITY": [{"BearerAuth": []}, {"SessionCookieAuth": []}],
    "TAGS": [
        {"name": "auth", "description": "Authentication, OAuth, session bootstrap and account flows."},
        {"name": "appointments", "description": "Client and master appointment lifecycle endpoints."},
        {"name": "chat", "description": "Appointment chat, quick replies and read-state endpoints."},
        {"name": "reviews", "description": "Client/master review flows."},
        {"name": "admin", "description": "Administrative and platform operations endpoints."},
        {"name": "common", "description": "Health, media and shared service endpoints."},
        {"name": "platform", "description": "Rules, metrics, notifications and platform foundation APIs."},
    ],
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "15"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
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

OAUTH_FRONTEND_URL = os.getenv("OAUTH_FRONTEND_URL", "")
GOOGLE_OAUTH_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
GOOGLE_OAUTH_CLIENT_SECRET = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "")
GOOGLE_OAUTH_REDIRECT_URI = os.getenv("GOOGLE_OAUTH_REDIRECT_URI", "")
YANDEX_OAUTH_CLIENT_ID = os.getenv("YANDEX_OAUTH_CLIENT_ID", "")
YANDEX_OAUTH_CLIENT_SECRET = os.getenv("YANDEX_OAUTH_CLIENT_SECRET", "")
YANDEX_OAUTH_REDIRECT_URI = os.getenv("YANDEX_OAUTH_REDIRECT_URI", "")
VK_OAUTH_CLIENT_ID = os.getenv("VK_OAUTH_CLIENT_ID", "")
VK_OAUTH_CLIENT_SECRET = os.getenv("VK_OAUTH_CLIENT_SECRET", "")
VK_OAUTH_REDIRECT_URI = os.getenv("VK_OAUTH_REDIRECT_URI", "")
VK_OAUTH_AUTHORIZE_URL = os.getenv("VK_OAUTH_AUTHORIZE_URL", "https://oauth.vk.com/authorize")
VK_OAUTH_TOKEN_URL = os.getenv("VK_OAUTH_TOKEN_URL", "https://oauth.vk.com/access_token")
VK_OAUTH_USERINFO_URL = os.getenv("VK_OAUTH_USERINFO_URL", "https://api.vk.com/method/users.get")
VK_OAUTH_SCOPE = os.getenv("VK_OAUTH_SCOPE", "email")
VK_OAUTH_API_VERSION = os.getenv("VK_OAUTH_API_VERSION", "5.131")
MAX_OAUTH_CLIENT_ID = os.getenv("MAX_OAUTH_CLIENT_ID", "")
MAX_OAUTH_CLIENT_SECRET = os.getenv("MAX_OAUTH_CLIENT_SECRET", "")
MAX_OAUTH_REDIRECT_URI = os.getenv("MAX_OAUTH_REDIRECT_URI", "")
MAX_OAUTH_AUTHORIZE_URL = os.getenv("MAX_OAUTH_AUTHORIZE_URL", "https://oauth.max.ru/authorize")
MAX_OAUTH_TOKEN_URL = os.getenv("MAX_OAUTH_TOKEN_URL", "https://oauth.max.ru/token")
MAX_OAUTH_USERINFO_URL = os.getenv("MAX_OAUTH_USERINFO_URL", "https://oauth.max.ru/userinfo")
MAX_OAUTH_SCOPE = os.getenv("MAX_OAUTH_SCOPE", "openid profile email")

REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME", "refresh_token")
REFRESH_COOKIE_SECURE = os.getenv("REFRESH_COOKIE_SECURE", "1" if not DEBUG else "0") == "1"
REFRESH_COOKIE_SAMESITE = os.getenv("REFRESH_COOKIE_SAMESITE", "Strict")
OAUTH_COOKIE_SECURE = os.getenv("OAUTH_COOKIE_SECURE", "1" if not DEBUG else "0") == "1"
OAUTH_COOKIE_SAMESITE = os.getenv("OAUTH_COOKIE_SAMESITE", "Lax")
RUSTDESK_ENCRYPTION_KEYS = os.getenv("RUSTDESK_ENCRYPTION_KEYS", "").strip()

SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Strict"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = _env_bool("SECURE_SSL_REDIRECT", False)
SECURE_CONTENT_TYPE_NOSNIFF = _env_bool("SECURE_CONTENT_TYPE_NOSNIFF", True)
SECURE_REFERRER_POLICY = os.getenv("SECURE_REFERRER_POLICY", "same-origin")
SECURE_CROSS_ORIGIN_OPENER_POLICY = os.getenv("SECURE_CROSS_ORIGIN_OPENER_POLICY", "same-origin")
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000" if not DEBUG else "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = _env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", False)
SECURE_HSTS_PRELOAD = _env_bool("SECURE_HSTS_PRELOAD", False)
SECURE_MEDIA_URL_TTL_SECONDS = int(os.getenv("SECURE_MEDIA_URL_TTL_SECONDS", "1800"))
SECURE_MEDIA_ACCEL_REDIRECT = _env_bool("SECURE_MEDIA_ACCEL_REDIRECT", not DEBUG)
SECURE_MEDIA_INTERNAL_PREFIX = os.getenv("SECURE_MEDIA_INTERNAL_PREFIX", "/_protected_media/")
SECURE_MEDIA_SIGNING_SALT = os.getenv("SECURE_MEDIA_SIGNING_SALT", "apps.common.secure-media")
LOG_LEVEL = (os.getenv("LOG_LEVEL", "INFO") or "INFO").strip().upper()
LOG_JSON = _env_bool("LOG_JSON", True)
SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
SENTRY_ENVIRONMENT = (os.getenv("SENTRY_ENVIRONMENT", "development" if DEBUG else "production") or "").strip()
SENTRY_RELEASE = os.getenv("SENTRY_RELEASE", "").strip()
SENTRY_TRACES_SAMPLE_RATE = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0"))

if not DEBUG and not RUSTDESK_ENCRYPTION_KEYS:
    raise ImproperlyConfigured("RUSTDESK_ENCRYPTION_KEYS must be set when DEBUG=0")
if not DEBUG and MEDIA_STORAGE_PROVIDER in {"r2", "s3"}:
    if not MEDIA_STORAGE_BUCKET_NAME:
        raise ImproperlyConfigured("MEDIA_STORAGE_BUCKET_NAME must be set when remote media storage is enabled")
    if MEDIA_STORAGE_PROVIDER != "s3" and not MEDIA_STORAGE_ENDPOINT_URL:
        raise ImproperlyConfigured("MEDIA_STORAGE_ENDPOINT_URL must be set for R2 media storage")
    if not MEDIA_STORAGE_ACCESS_KEY_ID or not MEDIA_STORAGE_SECRET_ACCESS_KEY:
        raise ImproperlyConfigured("MEDIA_STORAGE_ACCESS_KEY_ID and MEDIA_STORAGE_SECRET_ACCESS_KEY must be set for remote media storage")

EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "465"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "0") == "1"
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "1") == "1"
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "no-reply@localhost")
SERVER_EMAIL = os.getenv("SERVER_EMAIL", DEFAULT_FROM_EMAIL)
EMAIL_VERIFICATION_TTL_HOURS = int(os.getenv("EMAIL_VERIFICATION_TTL_HOURS", "24"))
EMAIL_VERIFICATION_URL = os.getenv("EMAIL_VERIFICATION_URL", "")

DEFAULT_ADMIN_PAYMENT_BANK = os.getenv("DEFAULT_ADMIN_PAYMENT_BANK", "")
DEFAULT_ADMIN_PAYMENT_CRYPTO = os.getenv("DEFAULT_ADMIN_PAYMENT_CRYPTO", "")
DEFAULT_ADMIN_PAYMENT_INSTRUCTIONS = os.getenv("DEFAULT_ADMIN_PAYMENT_INSTRUCTIONS", "")
DEFAULT_SLA_RESPONSE_MINUTES = int(os.getenv("DEFAULT_SLA_RESPONSE_MINUTES", "15"))
DEFAULT_SLA_COMPLETION_HOURS = int(os.getenv("DEFAULT_SLA_COMPLETION_HOURS", "24"))

REDIS_URL = os.getenv("REDIS_URL", "").strip()
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
            "KEY_PREFIX": "frpclient",
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "frpclient-default-cache",
        }
    }
if REDIS_URL:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [REDIS_URL],
            },
        },
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        },
    }

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
        "OPTIONS": {"max_similarity": 0.7},
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": PASSWORD_MIN_LENGTH},
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Large proof/media uploads (camera originals, HEIC) should not fail on server-side parser limits.
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "100"))
DATA_UPLOAD_MAX_MEMORY_SIZE = MAX_UPLOAD_MB * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 8 * 1024 * 1024
LOCK_SCREEN_MAX_UPLOAD_MB = int(os.getenv("LOCK_SCREEN_MAX_UPLOAD_MB", "10"))
PAYMENT_PROOF_MAX_UPLOAD_MB = int(os.getenv("PAYMENT_PROOF_MAX_UPLOAD_MB", "100"))
CHAT_FILE_MAX_UPLOAD_MB = int(os.getenv("CHAT_FILE_MAX_UPLOAD_MB", "10"))
QUICK_REPLY_MEDIA_MAX_UPLOAD_MB = int(os.getenv("QUICK_REPLY_MEDIA_MAX_UPLOAD_MB", "100"))

LOGGING_CONFIG = None
LOGGING = configure_logging(log_level=LOG_LEVEL, json_logs=LOG_JSON)
configure_sentry(
    dsn=SENTRY_DSN,
    environment=SENTRY_ENVIRONMENT,
    release=SENTRY_RELEASE,
    traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
)
