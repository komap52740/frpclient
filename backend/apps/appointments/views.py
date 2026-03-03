from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import MasterLevelChoices, RoleChoices, WholesaleStatusChoices
from apps.accounts.notifications import notify_masters_about_new_appointment
from apps.accounts.permissions import IsAdminRole, IsAuthenticatedAndNotBanned
from apps.accounts.services import recalculate_client_stats
from apps.appointments.access import get_appointment_for_user
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


class AppointmentCreateView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request):
        if request.user.role != RoleChoices.CLIENT:
            return Response({"detail": "РўРѕР»СЊРєРѕ РєР»РёРµРЅС‚ РјРѕР¶РµС‚ СЃРѕР·РґР°РІР°С‚СЊ Р·Р°СЏРІРєРё"}, status=status.HTTP_403_FORBIDDEN)
        if request.user.is_banned:
            return Response({"detail": "РљР»РёРµРЅС‚ Р·Р°Р±Р°РЅРµРЅ"}, status=status.HTTP_403_FORBIDDEN)

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
        return Response(AppointmentSerializer(appointment, context={"request": request}).data, status=status.HTTP_201_CREATED)


class MyAppointmentsView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def get(self, request):
        if request.user.role != RoleChoices.CLIENT:
            return Response({"detail": "РўРѕР»СЊРєРѕ РґР»СЏ РєР»РёРµРЅС‚РѕРІ"}, status=status.HTTP_403_FORBIDDEN)

        queryset = Appointment.objects.filter(client=request.user).select_related("assigned_master", "client")
        data = AppointmentSerializer(queryset, many=True, context={"request": request}).data
        return Response(data)


class AppointmentDetailView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def get(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        data = AppointmentSerializer(appointment, context={"request": request}).data
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
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)


class AppointmentEventsView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def get(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        after_id_raw = request.query_params.get("after_id", "0")
        try:
            after_id = int(after_id_raw or 0)
        except (TypeError, ValueError):
            return Response({"detail": "РџР°СЂР°РјРµС‚СЂ after_id РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ С‡РёСЃР»РѕРј"}, status=status.HTTP_400_BAD_REQUEST)

        queryset = appointment.events.select_related("actor").all()
        if after_id > 0:
            queryset = queryset.filter(id__gt=after_id)
        queryset = queryset[:100]
        data = AppointmentEventSerializer(queryset, many=True).data
        return Response(data)


class UploadPaymentProofView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.CLIENT or appointment.client_id != request.user.id:
            return Response({"detail": "РўРѕР»СЊРєРѕ РєР»РёРµРЅС‚ Р·Р°СЏРІРєРё"}, status=status.HTTP_403_FORBIDDEN)
        if appointment.status != AppointmentStatusChoices.AWAITING_PAYMENT:
            return Response({"detail": "Р§РµРє РјРѕР¶РЅРѕ Р·Р°РіСЂСѓР·РёС‚СЊ С‚РѕР»СЊРєРѕ РІ СЃС‚Р°С‚СѓСЃРµ AWAITING_PAYMENT"}, status=status.HTTP_400_BAD_REQUEST)
        if "payment_proof" not in request.FILES:
            return Response({"detail": "РџРµСЂРµРґР°Р№С‚Рµ С„Р°Р№Р» payment_proof"}, status=status.HTTP_400_BAD_REQUEST)

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
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.CLIENT or appointment.client_id != request.user.id:
            return Response({"detail": "РўРѕР»СЊРєРѕ РєР»РёРµРЅС‚ Р·Р°СЏРІРєРё"}, status=status.HTTP_403_FORBIDDEN)
        if appointment.status != AppointmentStatusChoices.AWAITING_PAYMENT:
            return Response({"detail": "РќРµРІРѕР·РјРѕР¶РЅРѕ РѕС‚РјРµС‚РёС‚СЊ РѕРїР»Р°С‚Сѓ РІ С‚РµРєСѓС‰РµРј СЃС‚Р°С‚СѓСЃРµ"}, status=status.HTTP_400_BAD_REQUEST)
        if not appointment.payment_proof:
            return Response({"detail": "РЎРЅР°С‡Р°Р»Р° Р·Р°РіСЂСѓР·РёС‚Рµ С‡РµРє"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = MarkPaidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        appointment.payment_method = serializer.validated_data["payment_method"]
        appointment.payment_marked_at = timezone.now()
        appointment.save(update_fields=["payment_method", "payment_marked_at", "updated_at"])
        transition_status(appointment, request.user, AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED, note="РљР»РёРµРЅС‚ РѕС‚РјРµС‚РёР» РѕРїР»Р°С‚Сѓ")
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
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.CLIENT or appointment.client_id != request.user.id:
            return Response({"detail": "РўРѕР»СЊРєРѕ РєР»РёРµРЅС‚ Р·Р°СЏРІРєРё"}, status=status.HTTP_403_FORBIDDEN)
        if not can_client_signal(appointment):
            return Response({"detail": "РЎРёРіРЅР°Р»С‹ РЅРµРґРѕСЃС‚СѓРїРЅС‹ РґР»СЏ С‚РµРєСѓС‰РµРіРѕ СЃС‚Р°С‚СѓСЃР°"}, status=status.HTTP_400_BAD_REQUEST)

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
                "detail": "РЎРёРіРЅР°Р» РѕС‚РїСЂР°РІР»РµРЅ РјР°СЃС‚РµСЂСѓ",
                "signal": signal_code,
            }
        )


class RepeatAppointmentView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        source = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.CLIENT or source.client_id != request.user.id:
            return Response({"detail": "РўРѕР»СЊРєРѕ РєР»РёРµРЅС‚ Р·Р°СЏРІРєРё"}, status=status.HTTP_403_FORBIDDEN)
        if request.user.is_banned:
            return Response({"detail": "РљР»РёРµРЅС‚ Р·Р°Р±Р°РЅРµРЅ"}, status=status.HTTP_403_FORBIDDEN)

        repeated = repeat_client_appointment(source=source, client_user=request.user)

        return Response(
            AppointmentSerializer(repeated, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class MasterNewAppointmentsView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def get(self, request):
        if request.user.role != RoleChoices.MASTER:
            return Response({"detail": "РўРѕР»СЊРєРѕ РґР»СЏ РјР°СЃС‚РµСЂРѕРІ"}, status=status.HTTP_403_FORBIDDEN)
        if (
            not request.user.is_master_active
            or not request.user.master_quality_approved
            or request.user.master_level == MasterLevelChoices.TRAINEE
        ):
            return Response([], status=status.HTTP_200_OK)

        queryset = Appointment.objects.filter(status=AppointmentStatusChoices.NEW, assigned_master__isnull=True).select_related("client")
        data = AppointmentSerializer(queryset, many=True, context={"request": request}).data
        return Response(data)


class MasterActiveAppointmentsView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def get(self, request):
        if request.user.role != RoleChoices.MASTER:
            return Response({"detail": "РўРѕР»СЊРєРѕ РґР»СЏ РјР°СЃС‚РµСЂРѕРІ"}, status=status.HTTP_403_FORBIDDEN)

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
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        appointment = take_appointment(appointment_id, request.user)
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)


class MasterDeclineView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.MASTER:
            return Response({"detail": "РўРѕР»СЊРєРѕ РјР°СЃС‚РµСЂ"}, status=status.HTTP_403_FORBIDDEN)
        assert_master_assigned(appointment, request.user)
        if appointment.status not in (AppointmentStatusChoices.IN_REVIEW, AppointmentStatusChoices.AWAITING_PAYMENT):
            return Response({"detail": "РћС‚РєР»РѕРЅРµРЅРёРµ РґРѕСЃС‚СѓРїРЅРѕ С‚РѕР»СЊРєРѕ РІ IN_REVIEW РёР»Рё AWAITING_PAYMENT"}, status=status.HTTP_400_BAD_REQUEST)

        transition_status(appointment, request.user, AppointmentStatusChoices.DECLINED_BY_MASTER)
        recalculate_client_stats(appointment.client)
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)


class MasterSetPriceView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.MASTER:
            return Response({"detail": "РўРѕР»СЊРєРѕ РјР°СЃС‚РµСЂ"}, status=status.HTTP_403_FORBIDDEN)
        assert_master_assigned(appointment, request.user)
        if appointment.status != AppointmentStatusChoices.IN_REVIEW:
            return Response({"detail": "Р¦РµРЅСѓ РјРѕР¶РЅРѕ РІС‹СЃС‚Р°РІРёС‚СЊ С‚РѕР»СЊРєРѕ РІ IN_REVIEW"}, status=status.HTTP_400_BAD_REQUEST)

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
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)


