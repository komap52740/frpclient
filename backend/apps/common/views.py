from __future__ import annotations

from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView


class ApiHealthView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        db_connected = False
        db_error = ""
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            db_connected = True
        except Exception as exc:  # pragma: no cover - defensive path
            db_error = str(exc)

        status_label = "ok" if db_connected else "degraded"
        response_status = 200 if db_connected else 503
        return Response(
            {
                "status": status_label,
                "service": "frpclient-backend",
                "time": timezone.now(),
                "debug": settings.DEBUG,
                "database": {
                    "connected": db_connected,
                    "error": db_error,
                },
            },
            status=response_status,
        )


def healthz(request):
    """Lightweight probe endpoint for balancers and docker healthchecks."""
    db_connected = True
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        db_connected = False

    payload = {
        "status": "ok" if db_connected else "degraded",
        "service": "frpclient-backend",
    }
    return JsonResponse(payload, status=200 if db_connected else 503)
