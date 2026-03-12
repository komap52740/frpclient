import os

os.environ["DEBUG"] = "1"
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production-only"
os.environ["ALLOWED_HOSTS"] = "*"

from .settings import *  # noqa: F401,F403


SECRET_KEY = "test-secret-key-not-for-production-only"
DEBUG = False
ALLOWED_HOSTS = ["*"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "test_db.sqlite3",
    }
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "frpclient-tests",
    }
}
