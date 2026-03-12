from __future__ import annotations

import logging
import logging.config
from collections.abc import Mapping, Sequence
from typing import Any

import structlog

REDACTED_VALUE = "[REDACTED]"
SENSITIVE_KEYS = {
    "access",
    "access_token",
    "authorization",
    "client_secret",
    "cookie",
    "csrfmiddlewaretoken",
    "email_host_password",
    "password",
    "password_confirm",
    "refresh",
    "refresh_token",
    "rustdesk_password",
    "sessionid",
    "set-cookie",
    "telegram_bot_token",
    "token",
}


def _redact_value(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {key: _redact_pair(key, inner_value) for key, inner_value in value.items()}
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [_redact_value(item) for item in value]
    return value


def _redact_pair(key: Any, value: Any) -> Any:
    normalized_key = str(key).strip().lower()
    if normalized_key in SENSITIVE_KEYS:
        return REDACTED_VALUE
    return _redact_value(value)


def redact_sensitive_processor(_logger, _method_name: str, event_dict: dict[str, Any]) -> dict[str, Any]:
    return {key: _redact_pair(key, value) for key, value in event_dict.items()}


def _shared_processors() -> list[Any]:
    return [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        redact_sensitive_processor,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]


def build_logging_config(*, log_level: str, json_logs: bool) -> dict[str, Any]:
    renderer = structlog.processors.JSONRenderer(sort_keys=True)
    if not json_logs:
        renderer = structlog.dev.ConsoleRenderer(colors=False)

    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "structlog": {
                "()": structlog.stdlib.ProcessorFormatter,
                "processor": renderer,
                "foreign_pre_chain": _shared_processors(),
            }
        },
        "handlers": {
            "default": {
                "class": "logging.StreamHandler",
                "formatter": "structlog",
            }
        },
        "root": {
            "handlers": ["default"],
            "level": log_level,
        },
        "loggers": {
            "django": {"handlers": ["default"], "level": log_level, "propagate": False},
            "django.server": {"handlers": ["default"], "level": log_level, "propagate": False},
            "gunicorn": {"handlers": ["default"], "level": log_level, "propagate": False},
            "uvicorn": {"handlers": ["default"], "level": log_level, "propagate": False},
        },
    }


def configure_logging(*, log_level: str, json_logs: bool) -> dict[str, Any]:
    logging_config = build_logging_config(log_level=log_level, json_logs=json_logs)
    logging.config.dictConfig(logging_config)
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            redact_sensitive_processor,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    return logging_config


def _sanitize_sentry_payload(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {key: _redact_pair(key, inner_value) for key, inner_value in value.items()}
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [_sanitize_sentry_payload(item) for item in value]
    return value


def _sentry_before_send(event: dict[str, Any], _hint: dict[str, Any]) -> dict[str, Any]:
    return _sanitize_sentry_payload(event)


def configure_sentry(
    *,
    dsn: str,
    environment: str,
    release: str,
    traces_sample_rate: float,
) -> None:
    normalized_dsn = (dsn or "").strip()
    if not normalized_dsn:
        return

    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    logging_integration = LoggingIntegration(level=logging.INFO, event_level=logging.ERROR)
    sentry_sdk.init(
        dsn=normalized_dsn,
        environment=(environment or "").strip() or "production",
        release=(release or "").strip() or None,
        integrations=[DjangoIntegration(), logging_integration],
        send_default_pii=False,
        traces_sample_rate=max(0.0, min(1.0, traces_sample_rate)),
        before_send=_sentry_before_send,
        max_breadcrumbs=50,
    )
