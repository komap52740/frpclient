from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User

from .models import DailyMetrics, FeatureFlag, Notification, PlatformEvent, Rule


class PlatformEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)

    class Meta:
        model = PlatformEvent
        fields = (
            "id",
            "event_type",
            "entity_type",
            "entity_id",
            "actor",
            "actor_username",
            "payload",
            "created_at",
        )


class FeatureFlagSerializer(serializers.ModelSerializer):
    users = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), many=True, required=False)

    class Meta:
        model = FeatureFlag
        fields = (
            "id",
            "name",
            "is_enabled",
            "rollout_percentage",
            "scope",
            "conditions",
            "users",
            "created_at",
            "updated_at",
        )


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "id",
            "type",
            "title",
            "message",
            "payload",
            "is_read",
            "created_at",
            "read_at",
        )


class NotificationMarkReadSerializer(serializers.Serializer):
    notification_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
    )
    mark_all = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if not attrs.get("mark_all") and not attrs.get("notification_ids"):
            raise serializers.ValidationError("Передайте notification_ids или mark_all=true")
        return attrs

    def save(self, *, user):
        notification_ids = self.validated_data.get("notification_ids", [])
        mark_all = self.validated_data.get("mark_all", False)
        queryset = Notification.objects.filter(user=user, is_read=False)
        if not mark_all:
            queryset = queryset.filter(id__in=notification_ids)
        now = timezone.now()
        updated = queryset.update(is_read=True, read_at=now)
        return updated


class RuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rule
        fields = (
            "id",
            "name",
            "is_active",
            "trigger_event_type",
            "condition_json",
            "action_json",
            "created_at",
            "updated_at",
        )


class DailyMetricsSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyMetrics
        fields = (
            "date",
            "gmv_total",
            "new_users",
            "new_appointments",
            "paid_appointments",
            "completed_appointments",
            "avg_time_to_first_response",
            "avg_time_to_complete",
            "conversion_new_to_paid",
        )
