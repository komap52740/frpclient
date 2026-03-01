from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import MasterStats, RoleChoices, User
from apps.accounts.services import recalculate_master_stats
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.reviews.models import Review, ReviewTypeChoices


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_recalculate_master_stats_computes_score():
    master = User.objects.create_user(username="score-master", password="x", role=RoleChoices.MASTER, is_master_active=True)
    client = User.objects.create_user(username="score-client", password="x", role=RoleChoices.CLIENT)

    completed = Appointment.objects.create(
        client=client,
        assigned_master=master,
        brand="Apple",
        model="iPhone",
        lock_type="PIN",
        has_pc=True,
        description="done",
        status=AppointmentStatusChoices.COMPLETED,
    )
    cancelled = Appointment.objects.create(
        client=client,
        assigned_master=master,
        brand="Samsung",
        model="S22",
        lock_type="PIN",
        has_pc=True,
        description="cancelled",
        status=AppointmentStatusChoices.DECLINED_BY_MASTER,
    )
    now = timezone.now()
    completed.created_at = now - timedelta(hours=2)
    completed.taken_at = now - timedelta(hours=1, minutes=30)
    completed.save(update_fields=["created_at", "taken_at", "updated_at"])
    cancelled.created_at = now - timedelta(hours=1)
    cancelled.taken_at = now - timedelta(minutes=50)
    cancelled.save(update_fields=["created_at", "taken_at", "updated_at"])

    Review.objects.create(
        appointment=completed,
        author=client,
        target=master,
        review_type=ReviewTypeChoices.MASTER_REVIEW,
        rating=4,
        comment="Хорошо",
    )

    stats = recalculate_master_stats(master)
    assert 0 <= stats.master_score <= 100
    assert 0 <= stats.completion_rate <= 1
    assert stats.avg_rating == 4.0
    assert stats.score_updated_at is not None


@pytest.mark.django_db
def test_master_dashboard_contains_master_score():
    master = User.objects.create_user(username="dash-master", password="x", role=RoleChoices.MASTER, is_master_active=True)
    response = auth_as(master).get("/api/dashboard/")
    assert response.status_code == 200
    assert response.data["role"] == "master"
    assert "master_score" in response.data["counts"]


@pytest.mark.django_db
def test_admin_masters_sort_and_filter_by_master_score():
    admin = User.objects.create_user(username="masters-admin", password="x", role=RoleChoices.ADMIN, is_staff=True)
    master_low = User.objects.create_user(username="master-low", password="x", role=RoleChoices.MASTER, is_master_active=True)
    master_high = User.objects.create_user(username="master-high", password="x", role=RoleChoices.MASTER, is_master_active=True)

    MasterStats.objects.create(user=master_low, master_score=30)
    MasterStats.objects.create(user=master_high, master_score=90)

    ordered = auth_as(admin).get("/api/admin/masters/?ordering=-master_score")
    assert ordered.status_code == 200
    assert ordered.data[0]["id"] == master_high.id

    filtered = auth_as(admin).get("/api/admin/masters/?min_score=80")
    assert filtered.status_code == 200
    ids = [item["id"] for item in filtered.data]
    assert master_high.id in ids
    assert master_low.id not in ids
