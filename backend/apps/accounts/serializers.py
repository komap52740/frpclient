from __future__ import annotations

from collections.abc import Mapping

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from apps.appointments.models import Appointment, AppointmentStatusChoices

from .models import ClientStats, MasterStats, SiteSettings, User, WholesaleStatusChoices
from .telegram import verify_telegram_login


class ClientStatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientStats
        fields = (
            "completed_orders_count",
            "cancelled_orders_count",
            "average_rating",
            "cancellation_rate",
            "level",
            "risk_score",
            "risk_level",
            "risk_updated_at",
        )


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = (
            "bank_requisites",
            "crypto_requisites",
            "instructions",
            "sla_response_minutes",
            "sla_completion_hours",
        )


class MeSerializer(serializers.ModelSerializer):
    client_stats = ClientStatsSerializer(read_only=True)
    master_stats = serializers.SerializerMethodField()
    profile_photo_url = serializers.SerializerMethodField()
    wholesale_service_photo_1_url = serializers.SerializerMethodField()
    wholesale_service_photo_2_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "telegram_id",
            "telegram_username",
            "telegram_photo_url",
            "profile_photo_url",
            "role",
            "is_master_active",
            "master_level",
            "master_specializations",
            "master_quality_approved",
            "master_quality_approved_at",
            "master_quality_comment",
            "is_service_center",
            "wholesale_status",
            "wholesale_discount_percent",
            "wholesale_company_name",
            "wholesale_comment",
            "wholesale_service_details",
            "wholesale_service_photo_1_url",
            "wholesale_service_photo_2_url",
            "wholesale_requested_at",
            "wholesale_reviewed_at",
            "wholesale_review_comment",
            "is_banned",
            "ban_reason",
            "client_stats",
            "master_stats",
        )

    def get_master_stats(self, obj: User):
        if obj.role != "master":
            return None
        stats = getattr(obj, "master_stats", None)
        return MasterStatsSerializer(stats).data if stats else None

    def _build_file_url(self, obj: User, field_name: str):
        file_field = getattr(obj, field_name, None)
        if not file_field or not getattr(file_field, "url", None):
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(file_field.url) if request else file_field.url

    def get_wholesale_service_photo_1_url(self, obj: User):
        return self._build_file_url(obj, "wholesale_service_photo_1")

    def get_wholesale_service_photo_2_url(self, obj: User):
        return self._build_file_url(obj, "wholesale_service_photo_2")

    def get_profile_photo_url(self, obj: User):
        return self._build_file_url(obj, "profile_photo")


class MasterStatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = MasterStats
        fields = (
            "avg_rating",
            "completion_rate",
            "avg_response_seconds",
            "active_workload",
            "cancellation_rate",
            "master_score",
            "score_updated_at",
        )


class TelegramAuthSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    first_name = serializers.CharField(max_length=255)
    last_name = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    username = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    photo_url = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    auth_date = serializers.IntegerField()
    hash = serializers.CharField(max_length=255)

    def to_internal_value(self, data):
        if isinstance(data, Mapping):
            # Keep only known keys for DRF validation, but still verify signature using full initial payload.
            data = {field_name: data.get(field_name) for field_name in self.fields if field_name in data}
        return super().to_internal_value(data)

    def validate(self, attrs):
        raw_payload = {}
        if isinstance(self.initial_data, Mapping):
            raw_payload = dict(self.initial_data)

        if not verify_telegram_login(raw_payload or attrs, settings.TELEGRAM_BOT_TOKEN):
            raise serializers.ValidationError("Неверная подпись Telegram.")

        now_ts = int(timezone.now().timestamp())
        if now_ts - attrs["auth_date"] > settings.TELEGRAM_AUTH_MAX_AGE_SECONDS:
            raise serializers.ValidationError("Срок авторизации Telegram истёк.")

        return attrs


class MarkPaidSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(choices=(("crypto", "crypto"), ("bank_transfer", "bank_transfer")))


class PasswordLoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=255, trim_whitespace=False)


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=255, trim_whitespace=False)
    password_confirm = serializers.CharField(max_length=255, trim_whitespace=False)

    def validate_username(self, value: str) -> str:
        username = value.strip()
        if len(username) < 3:
            raise serializers.ValidationError("Ник должен содержать минимум 3 символа.")
        if User.objects.filter(username=username).exists():
            raise serializers.ValidationError("Пользователь с таким ником уже существует.")
        return username

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Пароли не совпадают."})
        if len(attrs["password"]) < 8:
            raise serializers.ValidationError({"password": "Пароль должен содержать минимум 8 символов."})
        return attrs


class BootstrapAdminSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=255, trim_whitespace=False)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate_username(self, value: str) -> str:
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Пользователь с таким логином уже существует.")
        return value

    def validate_password(self, value: str) -> str:
        if len(value) < 8:
            raise serializers.ValidationError("Пароль должен содержать минимум 8 символов.")
        return value


