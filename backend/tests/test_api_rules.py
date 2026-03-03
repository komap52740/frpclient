from __future__ import annotations

from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import MasterLevelChoices, RoleChoices, User, WholesaleStatusChoices
from apps.accounts.notifications import notify_masters_about_new_appointment
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.chat.models import Message
from apps.platform.models import Notification
from apps.reviews.models import Review, ReviewTypeChoices


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
        master_quality_approved=True,
    )


@pytest.fixture
def master_user_2(db):
    return User.objects.create_user(
        username="master2",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
        master_quality_approved=True,
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
def test_take_appointment_for_active_master_without_quality_gate(client_user):
    master_pending = User.objects.create_user(
        username="master_pending_quality",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
        master_quality_approved=False,
    )
    appointment = Appointment.objects.create(
        client=client_user,
        brand="Samsung",
        model="A14",
        lock_type="PIN",
        has_pc=True,
        description="desc",
    )

    response = auth_as(master_pending).post(f"/api/appointments/{appointment.id}/take/")
    assert response.status_code == 200
    appointment.refresh_from_db()
    assert appointment.assigned_master_id == master_pending.id


@pytest.mark.django_db
def test_take_appointment_allows_non_senior_levels(client_user):
    master_trainee = User.objects.create_user(
        username="master_trainee",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
        master_quality_approved=True,
        master_level=MasterLevelChoices.TRAINEE,
    )
    appointment = Appointment.objects.create(
        client=client_user,
        brand="Samsung",
        model="A22",
        lock_type="PIN",
        has_pc=True,
        description="desc",
    )

    response = auth_as(master_trainee).post(f"/api/appointments/{appointment.id}/take/")
    assert response.status_code == 200
    appointment.refresh_from_db()
    assert appointment.assigned_master_id == master_trainee.id


@pytest.mark.django_db
def test_admin_can_update_master_quality(admin_user):
    master = User.objects.create_user(
        username="master_quality_edit",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
        master_quality_approved=False,
    )

    response = auth_as(admin_user).post(
        f"/api/admin/masters/{master.id}/quality/",
        {
            "master_tier": "senior",
        },
        format="json",
    )
    assert response.status_code == 200
    assert response.data["master_tier"] == "senior"
    assert response.data["master_level"] == "senior"
    assert response.data["master_specializations"] == ""
    assert response.data["master_quality_approved"] is True


@pytest.mark.django_db
def test_notify_new_appointment_targets_active_masters_with_telegram(client_user):
    master_allowed = User.objects.create_user(
        username="master_allowed",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
        master_quality_approved=True,
        master_level=MasterLevelChoices.SENIOR,
        telegram_id=11111111,
    )
    User.objects.create_user(
        username="master_pending_quality_2",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
        master_quality_approved=False,
        telegram_id=22222222,
    )
    User.objects.create_user(
        username="master_trainee_2",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
        master_quality_approved=True,
        master_level=MasterLevelChoices.TRAINEE,
        telegram_id=33333333,
    )
    appointment = Appointment.objects.create(
        client=client_user,
        brand="Xiaomi",
        model="Redmi",
        lock_type="PIN",
        has_pc=True,
        description="desc",
    )

    with patch("apps.accounts.notifications.send_telegram_message", return_value=True) as telegram_mock:
        sent = notify_masters_about_new_appointment(appointment)

    assert sent == 3
    assert telegram_mock.call_count == 3
    recipient_ids = {call.args[0] for call in telegram_mock.call_args_list}
    assert recipient_ids == {master_allowed.telegram_id, 22222222, 33333333}


@pytest.mark.django_db
def test_status_change_is_forwarded_to_client_telegram(client_user, master_user):
    client_user.telegram_id = 222333444
    client_user.save(update_fields=["telegram_id", "updated_at"])
    appointment = Appointment.objects.create(
        client=client_user,
        brand="Samsung",
        model="A50",
        lock_type="PIN",
        has_pc=True,
        description="desc",
    )

    with patch("apps.accounts.notifications.send_telegram_message", return_value=True) as tg_mock:
        response = auth_as(master_user).post(f"/api/appointments/{appointment.id}/take/")
        assert response.status_code == 200
        tg_mock.assert_called()
        args, _ = tg_mock.call_args
        assert args[0] == 222333444
        assert f"Р·Р°СЏРІРєРµ #{appointment.id}".lower() in args[1].lower()
        assert "РЎС‚Р°С‚СѓСЃ:" in args[1]


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
def test_master_message_is_forwarded_to_client_telegram(client_user, master_user):
    client_user.telegram_id = 123456789
    client_user.save(update_fields=["telegram_id", "updated_at"])

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

    with patch("apps.chat.services.send_telegram_message", return_value=True) as telegram_mock:
        response = auth_as(master_user).post(
            f"/api/appointments/{appointment.id}/messages/",
            {"text": "РџСЂРѕРІРµСЂРёР», РјРѕР¶РЅРѕ РїСЂРѕРґРѕР»Р¶Р°С‚СЊ"},
            format="json",
        )
        assert response.status_code == 201
        telegram_mock.assert_called_once()
        args, _ = telegram_mock.call_args
        assert args[0] == 123456789
        assert f"Р·Р°СЏРІРєРµ #{appointment.id}".lower() in args[1].lower()


@pytest.mark.django_db
def test_client_message_is_forwarded_to_master_telegram(client_user, master_user):
    master_user.telegram_id = 987654321
    master_user.save(update_fields=["telegram_id", "updated_at"])

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

    with patch("apps.chat.services.send_telegram_message", return_value=True) as telegram_mock:
        response = auth_as(client_user).post(
            f"/api/appointments/{appointment.id}/messages/",
            {"text": "Р—РґСЂР°РІСЃС‚РІСѓР№С‚Рµ, РіРѕС‚РѕРІ Рє РїРѕРґРєР»СЋС‡РµРЅРёСЋ"},
            format="json",
        )
        assert response.status_code == 201
        telegram_mock.assert_called()
        args, _ = telegram_mock.call_args
        assert args[0] == 987654321
        assert f"Р·Р°СЏРІРєРµ #{appointment.id}".lower() in args[1].lower()


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
            "first_name": "РРІР°РЅ",
            "last_name": "РђРґРјРёРЅ",
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
        "bank_requisites": "РЎС‡РµС‚ 123",
        "crypto_requisites": "USDT TRC20 ...",
        "instructions": "РћРїР»Р°С‚РёС‚Рµ Рё РїСЂРёР»РѕР¶РёС‚Рµ С‡РµРє.",
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
        {"signal": "need_help", "comment": "РќРµ РїРѕРЅРёРјР°СЋ СЃР»РµРґСѓСЋС‰РёР№ С€Р°Рі"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["ok"] is True

    events_response = auth_as(client_user).get(f"/api/appointments/{appointment.id}/events/")
    assert events_response.status_code == 200
    assert any(item["event_type"] == "client_signal" for item in events_response.data)

    note = events_response.data[0]["note"]
    assert "РљР»РёРµРЅС‚ РїСЂРѕСЃРёС‚ РїРѕРјРѕС‰СЊ" in note

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
        contact_phone="+79001112233",
        description="РџРѕРІС‚РѕСЂРЅР°СЏ РґРёР°РіРЅРѕСЃС‚РёРєР°",
        rustdesk_id="123 456 789",
        rustdesk_password="pass-001",
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
    assert repeated.contact_phone == source.contact_phone
    assert repeated.rustdesk_id == source.rustdesk_id
    assert repeated.rustdesk_password == source.rustdesk_password
    assert repeated.status == AppointmentStatusChoices.NEW


@pytest.mark.django_db
def test_register_flow(api_client, monkeypatch, settings):
    settings.EMAIL_HOST = "mail.unlocktool.ru"
    settings.DEFAULT_FROM_EMAIL = "no-reply@example.com"

    def fake_send_mail(subject, message, from_email, recipient_list, fail_silently=False):
        return 1

    monkeypatch.setattr("apps.accounts.views.send_mail", fake_send_mail)

    payload = {
        "username": "new_client",
        "email": "new_client@example.com",
        "password": "safe-pass-123",
        "password_confirm": "safe-pass-123",
    }
    response = api_client.post("/api/auth/register/", payload, format="json")
    assert response.status_code == 201
    assert response.data["verification_sent"] is True

    created = User.objects.get(username=payload["username"])
    assert created.role == RoleChoices.CLIENT
    assert created.is_active is False
    assert created.is_email_verified is False

    duplicate = api_client.post("/api/auth/register/", payload, format="json")
    assert duplicate.status_code == 400

@pytest.mark.django_db
def test_banned_client_is_blocked_from_functional_api_but_can_read_me(client_user):
    client_user.is_banned = True
    client_user.ban_reason = "РќР°СЂСѓС€РµРЅРёРµ РїСЂР°РІРёР» РїР»Р°С‚С„РѕСЂРјС‹"
    client_user.save(update_fields=["is_banned", "ban_reason", "updated_at"])

    list_response = auth_as(client_user).get("/api/appointments/my/")
    assert list_response.status_code == 403
    assert "Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅ" in str(list_response.data.get("detail", "")).lower()

    dashboard_response = auth_as(client_user).get("/api/dashboard/")
    assert dashboard_response.status_code == 403

    me_response = auth_as(client_user).get("/api/me/")
    assert me_response.status_code == 200
    assert me_response.data["user"]["is_banned"] is True
    assert "РќР°СЂСѓС€РµРЅРёРµ РїСЂР°РІРёР» РїР»Р°С‚С„РѕСЂРјС‹" in me_response.data["user"]["ban_reason"]


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
        "contact_phone": "+79001112233",
        "description": "desc",
        "rustdesk_id": "987 654 321",
        "rustdesk_password": "test-pass",
    }

    with patch("apps.appointments.views.notify_masters_about_new_appointment") as notify_mock:
        response = auth_as(client_user).post("/api/appointments/", payload, format="json")
        assert response.status_code == 201
        notify_mock.assert_called_once()
        assert response.data["rustdesk_id"] == "987 654 321"


@pytest.mark.django_db
def test_create_appointment_ignores_wholesale_fields_from_payload(client_user):
    service_photo = SimpleUploadedFile("service1.jpg", b"photo-data", content_type="image/jpeg")
    payload = {
        "brand": "Samsung",
        "model": "A50",
        "lock_type": "PIN",
        "has_pc": True,
        "description": "desc",
        "rustdesk_id": "987654321",
        "rustdesk_password": "test-pass",
        "is_wholesale_request": True,
        "is_service_center": True,
        "wholesale_company_name": "FixLab",
        "wholesale_comment": "15+ заявок в месяц",
        "wholesale_service_details": "Сервисный центр с потоком заявок, работаем с Samsung/Xiaomi/Realme.",
        "wholesale_service_photo_1": service_photo,
    }

    response = auth_as(client_user).post("/api/appointments/", payload, format="multipart")
    assert response.status_code == 201
    assert response.data["is_wholesale_request"] is False

    client_user.refresh_from_db()
    assert client_user.is_service_center is False
    assert client_user.wholesale_status == WholesaleStatusChoices.NONE
    assert client_user.wholesale_company_name == ""


@pytest.mark.django_db
def test_create_appointment_auto_marks_wholesale_for_approved_service(client_user):
    client_user.is_service_center = True
    client_user.wholesale_status = WholesaleStatusChoices.APPROVED
    client_user.wholesale_discount_percent = 20
    client_user.save(
        update_fields=["is_service_center", "wholesale_status", "wholesale_discount_percent", "updated_at"]
    )

    payload = {
        "brand": "Samsung",
        "model": "A55",
        "lock_type": "PIN",
        "has_pc": True,
        "description": "desc",
        "rustdesk_id": "123456789",
        "rustdesk_password": "test-pass",
    }

    response = auth_as(client_user).post("/api/appointments/", payload, format="json")
    assert response.status_code == 201
    assert response.data["is_wholesale_request"] is True


@pytest.mark.django_db
def test_create_appointment_allows_empty_rudesktop_credentials(client_user):
    payload = {
        "brand": "Samsung",
        "model": "A50",
        "lock_type": "PIN",
        "has_pc": True,
        "description": "desc",
    }

    response = auth_as(client_user).post("/api/appointments/", payload, format="json")
    assert response.status_code == 201
    assert response.data["rustdesk_id"] == ""
    assert response.data["rustdesk_password"] == ""


@pytest.mark.django_db
def test_client_can_update_rudesktop_after_appointment_created(client_user, master_user):
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Samsung",
        model="A50",
        lock_type="PIN",
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

    forbidden_response = auth_as(master_user).post(
        f"/api/appointments/{appointment.id}/client-access/",
        {"rustdesk_id": "999888777"},
        format="json",
    )
    assert forbidden_response.status_code == 403


@pytest.mark.django_db
def test_master_can_list_own_reviews(client_user, master_user):
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Samsung",
        model="A50",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.COMPLETED,
    )
    Review.objects.create(
        appointment=appointment,
        author=client_user,
        target=master_user,
        review_type=ReviewTypeChoices.MASTER_REVIEW,
        rating=5,
        comment="РћС‚Р»РёС‡РЅРѕ",
    )

    response = auth_as(master_user).get("/api/reviews/my/")
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["target"] == master_user.id
    assert response.data[0]["review_type"] == ReviewTypeChoices.MASTER_REVIEW


