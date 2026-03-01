from __future__ import annotations

from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.chat.models import Message
from apps.platform.models import Notification


@pytest.fixture
def client_user(db):
    return User.objects.create_user(username="client1", password="x", role=RoleChoices.CLIENT)


@pytest.fixture
def client_user_2(db):
    return User.objects.create_user(username="client2", password="x", role=RoleChoices.CLIENT)


@pytest.fixture
def master_user(db):
    return User.objects.create_user(
        username="master1",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
    )


@pytest.fixture
def master_user_2(db):
    return User.objects.create_user(
        username="master2",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(username="admin1", password="x", role=RoleChoices.ADMIN, is_staff=True)


@pytest.fixture
def api_client():
    return APIClient()


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_take_appointment_locking(client_user, master_user, master_user_2):
    appointment = Appointment.objects.create(
        client=client_user,
        brand="Samsung",
        model="A50",
        lock_type="PIN",
        has_pc=True,
        description="desc",
    )

    first = auth_as(master_user).post(f"/api/appointments/{appointment.id}/take/")
    assert first.status_code == 200

    second = auth_as(master_user_2).post(f"/api/appointments/{appointment.id}/take/")
    assert second.status_code == 400

    appointment.refresh_from_db()
    assert appointment.assigned_master_id == master_user.id
    assert appointment.status == AppointmentStatusChoices.IN_REVIEW


@pytest.mark.django_db
def test_set_price_only_in_review(client_user, master_user):
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Samsung",
        model="A50",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.NEW,
    )

    bad = auth_as(master_user).post(f"/api/appointments/{appointment.id}/set-price/", {"total_price": 2000})
    assert bad.status_code == 400

    appointment.status = AppointmentStatusChoices.IN_REVIEW
    appointment.save(update_fields=["status", "updated_at"])

    ok = auth_as(master_user).post(f"/api/appointments/{appointment.id}/set-price/", {"total_price": 2500})
    assert ok.status_code == 200

    appointment.refresh_from_db()
    assert appointment.total_price == 2500
    assert appointment.status == AppointmentStatusChoices.AWAITING_PAYMENT


@pytest.mark.django_db
def test_upload_proof_only_awaiting_payment(client_user, master_user):
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Xiaomi",
        model="Note",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.IN_REVIEW,
    )

    proof = SimpleUploadedFile("proof.jpg", b"filecontent", content_type="image/jpeg")
    bad = auth_as(client_user).post(
        f"/api/appointments/{appointment.id}/upload-payment-proof/",
        {"payment_proof": proof},
        format="multipart",
    )
    assert bad.status_code == 400

    appointment.status = AppointmentStatusChoices.AWAITING_PAYMENT
    appointment.save(update_fields=["status", "updated_at"])

    proof2 = SimpleUploadedFile("proof2.jpg", b"filecontent", content_type="image/jpeg")
    ok = auth_as(client_user).post(
        f"/api/appointments/{appointment.id}/upload-payment-proof/",
        {"payment_proof": proof2},
        format="multipart",
    )
    assert ok.status_code == 200


@pytest.mark.django_db
def test_start_only_from_paid(client_user, master_user):
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="iPhone",
        model="12",
        lock_type="APPLE_ID",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.AWAITING_PAYMENT,
    )

    bad = auth_as(master_user).post(f"/api/appointments/{appointment.id}/start/")
    assert bad.status_code == 400

    appointment.status = AppointmentStatusChoices.PAID
    appointment.save(update_fields=["status", "updated_at"])

    ok = auth_as(master_user).post(f"/api/appointments/{appointment.id}/start/")
    assert ok.status_code == 200

    appointment.refresh_from_db()
    assert appointment.status == AppointmentStatusChoices.IN_PROGRESS


@pytest.mark.django_db
def test_unread_count_flow(client_user, master_user):
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Honor",
        model="X",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.IN_PROGRESS,
    )

    m1 = Message.objects.create(appointment=appointment, sender=master_user, text="1")
    m2 = Message.objects.create(appointment=appointment, sender=master_user, text="2")

    list_resp = auth_as(client_user).get("/api/appointments/my/")
    assert list_resp.status_code == 200
    assert list_resp.data[0]["unread_count"] == 2

    read_resp = auth_as(client_user).post(f"/api/appointments/{appointment.id}/read/", {"last_read_message_id": m2.id})
    assert read_resp.status_code == 200

    list_resp2 = auth_as(client_user).get("/api/appointments/my/")
    assert list_resp2.status_code == 200
    assert list_resp2.data[0]["unread_count"] == 0


