from __future__ import annotations

from io import StringIO

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.accounts.models import RoleChoices, User


@pytest.mark.django_db
def test_django_admin_is_hidden_on_main_domain():
    client = APIClient()

    response = client.get("/django-admin/login/", HTTP_HOST="frpclient.ru")

    assert response.status_code == 404


@pytest.mark.django_db
def test_django_admin_login_on_admin_host_uses_otp_form():
    client = APIClient()

    response = client.get("/django-admin/login/", HTTP_HOST="admin.frpclient.ru")

    assert response.status_code == 200
    assert b"otp_device" in response.content
    assert b"otp_token" in response.content


@pytest.mark.django_db
def test_unverified_staff_user_cannot_open_admin_index():
    user = User.objects.create_user(
        username="otp_admin_user",
        password="safe-pass-12345",
        role=RoleChoices.ADMIN,
        is_staff=True,
        is_superuser=True,
        is_active=True,
    )
    client = APIClient()
    client.force_login(user)

    response = client.get("/django-admin/", HTTP_HOST="admin.frpclient.ru")

    assert response.status_code == 302
    assert "/django-admin/login/" in response["Location"]


@pytest.mark.django_db
def test_bootstrap_admin_totp_command_creates_totp_device_and_static_token():
    from django_otp.plugins.otp_static.models import StaticToken
    from django_otp.plugins.otp_totp.models import TOTPDevice

    user = User.objects.create_user(
        username="otp_bootstrap_admin",
        password="safe-pass-12345",
        role=RoleChoices.ADMIN,
        is_staff=True,
        is_superuser=True,
        is_active=True,
    )

    stdout = StringIO()
    call_command(
        "bootstrap_admin_totp",
        "--username",
        user.username,
        "--issue-static-token",
        stdout=stdout,
    )

    output = stdout.getvalue()
    assert "config_url=" in output
    assert "emergency_static_token=" in output
    assert TOTPDevice.objects.filter(user=user, name="default", confirmed=True).exists()
    assert StaticToken.objects.filter(device__user=user, device__name="default-emergency").exists()
