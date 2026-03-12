from __future__ import annotations

from django.conf import settings

from apps.accounts.notifications import send_telegram_message
from apps.common.secure_media import build_message_file_url


def _app_base_url() -> str:
    return (settings.TELEGRAM_CLIENT_BOT_FRONTEND_URL or settings.OAUTH_FRONTEND_URL or "").rstrip("/")


def notify_client_about_chat_message(message) -> bool:
    appointment = getattr(message, "appointment", None)
    sender = getattr(message, "sender", None)
    if appointment is None or sender is None:
        return False

    client = appointment.client
    if not client or not client.telegram_id:
        return False
    if sender.id == client.id:
        return False

    sender_role = getattr(sender, "role", "")
    role_title = "Мастер" if sender_role == "master" else "Администратор" if sender_role == "admin" else "Пользователь"

    parts = [
        f"Новое сообщение по заявке #{appointment.id}",
        f"Отправитель: {role_title} {sender.username}",
    ]

    if message.text:
        parts.append(f"Текст: {message.text}")
    if message.file and getattr(message.file, "name", ""):
        file_url = build_message_file_url(None, message, base_url=_app_base_url()) if _app_base_url() else None
        if file_url:
            parts.append(f"Файл: {file_url}")

    if settings.TELEGRAM_CLIENT_BOT_FRONTEND_URL:
        parts.append(f"Открыть заявку: {settings.TELEGRAM_CLIENT_BOT_FRONTEND_URL.rstrip('/')}/appointments/{appointment.id}")

    return send_telegram_message(int(client.telegram_id), "\n".join(parts))


def notify_master_about_client_chat_message(message) -> bool:
    appointment = getattr(message, "appointment", None)
    sender = getattr(message, "sender", None)
    if appointment is None or sender is None:
        return False

    master = getattr(appointment, "assigned_master", None)
    if not master or not master.telegram_id:
        return False

    if sender.id != appointment.client_id:
        return False

    parts = [
        f"Новое сообщение клиента по заявке #{appointment.id}",
        f"Клиент: {sender.username}",
    ]

    if message.text:
        parts.append(f"Текст: {message.text}")
    if message.file and getattr(message.file, "name", ""):
        file_url = build_message_file_url(None, message, base_url=_app_base_url()) if _app_base_url() else None
        if file_url:
            parts.append(f"Файл: {file_url}")

    if settings.TELEGRAM_CLIENT_BOT_FRONTEND_URL:
        parts.append(f"Открыть заявку: {settings.TELEGRAM_CLIENT_BOT_FRONTEND_URL.rstrip('/')}/appointments/{appointment.id}")

    return send_telegram_message(int(master.telegram_id), "\n".join(parts))
