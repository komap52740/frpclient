from __future__ import annotations

from channels.routing import URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.urls import path

from apps.appointments.consumers import AppointmentEventsConsumer, MasterQueueConsumer
from apps.chat.consumers import ChatConsumer
from apps.common.channels_auth import SessionAuthMiddlewareStack
from apps.platform.consumers import NotificationsConsumer

websocket_urlpatterns = [
    path("ws/appointments/<int:appointment_id>/chat/", ChatConsumer.as_asgi()),
    path("ws/appointments/<int:appointment_id>/events/", AppointmentEventsConsumer.as_asgi()),
    path("ws/notifications/", NotificationsConsumer.as_asgi()),
    path("ws/master/queue/", MasterQueueConsumer.as_asgi()),
]

websocket_application = AllowedHostsOriginValidator(
    SessionAuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    )
)
