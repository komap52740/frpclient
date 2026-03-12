from __future__ import annotations

import csv
import io
import time
from datetime import timedelta

from django.conf import settings
from django.core.mail import get_connection, send_mail
from django.core.management import call_command
from django.db import connection
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Prefetch, Q, Sum
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import (
    MasterLevelChoices,
    RoleChoices,
    SiteSettings,
    User,
    WholesalePriorityChoices,
    WholesaleStatusChoices,
)
from apps.accounts.permissions import IsAdminRole, IsAuthenticatedAndNotBanned
from apps.accounts.services import recalculate_client_stats
from apps.appointments.models import (
    Appointment,
    AppointmentEvent,
    AppointmentEventType,
    AppointmentStatusChoices,
    PaymentMethodChoices,
)
from apps.appointments.serializers import AppointmentSerializer
from apps.appointments.views import ConfirmPaymentMixin
from apps.common.api_limits import BoundedListAPIView, resolve_list_window
from apps.common.ops_state import (
    get_deploy_lock_state,
    get_job_statuses,
    get_maintenance_mode_state,
    get_release_state,
    get_rollback_inventory,
)
from apps.common.secure_media import build_appointment_media_url
from apps.platform.services import create_notification, emit_event

from .filters import AdminAppointmentFilter
from .serializers import (
    AdminPaymentRegistryRowSerializer,
    AdminSendClientEmailSerializer,
    AdminMasterQualitySerializer,
    AdminSystemActionSerializer,
    AdminSystemSettingsSerializer,
    AdminUserRoleSerializer,
    AdminUserSerializer,
    AdminWholesalePrioritySerializer,
    AdminWholesaleReviewSerializer,
    BanUserSerializer,
)


def _master_level_to_tier(level: str) -> str:
    return "senior" if level == MasterLevelChoices.SENIOR else "regular"


def _master_tier_to_level(tier: str) -> str:
    return MasterLevelChoices.SENIOR if tier == "senior" else MasterLevelChoices.JUNIOR


def _can_view_staff_tools(user) -> bool:
    return bool(user and (user.is_superuser or user.role in {RoleChoices.ADMIN, RoleChoices.MASTER}))


def _scoped_appointments_for_report(user):
    if user.is_superuser or user.role == RoleChoices.ADMIN:
        return Appointment.objects.all()
    return Appointment.objects.filter(assigned_master=user)


PAYMENT_HISTORY_EVENT_TYPES = (
    AppointmentEventType.PAYMENT_PROOF_UPLOADED,
    AppointmentEventType.PAYMENT_MARKED,
    AppointmentEventType.PAYMENT_CONFIRMED,
)


def _payment_registry_queryset(user, query_params):
    queryset = (
        _scoped_appointments_for_report(user)
        .select_related("client", "assigned_master", "payment_confirmed_by")
        .prefetch_related(
            Prefetch(
                "events",
                queryset=AppointmentEvent.objects.filter(event_type__in=PAYMENT_HISTORY_EVENT_TYPES)
                .select_related("actor")
                .order_by("-id"),
                to_attr="payment_history_events",
            )
        )
    )

    queryset = queryset.filter(
        Q(payment_marked_at__isnull=False)
        | Q(payment_proof__isnull=False)
        | Q(payment_confirmed_at__isnull=False)
        | Q(
            status__in=(
                AppointmentStatusChoices.AWAITING_PAYMENT,
                AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED,
                AppointmentStatusChoices.PAID,
                AppointmentStatusChoices.IN_PROGRESS,
                AppointmentStatusChoices.COMPLETED,
            )
        )
    )

    state_filter = (query_params.get("state") or "").strip().lower()
    if state_filter == "confirmed":
        queryset = queryset.filter(payment_confirmed_at__isnull=False)
    elif state_filter == "pending":
        queryset = queryset.filter(payment_confirmed_at__isnull=True).filter(
            Q(payment_marked_at__isnull=False)
            | Q(payment_proof__isnull=False)
            | Q(status=AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED)
        )

    payment_method = (query_params.get("payment_method") or "").strip()
    if payment_method in PaymentMethodChoices.values:
        queryset = queryset.filter(payment_method=payment_method)

    appointment_id = (query_params.get("appointment_id") or "").strip()
    if appointment_id.isdigit():
        queryset = queryset.filter(id=int(appointment_id))

    client_id = (query_params.get("client_id") or "").strip()
    if client_id.isdigit():
        queryset = queryset.filter(client_id=int(client_id))

    master_id = (query_params.get("master_id") or "").strip()
    if master_id.isdigit():
        queryset = queryset.filter(assigned_master_id=int(master_id))

    confirmed_by_id = (query_params.get("confirmed_by_id") or "").strip()
    if confirmed_by_id.isdigit():
        queryset = queryset.filter(payment_confirmed_by_id=int(confirmed_by_id))

    date_from = parse_date(query_params.get("from") or "")
    date_to = parse_date(query_params.get("to") or "")
    if date_from and date_to and date_from > date_to:
        date_from, date_to = date_to, date_from

    if date_from:
        queryset = queryset.filter(
            Q(payment_marked_at__date__gte=date_from)
            | Q(payment_confirmed_at__date__gte=date_from)
            | Q(updated_at__date__gte=date_from)
        )
    if date_to:
        queryset = queryset.filter(
            Q(payment_marked_at__date__lte=date_to)
            | Q(payment_confirmed_at__date__lte=date_to)
            | Q(updated_at__date__lte=date_to)
        )

    return queryset.order_by("-payment_confirmed_at", "-payment_marked_at", "-updated_at", "-id")


