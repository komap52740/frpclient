from django.urls import path

from .views import AppointmentMessagesView, AppointmentReadView, MessageDeleteView

urlpatterns = [
    path("appointments/<int:appointment_id>/messages/", AppointmentMessagesView.as_view(), name="appointment-messages"),
    path("messages/<int:message_id>/", MessageDeleteView.as_view(), name="message-delete"),
    path("appointments/<int:appointment_id>/read/", AppointmentReadView.as_view(), name="appointment-read"),
]
