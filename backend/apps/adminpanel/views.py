from __future__ import annotations

import io
import time

from django.conf import settings
from django.core.management import call_command
from django.db import connection
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import RoleChoices, SiteSettings, User
from apps.accounts.permissions import IsAdminRole
from apps.accounts.services import recalculate_client_stats
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.appointments.serializers import AppointmentSerializer
from apps.appointments.views import ConfirmPaymentMixin

from .filters import AdminAppointmentFilter
from .serializers import (
    AdminSystemActionSerializer,
    AdminSystemSettingsSerializer,
    AdminUserRoleSerializer,
    AdminUserSerializer,
    BanUserSerializer,
)


class AdminAppointmentListView(generics.ListAPIView):
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)
    serializer_class = AppointmentSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_class = AdminAppointmentFilter

    def get_queryset(self):
        return Appointment.objects.select_related("client", "assigned_master", "payment_confirmed_by").all()


class AdminConfirmPaymentView(APIView, ConfirmPaymentMixin):
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

    def post(self, request, appointment_id: int):
        return self.confirm_payment(request, appointment_id)


class AdminBanUserView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

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
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

    def post(self, request, user_id: int):
        user = get_object_or_404(User, id=user_id, role=RoleChoices.CLIENT)
        user.is_banned = False
        user.ban_reason = ""
        user.banned_at = None
        user.save(update_fields=["is_banned", "ban_reason", "banned_at", "updated_at"])
        recalculate_client_stats(user)
        return Response(AdminUserSerializer(user).data)


class AdminActivateMasterView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

    def post(self, request, user_id: int):
        user = get_object_or_404(User, id=user_id, role=RoleChoices.MASTER)
        user.is_master_active = True
        user.save(update_fields=["is_master_active", "updated_at"])
        return Response(AdminUserSerializer(user).data)


class AdminSuspendMasterView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

    def post(self, request, user_id: int):
        user = get_object_or_404(User, id=user_id, role=RoleChoices.MASTER)
        user.is_master_active = False
        user.save(update_fields=["is_master_active", "updated_at"])
        return Response(AdminUserSerializer(user).data)


class AdminClientsView(generics.ListAPIView):
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        return User.objects.filter(role=RoleChoices.CLIENT).order_by("-id")


class AdminMastersView(generics.ListAPIView):
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        queryset = User.objects.filter(role=RoleChoices.MASTER).select_related("master_stats").order_by("-id")
        min_score = self.request.query_params.get("min_score")
        ordering = self.request.query_params.get("ordering")

        if min_score and str(min_score).isdigit():
            queryset = queryset.filter(master_stats__master_score__gte=int(min_score))

        if ordering in {"master_score", "-master_score"}:
            queryset = queryset.order_by(f"{'' if ordering == 'master_score' else '-'}master_stats__master_score", "-id")
        return queryset


class AdminAllUsersView(generics.ListAPIView):
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        queryset = User.objects.all().order_by("-id")
        role = self.request.query_params.get("role")
        if role in RoleChoices.values:
            queryset = queryset.filter(role=role)
        return queryset


class AdminUserRoleUpdateView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

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
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

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
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

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
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

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
