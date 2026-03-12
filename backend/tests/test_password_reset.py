from __future__ import annotations

from datetime import timedelta

import pytest
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import PasswordResetToken, RoleChoices, User


@pytest.fixture(autouse=True)
def clear_auth_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
def test_password_reset_request_creates_token_and_sends_email(monkeypatch, settings):
    settings.EMAIL_HOST = "mail.unlocktool.ru"
    settings.DEFAULT_FROM_EMAIL = "no-reply@example.com"
    settings.PASSWORD_RESET_URL = "https://frpclient.ru/login"

    delivered = {}

    def fake_send_mail(subject, message, from_email, recipient_list, fail_silently=False):
        delivered["subject"] = subject
        delivered["message"] = message
        delivered["from_email"] = from_email
        delivered["recipient_list"] = recipient_list
        return 1

    monkeypatch.setattr("apps.accounts.views.send_mail", fake_send_mail)

    user = User.objects.create_user(
        username="reset_email_user",
        email="reset_email_user@example.com",
        password="safe-pass-12345",
        role=RoleChoices.CLIENT,
        is_active=True,
        is_email_verified=True,
    )
    client = APIClient()

    response = client.post(
        "/api/auth/password-reset/",
        {"email": user.email},
        format="json",
    )

    assert response.status_code == 200
    token = PasswordResetToken.objects.get(user=user, used_at__isnull=True)
    assert token.token in delivered["message"]
    assert delivered["recipient_list"] == [user.email]


@pytest.mark.django_db
def test_password_reset_request_is_generic_for_unknown_email():
    client = APIClient()

    response = client.post(
        "/api/auth/password-reset/",
        {"email": "missing@example.com"},
        format="json",
    )

    assert response.status_code == 200
    assert PasswordResetToken.objects.count() == 0


@pytest.mark.django_db
@override_settings(AUTH_LOCKOUT_FAILURE_LIMIT=2, AUTH_LOCKOUT_SECONDS=300)
def test_password_reset_confirm_updates_password_clears_lockout_and_blacklists_refresh_tokens(settings):
    user = User.objects.create_user(
        username="reset_confirm_user",
        email="reset_confirm_user@example.com",
        password="safe-pass-12345",
        role=RoleChoices.CLIENT,
        is_active=True,
        is_email_verified=True,
    )

    login_client = APIClient()
    login_response = login_client.post(
        "/api/auth/login/",
        {
            "username": user.username,
            "password": "safe-pass-12345",
        },
        format="json",
    )
    assert login_response.status_code == 200
    old_refresh_cookie = login_client.cookies.get(settings.REFRESH_COOKIE_NAME).value

    for _ in range(2):
        failed_response = login_client.post(
            "/api/auth/login/",
            {
                "username": user.username,
                "password": "wrong-password",
            },
            format="json",
        )
        assert failed_response.status_code == 401

    blocked_response = login_client.post(
        "/api/auth/login/",
        {
            "username": user.username,
            "password": "safe-pass-12345",
        },
        format="json",
    )
    assert blocked_response.status_code == 429

    reset_token = PasswordResetToken.objects.create(
        user=user,
        token="reset-confirm-token-1234567890",
        expires_at=timezone.now() + timedelta(hours=1),
    )

    reset_response = login_client.post(
        "/api/auth/password-reset/confirm/",
        {
            "token": reset_token.token,
            "password": "new-safe-pass-12345",
            "password_confirm": "new-safe-pass-12345",
        },
        format="json",
    )
    assert reset_response.status_code == 200

    reset_token.refresh_from_db()
    assert reset_token.used_at is not None

    old_password_response = APIClient().post(
        "/api/auth/login/",
        {
            "username": user.username,
            "password": "safe-pass-12345",
        },
        format="json",
    )
    assert old_password_response.status_code == 401

    new_password_response = login_client.post(
        "/api/auth/login/",
        {
            "username": user.username,
            "password": "new-safe-pass-12345",
        },
        format="json",
    )
    assert new_password_response.status_code == 200

    old_refresh_client = APIClient()
    old_refresh_client.cookies[settings.REFRESH_COOKIE_NAME] = old_refresh_cookie
    refresh_response = old_refresh_client.post("/api/auth/refresh/", {}, format="json")
    assert refresh_response.status_code == 401
