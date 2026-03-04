from __future__ import annotations

from rest_framework import serializers

from apps.accounts.models import MasterLevelChoices, RoleChoices, SiteSettings, User
from apps.accounts.serializers import ClientStatsSerializer, MasterStatsSerializer


class BanUserSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


class AdminUserSerializer(serializers.ModelSerializer):
    client_stats = ClientStatsSerializer(read_only=True)
    master_stats = MasterStatsSerializer(read_only=True)
    master_tier = serializers.SerializerMethodField()
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

    def get_profile_photo_url(self, obj: User):
        return self._build_file_url(obj, "profile_photo")

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
