from __future__ import annotations

import pytest
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient

from apps.accounts.models import RoleChoices


@pytest.fixture(autouse=True)
def clear_auth_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
def test_register_rejects_weak_password():
    client = APIClient()

    response = client.post(
        "/api/auth/register/",
        {
            "username": "weak_client",
            "email": "weak_client@example.com",
            "password": "1234567890",
            "password_confirm": "1234567890",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "password" in response.data


@pytest.mark.django_db
def test_bootstrap_admin_rejects_weak_password():
    client = APIClient()

    response = client.post(
        "/api/auth/bootstrap-admin/",
        {
            "username": "rootadmin",
            "password": "1234567890",
            "first_name": "Root",
            "last_name": "Admin",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "password" in response.data


@pytest.mark.django_db
@override_settings(AUTH_LOCKOUT_FAILURE_LIMIT=3, AUTH_LOCKOUT_SECONDS=300)
def test_login_lockout_blocks_after_repeated_failures():
    from apps.accounts.models import User

    user = User.objects.create_user(
        username="lockout-user",
        password="safe-pass-12345",
        role=RoleChoices.CLIENT,
        is_active=True,
    )
    client = APIClient()

    for _ in range(3):
        response = client.post(
            "/api/auth/login/",
            {
                "username": user.username,
                "password": "wrong-password",
            },
            format="json",
        )
        assert response.status_code == 401

    blocked_response = client.post(
        "/api/auth/login/",
        {
            "username": user.username,
            "password": "safe-pass-12345",
        },
        format="json",
    )

    assert blocked_response.status_code == 429
    assert "Слишком много" in str(blocked_response.data.get("detail", ""))
