from __future__ import annotations

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User, WholesaleStatusChoices
from apps.appointments.models import Appointment, AppointmentStatusChoices


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(username="schema-admin", password="x", role=RoleChoices.ADMIN, is_staff=True)


@pytest.fixture
def client_user(db):
    return User.objects.create_user(username="portal-client", password="x", role=RoleChoices.CLIENT)


@pytest.fixture
def master_user(db):
    return User.objects.create_user(
        username="portal-master",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
        master_quality_approved=True,
    )


@pytest.mark.django_db
def test_admin_can_get_rule_schema(admin_user):
    response = auth_as(admin_user).get("/api/v1/admin/rules/schema/")

    assert response.status_code == 200
    assert len(response.data["event_types"]) >= 5
    assert any(item["value"] == "appointment.created" for item in response.data["event_types"])
    assert any(item["value"] == "appointment.status" for item in response.data["condition_fields"])
    assert any(item["value"] == "change_status" for item in response.data["actions"])
    assert any(item["value"] == "admins" for item in response.data["notification_targets"])


@pytest.mark.django_db
def test_client_can_get_wholesale_portal_summary(client_user, master_user):
    client_user.is_service_center = True
    client_user.wholesale_status = WholesaleStatusChoices.APPROVED
    client_user.wholesale_company_name = "FixLab"
    client_user.wholesale_city = "Москва"
    client_user.wholesale_address = "ул. Тестовая, 10"
    client_user.save(
        update_fields=[
            "is_service_center",
            "wholesale_status",
            "wholesale_company_name",
            "wholesale_city",
            "wholesale_address",
            "updated_at",
        ]
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
        is_wholesale_request=True,
    )

    response = auth_as(client_user).get("/api/wholesale/portal/summary/")

    assert response.status_code == 200
    assert response.data["wholesale"]["wholesale_status"] == WholesaleStatusChoices.APPROVED
    assert response.data["counts"]["orders_total"] == 1
    assert response.data["counts"]["orders_active"] == 1
    assert response.data["latest_order"]["id"] == appointment.id


@pytest.mark.django_db
def test_client_can_filter_wholesale_portal_orders(client_user):
    Appointment.objects.create(
        client=client_user,
        brand="Samsung",
        model="A10",
        lock_type="PIN",
        has_pc=True,
        description="active",
        status=AppointmentStatusChoices.NEW,
    )
    completed = Appointment.objects.create(
        client=client_user,
        brand="Samsung",
        model="A11",
        lock_type="PIN",
        has_pc=True,
        description="done",
        status=AppointmentStatusChoices.COMPLETED,
        is_wholesale_request=True,
    )

    response = auth_as(client_user).get("/api/wholesale/portal/orders/", {"status": AppointmentStatusChoices.COMPLETED})

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["id"] == completed.id


@pytest.mark.django_db
def test_wholesale_portal_summary_hides_non_b2b_orders(client_user, master_user):
    client_user.is_service_center = True
    client_user.wholesale_status = WholesaleStatusChoices.APPROVED
    client_user.save(update_fields=["is_service_center", "wholesale_status", "updated_at"])

    Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Samsung",
        model="Retail",
        lock_type="PIN",
        has_pc=True,
        description="retail",
        status=AppointmentStatusChoices.IN_PROGRESS,
        is_wholesale_request=False,
    )
    b2b_appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Samsung",
        model="B2B",
        lock_type="PIN",
        has_pc=True,
        description="b2b",
        status=AppointmentStatusChoices.NEW,
        is_wholesale_request=True,
    )

    response = auth_as(client_user).get("/api/wholesale/portal/summary/")

    assert response.status_code == 200
    assert response.data["counts"]["orders_total"] == 1
    assert response.data["latest_order"]["id"] == b2b_appointment.id


@pytest.mark.django_db
def test_wholesale_portal_orders_hides_non_b2b_orders(client_user):
    Appointment.objects.create(
        client=client_user,
        brand="Samsung",
        model="Retail",
        lock_type="PIN",
        has_pc=True,
        description="retail",
        status=AppointmentStatusChoices.COMPLETED,
        is_wholesale_request=False,
    )
    b2b_completed = Appointment.objects.create(
        client=client_user,
        brand="Samsung",
        model="B2B",
        lock_type="PIN",
        has_pc=True,
        description="b2b",
        status=AppointmentStatusChoices.COMPLETED,
        is_wholesale_request=True,
    )

    response = auth_as(client_user).get("/api/wholesale/portal/orders/", {"status": AppointmentStatusChoices.COMPLETED})

    assert response.status_code == 200
    assert [item["id"] for item in response.data] == [b2b_completed.id]


@pytest.mark.django_db
def test_non_client_cannot_open_wholesale_portal(master_user):
    response = auth_as(master_user).get("/api/wholesale/portal/summary/")

    assert response.status_code == 403
