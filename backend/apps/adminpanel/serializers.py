from __future__ import annotations

from rest_framework import serializers

from apps.accounts.models import MasterLevelChoices, RoleChoices, SiteSettings, User
from apps.accounts.serializers import ClientStatsSerializer, MasterStatsSerializer


class BanUserSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


class AdminUserSerializer(serializers.ModelSerializer):
    client_stats = ClientStatsSerializer(read_only=True)
    master_stats = MasterStatsSerializer(read_only=True)
    wholesale_service_photo_1_url = serializers.SerializerMethodField()
    wholesale_service_photo_2_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "role",
            "telegram_username",
            "is_banned",
            "ban_reason",
            "banned_at",
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
            "is_staff",
            "is_superuser",
            "client_stats",
            "master_stats",
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


class AdminUserRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=RoleChoices.choices)
    is_master_active = serializers.BooleanField(required=False)


class AdminMasterQualitySerializer(serializers.Serializer):
    master_level = serializers.ChoiceField(choices=MasterLevelChoices.choices, required=False)
    master_specializations = serializers.CharField(max_length=255, required=False, allow_blank=True)
    master_quality_approved = serializers.BooleanField(required=False)
    master_quality_comment = serializers.CharField(max_length=255, required=False, allow_blank=True)


class AdminWholesaleReviewSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=(("approve", "approve"), ("reject", "reject")))
    discount_percent = serializers.IntegerField(min_value=0, max_value=100, required=False)
    review_comment = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["decision"] == "approve" and attrs.get("discount_percent") is None:
            raise serializers.ValidationError({"discount_percent": "Укажите размер скидки при одобрении"})
        return attrs


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
    ACTION_CHECK = "check"

    ACTION_CHOICES = (
        (ACTION_MIGRATE, "Применить миграции"),
        (ACTION_COLLECTSTATIC, "Собрать статические файлы"),
        (ACTION_CLEARSESSIONS, "Очистить просроченные сессии"),
        (ACTION_CHECK, "Проверка конфигурации Django"),
    )

    action = serializers.ChoiceField(choices=ACTION_CHOICES)
