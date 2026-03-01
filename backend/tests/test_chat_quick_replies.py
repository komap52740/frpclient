from __future__ import annotations

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.chat.models import MasterQuickReply


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.fixture
def client_user(db):
    return User.objects.create_user(username="client_for_quick", password="x", role=RoleChoices.CLIENT)


@pytest.fixture
def master_user(db):
    return User.objects.create_user(
        username="master_for_quick",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
    )


@pytest.mark.django_db
def test_master_quick_replies_crud_and_permissions(master_user, client_user):
    create_response = auth_as(master_user).post(
        "/api/chat/quick-replies/",
        {"command": "/1", "title": "Установка", "text": "Скачайте программу и откройте ее."},
        format="json",
    )
    assert create_response.status_code == 201
    reply_id = create_response.data["id"]
    assert create_response.data["command"] == "1"

    list_response = auth_as(master_user).get("/api/chat/quick-replies/")
    assert list_response.status_code == 200
    assert len(list_response.data) == 1
    assert list_response.data[0]["command"] == "1"

    patch_response = auth_as(master_user).patch(
        f"/api/chat/quick-replies/{reply_id}/",
        {"text": "Скачайте программу и следуйте инструкции."},
        format="json",
    )
    assert patch_response.status_code == 200
    assert "инструкции" in patch_response.data["text"]

    forbidden_response = auth_as(client_user).get("/api/chat/quick-replies/")
    assert forbidden_response.status_code == 403

    delete_response = auth_as(master_user).delete(f"/api/chat/quick-replies/{reply_id}/")
    assert delete_response.status_code == 204


@pytest.mark.django_db
def test_master_message_expands_quick_reply_command(master_user, client_user):
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Samsung",
        model="A50",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.IN_PROGRESS,
    )
    MasterQuickReply.objects.create(
        user=master_user,
        command="1",
        title="Установка",
        text="Скачайте программу и откройте ее.",
    )

    first_response = auth_as(master_user).post(
        f"/api/appointments/{appointment.id}/messages/",
        {"text": "/1"},
        format="json",
    )
    assert first_response.status_code == 201
    assert first_response.data["text"] == "Скачайте программу и откройте ее."

    second_response = auth_as(master_user).post(
        f"/api/appointments/{appointment.id}/messages/",
        {"text": "/1 После установки напишите в чат."},
        format="json",
    )
    assert second_response.status_code == 201
    assert "Скачайте программу и откройте ее." in second_response.data["text"]
    assert "После установки напишите в чат." in second_response.data["text"]
