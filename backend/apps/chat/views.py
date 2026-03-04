from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import RoleChoices
from apps.accounts.permissions import IsAuthenticatedAndNotBanned
from apps.appointments.access import get_appointment_for_user
from apps.appointments.models import AppointmentEventType
from apps.appointments.services import add_event, evaluate_response_sla
from apps.platform.services import emit_event

from .models import MasterQuickReply, Message, ReadState
from .serializers import (
    MasterQuickReplySerializer,
    MessageCreateSerializer,
    MessageSerializer,
    ReadStateSerializer,
)
from .services import notify_client_about_chat_message
from .services import notify_master_about_client_chat_message
from .text_moderation import ChatMessageRejected, validate_client_chat_text


def apply_master_quick_reply(user, text: str) -> tuple[str, MasterQuickReply | None]:
    raw = (text or "").strip()
    if user.role != RoleChoices.MASTER or not raw:
        return raw, None
    if raw.startswith("//"):
        return raw[1:], None
    if not raw.startswith("/"):
        return raw, None

    first_token, _, tail = raw.partition(" ")
    command = first_token[1:].strip().lower()
    if not command:
        return raw, None

    quick_reply = (
        MasterQuickReply.objects.filter(user=user, command=command)
        .only("id", "text", "media_file")
        .first()
    )
    if not quick_reply:
        return raw, None

    base_text = (quick_reply.text or "").strip()
    extra = tail.strip()
    if extra:
        if base_text:
            return f"{base_text}\n\n{extra}", quick_reply
        return extra, quick_reply
    return base_text, quick_reply


class AppointmentMessagesView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

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
        resolved_text, quick_reply = apply_master_quick_reply(
            request.user,
            serializer.validated_data.get("text", ""),
        )
        if request.user.role == RoleChoices.CLIENT:
            try:
                resolved_text = validate_client_chat_text(resolved_text)
            except ChatMessageRejected as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        save_kwargs = {
            "appointment": appointment,
            "sender": request.user,
            "text": resolved_text,
        }
        if quick_reply and quick_reply.media_file and not serializer.validated_data.get("file"):
            save_kwargs["file"] = quick_reply.media_file

        message = serializer.save(**save_kwargs)
        if request.user.role == RoleChoices.MASTER and appointment.assigned_master_id == request.user.id:
            evaluate_response_sla(appointment, request.user)
        emit_event(
            "chat.message_sent",
            message,
            actor=request.user,
            payload={"appointment_id": appointment.id},
        )
        notify_client_about_chat_message(message)
        notify_master_about_client_chat_message(message)
        data = MessageSerializer(message, context={"request": request}).data
        return Response(data, status=status.HTTP_201_CREATED)


class MessageDeleteView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

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
        emit_event(
            "chat.message_deleted",
            message,
            actor=request.user,
            payload={"appointment_id": appointment.id},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class AppointmentReadView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

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


class MasterQuickReplyListCreateView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def _ensure_master(self, request):
        if request.user.role != RoleChoices.MASTER:
            return Response({"detail": "Только для мастеров"}, status=status.HTTP_403_FORBIDDEN)
        return None

    def get(self, request):
        denied = self._ensure_master(request)
        if denied:
            return denied

        queryset = MasterQuickReply.objects.filter(user=request.user).order_by("command", "id")
        data = MasterQuickReplySerializer(queryset, many=True, context={"request": request}).data
        return Response(data)

    def post(self, request):
        denied = self._ensure_master(request)
        if denied:
            return denied

        serializer = MasterQuickReplySerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        if MasterQuickReply.objects.filter(user=request.user, command=serializer.validated_data["command"]).exists():
            return Response({"detail": "Шаблон с такой командой уже существует."}, status=status.HTTP_400_BAD_REQUEST)
        reply = serializer.save(user=request.user)
        data = MasterQuickReplySerializer(reply, context={"request": request}).data
        return Response(data, status=status.HTTP_201_CREATED)


class MasterQuickReplyDetailView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def _get_master_reply(self, request, reply_id: int) -> MasterQuickReply | None:
        if request.user.role != RoleChoices.MASTER:
            return None
        return MasterQuickReply.objects.filter(id=reply_id, user=request.user).first()

    def patch(self, request, reply_id: int):
        reply = self._get_master_reply(request, reply_id)
        if not reply:
            return Response({"detail": "Шаблон не найден."}, status=status.HTTP_404_NOT_FOUND)

        serializer = MasterQuickReplySerializer(reply, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        next_command = serializer.validated_data.get("command")
        if next_command and MasterQuickReply.objects.filter(user=request.user, command=next_command).exclude(id=reply.id).exists():
            return Response({"detail": "Шаблон с такой командой уже существует."}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, reply_id: int):
        reply = self._get_master_reply(request, reply_id)
        if not reply:
            return Response({"detail": "Шаблон не найден."}, status=status.HTTP_404_NOT_FOUND)
        reply.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
