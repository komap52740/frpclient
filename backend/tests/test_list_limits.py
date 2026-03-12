from __future__ import annotations

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User, WholesaleStatusChoices
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.chat.models import MasterQuickReply, Message
from apps.platform.models import Notification


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.fixture
def client_user(db):
    user = User.objects.create_user(username="list-client", password="x", role=RoleChoices.CLIENT)
    user.is_service_center = True
    user.wholesale_status = WholesaleStatusChoices.APPROVED
    user.save(update_fields=["is_service_center", "wholesale_status", "updated_at"])
    return user


@pytest.fixture
def master_user(db):
    return User.objects.create_user(
        username="list-master",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
        master_quality_approved=True,
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(username="list-admin", password="x", role=RoleChoices.ADMIN, is_staff=True)


@pytest.mark.django_db
def test_my_appointments_supports_meta_limit_and_offset(client_user, master_user):
    for index in range(3):
        Appointment.objects.create(
            client=client_user,
            assigned_master=master_user,
            brand="Samsung",
            model=f"A{index}",
            lock_type="PIN",
            has_pc=True,
            description=f"item-{index}",
            status=AppointmentStatusChoices.IN_PROGRESS,
        )

    response = auth_as(client_user).get("/api/appointments/my/", {"limit": 1, "offset": 1, "include_meta": 1})

    assert response.status_code == 200
    assert response.data["count"] == 3
    assert response.data["limit"] == 1
    assert response.data["offset"] == 1
    assert len(response.data["results"]) == 1


@pytest.mark.django_db
def test_list_endpoint_rejects_invalid_limit(client_user):
    Appointment.objects.create(
        client=client_user,
        brand="Samsung",
        model="A50",
        lock_type="PIN",
        has_pc=True,
        description="item",
    )

    response = auth_as(client_user).get("/api/appointments/my/", {"limit": "oops"})

    assert response.status_code == 400
    assert "limit" in response.data


@pytest.mark.django_db
def test_chat_messages_reject_invalid_after_id_and_honor_limit(client_user, master_user):
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Xiaomi",
        model="Note",
        lock_type="PIN",
        has_pc=True,
        description="chat",
        status=AppointmentStatusChoices.IN_PROGRESS,
    )
    for index in range(3):
        Message.objects.create(appointment=appointment, sender=master_user, text=f"m-{index}")

    bad_response = auth_as(client_user).get(f"/api/appointments/{appointment.id}/messages/", {"after_id": "bad"})
    assert bad_response.status_code == 400
    assert "after_id" in bad_response.data

    ok_response = auth_as(client_user).get(
        f"/api/appointments/{appointment.id}/messages/",
        {"limit": 2, "include_meta": 1},
    )
    assert ok_response.status_code == 200
    assert ok_response.data["count"] == 3
    assert ok_response.data["limit"] == 2
    assert len(ok_response.data["results"]) == 2


@pytest.mark.django_db
def test_notifications_meta_response_caps_limit(client_user):
    for index in range(3):
        Notification.objects.create(user=client_user, type="system", title=f"n-{index}", message="m")

    response = auth_as(client_user).get("/api/notifications/", {"limit": 999, "include_meta": 1})

    assert response.status_code == 200
    assert response.data["count"] == 3
    assert response.data["limit"] == 200
    assert len(response.data["results"]) == 3


@pytest.mark.django_db
def test_wholesale_orders_support_meta_and_pagination(client_user):
    for index in range(2):
        Appointment.objects.create(
            client=client_user,
            brand="Samsung",
            model=f"B2B-{index}",
            lock_type="PIN",
            has_pc=True,
            description="b2b",
            status=AppointmentStatusChoices.COMPLETED,
            is_wholesale_request=True,
        )

    response = auth_as(client_user).get(
        "/api/wholesale/portal/orders/",
        {"status": AppointmentStatusChoices.COMPLETED, "limit": 1, "include_meta": 1},
    )

    assert response.status_code == 200
    assert response.data["count"] == 2
    assert response.data["limit"] == 1
    assert len(response.data["results"]) == 1


@pytest.mark.django_db
def test_admin_users_support_meta_and_offset(admin_user):
    for index in range(3):
        User.objects.create_user(username=f"user-{index}", password="x", role=RoleChoices.CLIENT)

    response = auth_as(admin_user).get("/api/admin/users/all/", {"limit": 2, "offset": 1, "include_meta": 1})

    assert response.status_code == 200
    assert response.data["count"] >= 3
    assert response.data["limit"] == 2
    assert response.data["offset"] == 1
    assert len(response.data["results"]) == 2


@pytest.mark.django_db
def test_quick_replies_support_limit(master_user):
    for index in range(3):
        MasterQuickReply.objects.create(user=master_user, command=f"q{index}", title=f"T{index}", text=f"Body {index}")

    response = auth_as(master_user).get("/api/chat/quick-replies/", {"limit": 2, "include_meta": 1})

    assert response.status_code == 200
    assert response.data["count"] == 3
    assert response.data["limit"] == 2
    assert len(response.data["results"]) == 2
