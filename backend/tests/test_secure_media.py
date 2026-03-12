from __future__ import annotations

from types import SimpleNamespace
from urllib.parse import parse_qs, urlencode, urlsplit

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.common.secure_media import build_appointment_media_url
from upload_helpers import make_test_image_upload, make_test_mp4_upload


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def request_relative_path(url: str) -> str:
    parts = urlsplit(url)
    if parts.query:
        return f"{parts.path}?{parts.query}"
    return parts.path


def streamed_bytes(response) -> bytes:
    if hasattr(response, "streaming_content"):
        return b"".join(response.streaming_content)
    return response.content


@pytest.mark.django_db
@override_settings(SECURE_MEDIA_ACCEL_REDIRECT=False)
def test_profile_photo_is_served_via_signed_url_and_public_media_path_is_closed():
    user = User.objects.create_user(username="secure_media_client", password="x", role=RoleChoices.CLIENT)
    photo = SimpleUploadedFile("avatar.jpg", b"avatar-bytes", content_type="image/jpeg")

    response = auth_as(user).patch(
        "/api/me/profile/",
        {"profile_photo": photo},
        format="multipart",
    )

    assert response.status_code == 200
    profile_photo_url = response.data["user"]["profile_photo_url"]
    assert "/api/media/signed/" in profile_photo_url
    assert "http://testserver/media/" not in profile_photo_url

    user.refresh_from_db()
    public_response = APIClient().get(user.profile_photo.url)
    assert public_response.status_code == 404

    download_response = APIClient().get(request_relative_path(profile_photo_url))
    assert download_response.status_code == 200
    assert streamed_bytes(download_response) == b"avatar-bytes"

    parts = urlsplit(profile_photo_url)
    tampered = parse_qs(parts.query)
    tampered["token"] = [f"{tampered['token'][0]}broken"]
    tampered_response = APIClient().get(f"{parts.path}?{urlencode({key: value[0] for key, value in tampered.items()})}")
    assert tampered_response.status_code == 404


@pytest.mark.django_db
@override_settings(SECURE_MEDIA_ACCEL_REDIRECT=False)
def test_appointment_media_urls_are_signed_and_raw_paths_hidden():
    client_user = User.objects.create_user(username="secure_media_client_2", password="x", role=RoleChoices.CLIENT)
    appointment = Appointment.objects.create(
        client=client_user,
        brand="Samsung",
        model="A50",
        lock_type="Google",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.AWAITING_PAYMENT,
    )
    appointment.photo_lock_screen = SimpleUploadedFile("lock.jpg", b"lock-image", content_type="image/jpeg")
    appointment.payment_proof = SimpleUploadedFile("proof.pdf", b"%PDF-proof", content_type="application/pdf")
    appointment.save(update_fields=["photo_lock_screen", "payment_proof", "updated_at"])

    response = auth_as(client_user).get(f"/api/appointments/{appointment.id}/")

    assert response.status_code == 200
    assert "photo_lock_screen" not in response.data
    assert "payment_proof" not in response.data
    assert "/api/media/signed/" in response.data["photo_lock_screen_url"]
    assert "/api/media/signed/" in response.data["payment_proof_url"]

    proof_download = APIClient().get(request_relative_path(response.data["payment_proof_url"]))
    assert proof_download.status_code == 200
    assert streamed_bytes(proof_download) == b"%PDF-proof"


@pytest.mark.django_db
@override_settings(SECURE_MEDIA_ACCEL_REDIRECT=False)
def test_chat_and_quick_reply_media_urls_are_signed():
    client_user = User.objects.create_user(username="secure_media_chat_client", password="x", role=RoleChoices.CLIENT)
    master_user = User.objects.create_user(
        username="secure_media_chat_master",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
        master_quality_approved=True,
    )
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Samsung",
        model="A50",
        lock_type="Google",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.IN_PROGRESS,
    )

    reply_media = make_test_mp4_upload("guide.mp4")
    reply_response = auth_as(master_user).post(
        "/api/chat/quick-replies/",
        {
            "command": "/guide",
            "title": "Видео",
            "text": "Откройте файл",
            "media_file": reply_media,
        },
        format="multipart",
    )
    assert reply_response.status_code == 201
    assert "/api/media/signed/" in reply_response.data["media_url"]

    message_file = make_test_image_upload("chat.jpg")
    message_response = auth_as(client_user).post(
        f"/api/appointments/{appointment.id}/messages/",
        {"file": message_file},
        format="multipart",
    )
    assert message_response.status_code == 201
    assert "file" not in message_response.data
    assert "/api/media/signed/" in message_response.data["file_url"]

    download_response = APIClient().get(request_relative_path(message_response.data["file_url"]))
    assert download_response.status_code == 200
    assert streamed_bytes(download_response).startswith(b"\xff\xd8\xff")


@override_settings(MEDIA_STORAGE_PROVIDER="r2", SECURE_MEDIA_URL_TTL_SECONDS=900)
def test_remote_media_uses_direct_storage_signed_url():
    storage_calls: list[dict[str, object]] = []

    class FakeStorage:
        def url(self, name, parameters=None, expire=None):
            storage_calls.append(
                {
                    "name": name,
                    "parameters": parameters or {},
                    "expire": expire,
                }
            )
            return f"https://r2.example.invalid/private/{name}?signature=test"

    appointment = SimpleNamespace(
        id=42,
        payment_proof=SimpleNamespace(name="payments/proof.pdf", storage=FakeStorage()),
    )

    file_url = build_appointment_media_url(None, appointment, "payment_proof")

    assert file_url == "https://r2.example.invalid/private/payments/proof.pdf?signature=test"
    assert "/api/media/signed/" not in file_url
    assert storage_calls == [
        {
            "name": "payments/proof.pdf",
            "parameters": {
                "ResponseContentDisposition": "inline; filename*=UTF-8''proof.pdf",
                "ResponseCacheControl": "private, no-store",
                "ResponseContentType": "application/pdf",
            },
            "expire": 900,
        }
    ]
