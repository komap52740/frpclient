from __future__ import annotations

import base64
import hashlib
import os
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models


_ENCRYPTED_PREFIX = "enc1:"
_DEV_FALLBACK_KEY = "dev-only-rustdesk-encryption-key"


def _normalize_fernet_key(raw_key: str) -> bytes:
    candidate = (raw_key or "").strip().encode("utf-8")
    if not candidate:
        raise ImproperlyConfigured("Encryption key material must not be empty")
    try:
        Fernet(candidate)
    except (TypeError, ValueError):
        return base64.urlsafe_b64encode(hashlib.sha256(candidate).digest())
    return candidate


@lru_cache(maxsize=8)
def _build_cipher(keys: tuple[str, ...]) -> MultiFernet:
    if not keys:
        raise ImproperlyConfigured("At least one encryption key must be configured")
    return MultiFernet([Fernet(_normalize_fernet_key(item)) for item in keys])


def get_sensitive_field_cipher() -> MultiFernet:
    configured_keys = tuple(
        item.strip() for item in getattr(settings, "RUSTDESK_ENCRYPTION_KEYS", "").split(",") if item.strip()
    )
    if not configured_keys:
        if getattr(settings, "DEBUG", False) or os.getenv("PYTEST_CURRENT_TEST"):
            configured_keys = (_DEV_FALLBACK_KEY,)
        else:
            raise ImproperlyConfigured("RUSTDESK_ENCRYPTION_KEYS must be configured when DEBUG=0")
    return _build_cipher(configured_keys)


def encrypt_sensitive_value(value: str) -> str:
    normalized = "" if value is None else str(value)
    if not normalized:
        return ""
    if normalized.startswith(_ENCRYPTED_PREFIX):
        return normalized
    token = get_sensitive_field_cipher().encrypt(normalized.encode("utf-8")).decode("utf-8")
    return f"{_ENCRYPTED_PREFIX}{token}"


def decrypt_sensitive_value(value: str) -> str:
    normalized = "" if value is None else str(value)
    if not normalized:
        return ""
    if not normalized.startswith(_ENCRYPTED_PREFIX):
        return normalized
    token = normalized[len(_ENCRYPTED_PREFIX) :].encode("utf-8")
    try:
        return get_sensitive_field_cipher().decrypt(token).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Encrypted field value could not be decrypted") from exc


class EncryptedTextField(models.TextField):
    description = "Text field encrypted at rest with Fernet"

    def from_db_value(self, value, expression, connection):
        return self.to_python(value)

    def to_python(self, value):
        if value in (None, ""):
            return value
        if not isinstance(value, str):
            value = str(value)
        return decrypt_sensitive_value(value)

    def get_prep_value(self, value):
        if value in (None, ""):
            return ""
        if not isinstance(value, str):
            value = str(value)
        return encrypt_sensitive_value(value)
