from __future__ import annotations

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_admin_can_run_flush_expired_tokens_action(monkeypatch):
    admin = User.objects.create_user(
        username="system-admin",
        password="x",
        role=RoleChoices.ADMIN,
        is_staff=True,
    )
    called = []

    def fake_call_command(command, stdout=None, stderr=None, **kwargs):
        called.append((command, kwargs))
        stdout.write("expired tokens flushed\n")

    monkeypatch.setattr("apps.adminpanel.views.call_command", fake_call_command)

    response = auth_as(admin).post(
        "/api/admin/system/run-action/",
        {"action": "flushexpiredtokens"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["success"] is True
    assert response.data["action"] == "flushexpiredtokens"
    assert "expired tokens flushed" in response.data["stdout"]
    assert called == [("flushexpiredtokens", {"verbosity": 1})]


@pytest.mark.django_db
def test_admin_can_run_compute_daily_metrics_action(monkeypatch):
    admin = User.objects.create_user(
        username="metrics-admin",
        password="x",
        role=RoleChoices.ADMIN,
        is_staff=True,
    )
    called = []

    def fake_call_command(command, stdout=None, stderr=None, **kwargs):
        called.append((command, kwargs))
        stdout.write("metrics refreshed\n")

    monkeypatch.setattr("apps.adminpanel.views.call_command", fake_call_command)

    response = auth_as(admin).post(
        "/api/admin/system/run-action/",
        {"action": "compute_daily_metrics"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["success"] is True
    assert response.data["action"] == "compute_daily_metrics"
    assert "metrics refreshed" in response.data["stdout"]
    assert called == [("compute_daily_metrics", {})]
