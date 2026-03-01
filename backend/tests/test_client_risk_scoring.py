from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User
from apps.accounts.services import compute_client_risk, recalculate_client_stats
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.reviews.models import BehaviorFlag, BehaviorFlagCode, Review, ReviewTypeChoices


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_compute_client_risk_score_range_and_levels():
    user = User.objects.create_user(username="risk-user", password="x", role=RoleChoices.CLIENT)
    user.date_joined = timezone.now() - timedelta(days=60)
    user.save(update_fields=["date_joined", "updated_at"])

    low_score, low_level = compute_client_risk(
        client=user,
        completed=10,
        cancellation_rate=0.0,
        average_rating=5.0,
        negative_flags=0,
    )
    assert low_score == 0
    assert low_level == "low"

    critical_score, critical_level = compute_client_risk(
        client=user,
        completed=0,
        cancellation_rate=1.0,
        average_rating=1.0,
        negative_flags=5,
    )
    assert critical_score == 100
    assert critical_level == "critical"


@pytest.mark.django_db
def test_recalculate_client_stats_updates_risk_fields():
    client_user = User.objects.create_user(username="risk-client", password="x", role=RoleChoices.CLIENT)
    master_user = User.objects.create_user(username="risk-master", password="x", role=RoleChoices.MASTER, is_master_active=True)

    Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Apple",
        model="iPhone 13",
        lock_type="PIN",
        has_pc=True,
        description="done",
        status=AppointmentStatusChoices.COMPLETED,
    )
    completed_appt = Appointment.objects.first()
    Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Apple",
        model="iPhone 14",
        lock_type="PIN",
        has_pc=True,
        description="cancelled",
        status=AppointmentStatusChoices.CANCELLED,
    )

    flag, _ = BehaviorFlag.objects.get_or_create(
        code=BehaviorFlagCode.DIFFICULT_CLIENT,
        defaults={"label": "Сложный клиент"},
    )
    review = Review.objects.create(
        appointment=completed_appt,
        author=master_user,
        target=client_user,
        review_type=ReviewTypeChoices.CLIENT_REVIEW,
        rating=2,
        comment="Трудный кейс",
    )
    review.behavior_flags.add(flag)

    stats = recalculate_client_stats(client_user)
    assert 0 <= stats.risk_score <= 100
    assert stats.risk_level in {"low", "medium", "high", "critical"}
    assert stats.risk_updated_at is not None


@pytest.mark.django_db
def test_risk_exposed_in_me_appointment_detail_and_admin_users():
    client_user = User.objects.create_user(username="risk-client-2", password="x", role=RoleChoices.CLIENT)
    master_user = User.objects.create_user(username="risk-master-2", password="x", role=RoleChoices.MASTER, is_master_active=True)
    admin_user = User.objects.create_user(username="risk-admin", password="x", role=RoleChoices.ADMIN, is_staff=True)
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Samsung",
        model="S23",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.IN_REVIEW,
    )
    recalculate_client_stats(client_user)

    me_response = auth_as(client_user).get("/api/me/")
    assert me_response.status_code == 200
    assert "risk_level" in me_response.data["user"]["client_stats"]
    assert "risk_score" in me_response.data["user"]["client_stats"]

    detail_response = auth_as(master_user).get(f"/api/appointments/{appointment.id}/")
    assert detail_response.status_code == 200
    assert detail_response.data["client_risk_level"] is not None
    assert detail_response.data["client_risk_score"] is not None

    admin_users_response = auth_as(admin_user).get("/api/admin/users/all/")
    assert admin_users_response.status_code == 200
    client_payload = next((item for item in admin_users_response.data if item["id"] == client_user.id), None)
    assert client_payload is not None
    assert "client_stats" in client_payload
    assert client_payload["client_stats"]["risk_level"] is not None
