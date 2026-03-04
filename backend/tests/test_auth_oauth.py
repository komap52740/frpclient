from __future__ import annotations

import pytest
from rest_framework.test import APIClient
from urllib.parse import parse_qs, urlparse

from apps.accounts import views as account_views
from apps.accounts.models import EmailVerificationToken, RoleChoices, User


@pytest.mark.django_db
def test_register_endpoint_creates_unverified_user_and_token(monkeypatch, settings):
    settings.EMAIL_HOST = "mail.unlocktool.ru"
    settings.DEFAULT_FROM_EMAIL = "no-reply@example.com"

    sent = {"count": 0}

    def fake_send_mail(subject, message, from_email, recipient_list, fail_silently=False):
        sent["count"] += 1
        assert "Подтверждение email" in subject
        assert "oauth_register@example.com" in recipient_list
        assert "verify-email" in message
        return 1

    monkeypatch.setattr(account_views, "send_mail", fake_send_mail)

    client = APIClient()
    response = client.post(
        "/api/auth/register/",
        {
            "username": "new_user",
            "email": "oauth_register@example.com",
            "password": "password123",
            "password_confirm": "password123",
        },
        format="json",
    )

    assert response.status_code == 201
    user = User.objects.get(username="new_user")
    assert user.email == "oauth_register@example.com"
    assert user.is_active is False
    assert user.is_email_verified is False
    assert EmailVerificationToken.objects.filter(user=user, used_at__isnull=True).exists()
    assert sent["count"] == 1


@pytest.mark.django_db
def test_google_oauth_start_requires_configuration(settings):
    settings.GOOGLE_OAUTH_CLIENT_ID = ""
    settings.GOOGLE_OAUTH_CLIENT_SECRET = ""

    client = APIClient()
    response = client.get("/api/auth/oauth/google/start/")

    assert response.status_code == 503


@pytest.mark.django_db
def test_google_oauth_callback_creates_client_and_redirects(monkeypatch, settings):
    settings.GOOGLE_OAUTH_CLIENT_ID = "google-client-id"
    settings.GOOGLE_OAUTH_CLIENT_SECRET = "google-client-secret"
    settings.OAUTH_FRONTEND_URL = "https://client.androidmultitool.ru"

    monkeypatch.setattr(
        account_views,
        "_load_google_profile",
        lambda config, code: {
            "sub": "google-sub-123",
            "email": "oauth_google@example.com",
            "given_name": "OAuth",
            "family_name": "Google",
        },
    )

    client = APIClient()
    start_response = client.get("/api/auth/oauth/google/start/")
    assert start_response.status_code == 200

    state = client.cookies.get("oauth_state_google").value
    callback_response = client.get(f"/api/auth/oauth/google/callback/?code=fake_code&state={state}")

    assert callback_response.status_code == 302
    assert callback_response["Location"].startswith("https://client.androidmultitool.ru/login#")
    assert "oauth_access=" in callback_response["Location"]
    assert "oauth_provider=google" in callback_response["Location"]
    assert User.objects.filter(email="oauth_google@example.com", role=RoleChoices.CLIENT).exists()


@pytest.mark.django_db
def test_vk_oauth_start_requires_configuration(settings):
    settings.VK_OAUTH_CLIENT_ID = ""
    settings.VK_OAUTH_CLIENT_SECRET = ""

    client = APIClient()
    response = client.get("/api/auth/oauth/vk/start/")

    assert response.status_code == 503


