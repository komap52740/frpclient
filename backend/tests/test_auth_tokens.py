from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import RoleChoices, User


@pytest.mark.django_db
def test_refresh_rotates_cookie_without_exposing_refresh_token(settings):
    user = User.objects.create_user(
        username="token-user",
        password="safe-pass-123",
        role=RoleChoices.CLIENT,
    )
    client = APIClient()

    login_response = client.post(
        "/api/auth/login/",
        {
            "username": user.username,
            "password": "safe-pass-123",
        },
        format="json",
    )

    assert login_response.status_code == 200
    initial_refresh = client.cookies.get(settings.REFRESH_COOKIE_NAME).value

    refresh_response = client.post("/api/auth/refresh/", {}, format="json")
    assert refresh_response.status_code == 200
    assert "access" in refresh_response.data
    assert "refresh" not in refresh_response.data

    rotated_refresh = refresh_response.cookies.get(settings.REFRESH_COOKIE_NAME).value
    assert rotated_refresh
    assert rotated_refresh != initial_refresh

    old_token_client = APIClient()
    old_token_client.cookies[settings.REFRESH_COOKIE_NAME] = initial_refresh
    old_refresh_response = old_token_client.post("/api/auth/refresh/", {}, format="json")
    assert old_refresh_response.status_code == 401


@pytest.mark.django_db
def test_logout_blacklists_refresh_cookie(settings):
    user = User.objects.create_user(
        username="logout-user",
        password="safe-pass-123",
        role=RoleChoices.CLIENT,
    )
    client = APIClient()

    login_response = client.post(
        "/api/auth/login/",
        {
            "username": user.username,
            "password": "safe-pass-123",
        },
        format="json",
    )

    assert login_response.status_code == 200
    refresh_cookie = client.cookies.get(settings.REFRESH_COOKIE_NAME).value

    logout_response = client.post("/api/auth/logout/", {}, format="json")
    assert logout_response.status_code == 200

    blacklisted_client = APIClient()
    blacklisted_client.cookies[settings.REFRESH_COOKIE_NAME] = refresh_cookie
    refresh_response = blacklisted_client.post("/api/auth/refresh/", {}, format="json")
    assert refresh_response.status_code == 401