@pytest.mark.django_db
def test_admin_can_list_all_reviews_with_filters(client_user, master_user, admin_user):
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Samsung",
        model="A50",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.COMPLETED,
    )
    Review.objects.create(
        appointment=appointment,
        author=client_user,
        target=master_user,
        review_type=ReviewTypeChoices.MASTER_REVIEW,
        rating=5,
        comment="РЎСѓРїРµСЂ",
    )
    Review.objects.create(
        appointment=appointment,
        author=master_user,
        target=client_user,
        review_type=ReviewTypeChoices.CLIENT_REVIEW,
        rating=3,
        comment="РћРє",
    )

    response = auth_as(admin_user).get("/api/admin/reviews/")
    assert response.status_code == 200
    assert len(response.data) == 2

    filtered = auth_as(admin_user).get("/api/admin/reviews/", {"review_type": ReviewTypeChoices.MASTER_REVIEW})
    assert filtered.status_code == 200
    assert len(filtered.data) == 1
    assert filtered.data[0]["review_type"] == ReviewTypeChoices.MASTER_REVIEW


@pytest.mark.django_db
def test_client_can_submit_wholesale_request(client_user):
    service_photo = SimpleUploadedFile("service.jpg", b"photo-data", content_type="image/jpeg")
    response = auth_as(client_user).post(
        "/api/wholesale/request/",
        {
            "is_service_center": True,
            "wholesale_company_name": "FixLab",
            "wholesale_comment": "15 заявок в месяц",
            "wholesale_service_details": "Сервисный центр с потоком 15+ заявок в месяц, специализация Samsung и Xiaomi",
            "wholesale_service_photo_1": service_photo,
        },
        format="multipart",
    )
    assert response.status_code == 200
    assert response.data["wholesale_status"] == WholesaleStatusChoices.PENDING

    client_user.refresh_from_db()
    assert client_user.is_service_center is True
    assert client_user.wholesale_status == WholesaleStatusChoices.PENDING
    assert client_user.wholesale_company_name == "FixLab"
    assert client_user.wholesale_service_details
    assert bool(client_user.wholesale_service_photo_1)


