from __future__ import annotations

import re
from uuid import uuid4

import sentry_sdk
import structlog


REQUEST_ID_HEADER = "X-Request-ID"
_VALID_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{8,128}$")


def _normalize_request_id(raw_value: str | None) -> str:
    value = (raw_value or "").strip()
    if value and _VALID_REQUEST_ID_RE.fullmatch(value):
        return value
    return uuid4().hex


class RequestIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = _normalize_request_id(request.headers.get(REQUEST_ID_HEADER))
        request.request_id = request_id
        request.correlation_id = request_id

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            request_method=request.method,
            request_path=request.path,
        )
        sentry_sdk.get_isolation_scope().set_tag("request_id", request_id)

        try:
            response = self.get_response(request)
        finally:
            structlog.contextvars.clear_contextvars()

        response[REQUEST_ID_HEADER] = request_id
        return response