@pytest.mark.django_db
def test_vk_oauth_callback_creates_client_and_redirects(monkeypatch, settings):
    settings.VK_OAUTH_CLIENT_ID = "vk-client-id"
    settings.VK_OAUTH_CLIENT_SECRET = "vk-client-secret"
    settings.VK_OAUTH_AUTHORIZE_URL = "https://oauth.vk.test/authorize"
    settings.VK_OAUTH_TOKEN_URL = "https://oauth.vk.test/access_token"
    settings.VK_OAUTH_USERINFO_URL = "https://api.vk.test/method/users.get"
    settings.VK_OAUTH_SCOPE = "email"
    settings.VK_OAUTH_API_VERSION = "5.131"
    settings.OAUTH_FRONTEND_URL = "https://client.androidmultitool.ru"

    monkeypatch.setattr(
        account_views,
        "_load_vk_profile",
        lambda config, code, **kwargs: {
            "id": "vk-user-777",
            "email": "oauth_vk@example.com",
            "first_name": "OAuth",
            "last_name": "VK",
            "username": "vk_oauth_user",
        },
    )

    client = APIClient()
    start_response = client.get("/api/auth/oauth/vk/start/")
    assert start_response.status_code == 200

    state = client.cookies.get("oauth_state_vk").value
    callback_response = client.get(f"/api/auth/oauth/vk/callback/?code=fake_code&state={state}")

    assert callback_response.status_code == 302
    assert callback_response["Location"].startswith("https://client.androidmultitool.ru/login#")
    assert "oauth_access=" in callback_response["Location"]
    assert "oauth_provider=vk" in callback_response["Location"]
    assert User.objects.filter(email="oauth_vk@example.com", role=RoleChoices.CLIENT).exists()


@pytest.mark.django_db
def test_vk_id_oauth_start_sets_pkce_and_device_cookie(settings):
    settings.VK_OAUTH_CLIENT_ID = "vk-client-id"
    settings.VK_OAUTH_CLIENT_SECRET = "vk-client-secret"
    settings.VK_OAUTH_AUTHORIZE_URL = "https://id.vk.com/authorize"
    settings.VK_OAUTH_TOKEN_URL = "https://id.vk.com/oauth2/auth"
    settings.VK_OAUTH_USERINFO_URL = "https://id.vk.com/oauth2/user_info"

    client = APIClient()
    start_response = client.get("/api/auth/oauth/vk/start/")

    assert start_response.status_code == 200
    auth_url = start_response.data["auth_url"]
    parsed = urlparse(auth_url)
    query = parse_qs(parsed.query)
    assert parsed.netloc == "id.vk.com"
    assert query.get("code_challenge_method") == ["S256"]
    assert query.get("code_challenge")
    assert query.get("device_id")
    assert client.cookies.get("oauth_pkce_verifier_vk")
    assert client.cookies.get("oauth_device_id_vk")


@pytest.mark.django_db
def test_vk_id_oauth_callback_passes_pkce_data(monkeypatch, settings):
    settings.VK_OAUTH_CLIENT_ID = "vk-client-id"
    settings.VK_OAUTH_CLIENT_SECRET = "vk-client-secret"
    settings.VK_OAUTH_AUTHORIZE_URL = "https://id.vk.com/authorize"
    settings.VK_OAUTH_TOKEN_URL = "https://id.vk.com/oauth2/auth"
    settings.VK_OAUTH_USERINFO_URL = "https://id.vk.com/oauth2/user_info"
    settings.OAUTH_FRONTEND_URL = "https://client.androidmultitool.ru"

    captured = {}

    def fake_load_vk_profile(config, code, **kwargs):
        captured.update(kwargs)
        return {
            "id": "vkid-user-777",
            "email": "oauth_vk_id@example.com",
            "first_name": "OAuth",
            "last_name": "VKID",
            "username": "vkid_oauth_user",
        }

    monkeypatch.setattr(account_views, "_load_vk_profile", fake_load_vk_profile)

    client = APIClient()
    start_response = client.get("/api/auth/oauth/vk/start/")
    assert start_response.status_code == 200

    state = client.cookies.get("oauth_state_vk").value
    code_verifier = client.cookies.get("oauth_pkce_verifier_vk").value
    device_id = client.cookies.get("oauth_device_id_vk").value

    callback_response = client.get(f"/api/auth/oauth/vk/callback/?code=fake_code&state={state}&device_id={device_id}")

    assert callback_response.status_code == 302
    assert "oauth_provider=vk" in callback_response["Location"]
    assert captured["state"] == state
    assert captured["device_id"] == device_id
    assert captured["code_verifier"] == code_verifier
    assert User.objects.filter(email="oauth_vk_id@example.com", role=RoleChoices.CLIENT).exists()
