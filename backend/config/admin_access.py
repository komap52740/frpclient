from __future__ import annotations

from django.conf import settings
from django.http import HttpResponseNotFound


def _normalize_host(value: str) -> str:
    host = (value or "").strip().lower()
    if not host:
        return ""
    if ":" in host and host.count(":") == 1:
        host = host.split(":", 1)[0].strip()
    return host


class AdminHostMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/django-admin/"):
            host = _normalize_host(request.get_host())
            allowed_hosts = {_normalize_host(item) for item in getattr(settings, "ADMIN_ALLOWED_HOSTS", [])}
            if host not in allowed_hosts:
                return HttpResponseNotFound()
        return self.get_response(request)
