from __future__ import annotations

from django.conf import settings
from django.db.models import OuterRef, Subquery
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import RoleChoices, WholesaleStatusChoices
from apps.accounts.notifications import notify_masters_about_new_appointment
from apps.accounts.permissions import IsAdminRole, IsAuthenticatedAndNotBanned
from apps.accounts.services import recalculate_client_stats
from apps.appointments.access import get_appointment_for_user
from apps.chat.models import Message
from apps.common.api_limits import parse_non_negative_int_param, serialize_bounded_queryset
from apps.chat.services import notify_client_about_chat_message
from apps.platform.services import emit_event

from .client_actions import can_client_signal, create_client_signal, repeat_client_appointment
from .models import Appointment, AppointmentEventType, AppointmentStatusChoices
from .serializers import (
    AdminManualStatusSerializer,
    AppointmentCreateSerializer,
    ClientAccessUpdateSerializer,
    ClientSignalSerializer,
    AppointmentEventSerializer,
    AppointmentSerializer,
    MarkPaidSerializer,
    MasterBulkActionSerializer,
    SetPriceSerializer,
    UploadPaymentProofSerializer,
)
from .services import (
    add_event,
    assert_master_assigned,
    get_available_new_appointments_queryset_for_master,
    initialize_response_deadline,
    take_appointment,
    transition_status,
)


def _appointment_serializer_context(request, *, include_client_access: bool) -> dict:
    return {
        "request": request,
        "include_client_access": include_client_access,
    }


class AppointmentCreateView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request):
        if request.user.role != RoleChoices.CLIENT:
            return Response({"detail": "Только клиент может создавать заявки"}, status=status.HTTP_403_FORBIDDEN)
        if request.user.is_banned:
            return Response({"detail": "Клиент забанен"}, status=status.HTTP_403_FORBIDDEN)

        serializer = AppointmentCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        appointment = serializer.save(client=request.user)

        if request.user.is_service_center and request.user.wholesale_status == WholesaleStatusChoices.APPROVED:
            appointment.is_wholesale_request = True
            appointment.save(update_fields=["is_wholesale_request", "updated_at"])

        initialize_response_deadline(appointment)
        emit_event(
            "appointment.created",
            appointment,
            actor=request.user,
            payload={"status": appointment.status},
        )
        notify_masters_about_new_appointment(appointment)
        return Response(
            AppointmentSerializer(
                appointment,
                context=_appointment_serializer_context(request, include_client_access=True),
            ).data,
            status=status.HTTP_201_CREATED,
        )


class MyAppointmentsView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def get(self, request):
        if request.user.role != RoleChoices.CLIENT:
            return Response({"detail": "Только для клиентов"}, status=status.HTTP_403_FORBIDDEN)

        queryset = Appointment.objects.filter(client=request.user).select_related("assigned_master", "client")
        return serialize_bounded_queryset(
            request,
            queryset,
            AppointmentSerializer,
            serializer_context=_appointment_serializer_context(request, include_client_access=False),
            default_limit=settings.DEFAULT_API_LIST_LIMIT,
            max_limit=settings.MAX_API_LIST_LIMIT,
        )


