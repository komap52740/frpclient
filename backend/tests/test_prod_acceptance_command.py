from __future__ import annotations

import io
import json

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.accounts.management.commands.run_prod_acceptance import Command
from apps.accounts.models import RoleChoices, User


def _create_temp_client(*_args, **_kwargs):
    user = User.objects.create_user(
        username="smoke_test_command_user",
        email="smoke_test_command_user@example.invalid",
        password="temporary-pass-123",
        role=RoleChoices.CLIENT,
        is_active=True,
        is_email_verified=True,
    )
    return user, "temporary-pass-123"


@pytest.mark.django_db
def test_run_prod_acceptance_cleans_up_temp_user_on_success(monkeypatch):
    monkeypatch.setattr(Command, "_create_temp_client", lambda self, username_prefix: _create_temp_client())
    monkeypatch.setattr(
        "apps.accounts.management.commands.run_prod_acceptance.run_acceptance",
        lambda **_kwargs: {
            "ok": True,
            "base_url": "https://frpclient.ru/",
            "username": "smoke_test_command_user",
            "appointment_id": 1,
            "event_type": "appointment.client_access_updated",
        },
    )

    stdout = io.StringIO()
    call_command("run_prod_acceptance", stdout=stdout)

    payload = json.loads(stdout.getvalue())
    assert payload["ok"] is True
    assert payload["cleanup"]["users_deleted"] >= 1
    assert payload["cleanup"]["appointment_ids"] == []
    assert not User.objects.filter(username="smoke_test_command_user").exists()


@pytest.mark.django_db
def test_run_prod_acceptance_failure_with_keep_artifacts_does_not_leak_password(monkeypatch):
    monkeypatch.setattr(Command, "_create_temp_client", lambda self, username_prefix: _create_temp_client())

    def _raise_failure(**_kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(
        "apps.accounts.management.commands.run_prod_acceptance.run_acceptance",
        _raise_failure,
    )

    with pytest.raises(CommandError) as exc_info:
        call_command("run_prod_acceptance", keep_artifacts=True)

    message = str(exc_info.value)
    assert "temporary-pass-123" not in message
    assert "password=" not in message
    assert "username=smoke_test_command_user" in message
    assert User.objects.filter(username="smoke_test_command_user").exists()


@pytest.mark.django_db
def test_run_prod_acceptance_failure_cleans_up_temp_user(monkeypatch):
    monkeypatch.setattr(Command, "_create_temp_client", lambda self, username_prefix: _create_temp_client())

    def _raise_failure(**_kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(
        "apps.accounts.management.commands.run_prod_acceptance.run_acceptance",
        _raise_failure,
    )

    with pytest.raises(CommandError) as exc_info:
        call_command("run_prod_acceptance")

    message = str(exc_info.value)
    assert "temporary-pass-123" not in message
    assert "acceptance failed and artifacts were cleaned: boom" in message
    assert not User.objects.filter(username="smoke_test_command_user").exists()
