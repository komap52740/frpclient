from __future__ import annotations

from collections.abc import Mapping

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from .models import ClientStats, SiteSettings, User
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
        )


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = (
            "bank_requisites",
            "crypto_requisites",
            "instructions",
        )


class MeSerializer(serializers.ModelSerializer):
    client_stats = ClientStatsSerializer(read_only=True)

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
            "role",
            "is_master_active",
            "is_banned",
            "ban_reason",
            "client_stats",
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