from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import RoleChoices
from apps.appointments.access import get_appointment_for_user
from apps.appointments.models import AppointmentEventType
from apps.appointments.services import add_event

from .models import Message, ReadState
from .serializers import MessageCreateSerializer, MessageSerializer, ReadStateSerializer


class AppointmentMessagesView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        after_id = int(request.query_params.get("after_id", "0") or 0)
        queryset = appointment.messages.filter(id__gt=after_id).select_related("sender")
        data = MessageSerializer(queryset, many=True, context={"request": request}).data
        return Response(data)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role == RoleChoices.CLIENT and request.user.is_banned:
            return Response({"detail": "Клиент забанен"}, status=status.HTTP_403_FORBIDDEN)

        serializer = MessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.save(appointment=appointment, sender=request.user)
        data = MessageSerializer(message, context={"request": request}).data
        return Response(data, status=status.HTTP_201_CREATED)


class MessageDeleteView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def delete(self, request, message_id: int):
        message = get_object_or_404(Message.objects.select_related("sender", "appointment"), id=message_id)
        appointment = get_appointment_for_user(request.user, message.appointment_id)

        is_admin = request.user.is_superuser or request.user.role == RoleChoices.ADMIN
        if message.sender_id != request.user.id and not is_admin:
            return Response({"detail": "Удалять можно только свои сообщения"}, status=status.HTTP_403_FORBIDDEN)

        message.is_deleted = True
        message.deleted_at = timezone.now()
        message.deleted_by = request.user
        message.text = ""
        message.save(update_fields=["is_deleted", "deleted_at", "deleted_by", "text", "updated_at"])

        add_event(
            appointment,
            request.user,
            AppointmentEventType.MESSAGE_DELETED,
            note=f"message_id={message.id}",
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class AppointmentReadView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        serializer = ReadStateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        last_read_message_id = serializer.validated_data["last_read_message_id"]

        read_state, _ = ReadState.objects.get_or_create(appointment=appointment, user=request.user)
        if last_read_message_id > read_state.last_read_message_id:
            read_state.last_read_message_id = last_read_message_id
            read_state.save(update_fields=["last_read_message_id", "updated_at"])

        return Response({"ok": True})
