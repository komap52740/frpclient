from __future__ import annotations

import hashlib
import time

from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import Throttled


def _client_ip(request) -> str:
    forwarded_for = (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
    if forwarded_for:
        return forwarded_for
    return (request.META.get("REMOTE_ADDR") or "unknown").strip() or "unknown"


def _normalize_username(username: str) -> str:
    return (username or "").strip().lower()


def _lockout_suffix(request, username: str) -> str:
    raw = f"{_client_ip(request)}|{_normalize_username(username)}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _attempts_key(request, username: str) -> str:
    return f"auth:login:attempts:{_lockout_suffix(request, username)}"


def _lock_key(request, username: str) -> str:
    return f"auth:login:locked:{_lockout_suffix(request, username)}"


def get_login_lockout_retry_seconds(request, username: str) -> int:
    lock_until = float(cache.get(_lock_key(request, username)) or 0)
    return max(int(lock_until - time.time()), 0)


def ensure_login_not_locked(request, username: str) -> None:
    retry_seconds = get_login_lockout_retry_seconds(request, username)
    if retry_seconds > 0:
        raise Throttled(
            wait=retry_seconds,
            detail="Слишком много неудачных попыток входа. Повторите позже.",
        )


def register_failed_login(request, username: str) -> int:
    attempts_key = _attempts_key(request, username)
    attempts = int(cache.get(attempts_key) or 0) + 1
    cache.set(attempts_key, attempts, timeout=settings.AUTH_LOCKOUT_SECONDS)
    if attempts >= settings.AUTH_LOCKOUT_FAILURE_LIMIT:
        cache.set(
            _lock_key(request, username),
            time.time() + settings.AUTH_LOCKOUT_SECONDS,
            timeout=settings.AUTH_LOCKOUT_SECONDS,
        )
    return attempts


def clear_failed_login(request, username: str) -> None:
    cache.delete_many(
        [
            _attempts_key(request, username),
            _lock_key(request, username),
        ]
    )
