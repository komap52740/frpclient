from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import RoleChoices
from apps.accounts.notifications import notify_masters_about_new_appointment
from apps.accounts.permissions import IsAdminRole
from apps.accounts.services import recalculate_client_stats
from apps.appointments.access import get_appointment_for_user
from apps.platform.services import create_notification, emit_event

from .models import Appointment, AppointmentEventType, AppointmentStatusChoices
from .serializers import (
    AdminManualStatusSerializer,
    AppointmentCreateSerializer,
    ClientSignalSerializer,
    AppointmentEventSerializer,
    AppointmentSerializer,
    MarkPaidSerializer,
    SetPriceSerializer,
    UploadPaymentProofSerializer,
)
from .services import (
    add_event,
    assert_master_assigned,
    initialize_response_deadline,
    take_appointment,
    transition_status,
)

CLIENT_SIGNAL_META = {
    "ready_for_session": {
        "title": "Клиент готов к подключению",
        "message": "Клиент подтвердил готовность к удаленному подключению.",
    },
    "need_help": {
        "title": "Клиент просит помощь",
        "message": "Клиент просит пошаговую помощь по текущей заявке.",
    },
    "payment_issue": {
        "title": "Проблема с оплатой",
        "message": "Клиент сообщил о проблеме с оплатой и ожидает подсказку.",
    },
    "need_reschedule": {
        "title": "Нужно перенести сессию",
        "message": "Клиент просит перенести время подключения.",
    },
}


def can_client_signal(appointment: Appointment) -> bool:
    return appointment.status not in (
        AppointmentStatusChoices.COMPLETED,
        AppointmentStatusChoices.CANCELLED,
        AppointmentStatusChoices.DECLINED_BY_MASTER,
    )


class AppointmentCreateView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        if request.user.role != RoleChoices.CLIENT:
            return Response({"detail": "Только клиент может создавать заявки"}, status=status.HTTP_403_FORBIDDEN)
        if request.user.is_banned:
            return Response({"detail": "Клиент забанен"}, status=status.HTTP_403_FORBIDDEN)

        serializer = AppointmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        appointment = serializer.save(client=request.user)
        initialize_response_deadline(appointment)
        emit_event(
            "appointment.created",
            appointment,
            actor=request.user,
            payload={"status": appointment.status},
        )
        notify_masters_about_new_appointment(appointment)
        return Response(AppointmentSerializer(appointment, context={"request": request}).data, status=status.HTTP_201_CREATED)


class MyAppointmentsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        if request.user.role != RoleChoices.CLIENT:
            return Response({"detail": "Только для клиентов"}, status=status.HTTP_403_FORBIDDEN)

        queryset = Appointment.objects.filter(client=request.user).select_related("assigned_master", "client")
        data = AppointmentSerializer(queryset, many=True, context={"request": request}).data
        return Response(data)


class AppointmentDetailView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        data = AppointmentSerializer(appointment, context={"request": request}).data
        return Response(data)


class AppointmentEventsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        after_id_raw = request.query_params.get("after_id", "0")
        try:
            after_id = int(after_id_raw or 0)
        except (TypeError, ValueError):
            return Response({"detail": "Параметр after_id должен быть числом"}, status=status.HTTP_400_BAD_REQUEST)

        queryset = appointment.events.select_related("actor").all()
        if after_id > 0:
            queryset = queryset.filter(id__gt=after_id)
        queryset = queryset[:100]
        data = AppointmentEventSerializer(queryset, many=True).data
        return Response(data)


