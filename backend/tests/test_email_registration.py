from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import EmailVerificationToken, User


@pytest.mark.django_db
def test_login_is_blocked_until_email_is_verified(monkeypatch, settings):
    settings.EMAIL_HOST = "mail.unlocktool.ru"
    settings.DEFAULT_FROM_EMAIL = "no-reply@example.com"

    monkeypatch.setattr("apps.accounts.views.send_mail", lambda *args, **kwargs: 1)

    client = APIClient()
    register_response = client.post(
        "/api/auth/register/",
        {
            "username": "email_client_1",
            "email": "email_client_1@example.com",
            "password": "safe-pass-123",
            "password_confirm": "safe-pass-123",
        },
        format="json",
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/api/auth/login/",
        {"username": "email_client_1", "password": "safe-pass-123"},
        format="json",
    )
    assert login_response.status_code == 403
    assert "Email" in str(login_response.data.get("detail", ""))


@pytest.mark.django_db
def test_verify_email_callback_activates_user_and_allows_login(monkeypatch, settings):
    settings.EMAIL_HOST = "mail.unlocktool.ru"
    settings.DEFAULT_FROM_EMAIL = "no-reply@example.com"
    settings.OAUTH_FRONTEND_URL = "https://frpclient.ru"

    monkeypatch.setattr("apps.accounts.views.send_mail", lambda *args, **kwargs: 1)

    client = APIClient()
    register_response = client.post(
        "/api/auth/register/",
        {
            "username": "email_client_2",
            "email": "email_client_2@example.com",
            "password": "safe-pass-123",
            "password_confirm": "safe-pass-123",
        },
        format="json",
    )
    assert register_response.status_code == 201

    user = User.objects.get(username="email_client_2")
    verification = EmailVerificationToken.objects.get(user=user, used_at__isnull=True)

    callback_response = client.get(f"/api/auth/verify-email/?token={verification.token}")
    assert callback_response.status_code == 302
    assert callback_response["Location"].startswith("https://frpclient.ru/login#")
    assert "email_verified=1" in callback_response["Location"]

    user.refresh_from_db()
    verification.refresh_from_db()
    assert user.is_active is True
    assert user.is_email_verified is True
    assert user.email_verified_at is not None
    assert verification.used_at is not None

    login_response = client.post(
        "/api/auth/login/",
        {"username": "email_client_2", "password": "safe-pass-123"},
        format="json",
    )
    assert login_response.status_code == 200
    assert "access" in login_response.data


@pytest.mark.django_db
def test_resend_verification_rotates_active_token(monkeypatch, settings):
    settings.EMAIL_HOST = "mail.unlocktool.ru"
    settings.DEFAULT_FROM_EMAIL = "no-reply@example.com"

    sent_counter = {"count": 0}

    def fake_send_mail(*args, **kwargs):
        sent_counter["count"] += 1
        return 1

    monkeypatch.setattr("apps.accounts.views.send_mail", fake_send_mail)

    client = APIClient()
    register_response = client.post(
        "/api/auth/register/",
        {
            "username": "email_client_3",
            "email": "email_client_3@example.com",
            "password": "safe-pass-123",
            "password_confirm": "safe-pass-123",
        },
        format="json",
    )
    assert register_response.status_code == 201

    user = User.objects.get(username="email_client_3")
    first_token = EmailVerificationToken.objects.get(user=user, used_at__isnull=True)

    resend_response = client.post(
        "/api/auth/register/resend-verification/",
        {"email": "email_client_3@example.com"},
        format="json",
    )
    assert resend_response.status_code == 200
    assert sent_counter["count"] == 2

    first_token.refresh_from_db()
    assert first_token.used_at is not None

    second_token = EmailVerificationToken.objects.get(user=user, used_at__isnull=True)
    assert second_token.id != first_token.id
    assert second_token.token != first_token.token

    unknown_response = client.post(
        "/api/auth/register/resend-verification/",
        {"email": "unknown@example.com"},
        format="json",
    )
    assert unknown_response.status_code == 200
