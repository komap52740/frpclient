from __future__ import annotations

import json

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.accounts.models import User, WholesalePriorityChoices, WholesaleStatusChoices
from apps.appointments.models import Appointment


@pytest.mark.django_db
def test_seed_playwright_smoke_creates_approved_b2b_client(capsys):
    call_command(
        "seed_playwright_smoke",
        username="pw_smoke",
        password="PlaywrightPass123!",
        email="pw-smoke@example.invalid",
    )

    user = User.objects.get(username="pw_smoke")
    admin_user = User.objects.get(username="playwright_admin")
    payload = json.loads(capsys.readouterr().out.strip())

    assert payload["username"] == "pw_smoke"
    assert payload["admin_username"] == "playwright_admin"
    assert user.check_password("PlaywrightPass123!")
    assert admin_user.check_password("PlaywrightAdmin123!")
    assert admin_user.role == "admin"
    assert admin_user.is_staff is True
    assert user.is_service_center is True
    assert user.wholesale_status == WholesaleStatusChoices.APPROVED
    assert user.wholesale_priority == WholesalePriorityChoices.PRIORITY
    assert user.is_email_verified is True


@pytest.mark.django_db
def test_seed_playwright_smoke_can_reset_user_appointments():
    user = User.objects.create_user(
        username="pw_reset",
        password="old-pass",
        email="pw-reset@example.invalid",
        role="client",
        is_service_center=True,
        wholesale_status=WholesaleStatusChoices.APPROVED,
        is_email_verified=True,
        email_verified_at=timezone.now(),
    )
    Appointment.objects.create(
        client=user,
        brand="Samsung",
        model="A55",
        lock_type="GOOGLE",
        has_pc=True,
        description="old appointment",
    )

    call_command(
        "seed_playwright_smoke",
        username="pw_reset",
        password="PlaywrightPass123!",
        email="pw-reset@example.invalid",
        reset_appointments=True,
    )

    user.refresh_from_db()
    assert user.check_password("PlaywrightPass123!")
    assert Appointment.objects.filter(client=user).count() == 0
