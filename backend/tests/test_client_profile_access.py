from __future__ import annotations

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.reviews.models import BehaviorFlag, BehaviorFlagCode, Review, ReviewTypeChoices


def auth_as(user: User) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.fixture
def client_user(db):
    return User.objects.create_user(username="client_profile_1", password="x", role=RoleChoices.CLIENT)


@pytest.fixture
def other_client_user(db):
    return User.objects.create_user(username="client_profile_2", password="x", role=RoleChoices.CLIENT)


@pytest.fixture
def master_user(db):
    return User.objects.create_user(
        username="master_profile_1",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
        master_quality_approved=True,
    )


@pytest.fixture
def second_master_user(db):
    return User.objects.create_user(
        username="master_profile_2",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
        master_quality_approved=True,
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username="admin_profile_1",
        password="x",
        role=RoleChoices.ADMIN,
        is_staff=True,
    )


@pytest.mark.django_db
def test_admin_can_open_client_profile(admin_user, client_user):
    response = auth_as(admin_user).get(f"/api/clients/{client_user.id}/profile/")

    assert response.status_code == 200
    assert response.data["id"] == client_user.id
    assert response.data["username"] == client_user.username
    assert "client_stats" in response.data
    assert "risk_level" in response.data["client_stats"]


@pytest.mark.django_db
def test_master_can_open_client_profile(master_user, client_user):
    response = auth_as(master_user).get(f"/api/clients/{client_user.id}/profile/")

    assert response.status_code == 200
    assert response.data["id"] == client_user.id
    assert "appointments_total" in response.data
    assert "master_behavior_reviews" in response.data


@pytest.mark.django_db
def test_client_cannot_open_client_profile(client_user, other_client_user):
    response = auth_as(client_user).get(f"/api/clients/{other_client_user.id}/profile/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_master_can_open_clients_list(master_user, client_user):
    response = auth_as(master_user).get("/api/admin/users/")

    assert response.status_code == 200
    assert isinstance(response.data, list)
    assert any(item["id"] == client_user.id for item in response.data)


@pytest.mark.django_db
def test_master_sees_only_own_behavior_comments_on_client_profile(master_user, second_master_user, client_user):
    flag, _ = BehaviorFlag.objects.get_or_create(
        code=BehaviorFlagCode.DIFFICULT_CLIENT,
        defaults={"label": "Сложный клиент", "is_active": True},
    )

    appointment_1 = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Xiaomi",
        model="11T",
        lock_type="PIN",
        description="a",
        status=AppointmentStatusChoices.COMPLETED,
    )
    review_1 = Review.objects.create(
        appointment=appointment_1,
        author=master_user,
        target=client_user,
        review_type=ReviewTypeChoices.CLIENT_REVIEW,
        rating=4,
        comment="мой комментарий",
    )
    review_1.behavior_flags.add(flag)

    appointment_2 = Appointment.objects.create(
        client=client_user,
        assigned_master=second_master_user,
        brand="Samsung",
        model="A51",
        lock_type="PIN",
        description="b",
        status=AppointmentStatusChoices.COMPLETED,
    )
    review_2 = Review.objects.create(
        appointment=appointment_2,
        author=second_master_user,
        target=client_user,
        review_type=ReviewTypeChoices.CLIENT_REVIEW,
        rating=2,
        comment="чужой комментарий",
    )
    review_2.behavior_flags.add(flag)

    response = auth_as(master_user).get(f"/api/clients/{client_user.id}/profile/")

    assert response.status_code == 200
    reviews = response.data["master_behavior_reviews"]
    assert len(reviews) == 1
    assert reviews[0]["author_id"] == master_user.id
    assert reviews[0]["comment"] == "мой комментарий"


@pytest.mark.django_db
def test_admin_sees_all_behavior_comments_on_client_profile(admin_user, master_user, second_master_user, client_user):
    appointment_1 = Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Xiaomi",
        model="11T",
        lock_type="PIN",
        description="a",
        status=AppointmentStatusChoices.COMPLETED,
    )
    Review.objects.create(
        appointment=appointment_1,
        author=master_user,
        target=client_user,
        review_type=ReviewTypeChoices.CLIENT_REVIEW,
        rating=4,
        comment="первый",
    )

    appointment_2 = Appointment.objects.create(
        client=client_user,
        assigned_master=second_master_user,
        brand="Samsung",
        model="A51",
        lock_type="PIN",
        description="b",
        status=AppointmentStatusChoices.COMPLETED,
    )
    Review.objects.create(
        appointment=appointment_2,
        author=second_master_user,
        target=client_user,
        review_type=ReviewTypeChoices.CLIENT_REVIEW,
        rating=3,
        comment="второй",
    )

    response = auth_as(admin_user).get(f"/api/clients/{client_user.id}/profile/")

    assert response.status_code == 200
    assert len(response.data["master_behavior_reviews"]) == 2
