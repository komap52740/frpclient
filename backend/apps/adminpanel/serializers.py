from __future__ import annotations

from rest_framework import serializers

from apps.accounts.models import User
from apps.appointments.serializers import AppointmentSerializer


class BanUserSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "role",
            "telegram_username",
            "is_banned",
            "ban_reason",
            "banned_at",
            "is_master_active",
        )