class AdminPaymentRegistryView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def get(self, request):
        if not _can_view_staff_tools(request.user):
            return Response({"detail": "Недостаточно прав"}, status=status.HTTP_403_FORBIDDEN)

        queryset = _payment_registry_queryset(request.user, request.query_params)

        window = resolve_list_window(
            request,
            default_limit=settings.ADMIN_API_LIST_LIMIT,
            max_limit=settings.ADMIN_API_MAX_LIST_LIMIT,
            max_offset=settings.API_LIST_MAX_OFFSET,
        )

        total = queryset.count()
        rows = queryset[window.offset : window.offset + window.limit]
        serializer = AdminPaymentRegistryRowSerializer(rows, many=True, context={"request": request})
        return Response(
            {
                "count": total,
                "limit": window.limit,
                "offset": window.offset,
                "results": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class AdminPaymentRegistryExportCsvView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def get(self, request):
        if not _can_view_staff_tools(request.user):
            return Response({"detail": "Недостаточно прав"}, status=status.HTTP_403_FORBIDDEN)

        queryset = _payment_registry_queryset(request.user, request.query_params)

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        filename = f"payment-registry-{timezone.localdate().isoformat()}.csv"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response.write("\ufeff")

        writer = csv.writer(response)
        writer.writerow(
            [
                "appointment_id",
                "status",
                "client_username",
                "master_username",
                "payment_method",
                "payment_requisites_note",
                "payment_proof_url",
                "total_price",
                "currency",
                "payment_marked_at",
                "payment_confirmed_at",
                "payment_confirmed_by",
                "history",
            ]
        )

        for appointment in queryset:
            proof_url = build_appointment_media_url(request, appointment, "payment_proof") or ""

            history_rows = []
            for event in getattr(appointment, "payment_history_events", []):
                event_time = timezone.localtime(event.created_at).strftime("%Y-%m-%d %H:%M:%S")
                actor_name = event.actor.username if event.actor_id else "-"
                note = (event.note or "").replace("\n", " ").strip()
                history_rows.append(f"{event_time} | {event.event_type} | {actor_name} | {note}")

            writer.writerow(
                [
                    appointment.id,
                    appointment.status,
                    appointment.client.username if appointment.client_id else "",
                    appointment.assigned_master.username if appointment.assigned_master_id else "",
                    appointment.payment_method or "",
                    appointment.payment_requisites_note or "",
                    proof_url,
                    int(appointment.total_price or 0),
                    appointment.currency or "RUB",
                    timezone.localtime(appointment.payment_marked_at).strftime("%Y-%m-%d %H:%M:%S")
                    if appointment.payment_marked_at
                    else "",
                    timezone.localtime(appointment.payment_confirmed_at).strftime("%Y-%m-%d %H:%M:%S")
                    if appointment.payment_confirmed_at
                    else "",
                    appointment.payment_confirmed_by.username if appointment.payment_confirmed_by_id else "",
                    " || ".join(history_rows),
                ]
            )

        return response


class AdminAppointmentListView(BoundedListAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    serializer_class = AppointmentSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_class = AdminAppointmentFilter
    default_list_limit = settings.ADMIN_API_LIST_LIMIT
    max_list_limit = settings.ADMIN_API_MAX_LIST_LIMIT

    def get_queryset(self):
        return Appointment.objects.select_related("client", "assigned_master", "payment_confirmed_by").all()


class AdminConfirmPaymentView(APIView, ConfirmPaymentMixin):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)

    def post(self, request, appointment_id: int):
        return self.confirm_payment(request, appointment_id)


class AdminDeleteAppointmentView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)

    def delete(self, request, appointment_id: int):
        appointment = get_object_or_404(
            Appointment.objects.select_related("client", "assigned_master"),
            id=appointment_id,
        )

        payload = {
            "appointment_id": appointment.id,
            "status": appointment.status,
            "client_id": appointment.client_id,
            "master_id": appointment.assigned_master_id,
            "total_price": appointment.total_price,
        }
        emit_event(
            "appointment.deleted_by_admin",
            appointment,
            actor=request.user,
            payload=payload,
        )
        appointment.delete()

        return Response(
            {
                "status": "deleted",
                "appointment_id": appointment_id,
            },
            status=status.HTTP_200_OK,
        )


class AdminBanUserView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)

    def post(self, request, user_id: int):
        user = get_object_or_404(User, id=user_id, role=RoleChoices.CLIENT)
        serializer = BanUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user.is_banned = True
        user.ban_reason = serializer.validated_data.get("reason", "")
        user.banned_at = timezone.now()
        user.save(update_fields=["is_banned", "ban_reason", "banned_at", "updated_at"])
        recalculate_client_stats(user)
        return Response(AdminUserSerializer(user).data)


