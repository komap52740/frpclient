from __future__ import annotations

from django.conf import settings

from apps.accounts.notifications import send_telegram_message


def _absolute_public_url(path: str) -> str:
    base = (settings.TELEGRAM_CLIENT_BOT_FRONTEND_URL or "").rstrip("/")
    if not base:
        return path
    if path.startswith("http://") or path.startswith("https://"):
        return path
    if path.startswith("/"):
        return f"{base}{path}"
    return f"{base}/{path}"


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
    if message.file and hasattr(message.file, "url"):
        parts.append(f"Файл: {_absolute_public_url(message.file.url)}")

    if settings.TELEGRAM_CLIENT_BOT_FRONTEND_URL:
        parts.append(f"Открыть заявку: {settings.TELEGRAM_CLIENT_BOT_FRONTEND_URL.rstrip('/')}/appointments/{appointment.id}")

    return send_telegram_message(int(client.telegram_id), "\n".join(parts))

