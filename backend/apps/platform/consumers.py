from __future__ import annotations

from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .realtime import notification_group_name


class NotificationsConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        if not getattr(user, "is_authenticated", False):
            await self.close(code=4401)
            return

        self.group_name = notification_group_name(user.id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get("type") == "ping":
            await self.send_json({"type": "pong"})

    async def notification_message(self, event):
        await self.send_json(event["payload"])