@pytest.mark.django_db
def test_admin_can_review_wholesale_request(admin_user, client_user):
    client_user.is_service_center = True
    client_user.wholesale_status = WholesaleStatusChoices.PENDING
    client_user.wholesale_company_name = "FixLab"
    client_user.save(
        update_fields=["is_service_center", "wholesale_status", "wholesale_company_name", "updated_at"]
    )

    response = auth_as(admin_user).post(
        f"/api/admin/wholesale-requests/{client_user.id}/review/",
        {"decision": "approve", "review_comment": "Подтвержден сервисный центр"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["wholesale_status"] == WholesaleStatusChoices.APPROVED
    assert "wholesale_discount_percent" not in response.data

    client_user.refresh_from_db()
    assert client_user.wholesale_status == WholesaleStatusChoices.APPROVED
    assert client_user.wholesale_discount_percent == 0


@pytest.mark.django_db
def test_set_price_does_not_apply_wholesale_discount_automatically(client_user, master_user):
    client_user.is_service_center = True
    client_user.wholesale_status = WholesaleStatusChoices.APPROVED
    client_user.wholesale_discount_percent = 25
    client_user.save(
        update_fields=["is_service_center", "wholesale_status", "wholesale_discount_percent", "updated_at"]
    )

    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Samsung",
        model="A50",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.IN_REVIEW,
        is_wholesale_request=True,
    )

    response = auth_as(master_user).post(
        f"/api/appointments/{appointment.id}/set-price/",
        {"total_price": 10000},
    )
    assert response.status_code == 200

    appointment.refresh_from_db()
    assert appointment.wholesale_base_price is None
    assert appointment.wholesale_discount_percent_applied == 0
    assert appointment.total_price == 10000
    assert appointment.status == AppointmentStatusChoices.AWAITING_PAYMENT