class UploadPaymentProofView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.CLIENT or appointment.client_id != request.user.id:
            return Response({"detail": "Только клиент заявки"}, status=status.HTTP_403_FORBIDDEN)
        if appointment.status != AppointmentStatusChoices.AWAITING_PAYMENT:
            return Response({"detail": "Чек можно загрузить только в статусе AWAITING_PAYMENT"}, status=status.HTTP_400_BAD_REQUEST)
        if "payment_proof" not in request.FILES:
            return Response({"detail": "Передайте файл payment_proof"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = UploadPaymentProofSerializer(appointment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        add_event(appointment, request.user, AppointmentEventType.PAYMENT_PROOF_UPLOADED)
        emit_event(
            "appointment.payment_proof_uploaded",
            appointment,
            actor=request.user,
            payload={"status": appointment.status},
        )
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)


class MarkPaidView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.CLIENT or appointment.client_id != request.user.id:
            return Response({"detail": "Только клиент заявки"}, status=status.HTTP_403_FORBIDDEN)
        if appointment.status != AppointmentStatusChoices.AWAITING_PAYMENT:
            return Response({"detail": "Невозможно отметить оплату в текущем статусе"}, status=status.HTTP_400_BAD_REQUEST)
        if not appointment.payment_proof:
            return Response({"detail": "Сначала загрузите чек"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = MarkPaidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        appointment.payment_method = serializer.validated_data["payment_method"]
        appointment.payment_marked_at = timezone.now()
        appointment.save(update_fields=["payment_method", "payment_marked_at", "updated_at"])
        transition_status(appointment, request.user, AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED, note="Клиент отметил оплату")
        add_event(
            appointment,
            request.user,
            AppointmentEventType.PAYMENT_MARKED,
            metadata={"payment_method": appointment.payment_method},
        )
        emit_event(
            "appointment.payment_marked",
            appointment,
            actor=request.user,
            payload={"payment_method": appointment.payment_method},
        )
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)


class ClientSignalView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.CLIENT or appointment.client_id != request.user.id:
            return Response({"detail": "Только клиент заявки"}, status=status.HTTP_403_FORBIDDEN)
        if not can_client_signal(appointment):
            return Response({"detail": "Сигналы недоступны для текущего статуса"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ClientSignalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        signal_code = serializer.validated_data["signal"]
        signal_meta = CLIENT_SIGNAL_META[signal_code]
        comment = serializer.validated_data.get("comment", "").strip()

        note = signal_meta["title"]
        if comment:
            note = f"{note}. Комментарий: {comment}"

        add_event(
            appointment,
            request.user,
            AppointmentEventType.CLIENT_SIGNAL,
            note=note,
            metadata={"signal": signal_code, "comment": comment},
        )
        emit_event(
            "appointment.client_signal",
            appointment,
            actor=request.user,
            payload={"signal": signal_code, "comment": comment},
        )

        if appointment.assigned_master_id:
            create_notification(
                user=appointment.assigned_master,
                type="appointment",
                title=f"Сигнал по заявке #{appointment.id}",
                message=signal_meta["message"],
                payload={"appointment_id": appointment.id, "signal": signal_code},
            )

        return Response(
            {
                "ok": True,
                "detail": "Сигнал отправлен мастеру",
                "signal": signal_code,
            }
        )


class RepeatAppointmentView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, appointment_id: int):
        source = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.CLIENT or source.client_id != request.user.id:
            return Response({"detail": "Только клиент заявки"}, status=status.HTTP_403_FORBIDDEN)
        if request.user.is_banned:
            return Response({"detail": "Клиент забанен"}, status=status.HTTP_403_FORBIDDEN)

        repeated = Appointment.objects.create(
            client=request.user,
            brand=source.brand,
            model=source.model,
            lock_type=source.lock_type,
            has_pc=source.has_pc,
            description=source.description,
        )
        initialize_response_deadline(repeated)
        emit_event(
            "appointment.created",
            repeated,
            actor=request.user,
            payload={
                "status": repeated.status,
                "source_appointment_id": source.id,
                "created_via": "repeat",
            },
        )
        notify_masters_about_new_appointment(repeated)

        return Response(
            AppointmentSerializer(repeated, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class MasterNewAppointmentsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        if request.user.role != RoleChoices.MASTER:
            return Response({"detail": "Только для мастеров"}, status=status.HTTP_403_FORBIDDEN)
        if not request.user.is_master_active:
            return Response([], status=status.HTTP_200_OK)

        queryset = Appointment.objects.filter(status=AppointmentStatusChoices.NEW, assigned_master__isnull=True).select_related("client")
        data = AppointmentSerializer(queryset, many=True, context={"request": request}).data
        return Response(data)


class MasterActiveAppointmentsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

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
        queryset = Appointment.objects.filter(assigned_master=request.user, status__in=active_statuses).select_related("client")
        data = AppointmentSerializer(queryset, many=True, context={"request": request}).data
        return Response(data)


class MasterTakeView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, appointment_id: int):
        appointment = take_appointment(appointment_id, request.user)
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)


class MasterDeclineView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.MASTER:
            return Response({"detail": "Только мастер"}, status=status.HTTP_403_FORBIDDEN)
        assert_master_assigned(appointment, request.user)
        if appointment.status not in (AppointmentStatusChoices.IN_REVIEW, AppointmentStatusChoices.AWAITING_PAYMENT):
            return Response({"detail": "Отклонение доступно только в IN_REVIEW или AWAITING_PAYMENT"}, status=status.HTTP_400_BAD_REQUEST)

        transition_status(appointment, request.user, AppointmentStatusChoices.DECLINED_BY_MASTER)
        recalculate_client_stats(appointment.client)
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)


class MasterSetPriceView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.MASTER:
            return Response({"detail": "Только мастер"}, status=status.HTTP_403_FORBIDDEN)
        assert_master_assigned(appointment, request.user)
        if appointment.status != AppointmentStatusChoices.IN_REVIEW:
            return Response({"detail": "Цену можно выставить только в IN_REVIEW"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SetPriceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        appointment.total_price = serializer.validated_data["total_price"]
        appointment.save(update_fields=["total_price", "updated_at"])
        add_event(
            appointment,
            request.user,
            AppointmentEventType.PRICE_SET,
            metadata={"total_price": appointment.total_price},
        )
        emit_event(
            "appointment.price_set",
            appointment,
            actor=request.user,
            payload={"total_price": appointment.total_price},
        )
        transition_status(appointment, request.user, AppointmentStatusChoices.AWAITING_PAYMENT)
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)


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
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)


class MasterConfirmPaymentView(APIView, ConfirmPaymentMixin):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, appointment_id: int):
        return self.confirm_payment(request, appointment_id)


class MasterStartView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

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
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)


class MasterCompleteView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

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
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)


class AdminManualStatusView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

    def post(self, request, appointment_id: int):
        appointment = get_object_or_404(Appointment, id=appointment_id)
        serializer = AdminManualStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        to_status = serializer.validated_data["status"]
        transition_status(appointment, request.user, to_status, serializer.validated_data.get("note", ""))
        recalculate_client_stats(appointment.client)
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)