class ConfirmPaymentMixin:
    def confirm_payment(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        allowed = request.user.is_superuser or request.user.role == RoleChoices.ADMIN
        if request.user.role == RoleChoices.MASTER and appointment.assigned_master_id == request.user.id:
            allowed = True
        if not allowed:
            return Response({"detail": "РќРµС‚ РїСЂР°РІ РЅР° РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РѕРїР»Р°С‚С‹"}, status=status.HTTP_403_FORBIDDEN)
        if appointment.status != AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED:
            return Response({"detail": "РџРѕРґС‚РІРµСЂРґРёС‚СЊ РѕРїР»Р°С‚Сѓ РјРѕР¶РЅРѕ С‚РѕР»СЊРєРѕ РёР· PAYMENT_PROOF_UPLOADED"}, status=status.HTTP_400_BAD_REQUEST)

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
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        return self.confirm_payment(request, appointment_id)


class MasterStartView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.MASTER:
            return Response({"detail": "РўРѕР»СЊРєРѕ РјР°СЃС‚РµСЂ"}, status=status.HTTP_403_FORBIDDEN)
        assert_master_assigned(appointment, request.user)
        if appointment.status != AppointmentStatusChoices.PAID:
            return Response({"detail": "РЎС‚Р°СЂС‚ РґРѕСЃС‚СѓРїРµРЅ С‚РѕР»СЊРєРѕ РїРѕСЃР»Рµ PAID"}, status=status.HTTP_400_BAD_REQUEST)

        transition_status(appointment, request.user, AppointmentStatusChoices.IN_PROGRESS)
        emit_event(
            "appointment.work_started",
            appointment,
            actor=request.user,
            payload={"status": AppointmentStatusChoices.IN_PROGRESS},
        )
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)


class MasterCompleteView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.MASTER:
            return Response({"detail": "РўРѕР»СЊРєРѕ РјР°СЃС‚РµСЂ"}, status=status.HTTP_403_FORBIDDEN)
        assert_master_assigned(appointment, request.user)
        if appointment.status != AppointmentStatusChoices.IN_PROGRESS:
            return Response({"detail": "Р—Р°РІРµСЂС€РµРЅРёРµ РґРѕСЃС‚СѓРїРЅРѕ С‚РѕР»СЊРєРѕ РІ IN_PROGRESS"}, status=status.HTTP_400_BAD_REQUEST)

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
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)

    def post(self, request, appointment_id: int):
        appointment = get_object_or_404(Appointment, id=appointment_id)
        serializer = AdminManualStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        to_status = serializer.validated_data["status"]
        transition_status(appointment, request.user, to_status, serializer.validated_data.get("note", ""))
        recalculate_client_stats(appointment.client)
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)