class WholesaleRequestSerializer(serializers.Serializer):
    is_service_center = serializers.BooleanField(default=True)
    wholesale_company_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    wholesale_comment = serializers.CharField(max_length=500, required=False, allow_blank=True)
    wholesale_service_details = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    wholesale_service_photo_1 = serializers.FileField(required=False, allow_null=True)
    wholesale_service_photo_2 = serializers.FileField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get("is_service_center") and not (attrs.get("wholesale_company_name") or "").strip():
            raise serializers.ValidationError({"wholesale_company_name": "Укажите название сервисного центра"})
        return attrs


class WholesaleStatusSerializer(serializers.Serializer):
    is_service_center = serializers.BooleanField()
    wholesale_status = serializers.ChoiceField(choices=WholesaleStatusChoices.choices)
    wholesale_discount_percent = serializers.IntegerField(min_value=0, max_value=100)
    wholesale_company_name = serializers.CharField(allow_blank=True)
    wholesale_comment = serializers.CharField(allow_blank=True)
    wholesale_service_details = serializers.CharField(allow_blank=True)
    wholesale_service_photo_1_url = serializers.CharField(allow_blank=True, allow_null=True)
    wholesale_service_photo_2_url = serializers.CharField(allow_blank=True, allow_null=True)
    wholesale_requested_at = serializers.DateTimeField(allow_null=True)
    wholesale_reviewed_at = serializers.DateTimeField(allow_null=True)
    wholesale_review_comment = serializers.CharField(allow_blank=True)


class ClientProfileDetailSerializer(serializers.ModelSerializer):
    client_stats = ClientStatsSerializer(read_only=True)
    profile_photo_url = serializers.SerializerMethodField()
    wholesale_service_photo_1_url = serializers.SerializerMethodField()
    wholesale_service_photo_2_url = serializers.SerializerMethodField()
    appointments_total = serializers.SerializerMethodField()
    appointments_active = serializers.SerializerMethodField()
    appointments_completed = serializers.SerializerMethodField()
    last_appointment_at = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "telegram_username",
            "profile_photo_url",
            "is_banned",
            "ban_reason",
            "banned_at",
            "is_service_center",
            "wholesale_status",
            "wholesale_discount_percent",
            "wholesale_company_name",
            "wholesale_comment",
            "wholesale_service_details",
            "wholesale_service_photo_1_url",
            "wholesale_service_photo_2_url",
            "wholesale_requested_at",
            "wholesale_reviewed_at",
            "wholesale_review_comment",
            "created_at",
            "client_stats",
            "appointments_total",
            "appointments_active",
            "appointments_completed",
            "last_appointment_at",
        )

    def _build_file_url(self, obj: User, field_name: str):
        file_field = getattr(obj, field_name, None)
        if not file_field or not getattr(file_field, "url", None):
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(file_field.url) if request else file_field.url

    def get_wholesale_service_photo_1_url(self, obj: User):
        return self._build_file_url(obj, "wholesale_service_photo_1")

    def get_wholesale_service_photo_2_url(self, obj: User):
        return self._build_file_url(obj, "wholesale_service_photo_2")

    def get_profile_photo_url(self, obj: User):
        return self._build_file_url(obj, "profile_photo")

    def _queryset(self, obj: User):
        return Appointment.objects.filter(client_id=obj.id)

    def get_appointments_total(self, obj: User) -> int:
        return self._queryset(obj).count()

    def get_appointments_active(self, obj: User) -> int:
        active_statuses = (
            AppointmentStatusChoices.NEW,
            AppointmentStatusChoices.IN_REVIEW,
            AppointmentStatusChoices.AWAITING_PAYMENT,
            AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED,
            AppointmentStatusChoices.PAID,
            AppointmentStatusChoices.IN_PROGRESS,
        )
        return self._queryset(obj).filter(status__in=active_statuses).count()

    def get_appointments_completed(self, obj: User) -> int:
        return self._queryset(obj).filter(status=AppointmentStatusChoices.COMPLETED).count()

    def get_last_appointment_at(self, obj: User):
        return self._queryset(obj).order_by("-updated_at").values_list("updated_at", flat=True).first()


class ProfileUpdateSerializer(serializers.ModelSerializer):
    remove_profile_photo = serializers.BooleanField(required=False, default=False, write_only=True)

    class Meta:
        model = User
        fields = ("username", "profile_photo", "remove_profile_photo")

    def validate_username(self, value: str) -> str:
        username = (value or "").strip()
        if len(username) < 3:
            raise serializers.ValidationError("Ник должен содержать минимум 3 символа.")
        user = self.instance
        if (
            user
            and user.username != username
            and User.objects.filter(username=username).exists()
        ):
            raise serializers.ValidationError("Пользователь с таким ником уже существует.")
        return username

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Передайте данные для обновления профиля.")
        return attrs
