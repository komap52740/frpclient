from __future__ import annotations

import pytest
from django.conf import settings
from rest_framework.test import APIClient

from apps.accounts.models import RoleChoices, User


@pytest.mark.django_db
def test_login_sets_session_cookie_for_websocket_auth():
    User.objects.create_user(username="session-login-user", password="secret123", role=RoleChoices.CLIENT)
    client = APIClient()

    response = client.post(
        "/api/auth/login/",
        {"username": "session-login-user", "password": "secret123"},
        format="json",
    )

    assert response.status_code == 200
    assert settings.SESSION_COOKIE_NAME in response.cookies
    assert client.cookies.get(settings.SESSION_COOKIE_NAME)


@pytest.mark.django_db
def test_refresh_restores_session_cookie_for_websocket_auth():
    User.objects.create_user(username="session-refresh-user", password="secret123", role=RoleChoices.CLIENT)
    client = APIClient()

    login_response = client.post(
        "/api/auth/login/",
        {"username": "session-refresh-user", "password": "secret123"},
        format="json",
    )
    assert login_response.status_code == 200
    assert settings.REFRESH_COOKIE_NAME in client.cookies

    client.cookies.pop(settings.SESSION_COOKIE_NAME, None)

    refresh_response = client.post("/api/auth/refresh/", {}, format="json")
    assert refresh_response.status_code == 200
    assert settings.SESSION_COOKIE_NAME in refresh_response.cookies
