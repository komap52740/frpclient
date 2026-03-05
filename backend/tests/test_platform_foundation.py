from __future__ import annotations

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User
from apps.appointments.models import Appointment
from apps.platform.models import FeatureFlag, FeatureFlagScope, Notification
from apps.platform.services import emit_event, is_feature_enabled


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_emit_event_stores_platform_event():
    user = User.objects.create_user(username="evt-user", password="x", role=RoleChoices.CLIENT)
    appointment = Appointment.objects.create(
        client=user,
        brand="Samsung",
        model="A50",
        lock_type="PIN",
        has_pc=True,
        description="desc",
    )

    event = emit_event(
        "appointment.created",
        appointment,
        actor=user,
        payload={"status": appointment.status},
    )

    assert event.event_type == "appointment.created"
    assert event.entity_type == "Appointment"
    assert event.entity_id == str(appointment.id)
    assert event.actor_id == user.id
    assert event.payload["status"] == "NEW"


@pytest.mark.django_db
def test_feature_flag_evaluation_basic():
    client_user = User.objects.create_user(username="client-flag", password="x", role=RoleChoices.CLIENT)
    master_user = User.objects.create_user(username="master-flag", password="x", role=RoleChoices.MASTER, is_master_active=True, master_quality_approved=True)

    global_flag = FeatureFlag.objects.create(
        name="global_on",
        is_enabled=True,
        scope=FeatureFlagScope.GLOBAL,
        rollout_percentage=100,
    )
    assert global_flag.evaluate(user=client_user) is True
    assert is_feature_enabled("global_on", user=client_user) is True

    per_user_flag = FeatureFlag.objects.create(
        name="user_allowlist",
        is_enabled=True,
        scope=FeatureFlagScope.PER_USER,
        rollout_percentage=0,
    )
    per_user_flag.users.add(client_user)
    assert is_feature_enabled("user_allowlist", user=client_user) is True
    assert is_feature_enabled("user_allowlist", user=master_user) is False

    per_role_flag = FeatureFlag.objects.create(
        name="masters_only",
        is_enabled=True,
        scope=FeatureFlagScope.PER_ROLE,
        rollout_percentage=100,
        conditions={"roles": ["master"]},
    )
    assert is_feature_enabled("masters_only", user=master_user) is True
    assert is_feature_enabled("masters_only", user=client_user) is False


@pytest.mark.django_db
def test_notification_unread_count_and_mark_read():
    user = User.objects.create_user(username="notif-user", password="x", role=RoleChoices.CLIENT)
    client = auth_as(user)

    first = Notification.objects.create(user=user, type="system", title="one", message="m1")
    Notification.objects.create(user=user, type="system", title="two", message="m2", is_read=True)

    unread_response = client.get("/api/notifications/unread-count/")
    assert unread_response.status_code == 200
    assert unread_response.data["unread_count"] == 1

    mark_response = client.post(
        "/api/notifications/mark-read/",
        {"notification_ids": [first.id]},
        format="json",
    )
    assert mark_response.status_code == 200
    assert mark_response.data["updated"] == 1

    unread_response_after = client.get("/api/notifications/unread-count/")
    assert unread_response_after.status_code == 200
    assert unread_response_after.data["unread_count"] == 0


@pytest.mark.django_db
def test_notification_list_scopes_by_role_and_related_appointment():
    client_user = User.objects.create_user(username="notif-client", password="x", role=RoleChoices.CLIENT)
    other_client = User.objects.create_user(username="notif-client-2", password="x", role=RoleChoices.CLIENT)
    viewer = auth_as(client_user)

    own_appointment = Appointment.objects.create(
        client=client_user,
        brand="Samsung",
        model="A50",
        lock_type="PIN",
        has_pc=True,
        description="desc",
    )
    foreign_appointment = Appointment.objects.create(
        client=other_client,
        brand="Xiaomi",
        model="Note",
        lock_type="PIN",
        has_pc=True,
        description="desc",
    )

    visible = Notification.objects.create(
        user=client_user,
        type="appointment",
        title="visible",
        payload={
            "appointment_id": own_appointment.id,
            "target_role": RoleChoices.CLIENT,
            "client_id": client_user.id,
        },
    )
    Notification.objects.create(
        user=client_user,
        type="appointment",
        title="foreign-appointment",
        payload={"appointment_id": foreign_appointment.id, "target_role": RoleChoices.CLIENT, "client_id": client_user.id},
    )
    Notification.objects.create(
        user=client_user,
        type="system",
        title="wrong-role",
        payload={"target_role": RoleChoices.ADMIN},
    )
    Notification.objects.create(
        user=client_user,
        type="system",
        title="wrong-client",
        payload={"target_role": RoleChoices.CLIENT, "client_id": other_client.id},
    )

    response = viewer.get("/api/notifications/")
    assert response.status_code == 200
    ids = [item["id"] for item in response.data]
    assert visible.id in ids
    assert len(ids) == 1

