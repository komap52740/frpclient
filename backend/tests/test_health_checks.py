from __future__ import annotations

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User
from apps.common import views


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def admin_user(db) -> User:
    return User.objects.create_user(username="health-admin", password="strong-pass-123", role=RoleChoices.ADMIN, is_staff=True)


@pytest.fixture
def client_user(db) -> User:
    return User.objects.create_user(username="health-client", password="strong-pass-123", role=RoleChoices.CLIENT)


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_api_health_reports_redis_unconfigured_by_default(api_client: APIClient):
    response = api_client.get("/api/health/")

    assert response.status_code == 200
    assert response.data["status"] == "ok"
    assert response.data["service"] == views.settings.HEALTH_SERVICE_NAME
    assert "time" in response.data
    assert "database" not in response.data
    assert "redis" not in response.data
    assert "debug" not in response.data


@pytest.mark.django_db
def test_api_health_degrades_when_configured_redis_is_unavailable(api_client: APIClient, monkeypatch):
    monkeypatch.setattr(views.settings, "REDIS_URL", "redis://redis:6379/1")
    monkeypatch.setattr(views, "_check_database", lambda: (True, ""))
    monkeypatch.setattr(views, "_check_redis", lambda: (True, False, "redis down"))

    response = api_client.get("/api/health/")

    assert response.status_code == 503
    assert response.data["status"] == "degraded"
    assert "database" not in response.data
    assert "redis" not in response.data
    assert "debug" not in response.data


@pytest.mark.django_db
def test_api_health_reports_redis_details_on_internal_endpoint(admin_user: User, monkeypatch):
    monkeypatch.setattr(views.settings, "REDIS_URL", "redis://redis:6379/1")
    monkeypatch.setattr(views, "_check_database", lambda: (True, ""))
    monkeypatch.setattr(views, "_check_redis", lambda: (True, True, ""))

    response = auth_as(admin_user).get("/api/health/internal/")

    assert response.status_code == 200
    assert response.data["status"] == "ok"
    assert response.data["database"] == {
        "connected": True,
        "error": "",
    }
    assert response.data["redis"] == {
        "configured": True,
        "connected": True,
        "error": "",
    }
    assert response.data["debug"] is False


@pytest.mark.django_db
def test_api_internal_health_requires_admin(api_client: APIClient, client_user: User):
    assert api_client.get("/api/health/internal/").status_code == 403
    assert auth_as(client_user).get("/api/health/internal/").status_code == 403


@pytest.mark.django_db
def test_healthz_degrades_when_redis_is_down(api_client: APIClient, monkeypatch):
    monkeypatch.setattr(views.settings, "REDIS_URL", "redis://redis:6379/1")
    monkeypatch.setattr(views, "_check_database", lambda: (True, ""))
    monkeypatch.setattr(views, "_check_redis", lambda: (True, False, "redis down"))

    response = api_client.get("/healthz")

    assert response.status_code == 503
    assert response.json() == {
        "status": "degraded",
        "service": views.settings.HEALTH_SERVICE_NAME,
        "database": {
            "connected": True,
            "error": "",
        },
        "redis": {
            "configured": True,
            "connected": False,
            "error": "redis down",
        },
        "time": response.json()["time"],
        "debug": False,
    }
