from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import RoleChoices, User
from apps.accounts.permissions import IsAdminRole
from apps.appointments.access import get_appointment_for_user
from apps.appointments.models import Appointment
from apps.appointments.serializers import AppointmentSerializer
from apps.appointments.views import ConfirmPaymentMixin

from .filters import AdminAppointmentFilter
from .serializers import AdminUserSerializer, BanUserSerializer


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
        return Response(AdminUserSerializer(user).data)


class AdminUnbanUserView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)

    def post(self, request, user_id: int):
        user = get_object_or_404(User, id=user_id, role=RoleChoices.CLIENT)
        user.is_banned = False
        user.ban_reason = ""
        user.banned_at = None
        user.save(update_fields=["is_banned", "ban_reason", "banned_at", "updated_at"])
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
        return User.objects.filter(role=RoleChoices.MASTER).order_by("-id")
