from __future__ import annotations

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.chat.models import MasterQuickReply, Message
from upload_helpers import make_test_image_upload, make_test_mp4_upload


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.fixture
def client_user(db):
    return User.objects.create_user(username="upload-client", password="x", role=RoleChoices.CLIENT)


@pytest.fixture
def master_user(db):
    return User.objects.create_user(
        username="upload-master",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
        master_quality_approved=True,
    )


@pytest.mark.django_db
def test_appointment_create_reencodes_lock_screen_and_strips_trailing_payload(client_user):
    photo = make_test_image_upload("lock.jpg", trailing_bytes=b"<script>alert(1)</script>")

    response = auth_as(client_user).post(
        "/api/appointments/",
        {
            "brand": "Samsung",
            "model": "A50",
            "lock_type": "GOOGLE",
            "has_pc": True,
            "description": "desc",
            "photo_lock_screen": photo,
        },
        format="multipart",
    )

    assert response.status_code == 201
    appointment = Appointment.objects.get(id=response.data["id"])
    appointment.photo_lock_screen.open("rb")
    stored_bytes = appointment.photo_lock_screen.read()
    appointment.photo_lock_screen.close()
    assert stored_bytes.startswith(b"\xff\xd8\xff")
    assert b"<script>alert(1)</script>" not in stored_bytes


@pytest.mark.django_db
def test_payment_proof_rejects_mime_spoofing(client_user, master_user):
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Samsung",
        model="A50",
        lock_type="GOOGLE",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.AWAITING_PAYMENT,
    )
    spoofed_file = SimpleUploadedFile("proof.jpg", b"%PDF-1.4\nmalicious", content_type="image/jpeg")

    response = auth_as(client_user).post(
        f"/api/appointments/{appointment.id}/upload-payment-proof/",
        {"payment_proof": spoofed_file},
        format="multipart",
    )

    assert response.status_code == 400
    appointment.refresh_from_db()
    assert not appointment.payment_proof


@pytest.mark.django_db
def test_chat_attachment_rejects_mime_spoofing(client_user, master_user):
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Samsung",
        model="A50",
        lock_type="GOOGLE",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.IN_PROGRESS,
    )
    spoofed_file = SimpleUploadedFile("chat.jpg", b"%PDF-1.4\nmalicious", content_type="image/jpeg")

    response = auth_as(client_user).post(
        f"/api/appointments/{appointment.id}/messages/",
        {"file": spoofed_file},
        format="multipart",
    )

    assert response.status_code == 400
    assert Message.objects.filter(appointment=appointment).count() == 0


@pytest.mark.django_db
def test_quick_reply_media_accepts_signature_checked_mp4(master_user):
    response = auth_as(master_user).post(
        "/api/chat/quick-replies/",
        {
            "command": "/video",
            "title": "Видео",
            "text": "Откройте видео",
            "media_file": make_test_mp4_upload("guide.mp4"),
        },
        format="multipart",
    )

    assert response.status_code == 201
    assert MasterQuickReply.objects.filter(user=master_user, command="video").exists()
