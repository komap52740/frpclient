from __future__ import annotations

import hashlib
import hmac
from typing import Any


def build_data_check_string(payload: dict[str, Any]) -> str:
    rows = []
    for key in sorted(payload.keys()):
        if key == "hash":
            continue
        value = payload[key]
        if value is None:
            continue
        if isinstance(value, (list, tuple)):
            value = value[0] if value else ""
        if isinstance(value, bool):
            value = "true" if value else "false"
        rows.append(f"{key}={value}")
    return "\n".join(rows)


def verify_telegram_login(payload: dict[str, Any], bot_token: str) -> bool:
    provided_hash = payload.get("hash", "")
    if not provided_hash or not bot_token:
        return False

    data_check_string = build_data_check_string(payload)
    secret_key = hashlib.sha256(bot_token.encode("utf-8")).digest()
    computed_hash = hmac.new(
        secret_key,
        data_check_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(computed_hash, provided_hash)