class AppointmentDetailView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def get(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        data = AppointmentSerializer(
            appointment,
            context=_appointment_serializer_context(request, include_client_access=True),
        ).data
        return Response(data)


class ClientAccessUpdateView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.CLIENT or appointment.client_id != request.user.id:
            return Response({"detail": "Только клиент заявки"}, status=status.HTTP_403_FORBIDDEN)
        if request.user.is_banned:
            return Response({"detail": "Клиент забанен"}, status=status.HTTP_403_FORBIDDEN)

        serializer = ClientAccessUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        fields_to_update = ["updated_at"]
        rustdesk_id = serializer.validated_data.get("rustdesk_id", "")
        rustdesk_password = serializer.validated_data.get("rustdesk_password", "")
        if rustdesk_id:
            appointment.rustdesk_id = rustdesk_id
            fields_to_update.append("rustdesk_id")
        if rustdesk_password:
            appointment.rustdesk_password = rustdesk_password
            fields_to_update.append("rustdesk_password")
        appointment.save(update_fields=fields_to_update)

        add_event(
            appointment,
            request.user,
            AppointmentEventType.CLIENT_SIGNAL,
            note="Клиент обновил данные RuDesktop",
            metadata={"signal": "rustdesk_updated"},
        )
        emit_event(
            "appointment.client_access_updated",
            appointment,
            actor=request.user,
            payload={"rustdesk_id_updated": bool(rustdesk_id), "rustdesk_password_updated": bool(rustdesk_password)},
        )
        return Response(
            AppointmentSerializer(
                appointment,
                context=_appointment_serializer_context(request, include_client_access=True),
            ).data
        )


class AppointmentEventsView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def get(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        after_id = parse_non_negative_int_param(request.query_params.get("after_id"), field_name="after_id", default=0)

        queryset = appointment.events.select_related("actor").all()
        if after_id > 0:
            queryset = queryset.filter(id__gt=after_id)
        queryset = queryset.order_by("-id")
        return serialize_bounded_queryset(
            request,
            queryset,
            AppointmentEventSerializer,
            default_limit=settings.APPOINTMENT_EVENTS_LIST_LIMIT,
            max_limit=settings.APPOINTMENT_EVENTS_MAX_LIST_LIMIT,
        )


class UploadPaymentProofView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.CLIENT or appointment.client_id != request.user.id:
            return Response({"detail": "Только клиент заявки"}, status=status.HTTP_403_FORBIDDEN)
        if appointment.status not in (
            AppointmentStatusChoices.AWAITING_PAYMENT,
            AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED,
        ):
            return Response(
                {"detail": "Чек можно загрузить только в статусе «Ожидает оплату» или «Чек загружен»"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if "payment_proof" not in request.FILES:
            return Response({"detail": "Передайте файл чека в поле payment_proof"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = UploadPaymentProofSerializer(appointment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        if appointment.status != AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED:
            transition_status(
                appointment,
                request.user,
                AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED,
                note="Клиент загрузил чек",
            )
        add_event(appointment, request.user, AppointmentEventType.PAYMENT_PROOF_UPLOADED)
        emit_event(
            "appointment.payment_proof_uploaded",
            appointment,
            actor=request.user,
            payload={"status": appointment.status},
        )
        return Response(
            AppointmentSerializer(
                appointment,
                context=_appointment_serializer_context(request, include_client_access=True),
            ).data
        )


class MarkPaidView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.CLIENT or appointment.client_id != request.user.id:
            return Response({"detail": "Только клиент заявки"}, status=status.HTTP_403_FORBIDDEN)
        if appointment.status not in (
            AppointmentStatusChoices.AWAITING_PAYMENT,
            AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED,
        ):
            return Response({"detail": "Невозможно отметить оплату в текущем статусе"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = MarkPaidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        appointment.payment_method = serializer.validated_data["payment_method"]
        appointment.payment_requisites_note = serializer.validated_data["payment_requisites_note"]
        appointment.payment_marked_at = timezone.now()
        appointment.save(update_fields=["payment_method", "payment_requisites_note", "payment_marked_at", "updated_at"])
        if appointment.status != AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED:
            transition_status(appointment, request.user, AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED, note="Клиент отметил оплату")
        add_event(
            appointment,
            request.user,
            AppointmentEventType.PAYMENT_MARKED,
            metadata={
                "payment_method": appointment.payment_method,
                "payment_requisites_note": appointment.payment_requisites_note,
                "has_payment_proof": bool(appointment.payment_proof),
            },
        )
        emit_event(
            "appointment.payment_marked",
            appointment,
            actor=request.user,
            payload={
                "payment_method": appointment.payment_method,
                "payment_requisites_note": appointment.payment_requisites_note,
                "has_payment_proof": bool(appointment.payment_proof),
            },
        )
        return Response(
            AppointmentSerializer(
                appointment,
                context=_appointment_serializer_context(request, include_client_access=True),
            ).data
        )


class ClientSignalView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.CLIENT or appointment.client_id != request.user.id:
            return Response({"detail": "Только клиент заявки"}, status=status.HTTP_403_FORBIDDEN)
        if not can_client_signal(appointment):
            return Response({"detail": "Сигналы недоступны для текущего статуса"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ClientSignalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        signal_code = serializer.validated_data["signal"]
        create_client_signal(
            appointment=appointment,
            client_user=request.user,
            signal_code=signal_code,
            comment=serializer.validated_data.get("comment", ""),
        )

        return Response(
            {
                "ok": True,
                "detail": "Сигнал отправлен мастеру",
                "signal": signal_code,
            }
        )


class RepeatAppointmentView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        source = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.CLIENT or source.client_id != request.user.id:
            return Response({"detail": "Только клиент заявки"}, status=status.HTTP_403_FORBIDDEN)
        if request.user.is_banned:
            return Response({"detail": "Клиент забанен"}, status=status.HTTP_403_FORBIDDEN)

        repeated = repeat_client_appointment(source=source, client_user=request.user)

        return Response(
            AppointmentSerializer(
                repeated,
                context=_appointment_serializer_context(request, include_client_access=True),
            ).data,
            status=status.HTTP_201_CREATED,
        )


class MasterNewAppointmentsView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def get(self, request):
        if request.user.role != RoleChoices.MASTER:
            return Response({"detail": "Только для мастеров"}, status=status.HTTP_403_FORBIDDEN)

        queryset = get_available_new_appointments_queryset_for_master(request.user).select_related("client")
        return serialize_bounded_queryset(
            request,
            queryset,
            AppointmentSerializer,
            serializer_context=_appointment_serializer_context(request, include_client_access=False),
            default_limit=settings.DEFAULT_API_LIST_LIMIT,
            max_limit=settings.MAX_API_LIST_LIMIT,
        )


class MasterActiveAppointmentsView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def get(self, request):
        if request.user.role != RoleChoices.MASTER:
            return Response({"detail": "Только для мастеров"}, status=status.HTTP_403_FORBIDDEN)

        active_statuses = (
            AppointmentStatusChoices.IN_REVIEW,
            AppointmentStatusChoices.AWAITING_PAYMENT,
            AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED,
            AppointmentStatusChoices.PAID,
            AppointmentStatusChoices.IN_PROGRESS,
        )
        latest_message_qs = Message.objects.filter(
            appointment_id=OuterRef("pk"),
            is_deleted=False,
        ).order_by("-id")
        queryset = (
            Appointment.objects.filter(assigned_master=request.user, status__in=active_statuses)
            .select_related("client", "assigned_master")
            .annotate(
                latest_message_text=Subquery(latest_message_qs.values("text")[:1]),
                latest_message_created_at=Subquery(latest_message_qs.values("created_at")[:1]),
                latest_message_sender_username=Subquery(latest_message_qs.values("sender__username")[:1]),
                latest_message_sender_role=Subquery(latest_message_qs.values("sender__role")[:1]),
            )
        )
        return serialize_bounded_queryset(
            request,
            queryset,
            AppointmentSerializer,
            serializer_context=_appointment_serializer_context(request, include_client_access=False),
            default_limit=settings.DEFAULT_API_LIST_LIMIT,
            max_limit=settings.MAX_API_LIST_LIMIT,
        )


class MasterBulkActionView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request):
        if request.user.role != RoleChoices.MASTER:
            return Response({"detail": "Только для мастеров"}, status=status.HTTP_403_FORBIDDEN)

        serializer = MasterBulkActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        ids = data["appointment_ids"]
        action = data["action"]
        message_text = (data.get("message_text") or "").strip()

        appointments = {
            item.id: item
            for item in Appointment.objects.filter(id__in=ids, assigned_master=request.user).select_related("client", "assigned_master")
        }

        processed = []
        skipped = []

        for appointment_id in ids:
            appointment = appointments.get(appointment_id)
            if not appointment:
                skipped.append({"appointment_id": appointment_id, "reason": "no_access_or_not_found"})
                continue

            if action == MasterBulkActionSerializer.ACTION_START_WORK:
                if appointment.status != AppointmentStatusChoices.PAID:
                    skipped.append({"appointment_id": appointment_id, "reason": "status_must_be_paid"})
                    continue
                transition_status(appointment, request.user, AppointmentStatusChoices.IN_PROGRESS, note="Bulk action: start work")
            elif action == MasterBulkActionSerializer.ACTION_COMPLETE_WORK:
                if appointment.status != AppointmentStatusChoices.IN_PROGRESS:
                    skipped.append({"appointment_id": appointment_id, "reason": "status_must_be_in_progress"})
                    continue
                transition_status(appointment, request.user, AppointmentStatusChoices.COMPLETED, note="Bulk action: complete work")
                recalculate_client_stats(appointment.client)

            if message_text:
                message = Message.objects.create(
                    appointment=appointment,
                    sender=request.user,
                    text=message_text,
                )
                emit_event(
                    "chat.message_sent",
                    message,
                    actor=request.user,
                    payload={"appointment_id": appointment.id, "bulk": True},
                )
                notify_client_about_chat_message(message)

            processed.append(appointment_id)

        return Response(
            {
                "action": action,
                "processed_count": len(processed),
                "processed_ids": processed,
                "skipped": skipped,
            },
            status=status.HTTP_200_OK,
        )


class MasterTakeView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        appointment = take_appointment(appointment_id, request.user)
        return Response(
            AppointmentSerializer(
                appointment,
                context=_appointment_serializer_context(request, include_client_access=True),
            ).data
        )


class MasterDeclineView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.MASTER:
            return Response({"detail": "Только мастер"}, status=status.HTTP_403_FORBIDDEN)
        assert_master_assigned(appointment, request.user)
        if appointment.status not in (AppointmentStatusChoices.IN_REVIEW, AppointmentStatusChoices.AWAITING_PAYMENT):
            return Response({"detail": "Отклонение доступно только в IN_REVIEW или AWAITING_PAYMENT"}, status=status.HTTP_400_BAD_REQUEST)

        transition_status(appointment, request.user, AppointmentStatusChoices.DECLINED_BY_MASTER)
        recalculate_client_stats(appointment.client)
        return Response(
            AppointmentSerializer(
                appointment,
                context=_appointment_serializer_context(request, include_client_access=True),
            ).data
        )


class MasterSetPriceView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.MASTER:
            return Response({"detail": "Только мастер"}, status=status.HTTP_403_FORBIDDEN)
        assert_master_assigned(appointment, request.user)
        if appointment.status != AppointmentStatusChoices.IN_REVIEW:
            return Response({"detail": "Цену можно выставить только в IN_REVIEW"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SetPriceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        base_price = int(serializer.validated_data["total_price"])
        # Wholesale discount is no longer auto-applied at price setting time.
        # Master sees wholesale marker in UI and decides pricing manually.
        discount_percent = 0
        appointment.wholesale_base_price = None
        appointment.wholesale_discount_percent_applied = 0
        appointment.total_price = base_price
        appointment.save(
            update_fields=[
                "wholesale_base_price",
                "wholesale_discount_percent_applied",
                "total_price",
                "updated_at",
            ]
        )
        add_event(
            appointment,
            request.user,
            AppointmentEventType.PRICE_SET,
            metadata={
                "base_price": base_price,
                "discount_percent": discount_percent,
                "total_price": appointment.total_price,
            },
        )
        emit_event(
            "appointment.price_set",
            appointment,
            actor=request.user,
            payload={
                "base_price": base_price,
                "discount_percent": discount_percent,
                "total_price": appointment.total_price,
            },
        )
        transition_status(appointment, request.user, AppointmentStatusChoices.AWAITING_PAYMENT)
        return Response(
            AppointmentSerializer(
                appointment,
                context=_appointment_serializer_context(request, include_client_access=True),
            ).data
        )


class ConfirmPaymentMixin:
    def confirm_payment(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        allowed = request.user.is_superuser or request.user.role == RoleChoices.ADMIN
        if request.user.role == RoleChoices.MASTER and appointment.assigned_master_id == request.user.id:
            allowed = True
        if not allowed:
            return Response({"detail": "Нет прав на подтверждение оплаты"}, status=status.HTTP_403_FORBIDDEN)
        if appointment.status != AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED:
            return Response({"detail": "Подтвердить оплату можно только из PAYMENT_PROOF_UPLOADED"}, status=status.HTTP_400_BAD_REQUEST)

        appointment.payment_confirmed_by = request.user
        appointment.payment_confirmed_at = timezone.now()
        appointment.save(update_fields=["payment_confirmed_by", "payment_confirmed_at", "updated_at"])
        transition_status(appointment, request.user, AppointmentStatusChoices.PAID)
        add_event(appointment, request.user, AppointmentEventType.PAYMENT_CONFIRMED)
        emit_event(
            "appointment.payment_confirmed",
            appointment,
            actor=request.user,
            payload={"confirmed_by": request.user.id},
        )
        return Response(
            AppointmentSerializer(
                appointment,
                context=_appointment_serializer_context(request, include_client_access=True),
            ).data
        )


class MasterConfirmPaymentView(APIView, ConfirmPaymentMixin):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        return self.confirm_payment(request, appointment_id)


class MasterStartView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.MASTER:
            return Response({"detail": "Только мастер"}, status=status.HTTP_403_FORBIDDEN)
        assert_master_assigned(appointment, request.user)
        if appointment.status != AppointmentStatusChoices.PAID:
            return Response({"detail": "Старт доступен только после PAID"}, status=status.HTTP_400_BAD_REQUEST)

        transition_status(appointment, request.user, AppointmentStatusChoices.IN_PROGRESS)
        emit_event(
            "appointment.work_started",
            appointment,
            actor=request.user,
            payload={"status": AppointmentStatusChoices.IN_PROGRESS},
        )
        return Response(
            AppointmentSerializer(
                appointment,
                context=_appointment_serializer_context(request, include_client_access=True),
            ).data
        )


class MasterCompleteView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.MASTER:
            return Response({"detail": "Только мастер"}, status=status.HTTP_403_FORBIDDEN)
        assert_master_assigned(appointment, request.user)
        if appointment.status != AppointmentStatusChoices.IN_PROGRESS:
            return Response({"detail": "Завершение доступно только в IN_PROGRESS"}, status=status.HTTP_400_BAD_REQUEST)

        transition_status(appointment, request.user, AppointmentStatusChoices.COMPLETED)
        emit_event(
            "appointment.work_completed",
            appointment,
            actor=request.user,
            payload={"status": AppointmentStatusChoices.COMPLETED},
        )
        recalculate_client_stats(appointment.client)
        return Response(
            AppointmentSerializer(
                appointment,
                context=_appointment_serializer_context(request, include_client_access=True),
            ).data
        )


class AdminManualStatusView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)

    def post(self, request, appointment_id: int):
        appointment = get_object_or_404(Appointment, id=appointment_id)
        serializer = AdminManualStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        to_status = serializer.validated_data["status"]
        transition_status(appointment, request.user, to_status, serializer.validated_data.get("note", ""))
        recalculate_client_stats(appointment.client)
        return Response(
            AppointmentSerializer(
                appointment,
                context=_appointment_serializer_context(request, include_client_access=True),
            ).data
        )

