from __future__ import annotations

import pytest
from django.db import connection
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User
from apps.appointments.models import Appointment, AppointmentStatusChoices


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.fixture
def client_user(db):
    return User.objects.create_user(username="secure-client", password="x", role=RoleChoices.CLIENT)


@pytest.fixture
def master_user(db):
    return User.objects.create_user(
        username="secure-master",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
        master_quality_approved=True,
    )


def _raw_rustdesk_columns(appointment_id: int) -> tuple[str, str]:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT rustdesk_id, rustdesk_password FROM appointments_appointment WHERE id = %s",
            [appointment_id],
        )
        row = cursor.fetchone()
    assert row is not None
    return row[0] or "", row[1] or ""


@pytest.mark.django_db
def test_client_create_keeps_detail_visible_but_encrypts_storage_and_hides_list_access(client_user):
    payload = {
        "brand": "Samsung",
        "model": "A55",
        "lock_type": "GOOGLE",
        "has_pc": True,
        "contact_phone": "",
        "description": "desc",
        "rustdesk_id": "987654321",
        "rustdesk_password": "test-pass",
    }

    response = auth_as(client_user).post("/api/appointments/", payload, format="json")
    assert response.status_code == 201
    assert response.data["rustdesk_id"] == "987654321"
    assert response.data["rustdesk_password"] == "test-pass"

    raw_id, raw_password = _raw_rustdesk_columns(response.data["id"])
    assert raw_id.startswith("enc1:")
    assert raw_password.startswith("enc1:")
    assert raw_id != payload["rustdesk_id"]
    assert raw_password != payload["rustdesk_password"]

    list_response = auth_as(client_user).get("/api/appointments/my/")
    assert list_response.status_code == 200
    assert list_response.data[0]["rustdesk_id"] == ""
    assert list_response.data[0]["rustdesk_password"] == ""

    detail_response = auth_as(client_user).get(f"/api/appointments/{response.data['id']}/")
    assert detail_response.status_code == 200
    assert detail_response.data["rustdesk_id"] == "987654321"
    assert detail_response.data["rustdesk_password"] == "test-pass"


@pytest.mark.django_db
def test_client_access_update_response_is_visible_but_storage_is_encrypted(client_user, master_user):
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Xiaomi",
        model="Note 12",
        lock_type="GOOGLE",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.AWAITING_PAYMENT,
        rustdesk_id="",
        rustdesk_password="",
    )

    response = auth_as(client_user).post(
        f"/api/appointments/{appointment.id}/client-access/",
        {"rustdesk_id": "123456789", "rustdesk_password": "7788"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["rustdesk_id"] == "123456789"
    assert response.data["rustdesk_password"] == "7788"

    raw_id, raw_password = _raw_rustdesk_columns(appointment.id)
    assert raw_id.startswith("enc1:")
    assert raw_password.startswith("enc1:")
    assert raw_id != "123456789"
    assert raw_password != "7788"


@pytest.mark.django_db
def test_master_sees_rustdesk_only_after_assignment_and_not_in_lists(client_user, master_user):
    appointment = Appointment.objects.create(
        client=client_user,
        brand="Honor",
        model="90",
        lock_type="OTHER",
        has_pc=True,
        description="desc",
        rustdesk_id="123456789",
        rustdesk_password="7788",
        status=AppointmentStatusChoices.NEW,
    )

    preview_response = auth_as(master_user).get(f"/api/appointments/{appointment.id}/")
    assert preview_response.status_code == 200
    assert preview_response.data["rustdesk_id"] == ""
    assert preview_response.data["rustdesk_password"] == ""

    take_response = auth_as(master_user).post(f"/api/appointments/{appointment.id}/take/")
    assert take_response.status_code == 200
    assert take_response.data["rustdesk_id"] == "123456789"
    assert take_response.data["rustdesk_password"] == "7788"

    active_response = auth_as(master_user).get("/api/appointments/active/")
    assert active_response.status_code == 200
    assert active_response.data[0]["rustdesk_id"] == ""
    assert active_response.data[0]["rustdesk_password"] == ""

    detail_response = auth_as(master_user).get(f"/api/appointments/{appointment.id}/")
    assert detail_response.status_code == 200
    assert detail_response.data["rustdesk_id"] == "123456789"
    assert detail_response.data["rustdesk_password"] == "7788"
