from __future__ import annotations

from rest_framework import serializers

from apps.accounts.models import RoleChoices, SiteSettings, User
from apps.accounts.serializers import ClientStatsSerializer, MasterStatsSerializer


class BanUserSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


class AdminUserSerializer(serializers.ModelSerializer):
    client_stats = ClientStatsSerializer(read_only=True)
    master_stats = MasterStatsSerializer(read_only=True)

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
            "is_staff",
            "is_superuser",
            "client_stats",
            "master_stats",
        )


class AdminUserRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=RoleChoices.choices)
    is_master_active = serializers.BooleanField(required=False)


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
