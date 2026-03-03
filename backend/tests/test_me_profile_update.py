from __future__ import annotations

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_client_can_update_nickname_and_profile_photo():
    user = User.objects.create_user(username="client_profile_a", password="x", role=RoleChoices.CLIENT)
    client = auth_as(user)
    photo = SimpleUploadedFile("avatar.jpg", b"fake-jpeg", content_type="image/jpeg")

    response = client.patch(
        "/api/me/profile/",
        {"username": "client_nick_new", "profile_photo": photo},
        format="multipart",
    )

    assert response.status_code == 200
    assert response.data["user"]["username"] == "client_nick_new"
    assert response.data["user"]["profile_photo_url"]

    user.refresh_from_db()
    assert user.username == "client_nick_new"
    assert bool(user.profile_photo)


@pytest.mark.django_db
def test_client_cannot_set_duplicate_nickname():
    first = User.objects.create_user(username="client_profile_first", password="x", role=RoleChoices.CLIENT)
    second = User.objects.create_user(username="client_profile_second", password="x", role=RoleChoices.CLIENT)
    client = auth_as(first)

    response = client.patch(
        "/api/me/profile/",
        {"username": second.username},
        format="json",
    )

    assert response.status_code == 400
    assert "username" in response.data
