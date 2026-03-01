from __future__ import annotations

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.platform.models import PlatformEvent
from apps.platform.services import emit_event


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_appointment_lifecycle_emits_platform_events():
    client_user = User.objects.create_user(username="platform-client", password="x", role=RoleChoices.CLIENT)
    master_user = User.objects.create_user(
        username="platform-master",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
    )

    create_response = auth_as(client_user).post(
        "/api/appointments/",
        {
            "brand": "Apple",
            "model": "iPhone 14",
            "lock_type": "PIN",
            "has_pc": True,
            "description": "Тестовая заявка",
        },
        format="json",
    )
    assert create_response.status_code == 201
    appointment_id = create_response.data["id"]

    take_response = auth_as(master_user).post(f"/api/appointments/{appointment_id}/take/")
    assert take_response.status_code == 200

    set_price_response = auth_as(master_user).post(
        f"/api/appointments/{appointment_id}/set-price/",
        {"total_price": 3500},
        format="json",
    )
    assert set_price_response.status_code == 200

    upload_response = auth_as(client_user).post(
        f"/api/appointments/{appointment_id}/upload-payment-proof/",
        {"payment_proof": SimpleUploadedFile("proof.jpg", b"proof", content_type="image/jpeg")},
        format="multipart",
    )
    assert upload_response.status_code == 200

    mark_paid_response = auth_as(client_user).post(
        f"/api/appointments/{appointment_id}/mark-paid/",
        {"payment_method": "bank_transfer"},
        format="json",
    )
    assert mark_paid_response.status_code == 200

    confirm_response = auth_as(master_user).post(f"/api/appointments/{appointment_id}/confirm-payment/")
    assert confirm_response.status_code == 200

    start_response = auth_as(master_user).post(f"/api/appointments/{appointment_id}/start/")
    assert start_response.status_code == 200

    complete_response = auth_as(master_user).post(f"/api/appointments/{appointment_id}/complete/")
    assert complete_response.status_code == 200

    event_types = set(
        PlatformEvent.objects.filter(entity_type="Appointment", entity_id=str(appointment_id))
        .values_list("event_type", flat=True)
    )
    assert "appointment.created" in event_types
    assert "appointment.master_taken" in event_types
    assert "appointment.price_set" in event_types
    assert "appointment.payment_proof_uploaded" in event_types
    assert "appointment.payment_marked" in event_types
    assert "appointment.payment_confirmed" in event_types
    assert "appointment.work_started" in event_types
    assert "appointment.work_completed" in event_types
    assert "appointment.status_changed" in event_types


@pytest.mark.django_db
def test_chat_message_events_emitted():
    client_user = User.objects.create_user(username="chat-client", password="x", role=RoleChoices.CLIENT)
    master_user = User.objects.create_user(
        username="chat-master",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
    )
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Samsung",
        model="A55",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.IN_PROGRESS,
    )

    send_response = auth_as(master_user).post(
        f"/api/appointments/{appointment.id}/messages/",
        {"text": "Проверка platform event"},
        format="json",
    )
    assert send_response.status_code == 201
    message_id = send_response.data["id"]

    delete_response = auth_as(master_user).delete(f"/api/messages/{message_id}/")
    assert delete_response.status_code == 204

    sent_exists = PlatformEvent.objects.filter(
        event_type="chat.message_sent",
        entity_type="Message",
        entity_id=str(message_id),
    ).exists()
    deleted_exists = PlatformEvent.objects.filter(
        event_type="chat.message_deleted",
        entity_type="Message",
        entity_id=str(message_id),
    ).exists()
    assert sent_exists is True
    assert deleted_exists is True


@pytest.mark.django_db
def test_review_events_emitted():
    client_user = User.objects.create_user(username="review-client", password="x", role=RoleChoices.CLIENT)
    master_user = User.objects.create_user(
        username="review-master",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
    )
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Xiaomi",
        model="13T",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.COMPLETED,
    )

    master_review_response = auth_as(client_user).post(
        f"/api/appointments/{appointment.id}/review-master/",
        {"rating": 5, "comment": "Отлично"},
        format="json",
    )
    assert master_review_response.status_code == 201

    client_review_response = auth_as(master_user).post(
        f"/api/appointments/{appointment.id}/review-client/",
        {"rating": 4, "comment": "Хороший клиент", "behavior_flags": []},
        format="json",
    )
    assert client_review_response.status_code == 201

    assert PlatformEvent.objects.filter(event_type="review.master_created", entity_type="Review").exists()
    assert PlatformEvent.objects.filter(event_type="review.client_created", entity_type="Review").exists()


@pytest.mark.django_db
def test_admin_can_filter_v1_events():
    admin_user = User.objects.create_user(
        username="events-admin",
        password="x",
        role=RoleChoices.ADMIN,
        is_staff=True,
    )
    client_user = User.objects.create_user(username="entity-client", password="x", role=RoleChoices.CLIENT)
    appointment = Appointment.objects.create(
        client=client_user,
        brand="OnePlus",
        model="12",
        lock_type="PIN",
        has_pc=True,
        description="desc",
    )
    emit_event("appointment.created", appointment, actor=client_user, payload={"status": appointment.status})

    response = auth_as(admin_user).get(
        f"/api/v1/events/?event_type=appointment.created&entity_type=Appointment&entity_id={appointment.id}"
    )
    assert response.status_code == 200
    assert len(response.data) >= 1
    assert response.data[0]["event_type"] == "appointment.created"
