from __future__ import annotations

from contextlib import nullcontext

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_admin_can_send_email_to_selected_clients(monkeypatch, settings):
    admin = User.objects.create_user(
        username="email-admin",
        password="x",
        role=RoleChoices.ADMIN,
        is_staff=True,
    )
    client_with_email = User.objects.create_user(
        username="client-email",
        password="x",
        role=RoleChoices.CLIENT,
        email="client@example.com",
    )
    client_without_email = User.objects.create_user(
        username="client-no-email",
        password="x",
        role=RoleChoices.CLIENT,
        email="",
    )

    settings.EMAIL_HOST = "smtp.example.com"
    settings.DEFAULT_FROM_EMAIL = "no-reply@example.com"

    sent_messages = []

    def fake_get_connection(*args, **kwargs):
        return nullcontext()

    def fake_send_mail(subject, message, from_email, recipient_list, fail_silently=False, connection=None):
        sent_messages.append(
            {
                "subject": subject,
                "message": message,
                "from_email": from_email,
                "recipient_list": recipient_list,
            }
        )
        return 1

    monkeypatch.setattr("apps.adminpanel.views.get_connection", fake_get_connection)
    monkeypatch.setattr("apps.adminpanel.views.send_mail", fake_send_mail)

    response = auth_as(admin).post(
        "/api/admin/clients/send-email/",
        {
            "subject": "Service update",
            "message": "Your request is being processed.",
            "user_ids": [client_with_email.id, client_without_email.id],
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.data["requested_total"] == 2
    assert response.data["with_email_total"] == 1
    assert response.data["sent_count"] == 1
    assert response.data["skipped_without_email"] == [client_without_email.id]
    assert response.data["failed"] == []
    assert sent_messages == [
        {
            "subject": "Service update",
            "message": "Your request is being processed.",
            "from_email": "no-reply@example.com",
            "recipient_list": ["client@example.com"],
        }
    ]