class AdminUnbanUserView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)

    def post(self, request, user_id: int):
        user = get_object_or_404(User, id=user_id, role=RoleChoices.CLIENT)
        user.is_banned = False
        user.ban_reason = ""
        user.banned_at = None
        user.save(update_fields=["is_banned", "ban_reason", "banned_at", "updated_at"])
        recalculate_client_stats(user)
        return Response(AdminUserSerializer(user).data)


class AdminActivateMasterView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)

    def post(self, request, user_id: int):
        user = get_object_or_404(User, id=user_id, role=RoleChoices.MASTER)
        user.is_master_active = True
        user.save(update_fields=["is_master_active", "updated_at"])
        return Response(AdminUserSerializer(user).data)


class AdminSuspendMasterView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)

    def post(self, request, user_id: int):
        user = get_object_or_404(User, id=user_id, role=RoleChoices.MASTER)
        user.is_master_active = False
        user.save(update_fields=["is_master_active", "updated_at"])
        return Response(AdminUserSerializer(user).data)


class AdminClientsView(BoundedListAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)
    serializer_class = AdminUserSerializer
    default_list_limit = settings.ADMIN_API_LIST_LIMIT
    max_list_limit = settings.ADMIN_API_MAX_LIST_LIMIT

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return User.objects.none()
        user = self.request.user
        if not (user.is_superuser or user.role in {RoleChoices.ADMIN, RoleChoices.MASTER}):
            raise PermissionDenied("Только для админа и мастера.")
        active_statuses = (
            AppointmentStatusChoices.NEW,
            AppointmentStatusChoices.IN_REVIEW,
            AppointmentStatusChoices.AWAITING_PAYMENT,
            AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED,
            AppointmentStatusChoices.PAID,
            AppointmentStatusChoices.IN_PROGRESS,
        )
        return (
            User.objects.filter(role=RoleChoices.CLIENT)
            .select_related("wholesale_verified_by")
            .annotate(
                appointments_total=Count("client_appointments", distinct=True),
                appointments_active=Count(
                    "client_appointments",
                    filter=Q(client_appointments__status__in=active_statuses),
                    distinct=True,
                ),
                appointments_sla_breached=Count(
                    "client_appointments",
                    filter=Q(client_appointments__sla_breached=True),
                    distinct=True,
                ),
            )
            .order_by("-id")
        )


