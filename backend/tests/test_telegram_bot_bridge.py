from __future__ import annotations

from unittest.mock import patch

import pytest

from apps.accounts.models import RoleChoices, User
from apps.accounts.telegram_bot import ClientTelegramBot
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.chat.models import Message
from apps.platform.models import Notification


@pytest.fixture
def client_user(db):
    return User.objects.create_user(
        username="tg_client",
        password="x",
        role=RoleChoices.CLIENT,
        telegram_id=555111222,
    )


@pytest.fixture
def master_user(db):
    return User.objects.create_user(
        username="master_for_tg",
        password="x",
        role=RoleChoices.MASTER,
        is_master_active=True,
    )


def _appointment_for_bridge(client_user: User, master_user: User) -> Appointment:
    return Appointment.objects.create(
        client=client_user,
        assigned_master=master_user,
        brand="Samsung",
        model="S22",
        lock_type="PIN",
        has_pc=True,
        description="Bridge test",
        status=AppointmentStatusChoices.IN_PROGRESS,
    )


@pytest.mark.django_db
def test_bot_text_message_creates_chat_message_for_active_appointment(client_user, master_user):
    appointment = _appointment_for_bridge(client_user, master_user)
    bot = ClientTelegramBot(token="test-token")
    bot.active_appointments[client_user.telegram_id] = appointment.id

    with (
        patch.object(bot, "send_message") as send_mock,
        patch("apps.accounts.telegram_bot.notify_master_about_client_chat_message", return_value=True) as master_tg_mock,
    ):
        bot._handle_message(
            {
                "chat": {"id": client_user.telegram_id},
                "text": "Пишу через Telegram-бота",
            }
        )

    message = Message.objects.get(appointment=appointment)
    assert message.text == "Пишу через Telegram-бота"
    assert not message.file

    notification = Notification.objects.filter(user=master_user).order_by("-id").first()
    assert notification is not None
    assert notification.payload["appointment_id"] == appointment.id
    assert send_mock.called
    master_tg_mock.assert_called_once()


@pytest.mark.django_db
def test_bot_document_message_creates_chat_message_with_file(client_user, master_user):
    appointment = _appointment_for_bridge(client_user, master_user)
    bot = ClientTelegramBot(token="test-token")
    bot.active_appointments[client_user.telegram_id] = appointment.id

    with (
        patch.object(bot, "_download_telegram_file", return_value=("payment-proof.pdf", b"%PDF-1.7 mock")),
        patch.object(bot, "send_message") as send_mock,
        patch("apps.accounts.telegram_bot.notify_master_about_client_chat_message", return_value=True) as master_tg_mock,
    ):
        bot._handle_message(
            {
                "chat": {"id": client_user.telegram_id},
                "caption": "Чек об оплате",
                "document": {
                    "file_id": "doc-file-id",
                    "file_name": "payment-proof.pdf",
                },
            }
        )

    message = Message.objects.get(appointment=appointment)
    assert message.text == "Чек об оплате"
    assert message.file.name.endswith(".pdf")
    assert send_mock.called
    master_tg_mock.assert_called_once()


@pytest.mark.django_db
def test_bot_rejects_unsupported_document_extension(client_user, master_user):
    appointment = _appointment_for_bridge(client_user, master_user)
    bot = ClientTelegramBot(token="test-token")
    bot.active_appointments[client_user.telegram_id] = appointment.id

    with (
        patch.object(bot, "_download_telegram_file", return_value=("payload.exe", b"binary-data")),
        patch.object(bot, "send_message") as send_mock,
    ):
        bot._handle_message(
            {
                "chat": {"id": client_user.telegram_id},
                "caption": "Запусти это",
                "document": {
                    "file_id": "doc-file-id",
                    "file_name": "payload.exe",
                },
            }
        )

    assert not Message.objects.filter(appointment=appointment).exists()
    assert any("Формат файла не поддерживается." in (call.args[1] if len(call.args) > 1 else "") for call in send_mock.call_args_list)