@pytest.mark.django_db
def test_permissions_scope(client_user, client_user_2, master_user, master_user_2):
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Nokia",
        model="G",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED,
        payment_proof=SimpleUploadedFile("proof.jpg", b"x", content_type="image/jpeg"),
    )

    denied_detail = auth_as(client_user_2).get(f"/api/appointments/{appointment.id}/")
    assert denied_detail.status_code == 403

    denied_confirm = auth_as(master_user_2).post(f"/api/appointments/{appointment.id}/confirm-payment/")
    assert denied_confirm.status_code == 403


@pytest.mark.django_db
def test_admin_system_status(admin_user):
    response = auth_as(admin_user).get("/api/admin/system/status/")
    assert response.status_code == 200
    assert "database" in response.data
    assert "counts" in response.data
    assert response.data["database"]["connected"] is True


@pytest.mark.django_db
def test_admin_system_action_check(admin_user):
    response = auth_as(admin_user).post("/api/admin/system/run-action/", {"action": "check"}, format="json")
    assert response.status_code == 200
    assert response.data["action"] == "check"
    assert response.data["success"] is True


@pytest.mark.django_db
def test_admin_system_action_requires_admin(client_user):
    response = auth_as(client_user).post("/api/admin/system/run-action/", {"action": "check"}, format="json")
    assert response.status_code == 403


@pytest.mark.django_db
def test_bootstrap_admin_flow(api_client):
    status_before = api_client.get("/api/auth/bootstrap-status/")
    assert status_before.status_code == 200
    assert status_before.data["requires_setup"] is True

    create_response = api_client.post(
        "/api/auth/bootstrap-admin/",
        {
            "username": "owner",
            "password": "supersecure123",
            "first_name": "Иван",
            "last_name": "Админ",
        },
        format="json",
    )
    assert create_response.status_code == 200
    assert create_response.data["user"]["role"] == RoleChoices.ADMIN

    status_after = api_client.get("/api/auth/bootstrap-status/")
    assert status_after.status_code == 200
    assert status_after.data["requires_setup"] is False

    conflict = api_client.post(
        "/api/auth/bootstrap-admin/",
        {"username": "second", "password": "anothersecure123"},
        format="json",
    )
    assert conflict.status_code == 409


@pytest.mark.django_db
def test_password_login_flow(api_client):
    User.objects.create_user(username="local_admin", password="safe-pass-123", role=RoleChoices.ADMIN, is_staff=True)

    ok_response = api_client.post(
        "/api/auth/login/",
        {"username": "local_admin", "password": "safe-pass-123"},
        format="json",
    )
    assert ok_response.status_code == 200
    assert ok_response.data["user"]["role"] == RoleChoices.ADMIN
    assert "access" in ok_response.data

    bad_response = api_client.post(
        "/api/auth/login/",
        {"username": "local_admin", "password": "wrong-pass"},
        format="json",
    )
    assert bad_response.status_code == 401


@pytest.mark.django_db
def test_admin_can_update_system_settings(admin_user):
    payload = {
        "bank_requisites": "Счет 123",
        "crypto_requisites": "USDT TRC20 ...",
        "instructions": "Оплатите и приложите чек.",
    }
    response = auth_as(admin_user).put("/api/admin/system/settings/", payload, format="json")
    assert response.status_code == 200
    assert response.data["bank_requisites"] == payload["bank_requisites"]
    assert response.data["crypto_requisites"] == payload["crypto_requisites"]
    assert response.data["instructions"] == payload["instructions"]


@pytest.mark.django_db
def test_admin_can_change_user_role(admin_user, client_user):
    response = auth_as(admin_user).post(
        f"/api/admin/users/{client_user.id}/role/",
        {"role": RoleChoices.MASTER, "is_master_active": True},
        format="json",
    )
    assert response.status_code == 200

    client_user.refresh_from_db()
    assert client_user.role == RoleChoices.MASTER
    assert client_user.is_master_active is True


@pytest.mark.django_db
def test_api_health_endpoint(api_client):
    response = api_client.get("/api/health/")
    assert response.status_code == 200
    assert response.data["status"] == "ok"
    assert response.data["database"]["connected"] is True


@pytest.mark.django_db
def test_dashboard_summary_for_client(client_user):
    appointment = Appointment.objects.create(
        client=client_user,
        brand="Samsung",
        model="A50",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.AWAITING_PAYMENT,
    )
    Message.objects.create(appointment=appointment, sender=client_user, text="self")
    response = auth_as(client_user).get("/api/dashboard/")
    assert response.status_code == 200
    assert response.data["role"] == RoleChoices.CLIENT
    assert response.data["counts"]["appointments_total"] >= 1
    assert response.data["counts"]["awaiting_payment"] >= 1


