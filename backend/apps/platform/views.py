from __future__ import annotations

from django.db.models import Q
from django.conf import settings
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole, IsAuthenticatedAndNotBanned
from apps.accounts.models import RoleChoices
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.common.api_limits import BoundedListAPIView

from .models import FeatureFlag, Notification
from .serializers import (
    DailyMetricsSerializer,
    FeatureFlagSerializer,
    NotificationMarkReadSerializer,
    NotificationSerializer,
    PlatformEventSerializer,
    RuleSerializer,
    RuleSchemaSerializer,
)
from .models import DailyMetrics, PlatformEvent, Rule


RULE_EVENT_TYPES = (
    ("appointment.created", "Создана заявка"),
    ("appointment.master_taken", "Мастер взял заявку"),
    ("appointment.price_set", "Выставлена цена"),
    ("appointment.payment_marked", "Оплата отмечена"),
    ("appointment.payment_confirmed", "Оплата подтверждена"),
    ("appointment.work_started", "Работа начата"),
    ("appointment.work_completed", "Работа завершена"),
    ("appointment.deleted_by_admin", "Заявка удалена админом"),
    ("chat.message_sent", "Отправлено сообщение в чат"),
    ("chat.message_deleted", "Удалено сообщение в чате"),
    ("review.master_created", "Клиент оставил отзыв мастеру"),
    ("review.client_created", "Мастер оставил отзыв клиенту"),
    ("sla.breached", "Нарушен SLA"),
    ("wholesale.requested", "Запрошен wholesale-статус"),
    ("wholesale.reviewed", "Проверен wholesale-статус"),
    ("wholesale.priority_updated", "Обновлен wholesale-приоритет"),
)

RULE_OPERATORS = (
    ("==", "Равно"),
    ("!=", "Не равно"),
    (">", "Больше"),
    (">=", "Больше или равно"),
    ("<", "Меньше"),
    ("<=", "Меньше или равно"),
    ("in", "Входит в список"),
    ("not_in", "Не входит в список"),
    ("contains", "Содержит"),
)

RULE_NOTIFICATION_TARGETS = (
    ("admins", "Админам"),
    ("client", "Клиенту"),
    ("master", "Мастеру"),
    ("actor", "Инициатору события"),
    ("role", "Всем пользователям роли"),
)


def _status_options():
    return [{"value": value, "label": label} for value, label in AppointmentStatusChoices.choices]


def _role_options():
    return [{"value": value, "label": label} for value, label in RoleChoices.choices]


