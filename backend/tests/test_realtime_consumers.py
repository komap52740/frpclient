from __future__ import annotations

import json

import pytest
from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator
from django.conf import settings
from django.test import Client
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User
from apps.appointments.models import Appointment, LockTypeChoices
from apps.chat.models import Message
from apps.platform.models import NotificationType
from apps.platform.services import create_notification, emit_event
from config.asgi import application


def _login_and_get_session_cookie(username: str, password: str) -> str:
    client = Client()
    response = client.post(
        "/api/auth/login/",
        data=json.dumps({"username": username, "password": password}),
        content_type="application/json",
    )
    assert response.status_code == 200
    return client.cookies[settings.SESSION_COOKIE_NAME].value


def _cookie_headers(session_cookie: str) -> list[tuple[bytes, bytes]]:
    return [(b"cookie", f"{settings.SESSION_COOKIE_NAME}={session_cookie}".encode("utf-8"))]


async def _access_token_for(user: User) -> str:
    refresh_token = await sync_to_async(RefreshToken.for_user)(user)
    return str(refresh_token.access_token)


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_notifications_consumer_pushes_new_notification():
    user = await sync_to_async(User.objects.create_user)(username="ws-notif-user", password="x", role=RoleChoices.CLIENT)
    session_cookie = await sync_to_async(_login_and_get_session_cookie)(user.username, "x")
    communicator = WebsocketCommunicator(application, "/ws/notifications/", headers=_cookie_headers(session_cookie))

    connected, _ = await communicator.connect()
    assert connected is True

    await sync_to_async(create_notification)(
        user=user,
        type=NotificationType.SYSTEM,
        title="Новая системная нотификация",
        message="Проверка websocket-канала",
    )

    payload = await communicator.receive_json_from(timeout=2)
    assert payload["kind"] == "notification"
    assert payload["notification"]["title"] == "Новая системная нотификация"
    assert payload["unread_count"] == 1

    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_appointment_events_consumer_pushes_platform_event():
    client_user = await sync_to_async(User.objects.create_user)(
        username="ws-appointment-client",
        password="x",
        role=RoleChoices.CLIENT,
    )
    appointment = await sync_to_async(Appointment.objects.create)(
        client=client_user,
        brand="Samsung",
        model="A52",
        lock_type=LockTypeChoices.GOOGLE,
        has_pc=True,
        description="Realtime appointment event",
    )
    session_cookie = await sync_to_async(_login_and_get_session_cookie)(client_user.username, "x")
    communicator = WebsocketCommunicator(
        application,
        f"/ws/appointments/{appointment.id}/events/",
        headers=_cookie_headers(session_cookie),
    )

    connected, _ = await communicator.connect()
    assert connected is True

    await sync_to_async(emit_event)(
        "appointment.status_changed",
        appointment,
        actor=client_user,
        payload={"from_status": "NEW", "to_status": "IN_REVIEW"},
    )

    payload = await communicator.receive_json_from(timeout=2)
    assert payload["kind"] == "platform_event"
    assert payload["event"]["event_type"] == "appointment.status_changed"

    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_chat_consumer_pushes_chat_event():
    client_user = await sync_to_async(User.objects.create_user)(username="ws-chat-client", password="x", role=RoleChoices.CLIENT)
    appointment = await sync_to_async(Appointment.objects.create)(
        client=client_user,
        brand="Xiaomi",
        model="Redmi Note",
        lock_type=LockTypeChoices.GOOGLE,
        has_pc=False,
        description="Realtime chat event",
    )
    message = await sync_to_async(Message.objects.create)(
        appointment=appointment,
        sender=client_user,
        text="Тест websocket-чата",
    )
    session_cookie = await sync_to_async(_login_and_get_session_cookie)(client_user.username, "x")
    communicator = WebsocketCommunicator(
        application,
        f"/ws/appointments/{appointment.id}/chat/",
        headers=_cookie_headers(session_cookie),
    )

    connected, _ = await communicator.connect()
    assert connected is True

    await sync_to_async(emit_event)(
        "chat.message_sent",
        message,
        actor=client_user,
        payload={"appointment_id": appointment.id},
    )

    payload = await communicator.receive_json_from(timeout=2)
    assert payload["kind"] == "chat_event"
    assert payload["event"]["event_type"] == "chat.message_sent"

    await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_notifications_consumer_rejects_query_token_without_session_cookie():
    user = await sync_to_async(User.objects.create_user)(username="ws-notif-legacy", password="x", role=RoleChoices.CLIENT)
    communicator = WebsocketCommunicator(application, f"/ws/notifications/?token={await _access_token_for(user)}")

    connected, _ = await communicator.connect()
    assert connected is False