class AdminWholesaleRequestsView(BoundedListAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    serializer_class = AdminUserSerializer
    default_list_limit = settings.ADMIN_API_LIST_LIMIT
    max_list_limit = settings.ADMIN_API_MAX_LIST_LIMIT

    def get_queryset(self):
        queryset = (
            User.objects.filter(role=RoleChoices.CLIENT, is_service_center=True)
            .exclude(wholesale_status=WholesaleStatusChoices.NONE)
            .order_by("-wholesale_requested_at", "-id")
        )
        status_filter = (self.request.query_params.get("status") or "").strip().lower()
        if status_filter in WholesaleStatusChoices.values:
            queryset = queryset.filter(wholesale_status=status_filter)
        return queryset


class AdminWholesaleReviewView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)

    def post(self, request, user_id: int):
        user = get_object_or_404(User, id=user_id, role=RoleChoices.CLIENT)
        serializer = AdminWholesaleReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        decision = serializer.validated_data["decision"]
        review_comment = (serializer.validated_data.get("review_comment") or "").strip()

        if decision == "approve":
            missing_fields = []
            if not (user.wholesale_company_name or "").strip():
                missing_fields.append("название сервиса")
            if not (user.wholesale_city or "").strip():
                missing_fields.append("город")
            if not (user.wholesale_address or "").strip():
                missing_fields.append("адрес")

            if missing_fields:
                return Response(
                    {
                        "detail": (
                            "Нельзя одобрить оптовый статус: заполните карточку сервиса клиента "
                            f"({', '.join(missing_fields)})."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        requested_at = user.wholesale_requested_at or timezone.now()
        reviewed_at = timezone.now()

        update_fields = [
            "wholesale_requested_at",
            "wholesale_reviewed_at",
            "wholesale_review_comment",
            "wholesale_verified_at",
            "wholesale_verified_by",
            "is_service_center",
            "updated_at",
        ]
        user.is_service_center = True
        user.wholesale_requested_at = requested_at
        user.wholesale_reviewed_at = reviewed_at
        user.wholesale_review_comment = review_comment

        if decision == "approve":
            user.wholesale_status = WholesaleStatusChoices.APPROVED
            user.wholesale_verified_at = reviewed_at
            user.wholesale_verified_by = request.user
            if not user.wholesale_priority:
                user.wholesale_priority = WholesalePriorityChoices.STANDARD
        else:
            user.wholesale_status = WholesaleStatusChoices.REJECTED
            user.wholesale_verified_at = None
            user.wholesale_verified_by = None
            user.wholesale_priority = WholesalePriorityChoices.STANDARD
            user.wholesale_priority_note = ""
            user.wholesale_priority_updated_at = None
        # Discount amount should not be shown in UI anymore.
        user.wholesale_discount_percent = 0

        update_fields.extend(
            [
                "wholesale_status",
                "wholesale_discount_percent",
                "wholesale_priority",
                "wholesale_priority_note",
                "wholesale_priority_updated_at",
            ]
        )
        user.save(update_fields=sorted(set(update_fields)))

        create_notification(
            user=user,
            type="system",
            title="Решение по оптовому статусу",
            message=(
                "Оптовый статус одобрен. Ваш аккаунт отмечен как оптовый сервис."
                if decision == "approve"
                else "Оптовый статус отклонен. Уточните детали в чате с поддержкой."
            ),
            payload={"decision": decision, "client_id": user.id, "target_role": RoleChoices.CLIENT},
        )
        emit_event(
            "wholesale.reviewed",
            user,
            actor=request.user,
            payload={"decision": decision, "verified_by": request.user.id if decision == "approve" else None},
        )

        return Response(AdminUserSerializer(user).data, status=status.HTTP_200_OK)


class AdminWholesalePriorityView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request, user_id: int):
        if not (request.user.is_superuser or request.user.role in {RoleChoices.ADMIN, RoleChoices.MASTER}):
            return Response({"detail": "Недостаточно прав"}, status=status.HTTP_403_FORBIDDEN)

        user = get_object_or_404(User, id=user_id, role=RoleChoices.CLIENT)
        serializer = AdminWholesalePrioritySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        priority = serializer.validated_data["wholesale_priority"]
        note = (serializer.validated_data.get("wholesale_priority_note") or "").strip()
        user.wholesale_priority = priority
        user.wholesale_priority_note = note
        user.wholesale_priority_updated_at = timezone.now()

        update_fields = [
            "wholesale_priority",
            "wholesale_priority_note",
            "wholesale_priority_updated_at",
            "updated_at",
        ]

        # Priority is managed by master/admin manually and can also mark the user as service-center oriented.
        if priority != WholesalePriorityChoices.STANDARD and not user.is_service_center:
            user.is_service_center = True
            update_fields.append("is_service_center")

        user.save(update_fields=sorted(set(update_fields)))

        emit_event(
            "wholesale.priority_updated",
            user,
            actor=request.user,
            payload={"priority": priority, "note": note},
        )
        return Response(AdminUserSerializer(user).data, status=status.HTTP_200_OK)


class AdminFinanceSummaryView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def get(self, request):
        if not _can_view_staff_tools(request.user):
            return Response({"detail": "Недостаточно прав"}, status=status.HTTP_403_FORBIDDEN)

        queryset = _scoped_appointments_for_report(request.user)

        today = timezone.localdate()
        date_from = parse_date(request.query_params.get("from") or "") or (today - timedelta(days=6))
        date_to = parse_date(request.query_params.get("to") or "") or today
        if date_from > date_to:
            date_from, date_to = date_to, date_from

        paid_queryset = queryset.filter(payment_confirmed_at__isnull=False)
        in_work_queryset = queryset.filter(status__in=[AppointmentStatusChoices.PAID, AppointmentStatusChoices.IN_PROGRESS])
        period_queryset = paid_queryset.filter(
            payment_confirmed_at__date__gte=date_from,
            payment_confirmed_at__date__lte=date_to,
        )

        payload = {
            "scope": "admin" if (request.user.is_superuser or request.user.role == RoleChoices.ADMIN) else "master",
            "currency": "RUB",
            "date_from": str(date_from),
            "date_to": str(date_to),
            "paid_total": int(paid_queryset.aggregate(v=Sum("total_price"))["v"] or 0),
            "paid_count": paid_queryset.count(),
            "in_work_total": int(in_work_queryset.aggregate(v=Sum("total_price"))["v"] or 0),
            "in_work_count": in_work_queryset.count(),
            "period_total": int(period_queryset.aggregate(v=Sum("total_price"))["v"] or 0),
            "period_count": period_queryset.count(),
        }
        return Response(payload, status=status.HTTP_200_OK)


class WeeklyPerformanceReportView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def get(self, request):
        if not _can_view_staff_tools(request.user):
            return Response({"detail": "Недостаточно прав"}, status=status.HTTP_403_FORBIDDEN)

        queryset = _scoped_appointments_for_report(request.user)
        now = timezone.now()
        week_start = now - timedelta(days=7)

        weekly_queryset = queryset.filter(created_at__gte=week_start, created_at__lte=now)
        closed_queryset = queryset.filter(
            completed_at__isnull=False,
            completed_at__gte=week_start,
            completed_at__lte=now,
        )
        first_response_agg = (
            queryset.filter(
                taken_at__isnull=False,
                taken_at__gte=week_start,
                taken_at__lte=now,
            )
            .annotate(
                response_time=ExpressionWrapper(F("taken_at") - F("created_at"), output_field=DurationField())
            )
            .aggregate(avg=Avg("response_time"))
        )
        completion_agg = (
            closed_queryset.annotate(
                completion_time=ExpressionWrapper(F("completed_at") - F("created_at"), output_field=DurationField())
            ).aggregate(avg=Avg("completion_time"))
        )

        def _seconds(duration):
            return round(duration.total_seconds(), 2) if duration else 0.0

        problematic_count = (
            weekly_queryset.filter(
                Q(sla_breached=True)
                | Q(status__in=[AppointmentStatusChoices.CANCELLED, AppointmentStatusChoices.DECLINED_BY_MASTER])
                | Q(client__client_stats__risk_level__in=["high", "critical"])
            )
            .distinct()
            .count()
        )

        daily_rows = (
            weekly_queryset.annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(
                total=Count("id"),
                closed=Count("id", filter=Q(status=AppointmentStatusChoices.COMPLETED)),
                sla_breached=Count("id", filter=Q(sla_breached=True)),
            )
            .order_by("day")
        )

        payload = {
            "scope": "admin" if (request.user.is_superuser or request.user.role == RoleChoices.ADMIN) else "master",
            "date_from": week_start.date().isoformat(),
            "date_to": now.date().isoformat(),
            "sla_breached_count": weekly_queryset.filter(sla_breached=True).count(),
            "avg_first_response_seconds": _seconds(first_response_agg.get("avg")),
            "avg_completion_seconds": _seconds(completion_agg.get("avg")),
            "closed_count": closed_queryset.count(),
            "problematic_cases_count": problematic_count,
            "daily": [
                {
                    "date": row["day"].isoformat() if row.get("day") else "",
                    "total": row.get("total", 0),
                    "closed": row.get("closed", 0),
                    "sla_breached": row.get("sla_breached", 0),
                }
                for row in daily_rows
            ],
        }
        return Response(payload, status=status.HTTP_200_OK)


class AdminMastersView(BoundedListAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    serializer_class = AdminUserSerializer
    default_list_limit = settings.ADMIN_API_LIST_LIMIT
    max_list_limit = settings.ADMIN_API_MAX_LIST_LIMIT

    def get_queryset(self):
        queryset = User.objects.filter(role=RoleChoices.MASTER).select_related("master_stats").order_by("-id")
        min_score = self.request.query_params.get("min_score")
        ordering = self.request.query_params.get("ordering")
        level = (self.request.query_params.get("level") or "").strip().lower()

        if min_score and str(min_score).isdigit():
            queryset = queryset.filter(master_stats__master_score__gte=int(min_score))

        if level == "senior":
            queryset = queryset.filter(master_level=MasterLevelChoices.SENIOR)
        elif level == "regular":
            queryset = queryset.exclude(master_level=MasterLevelChoices.SENIOR)
        elif level in MasterLevelChoices.values:
            queryset = queryset.filter(master_level=level)

        if ordering in {"master_score", "-master_score"}:
            queryset = queryset.order_by(f"{'' if ordering == 'master_score' else '-'}master_stats__master_score", "-id")
        return queryset


class AdminMasterQualityUpdateView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)

    def post(self, request, user_id: int):
        user = get_object_or_404(User, id=user_id, role=RoleChoices.MASTER)
        serializer = AdminMasterQualitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        update_fields = ["updated_at"]
        next_tier = data.get("master_tier")
        if not next_tier and "master_level" in data:
            next_tier = _master_level_to_tier(data["master_level"])
        if next_tier:
            user.master_level = _master_tier_to_level(next_tier)
            update_fields.append("master_level")

        # Legacy QA/specialization fields are no longer used in master management.
        if user.master_specializations:
            user.master_specializations = ""
            update_fields.append("master_specializations")
        if user.master_quality_comment:
            user.master_quality_comment = ""
            update_fields.append("master_quality_comment")
        if not user.master_quality_approved:
            user.master_quality_approved = True
            update_fields.append("master_quality_approved")
        if not user.master_quality_approved_at:
            user.master_quality_approved_at = timezone.now()
            update_fields.append("master_quality_approved_at")

        user.save(update_fields=sorted(set(update_fields)))
        return Response(AdminUserSerializer(user).data)


class AdminAllUsersView(BoundedListAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    serializer_class = AdminUserSerializer
    default_list_limit = settings.ADMIN_API_LIST_LIMIT
    max_list_limit = settings.ADMIN_API_MAX_LIST_LIMIT

    def get_queryset(self):
        queryset = User.objects.all().order_by("-id")
        role = self.request.query_params.get("role")
        if role in RoleChoices.values:
            queryset = queryset.filter(role=role)
        return queryset


class AdminUserRoleUpdateView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)

    def post(self, request, user_id: int):
        user = get_object_or_404(User, id=user_id)
        if user.is_superuser and not request.user.is_superuser:
            return Response({"detail": "Изменение суперпользователя запрещено."}, status=status.HTTP_403_FORBIDDEN)

        serializer = AdminUserRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_role = serializer.validated_data["role"]
        if request.user.id == user.id and not request.user.is_superuser and new_role != RoleChoices.ADMIN:
            return Response({"detail": "Нельзя снять с себя роль администратора."}, status=status.HTTP_400_BAD_REQUEST)

        user.role = new_role
        update_fields = ["role", "updated_at"]

        if new_role == RoleChoices.MASTER:
            if "is_master_active" in serializer.validated_data:
                user.is_master_active = serializer.validated_data["is_master_active"]
                update_fields.append("is_master_active")
            if not user.master_quality_approved:
                user.master_quality_approved = True
                update_fields.append("master_quality_approved")
            if not user.master_quality_approved_at:
                user.master_quality_approved_at = timezone.now()
                update_fields.append("master_quality_approved_at")
            if user.master_specializations:
                user.master_specializations = ""
                update_fields.append("master_specializations")
            if user.master_quality_comment:
                user.master_quality_comment = ""
                update_fields.append("master_quality_comment")
        else:
            user.is_master_active = False
            update_fields.append("is_master_active")

        if new_role != RoleChoices.CLIENT and user.is_banned:
            user.is_banned = False
            user.ban_reason = ""
            user.banned_at = None
            update_fields.extend(["is_banned", "ban_reason", "banned_at"])

        if not user.is_superuser:
            user.is_staff = new_role == RoleChoices.ADMIN
            update_fields.append("is_staff")

        user.save(update_fields=sorted(set(update_fields)))
        return Response(AdminUserSerializer(user).data)


class AdminSystemSettingsView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)

    def get(self, request):
        settings_obj = SiteSettings.load()
        serializer = AdminSystemSettingsSerializer(settings_obj)
        return Response(serializer.data)

    def put(self, request):
        settings_obj = SiteSettings.load()
        serializer = AdminSystemSettingsSerializer(settings_obj, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def patch(self, request):
        settings_obj = SiteSettings.load()
        serializer = AdminSystemSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AdminSystemStatusView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)

    def get(self, request):
        db_connected = False
        db_error = ""
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            db_connected = True
        except Exception as exc:  # pragma: no cover - defensive path
            db_error = str(exc)

        active_statuses = (
            AppointmentStatusChoices.NEW,
            AppointmentStatusChoices.IN_REVIEW,
            AppointmentStatusChoices.AWAITING_PAYMENT,
            AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED,
            AppointmentStatusChoices.PAID,
            AppointmentStatusChoices.IN_PROGRESS,
        )

        settings_obj = SiteSettings.load()
        data = {
            "server_time": timezone.now(),
            "debug": settings.DEBUG,
            "database": {
                "connected": db_connected,
                "engine": settings.DATABASES["default"]["ENGINE"],
                "error": db_error,
            },
            "telegram": {
                "bot_token_configured": bool(settings.TELEGRAM_BOT_TOKEN),
                "login_username_configured": bool(settings.TELEGRAM_LOGIN_BOT_USERNAME),
                "login_username": settings.TELEGRAM_LOGIN_BOT_USERNAME or "",
            },
            "payments": {
                "bank_requisites_configured": bool(settings_obj.bank_requisites.strip()),
                "crypto_requisites_configured": bool(settings_obj.crypto_requisites.strip()),
                "instructions_configured": bool(settings_obj.instructions.strip()),
            },
            "operations": {
                "deploy_lock": get_deploy_lock_state(),
                "maintenance_mode": get_maintenance_mode_state(),
                "release": get_release_state(),
                "rollback": get_rollback_inventory(),
                "jobs": get_job_statuses(),
            },
            "sla": {
                "response_minutes": settings_obj.sla_response_minutes,
                "completion_hours": settings_obj.sla_completion_hours,
            },
            "counts": {
                "users_total": User.objects.count(),
                "clients_total": User.objects.filter(role=RoleChoices.CLIENT).count(),
                "masters_total": User.objects.filter(role=RoleChoices.MASTER).count(),
                "admins_total": User.objects.filter(role=RoleChoices.ADMIN).count() + User.objects.filter(is_superuser=True).exclude(role=RoleChoices.ADMIN).count(),
                "appointments_total": Appointment.objects.count(),
                "appointments_active": Appointment.objects.filter(status__in=active_statuses).count(),
            },
        }
        return Response(data)


class AdminSystemRunActionView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)

    ACTION_COMMANDS = {
        AdminSystemActionSerializer.ACTION_MIGRATE: {
            "command": "migrate",
            "kwargs": {"interactive": False, "verbosity": 1},
        },
        AdminSystemActionSerializer.ACTION_COLLECTSTATIC: {
            "command": "collectstatic",
            "kwargs": {"interactive": False, "verbosity": 1},
        },
        AdminSystemActionSerializer.ACTION_CLEARSESSIONS: {
            "command": "clearsessions",
            "kwargs": {"verbosity": 1},
        },
        AdminSystemActionSerializer.ACTION_FLUSH_EXPIRED_TOKENS: {
            "command": "flushexpiredtokens",
            "kwargs": {"verbosity": 1},
        },
        AdminSystemActionSerializer.ACTION_COMPUTE_DAILY_METRICS: {
            "command": "compute_daily_metrics",
            "kwargs": {},
        },
        AdminSystemActionSerializer.ACTION_CHECK: {
            "command": "check",
            "kwargs": {"verbosity": 1},
        },
    }

    def post(self, request):
        serializer = AdminSystemActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action = serializer.validated_data["action"]
        action_spec = self.ACTION_COMMANDS[action]

        stdout = io.StringIO()
        stderr = io.StringIO()
        started_at = time.monotonic()
        success = True

        try:
            call_command(
                action_spec["command"],
                stdout=stdout,
                stderr=stderr,
                **action_spec["kwargs"],
            )
        except Exception as exc:
            success = False
            stderr.write(f"{type(exc).__name__}: {exc}\\n")

        duration_seconds = round(time.monotonic() - started_at, 2)
        return Response(
            {
                "action": action,
                "success": success,
                "duration_seconds": duration_seconds,
                "stdout": stdout.getvalue(),
                "stderr": stderr.getvalue(),
            },
            status=status.HTTP_200_OK if success else status.HTTP_400_BAD_REQUEST,
        )


