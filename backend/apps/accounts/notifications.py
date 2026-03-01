from __future__ import annotations

import json
import logging
from urllib import error as url_error
from urllib import request as url_request

from django.conf import settings

from apps.appointments.models import Appointment, AppointmentStatusChoices

from .models import RoleChoices, User

logger = logging.getLogger(__name__)


def send_telegram_message(chat_id: int, text: str) -> bool:
    if not settings.TELEGRAM_BOT_TOKEN:
        return False

    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = json.dumps(
        {
            "chat_id": int(chat_id),
            "text": text,
            "disable_web_page_preview": True,
        }
    ).encode("utf-8")
    req = url_request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with url_request.urlopen(req, timeout=5) as response:
            return 200 <= response.status < 300
    except (ValueError, TypeError, url_error.URLError) as exc:
        logger.warning("Telegram sendMessage failed for chat_id=%s: %s", chat_id, exc)
        return False


def notify_masters_about_new_appointment(appointment: Appointment) -> int:
    masters = User.objects.filter(
        role=RoleChoices.MASTER,
        is_master_active=True,
        is_banned=False,
        telegram_id__isnull=False,
    ).exclude(telegram_id=0)

    text = (
        "Новая заявка для мастеров\n"
        f"#{appointment.id} • {appointment.brand} {appointment.model}\n"
        f"Тип: {appointment.lock_type}\n"
        f"Есть ПК: {'Да' if appointment.has_pc else 'Нет'}\n"
        "Откройте раздел «Новые заявки» в кабинете."
    )

    sent = 0
    for master in masters:
        if send_telegram_message(master.telegram_id, text):
            sent += 1
    return sent


def notify_client_about_status_change(
    appointment: Appointment,
    *,
    from_status: str,
    to_status: str,
    note: str = "",
) -> bool:
    client = appointment.client
    if not client or not client.telegram_id:
        return False

    status_map = dict(AppointmentStatusChoices.choices)
    from_label = status_map.get(from_status, from_status or "—")
    to_label = status_map.get(to_status, to_status or "—")

    lines = [
        f"Обновление по заявке #{appointment.id}",
        f"Статус: {from_label} -> {to_label}",
    ]
    if note:
        lines.append(f"Комментарий: {note}")
    if settings.TELEGRAM_CLIENT_BOT_FRONTEND_URL:
        base = settings.TELEGRAM_CLIENT_BOT_FRONTEND_URL.rstrip("/")
        lines.append(f"Открыть заявку: {base}/appointments/{appointment.id}")

    return send_telegram_message(int(client.telegram_id), "\n".join(lines))
