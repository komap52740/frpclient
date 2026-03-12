from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .serializers import NotificationSerializer, PlatformEventSerializer


def notification_group_name(user_id: int) -> str:
    return f"notifications.user.{user_id}"


def appointment_events_group_name(appointment_id: int) -> str:
    return f"appointments.{appointment_id}.events"


def appointment_chat_group_name(appointment_id: int) -> str:
    return f"appointments.{appointment_id}.chat"


def master_queue_group_name() -> str:
    return "masters.queue"


def _group_send(group_name: str, event_type: str, payload: dict) -> None:
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": event_type,
            "payload": payload,
        },
    )


def _resolve_appointment_id(event) -> int | None:
    payload = event.payload or {}
    appointment_id = payload.get("appointment_id")
    if appointment_id:
        try:
            return int(appointment_id)
        except (TypeError, ValueError):
            return None
    if event.entity_type == "Appointment":
        try:
            return int(event.entity_id)
        except (TypeError, ValueError):
            return None
    return None


def broadcast_platform_event(event) -> None:
    serialized = PlatformEventSerializer(event).data
    appointment_id = _resolve_appointment_id(event)
    if appointment_id:
        _group_send(
            appointment_events_group_name(appointment_id),
            "appointment_event",
            {
                "kind": "platform_event",
                "event": serialized,
            },
        )

    if appointment_id and event.event_type.startswith("chat."):
        _group_send(
            appointment_chat_group_name(appointment_id),
            "chat_message",
            {
                "kind": "chat_event",
                "event": serialized,
            },
        )

    if event.event_type.startswith(("appointment.", "chat.", "review.", "sla.")):
        _group_send(
            master_queue_group_name(),
            "master_queue",
            {
                "kind": "queue_event",
                "event": serialized,
            },
        )


def broadcast_notification(notification) -> None:
    unread_count = notification.user.notifications.filter(is_read=False).count()
    _group_send(
        notification_group_name(notification.user_id),
        "notification_message",
        {
            "kind": "notification",
            "notification": NotificationSerializer(notification).data,
            "unread_count": unread_count,
        },
    )
