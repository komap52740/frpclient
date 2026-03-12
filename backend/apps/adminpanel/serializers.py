from __future__ import annotations

from rest_framework import serializers

from apps.accounts.models import (
    MasterLevelChoices,
    RoleChoices,
    SiteSettings,
    User,
    WholesalePriorityChoices,
)
from apps.accounts.serializers import ClientStatsSerializer, MasterStatsSerializer
from apps.appointments.models import Appointment, AppointmentEvent, AppointmentEventType, PaymentMethodChoices
from apps.common.secure_media import build_appointment_media_url, build_user_media_url


class BanUserSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


class AdminUserSerializer(serializers.ModelSerializer):
    client_stats = ClientStatsSerializer(read_only=True)
    master_stats = MasterStatsSerializer(read_only=True)
    master_tier = serializers.SerializerMethodField()
    profile_photo_url = serializers.SerializerMethodField()
    wholesale_service_photo_1_url = serializers.SerializerMethodField()
    wholesale_service_photo_2_url = serializers.SerializerMethodField()
    wholesale_verified_by_username = serializers.SerializerMethodField()
    appointments_total = serializers.IntegerField(read_only=True, default=0)
    appointments_active = serializers.IntegerField(read_only=True, default=0)
    appointments_sla_breached = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "profile_photo_url",
            "role",
            "telegram_username",
            "is_banned",
            "ban_reason",
            "banned_at",
            "is_master_active",
            "master_tier",
            "master_level",
            "master_specializations",
            "master_quality_approved",
            "master_quality_approved_at",
            "master_quality_comment",
            "is_service_center",
            "wholesale_status",
            "wholesale_company_name",
            "wholesale_city",
            "wholesale_address",
            "wholesale_service_photo_1_url",
            "wholesale_service_photo_2_url",
            "wholesale_requested_at",
            "wholesale_reviewed_at",
            "wholesale_review_comment",
            "wholesale_verified_at",
            "wholesale_verified_by",
            "wholesale_verified_by_username",
            "wholesale_priority",
            "wholesale_priority_note",
            "wholesale_priority_updated_at",
            "appointments_total",
            "appointments_active",
            "appointments_sla_breached",
            "is_staff",
            "is_superuser",
            "client_stats",
            "master_stats",
        )

    def _build_file_url(self, obj: User, field_name: str) -> str | None:
        return build_user_media_url(self.context.get("request"), obj, field_name)

    def get_wholesale_service_photo_1_url(self, obj: User) -> str | None:
        return self._build_file_url(obj, "wholesale_service_photo_1")

    def get_wholesale_service_photo_2_url(self, obj: User) -> str | None:
        return self._build_file_url(obj, "wholesale_service_photo_2")

    def get_profile_photo_url(self, obj: User) -> str | None:
        return self._build_file_url(obj, "profile_photo")

    def get_wholesale_verified_by_username(self, obj: User) -> str:
        verifier = getattr(obj, "wholesale_verified_by", None)
        return getattr(verifier, "username", "") if verifier else ""

    def get_master_tier(self, obj: User) -> str:
        return "senior" if obj.master_level == MasterLevelChoices.SENIOR else "regular"


class AdminUserRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=RoleChoices.choices)
    is_master_active = serializers.BooleanField(required=False)


class AdminMasterQualitySerializer(serializers.Serializer):
    master_tier = serializers.ChoiceField(choices=(("senior", "senior"), ("regular", "regular")), required=False)
    master_level = serializers.ChoiceField(choices=MasterLevelChoices.choices, required=False)
    master_specializations = serializers.CharField(max_length=255, required=False, allow_blank=True)
    master_quality_approved = serializers.BooleanField(required=False)
    master_quality_comment = serializers.CharField(max_length=255, required=False, allow_blank=True)


class AdminWholesaleReviewSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=(("approve", "approve"), ("reject", "reject")))
    discount_percent = serializers.IntegerField(min_value=0, max_value=100, required=False)
    review_comment = serializers.CharField(max_length=255, required=False, allow_blank=True)


class AdminWholesalePrioritySerializer(serializers.Serializer):
    wholesale_priority = serializers.ChoiceField(choices=WholesalePriorityChoices.choices)
    wholesale_priority_note = serializers.CharField(max_length=255, required=False, allow_blank=True)


class AdminSystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = (
            "bank_requisites",
            "crypto_requisites",
            "instructions",
            "sla_response_minutes",
            "sla_completion_hours",
        )


class AdminSystemActionSerializer(serializers.Serializer):
    ACTION_MIGRATE = "migrate"
    ACTION_COLLECTSTATIC = "collectstatic"
    ACTION_CLEARSESSIONS = "clearsessions"
    ACTION_FLUSH_EXPIRED_TOKENS = "flushexpiredtokens"
    ACTION_COMPUTE_DAILY_METRICS = "compute_daily_metrics"
    ACTION_CHECK = "check"

    ACTION_CHOICES = (
        (ACTION_MIGRATE, "Применить миграции"),
        (ACTION_COLLECTSTATIC, "Собрать статические файлы"),
        (ACTION_CLEARSESSIONS, "Очистить просроченные сессии"),
        (ACTION_FLUSH_EXPIRED_TOKENS, "Очистить просроченные токены"),
        (ACTION_COMPUTE_DAILY_METRICS, "Пересчитать метрики"),
        (ACTION_CHECK, "Проверка конфигурации Django"),
    )

    action = serializers.ChoiceField(choices=ACTION_CHOICES)


class PaymentRegistryHistoryItemSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)
    event_label = serializers.SerializerMethodField()

    class Meta:
        model = AppointmentEvent
        fields = (
            "id",
            "event_type",
            "event_label",
            "created_at",
            "actor",
            "actor_username",
            "note",
            "metadata",
        )

    def get_event_label(self, obj: AppointmentEvent) -> str:
        try:
            return AppointmentEventType(obj.event_type).label
        except Exception:  # pragma: no cover - defensive fallback
            return obj.event_type


class AdminPaymentRegistryRowSerializer(serializers.ModelSerializer):
    appointment_id = serializers.IntegerField(source="id", read_only=True)
    client_username = serializers.CharField(source="client.username", read_only=True)
    master_username = serializers.CharField(source="assigned_master.username", read_only=True)
    payment_confirmed_by_username = serializers.CharField(source="payment_confirmed_by.username", read_only=True)
    payment_proof_url = serializers.SerializerMethodField()
    payment_method_label = serializers.SerializerMethodField()
    history = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = (
            "appointment_id",
            "status",
            "total_price",
            "currency",
            "created_at",
            "updated_at",
            "client_id",
            "client_username",
            "assigned_master_id",
            "master_username",
            "payment_method",
            "payment_method_label",
            "payment_requisites_note",
            "payment_proof_url",
            "payment_marked_at",
            "payment_confirmed_at",
            "payment_confirmed_by",
            "payment_confirmed_by_username",
            "history",
        )

    def get_payment_proof_url(self, obj: Appointment) -> str | None:
        return build_appointment_media_url(self.context.get("request"), obj, "payment_proof")

    def get_payment_method_label(self, obj: Appointment) -> str:
        if not obj.payment_method:
            return ""
        try:
            return PaymentMethodChoices(obj.payment_method).label
        except Exception:  # pragma: no cover - defensive fallback
            return obj.payment_method

    def get_history(self, obj: Appointment) -> list[dict]:
        events = getattr(obj, "payment_history_events", None)
        if events is None:
            events = (
                obj.events.filter(
                    event_type__in=(
                        AppointmentEventType.PAYMENT_PROOF_UPLOADED,
                        AppointmentEventType.PAYMENT_MARKED,
                        AppointmentEventType.PAYMENT_CONFIRMED,
                    )
                )
                .select_related("actor")
                .order_by("-id")
            )
        serializer = PaymentRegistryHistoryItemSerializer(events, many=True)
        return serializer.data


class AdminSendClientEmailSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=255)
    message = serializers.CharField(max_length=10000)
    user_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
    )
    send_to_all = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        send_to_all = attrs.get("send_to_all", False)
        user_ids = attrs.get("user_ids") or []
        if not send_to_all and not user_ids:
            raise serializers.ValidationError("Select users or set send_to_all=true.")
        return attrs