def _rule_schema_payload():
    status_options = _status_options()
    role_options = _role_options()
    event_options = [{"value": value, "label": label} for value, label in RULE_EVENT_TYPES]
    target_options = [{"value": value, "label": label} for value, label in RULE_NOTIFICATION_TARGETS]
    boolean_options = [
        {"value": "true", "label": "Да"},
        {"value": "false", "label": "Нет"},
    ]
    return {
        "event_types": event_options,
        "condition_fields": [
            {
                "value": "appointment.status",
                "label": "Статус заявки",
                "type": "enum",
                "supported_operators": ["==", "!=", "in", "not_in"],
                "options": status_options,
            },
            {
                "value": "appointment.total_price",
                "label": "Цена заявки",
                "type": "number",
                "supported_operators": ["==", "!=", ">", ">=", "<", "<="],
            },
            {
                "value": "appointment.platform_tags",
                "label": "Теги заявки",
                "type": "string[]",
                "supported_operators": ["contains", "in", "not_in"],
            },
            {
                "value": "client.risk_level",
                "label": "Уровень риска клиента",
                "type": "enum",
                "supported_operators": ["==", "!=", "in", "not_in", ">=", "<="],
                "options": [
                    {"value": "low", "label": "Low"},
                    {"value": "medium", "label": "Medium"},
                    {"value": "high", "label": "High"},
                    {"value": "critical", "label": "Critical"},
                ],
            },
            {
                "value": "client.risk_score",
                "label": "Risk score клиента",
                "type": "number",
                "supported_operators": ["==", "!=", ">", ">=", "<", "<="],
            },
            {
                "value": "client.is_banned",
                "label": "Клиент заблокирован",
                "type": "boolean",
                "supported_operators": ["==", "!="],
                "options": boolean_options,
            },
            {
                "value": "master.master_score",
                "label": "Score мастера",
                "type": "number",
                "supported_operators": ["==", "!=", ">", ">=", "<", "<="],
            },
            {
                "value": "master.is_master_active",
                "label": "Мастер активен",
                "type": "boolean",
                "supported_operators": ["==", "!="],
                "options": boolean_options,
            },
            {
                "value": "event.event_type",
                "label": "Тип события",
                "type": "enum",
                "supported_operators": ["==", "!=", "in", "not_in"],
                "options": event_options,
            },
        ],
        "operators": [{"value": value, "label": label} for value, label in RULE_OPERATORS],
        "actions": [
            {
                "value": "request_admin_attention",
                "label": "Запросить внимание админа",
                "fields": [
                    {"key": "title", "label": "Заголовок", "type": "string", "required": False},
                    {"key": "message", "label": "Сообщение", "type": "string", "required": False},
                ],
            },
            {
                "value": "create_notification",
                "label": "Создать уведомление",
                "fields": [
                    {
                        "key": "target",
                        "label": "Кому",
                        "type": "enum",
                        "required": True,
                        "options": target_options,
                    },
                    {
                        "key": "role",
                        "label": "Роль",
                        "type": "enum",
                        "required": False,
                        "options": role_options,
                    },
                    {"key": "title", "label": "Заголовок", "type": "string", "required": False},
                    {"key": "message", "label": "Сообщение", "type": "string", "required": False},
                ],
            },
            {
                "value": "assign_tag",
                "label": "Назначить тег",
                "fields": [
                    {"key": "tag", "label": "Тег", "type": "string", "required": True},
                ],
            },
            {
                "value": "change_status",
                "label": "Изменить статус заявки",
                "fields": [
                    {
                        "key": "to_status",
                        "label": "Новый статус",
                        "type": "enum",
                        "required": True,
                        "options": status_options,
                    },
                ],
            },
        ],
        "roles": role_options,
        "notification_targets": target_options,
    }


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


class FeatureFlagListCreateView(BoundedListAPIView, generics.ListCreateAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    serializer_class = FeatureFlagSerializer
    queryset = FeatureFlag.objects.prefetch_related("users").all()
    default_list_limit = settings.ADMIN_API_LIST_LIMIT
    max_list_limit = settings.ADMIN_API_MAX_LIST_LIMIT


class FeatureFlagDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    serializer_class = FeatureFlagSerializer
    queryset = FeatureFlag.objects.prefetch_related("users").all()
    lookup_field = "id"
    lookup_url_kwarg = "flag_id"


class NotificationListView(BoundedListAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)
    serializer_class = NotificationSerializer
    default_list_limit = settings.DEFAULT_API_LIST_LIMIT
    max_list_limit = settings.MAX_API_LIST_LIMIT

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Notification.objects.none()
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


class PlatformEventListView(BoundedListAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    serializer_class = PlatformEventSerializer
    default_list_limit = settings.DEFAULT_API_LIST_LIMIT
    max_list_limit = settings.MAX_API_LIST_LIMIT

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
        return queryset.order_by("-id")

class RuleListCreateView(BoundedListAPIView, generics.ListCreateAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    serializer_class = RuleSerializer
    queryset = Rule.objects.all().order_by("name")
    default_list_limit = settings.ADMIN_API_LIST_LIMIT
    max_list_limit = settings.ADMIN_API_MAX_LIST_LIMIT


class RuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    serializer_class = RuleSerializer
    queryset = Rule.objects.all()
    lookup_field = "id"
    lookup_url_kwarg = "rule_id"


class RuleSchemaView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)

    def get(self, request):
        serializer = RuleSchemaSerializer(_rule_schema_payload())
        return Response(serializer.data)


class DailyMetricsListView(BoundedListAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    serializer_class = DailyMetricsSerializer
    default_list_limit = 90
    max_list_limit = 365

    def get_queryset(self):
        queryset = DailyMetrics.objects.all().order_by("-date")
        date_from = self.request.query_params.get("from")
        date_to = self.request.query_params.get("to")
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)
        return queryset

