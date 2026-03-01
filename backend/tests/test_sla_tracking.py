from __future__ import annotations

from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.platform.models import Notification, PlatformEvent, Rule


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_appointment_create_sets_response_deadline():
    client_user = User.objects.create_user(username="sla-client-create", password="x", role=RoleChoices.CLIENT)

    response = auth_as(client_user).post(
        "/api/appointments/",
        {
            "brand": "Apple",
            "model": "iPhone",
            "lock_type": "PIN",
            "has_pc": True,
            "description": "desc",
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["response_deadline_at"] is not None
    assert response.data["sla_breached"] is False


@pytest.mark.django_db
def test_confirm_payment_sets_completion_deadline():
    client_user = User.objects.create_user(username="sla-client-paid", password="x", role=RoleChoices.CLIENT)
    master_user = User.objects.create_user(
        username="sla-master-paid",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
    )
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Samsung",
        model="S23",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED,
        payment_proof=SimpleUploadedFile("proof.jpg", b"x", content_type="image/jpeg"),
    )

    response = auth_as(master_user).post(f"/api/appointments/{appointment.id}/confirm-payment/")
    assert response.status_code == 200
    appointment.refresh_from_db()
    assert appointment.status == AppointmentStatusChoices.PAID
    assert appointment.completion_deadline_at is not None


@pytest.mark.django_db
def test_sla_breach_emits_event_and_rule_creates_admin_notification():
    admin_user = User.objects.create_user(username="sla-admin", password="x", role=RoleChoices.ADMIN, is_staff=True)
    client_user = User.objects.create_user(username="sla-client", password="x", role=RoleChoices.CLIENT)
    master_user = User.objects.create_user(
        username="sla-master",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
    )
    Rule.objects.create(
        name="notify_admin_on_sla_breach",
        is_active=True,
        trigger_event_type="sla.breached",
        condition_json={},
        action_json={"type": "request_admin_attention", "title": "SLA нарушен"},
    )

    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Xiaomi",
        model="13",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.IN_PROGRESS,
        completion_deadline_at=timezone.now() - timedelta(minutes=10),
        started_at=timezone.now() - timedelta(hours=1),
    )

    complete_response = auth_as(master_user).post(f"/api/appointments/{appointment.id}/complete/")
    assert complete_response.status_code == 200

    appointment.refresh_from_db()
    assert appointment.sla_breached is True
    assert PlatformEvent.objects.filter(
        event_type="sla.breached",
        entity_type="Appointment",
        entity_id=str(appointment.id),
    ).exists()
    assert Notification.objects.filter(user=admin_user, title="SLA нарушен").exists()
