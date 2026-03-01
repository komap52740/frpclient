from __future__ import annotations

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.platform.models import Notification, Rule
from apps.platform.services import emit_event


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_rule_creates_notification_on_event():
    admin_user = User.objects.create_user(username="rule-admin", password="x", role=RoleChoices.ADMIN, is_staff=True)
    client_user = User.objects.create_user(username="rule-client", password="x", role=RoleChoices.CLIENT)

    Rule.objects.create(
        name="notify_admin_on_new_appointment",
        is_active=True,
        trigger_event_type="appointment.created",
        condition_json={"all": [{"field": "appointment.status", "op": "==", "value": "NEW"}]},
        action_json={
            "type": "create_notification",
            "target": "role",
            "role": "admin",
            "title": "Новая заявка",
            "message": "Проверьте входящую заявку",
        },
    )

    response = auth_as(client_user).post(
        "/api/appointments/",
        {
            "brand": "Apple",
            "model": "iPhone 15",
            "lock_type": "PIN",
            "has_pc": True,
            "description": "desc",
        },
        format="json",
    )
    assert response.status_code == 201
    assert Notification.objects.filter(user=admin_user, title="Новая заявка").exists()


@pytest.mark.django_db
def test_rule_can_change_appointment_status_with_safe_transition():
    master_user = User.objects.create_user(
        username="rule-master",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
    )
    client_user = User.objects.create_user(username="rule-client-2", password="x", role=RoleChoices.CLIENT)
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Samsung",
        model="S24",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.PAID,
    )

    Rule.objects.create(
        name="auto_start_after_paid_event",
        is_active=True,
        trigger_event_type="appointment.payment_confirmed",
        condition_json={"all": [{"field": "appointment.status", "op": "==", "value": "PAID"}]},
        action_json={"type": "change_status", "to_status": "IN_PROGRESS"},
    )

    emit_event("appointment.payment_confirmed", appointment, actor=master_user, payload={})
    appointment.refresh_from_db()
    assert appointment.status == AppointmentStatusChoices.IN_PROGRESS


@pytest.mark.django_db
def test_rule_assign_tag_action():
    client_user = User.objects.create_user(username="rule-tag-client", password="x", role=RoleChoices.CLIENT)
    appointment = Appointment.objects.create(
        client=client_user,
        brand="Xiaomi",
        model="14",
        lock_type="PIN",
        has_pc=True,
        description="desc",
    )

    Rule.objects.create(
        name="tag_new_appointments",
        is_active=True,
        trigger_event_type="appointment.created",
        condition_json={},
        action_json={"type": "assign_tag", "tag": "new-request"},
    )

    emit_event("appointment.created", appointment, actor=client_user, payload={"status": appointment.status})
    appointment.refresh_from_db()
    assert "new-request" in (appointment.platform_tags or [])


@pytest.mark.django_db
def test_admin_rule_crud_api():
    admin_user = User.objects.create_user(username="rules-admin-api", password="x", role=RoleChoices.ADMIN, is_staff=True)
    client = auth_as(admin_user)

    create_response = client.post(
        "/api/v1/admin/rules/",
        {
            "name": "api_rule",
            "is_active": True,
            "trigger_event_type": "appointment.created",
            "condition_json": {},
            "action_json": {"type": "request_admin_attention"},
        },
        format="json",
    )
    assert create_response.status_code == 201
    rule_id = create_response.data["id"]

    list_response = client.get("/api/v1/admin/rules/")
    assert list_response.status_code == 200
    assert len(list_response.data) >= 1

    patch_response = client.patch(f"/api/v1/admin/rules/{rule_id}/", {"is_active": False}, format="json")
    assert patch_response.status_code == 200
    assert patch_response.data["is_active"] is False