@pytest.mark.django_db
def test_dashboard_summary_for_admin(admin_user):
    response = auth_as(admin_user).get("/api/dashboard/")
    assert response.status_code == 200
    assert response.data["role"] == "admin"
    assert "users_total" in response.data["counts"]


@pytest.mark.django_db
def test_appointment_events_endpoint(client_user, master_user):
    appointment = Appointment.objects.create(
        client=client_user,
        brand="Samsung",
        model="A50",
        lock_type="PIN",
        has_pc=True,
        description="desc",
    )
    take_response = auth_as(master_user).post(f"/api/appointments/{appointment.id}/take/")
    assert take_response.status_code == 200

    events_response = auth_as(client_user).get(f"/api/appointments/{appointment.id}/events/")
    assert events_response.status_code == 200
    assert len(events_response.data) >= 1

    latest_event_id = events_response.data[0]["id"]
    incremental_response = auth_as(client_user).get(
        f"/api/appointments/{appointment.id}/events/",
        {"after_id": latest_event_id},
    )
    assert incremental_response.status_code == 200
    assert incremental_response.data == []

    bad_after_id_response = auth_as(client_user).get(
        f"/api/appointments/{appointment.id}/events/",
        {"after_id": "abc"},
    )
    assert bad_after_id_response.status_code == 400


@pytest.mark.django_db
def test_client_signal_creates_event_and_master_notification(client_user, master_user):
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Google",
        model="Pixel",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.IN_REVIEW,
    )

    response = auth_as(client_user).post(
        f"/api/appointments/{appointment.id}/client-signal/",
        {"signal": "need_help", "comment": "Не понимаю следующий шаг"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["ok"] is True

    events_response = auth_as(client_user).get(f"/api/appointments/{appointment.id}/events/")
    assert events_response.status_code == 200
    assert any(item["event_type"] == "client_signal" for item in events_response.data)

    note = events_response.data[0]["note"]
    assert "Клиент просит помощь" in note

    notification = Notification.objects.filter(user=master_user).order_by("-id").first()
    assert notification is not None
    assert notification.payload["appointment_id"] == appointment.id
    assert notification.payload["signal"] == "need_help"


@pytest.mark.django_db
def test_client_can_repeat_appointment(client_user):
    source = Appointment.objects.create(
        client=client_user,
        brand="Samsung",
        model="A50",
        lock_type="PIN",
        has_pc=True,
        description="Повторная диагностика",
        status=AppointmentStatusChoices.COMPLETED,
    )

    with patch("apps.appointments.client_actions.notify_masters_about_new_appointment") as notify_mock:
        response = auth_as(client_user).post(f"/api/appointments/{source.id}/repeat/")
        assert response.status_code == 201
        notify_mock.assert_called_once()

    repeated_id = response.data["id"]
    assert repeated_id != source.id
    repeated = Appointment.objects.get(id=repeated_id)
    assert repeated.client_id == client_user.id
    assert repeated.brand == source.brand
    assert repeated.model == source.model
    assert repeated.lock_type == source.lock_type
    assert repeated.status == AppointmentStatusChoices.NEW


@pytest.mark.django_db
def test_register_flow(api_client):
    payload = {
        "username": "new_client",
        "password": "safe-pass-123",
        "password_confirm": "safe-pass-123",
    }
    response = api_client.post("/api/auth/register/", payload, format="json")
    assert response.status_code == 200
    assert response.data["user"]["username"] == payload["username"]
    assert response.data["user"]["role"] == RoleChoices.CLIENT
    assert "access" in response.data

    duplicate = api_client.post("/api/auth/register/", payload, format="json")
    assert duplicate.status_code == 400


@pytest.mark.django_db
def test_client_cannot_see_own_risk_in_appointment_detail(client_user, master_user):
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Samsung",
        model="A50",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.IN_REVIEW,
    )

    client_response = auth_as(client_user).get(f"/api/appointments/{appointment.id}/")
    assert client_response.status_code == 200
    assert client_response.data["client_risk_score"] is None
    assert client_response.data["client_risk_level"] is None

    master_response = auth_as(master_user).get(f"/api/appointments/{appointment.id}/")
    assert master_response.status_code == 200
    assert master_response.data["client_risk_score"] is not None
    assert master_response.data["client_risk_level"] in {"low", "medium", "high", "critical"}


@pytest.mark.django_db
def test_create_appointment_calls_master_telegram_notifications(client_user):
    payload = {
        "brand": "Samsung",
        "model": "A50",
        "lock_type": "PIN",
        "has_pc": True,
        "description": "desc",
    }

    with patch("apps.appointments.views.notify_masters_about_new_appointment") as notify_mock:
        response = auth_as(client_user).post("/api/appointments/", payload, format="json")
        assert response.status_code == 201
        notify_mock.assert_called_once()

