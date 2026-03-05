from __future__ import annotations

from rest_framework import generics, permissions
from django.db.models import Q
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole, IsAuthenticatedAndNotBanned
from apps.accounts.models import RoleChoices
from apps.appointments.models import Appointment

from .models import FeatureFlag, Notification
from .serializers import (
    DailyMetricsSerializer,
    FeatureFlagSerializer,
    NotificationMarkReadSerializer,
    NotificationSerializer,
    PlatformEventSerializer,
    RuleSerializer,
)
from .models import DailyMetrics, PlatformEvent, Rule


def _notification_queryset_for_user(user):
    queryset = Notification.objects.filter(user=user)
    user_role = user.role or (RoleChoices.ADMIN if getattr(user, "is_superuser", False) else "")

    # Optional explicit scoping flags in payload.
    queryset = queryset.filter(Q(payload__target_user_id__isnull=True) | Q(payload__target_user_id=user.id))
    queryset = queryset.filter(Q(payload__target_role__isnull=True) | Q(payload__target_role=user_role))
    if user_role != RoleChoices.ADMIN:
        queryset = queryset.exclude(title__iexact="Новая оптовая заявка")

    if user_role == RoleChoices.CLIENT:
        appointment_ids = Appointment.objects.filter(client=user).values_list("id", flat=True)
        queryset = queryset.filter(
            Q(payload__appointment_id__isnull=True) | Q(payload__appointment_id__in=appointment_ids)
        )
        queryset = queryset.filter(Q(payload__client_id__isnull=True) | Q(payload__client_id=user.id))
    elif user_role == RoleChoices.MASTER:
        appointment_ids = Appointment.objects.filter(assigned_master=user).values_list("id", flat=True)
        queryset = queryset.filter(
            Q(payload__appointment_id__isnull=True) | Q(payload__appointment_id__in=appointment_ids)
        )
        queryset = queryset.filter(Q(payload__master_id__isnull=True) | Q(payload__master_id=user.id))
    elif user_role == RoleChoices.ADMIN:
        queryset = queryset.filter(Q(payload__admin_id__isnull=True) | Q(payload__admin_id=user.id))
    else:
        queryset = queryset.filter(payload__appointment_id__isnull=True)

    return queryset


class FeatureFlagListCreateView(generics.ListCreateAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    serializer_class = FeatureFlagSerializer
    queryset = FeatureFlag.objects.prefetch_related("users").all()


class FeatureFlagDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    serializer_class = FeatureFlagSerializer
    queryset = FeatureFlag.objects.prefetch_related("users").all()
    lookup_field = "id"
    lookup_url_kwarg = "flag_id"


class NotificationListView(generics.ListAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)
    serializer_class = NotificationSerializer

    def get_queryset(self):
        queryset = _notification_queryset_for_user(self.request.user).order_by("-id")
        is_read = self.request.query_params.get("is_read")
        if is_read in {"0", "1"}:
            queryset = queryset.filter(is_read=is_read == "1")
        return queryset


class NotificationMarkReadView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request):
        serializer = NotificationMarkReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save(user=request.user)
        return Response({"updated": updated})


class NotificationUnreadCountView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def get(self, request):
        count = _notification_queryset_for_user(request.user).filter(is_read=False).count()
        return Response({"unread_count": count})


class PlatformEventListView(generics.ListAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    serializer_class = PlatformEventSerializer

    def get_queryset(self):
        queryset = PlatformEvent.objects.select_related("actor").all()
        event_type = self.request.query_params.get("event_type")
        entity_type = self.request.query_params.get("entity_type")
        entity_id = self.request.query_params.get("entity_id")
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        if entity_id:
            queryset = queryset.filter(entity_id=entity_id)
        return queryset[:200]


class RuleListCreateView(generics.ListCreateAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    serializer_class = RuleSerializer
    queryset = Rule.objects.all().order_by("name")


class RuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    serializer_class = RuleSerializer
    queryset = Rule.objects.all()
    lookup_field = "id"
    lookup_url_kwarg = "rule_id"


class DailyMetricsListView(generics.ListAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    serializer_class = DailyMetricsSerializer

    def get_queryset(self):
        queryset = DailyMetrics.objects.all().order_by("-date")
        date_from = self.request.query_params.get("from")
        date_to = self.request.query_params.get("to")
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)
        return queryset[:365]

