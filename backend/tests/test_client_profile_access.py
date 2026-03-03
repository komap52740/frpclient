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


@pytest.fixture
def client_user(db):
    return User.objects.create_user(username="client_profile_1", password="x", role=RoleChoices.CLIENT)


@pytest.fixture
def other_client_user(db):
    return User.objects.create_user(username="client_profile_2", password="x", role=RoleChoices.CLIENT)


@pytest.fixture
def master_user(db):
    return User.objects.create_user(
        username="master_profile_1",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
        master_quality_approved=True,
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username="admin_profile_1",
        password="x",
        role=RoleChoices.ADMIN,
        is_staff=True,
    )


@pytest.mark.django_db
def test_admin_can_open_client_profile(admin_user, client_user):
    response = auth_as(admin_user).get(f"/api/clients/{client_user.id}/profile/")

    assert response.status_code == 200
    assert response.data["id"] == client_user.id
    assert response.data["username"] == client_user.username
    assert "client_stats" in response.data
    assert "risk_level" in response.data["client_stats"]


@pytest.mark.django_db
def test_master_can_open_client_profile(master_user, client_user):
    response = auth_as(master_user).get(f"/api/clients/{client_user.id}/profile/")

    assert response.status_code == 200
    assert response.data["id"] == client_user.id
    assert "appointments_total" in response.data


@pytest.mark.django_db
def test_client_cannot_open_client_profile(client_user, other_client_user):
    response = auth_as(client_user).get(f"/api/clients/{other_client_user.id}/profile/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_master_can_open_clients_list(master_user, client_user):
    response = auth_as(master_user).get("/api/admin/users/")

    assert response.status_code == 200
    assert isinstance(response.data, list)
    assert any(item["id"] == client_user.id for item in response.data)
