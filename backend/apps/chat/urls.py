from django.urls import path

from .views import (
    AppointmentMessagesView,
    AppointmentReadView,
    MasterQuickReplyDetailView,
    MasterQuickReplyListCreateView,
    MessageDeleteView,
)

urlpatterns = [
    path("appointments/<int:appointment_id>/messages/", AppointmentMessagesView.as_view(), name="appointment-messages"),
    path("messages/<int:message_id>/", MessageDeleteView.as_view(), name="message-delete"),
    path("appointments/<int:appointment_id>/read/", AppointmentReadView.as_view(), name="appointment-read"),
    path("chat/quick-replies/", MasterQuickReplyListCreateView.as_view(), name="master-quick-replies"),
    path("chat/quick-replies/<int:reply_id>/", MasterQuickReplyDetailView.as_view(), name="master-quick-reply-detail"),
]