class AdminSendClientEmailView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)

    def post(self, request):
        serializer = AdminSendClientEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if not settings.EMAIL_HOST:
            return Response(
                {"detail": "SMTP не настроен. Заполните EMAIL_* переменные в backend/.env и BACKEND_SECRETS_FILE."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        subject = data["subject"].strip()
        message = data["message"].strip()
        send_to_all = data.get("send_to_all", False)
        user_ids = data.get("user_ids") or []

        if not subject or not message:
            return Response(
                {"detail": "Тема и текст письма обязательны."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = User.objects.filter(role=RoleChoices.CLIENT)
        if not send_to_all:
            queryset = queryset.filter(id__in=user_ids)

        targets = list(queryset.only("id", "username", "email"))
        recipients = [user for user in targets if (user.email or "").strip()]
        skipped_without_email = [user.id for user in targets if not (user.email or "").strip()]

        if not recipients:
            return Response(
                {"detail": "Нет клиентов с заполненным email для отправки."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sent_count = 0
        failed = []
        connection = get_connection(fail_silently=False)
        with connection:
            for user in recipients:
                try:
                    delivered = send_mail(
                        subject=subject,
                        message=message,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[user.email],
                        fail_silently=False,
                        connection=connection,
                    )
                    if delivered:
                        sent_count += 1
                    else:
                        failed.append({"user_id": user.id, "username": user.username, "error": "delivery_failed"})
                except Exception as exc:  # pragma: no cover - network dependent
                    failed.append({"user_id": user.id, "username": user.username, "error": str(exc)[:300]})

        return Response(
            {
                "requested_total": len(targets),
                "with_email_total": len(recipients),
                "sent_count": sent_count,
                "skipped_without_email": skipped_without_email,
                "failed": failed,
            },
            status=status.HTTP_200_OK,
        )
