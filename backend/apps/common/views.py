from __future__ import annotations

from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import authentication
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole, IsAuthenticatedAndNotBanned

from .secure_media import build_secure_media_response, resolve_signed_media_file


def _check_database() -> tuple[bool, str]:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return True, ""
    except Exception as exc:  # pragma: no cover - defensive path
        return False, str(exc)


def _check_redis() -> tuple[bool, bool | None, str]:
    redis_url = settings.REDIS_URL.strip()
    if not redis_url:
        return False, None, ""

    client = None
    try:
        import redis

        client = redis.Redis.from_url(redis_url, socket_connect_timeout=2, socket_timeout=2)
        return True, bool(client.ping()), ""
    except Exception as exc:  # pragma: no cover - defensive path
        return True, False, str(exc)
    finally:
        if client is not None and hasattr(client, "close"):
            client.close()


def _build_health_payload() -> tuple[dict[str, object], int]:
    db_connected, db_error = _check_database()
    redis_configured, redis_connected, redis_error = _check_redis()
    dependencies_ok = db_connected and (not redis_configured or bool(redis_connected))

    payload = {
        "status": "ok" if dependencies_ok else "degraded",
        "service": settings.HEALTH_SERVICE_NAME,
        "database": {
            "connected": db_connected,
            "error": db_error,
        },
        "redis": {
            "configured": redis_configured,
            "connected": redis_connected,
            "error": redis_error,
        },
    }
    return payload, 200 if dependencies_ok else 503


def _public_health_payload(payload: dict[str, object]) -> dict[str, object]:
    return {
        "status": payload["status"],
        "service": payload["service"],
        "time": timezone.now(),
    }


def _internal_health_payload(payload: dict[str, object]) -> dict[str, object]:
    response_payload: dict[str, object] = {
        **payload,
        "time": timezone.now(),
    }
    if settings.INTERNAL_HEALTH_INCLUDE_DEBUG:
        response_payload["debug"] = settings.DEBUG
    return response_payload


def _finalize_health_response(response: Response | JsonResponse) -> Response | JsonResponse:
    response["Cache-Control"] = "no-store"
    response["Pragma"] = "no-cache"
    response["X-Robots-Tag"] = "noindex, nofollow, noarchive"
    return response


class ApiHealthView(APIView):
    permission_classes = (permissions.AllowAny,)
    authentication_classes = ()

    def get(self, request):
        payload, response_status = _build_health_payload()
        return _finalize_health_response(Response(_public_health_payload(payload), status=response_status))


class ApiInternalHealthView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    authentication_classes = (authentication.SessionAuthentication, JWTAuthentication)

    def get(self, request):
        payload, response_status = _build_health_payload()
        return _finalize_health_response(Response(_internal_health_payload(payload), status=response_status))


class SignedMediaDownloadView(APIView):
    permission_classes = (permissions.AllowAny,)
    authentication_classes = ()

    def get(self, request):
        token = (request.query_params.get("token") or "").strip()
        file_field = resolve_signed_media_file(token)
        return build_secure_media_response(file_field)


def healthz(request):
    """Internal probe endpoint with dependency details for local checks."""
    payload, response_status = _build_health_payload()
    return _finalize_health_response(JsonResponse(_internal_health_payload(payload), status=response_status))
