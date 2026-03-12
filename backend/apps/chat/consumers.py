from __future__ import annotations

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.appointments.access import can_access_appointment
from apps.appointments.models import Appointment
from apps.platform.realtime import appointment_chat_group_name


@database_sync_to_async
def _can_join_chat(user, appointment_id: int) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    appointment = (
        Appointment.objects.select_related("client", "assigned_master", "payment_confirmed_by")
        .filter(id=appointment_id)
        .first()
    )
    if appointment is None:
        return False
    return can_access_appointment(user, appointment)


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.appointment_id = int(self.scope["url_route"]["kwargs"]["appointment_id"])
        self.group_name = appointment_chat_group_name(self.appointment_id)

        if not await _can_join_chat(self.scope["user"], self.appointment_id):
            await self.close(code=4403)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get("type") == "ping":
            await self.send_json({"type": "pong"})

    async def chat_message(self, event):
        await self.send_json(event["payload"])
