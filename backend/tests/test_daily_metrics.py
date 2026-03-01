from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.platform.analytics import compute_daily_metrics_for_date


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_compute_daily_metrics_and_admin_api():
    admin_user = User.objects.create_user(username="metrics-admin", password="x", role=RoleChoices.ADMIN, is_staff=True)
    client_user = User.objects.create_user(username="metrics-client", password="x", role=RoleChoices.CLIENT)
    master_user = User.objects.create_user(username="metrics-master", password="x", role=RoleChoices.MASTER, is_master_active=True)

    now = timezone.now()
    appointment = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Apple",
        model="iPhone",
        lock_type="PIN",
        has_pc=True,
        description="desc",
        status=AppointmentStatusChoices.COMPLETED,
        total_price=5000,
        taken_at=now - timedelta(minutes=50),
        started_at=now - timedelta(minutes=30),
        completed_at=now - timedelta(minutes=5),
        payment_confirmed_at=now - timedelta(minutes=35),
    )
    appointment.created_at = now - timedelta(hours=1)
    appointment.save(update_fields=["created_at", "updated_at"])

    today = timezone.localdate()
    metrics = compute_daily_metrics_for_date(today)
    assert metrics.date == today
    assert metrics.new_appointments >= 1
    assert metrics.paid_appointments >= 1
    assert metrics.completed_appointments >= 1
    assert metrics.gmv_total >= 5000
    assert metrics.avg_time_to_first_response >= 0
    assert metrics.avg_time_to_complete >= 0

    response = auth_as(admin_user).get(f"/api/v1/admin/metrics/daily/?from={today.isoformat()}&to={today.isoformat()}")
    assert response.status_code == 200
    assert len(response.data) >= 1
    assert response.data[0]["date"] == today.isoformat()
