from __future__ import annotations

from django.db.models import Count, Q
from rest_framework import serializers

from apps.chat.models import ReadState

from .models import (
    Appointment,
    AppointmentEvent,
    AppointmentStatusChoices,
    LockTypeChoices,
    PaymentMethodChoices,
)


class AppointmentSerializer(serializers.ModelSerializer):
    unread_count = serializers.SerializerMethodField()
    client_username = serializers.CharField(source="client.username", read_only=True)
    master_username = serializers.CharField(source="assigned_master.username", read_only=True)
    photo_lock_screen_url = serializers.SerializerMethodField()
    payment_proof_url = serializers.SerializerMethodField()
    client_risk_score = serializers.SerializerMethodField()
    client_risk_level = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = (
            "id",
            "brand",
            "model",
            "lock_type",
            "has_pc",
            "description",
            "photo_lock_screen",
            "photo_lock_screen_url",
            "status",
            "total_price",
            "currency",
            "payment_method",
            "payment_proof",
            "payment_proof_url",
            "payment_marked_at",
            "payment_confirmed_at",
            "payment_confirmed_by",
            "client",
            "client_username",
            "assigned_master",
            "master_username",
            "client_risk_score",
            "client_risk_level",
            "taken_at",
            "started_at",
            "completed_at",
            "platform_tags",
            "unread_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "status",
            "currency",
            "payment_confirmed_at",
            "payment_confirmed_by",
            "client",
            "assigned_master",
            "taken_at",
            "started_at",
            "completed_at",
            "platform_tags",
            "unread_count",
            "created_at",
            "updated_at",
        )

    def get_unread_count(self, obj: Appointment) -> int:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return 0

        state = ReadState.objects.filter(appointment=obj, user=user).first()
        last_read_id = state.last_read_message_id if state else 0
        return obj.messages.filter(id__gt=last_read_id, is_deleted=False).exclude(sender=user).count()

    def get_photo_lock_screen_url(self, obj: Appointment) -> str | None:
        request = self.context.get("request")
        if obj.photo_lock_screen and hasattr(obj.photo_lock_screen, "url"):
            return request.build_absolute_uri(obj.photo_lock_screen.url) if request else obj.photo_lock_screen.url
        return None

    def get_payment_proof_url(self, obj: Appointment) -> str | None:
        request = self.context.get("request")
        if obj.payment_proof and hasattr(obj.payment_proof, "url"):
            return request.build_absolute_uri(obj.payment_proof.url) if request else obj.payment_proof.url
        return None

    def _can_see_client_risk(self, obj: Appointment) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.role == "admin":
            return True
        if user.role == "master" and obj.assigned_master_id == user.id:
            return True
        if user.role == "client" and obj.client_id == user.id:
            return True
        return False

    def get_client_risk_score(self, obj: Appointment) -> int | None:
        if not self._can_see_client_risk(obj):
            return None
        stats = getattr(obj.client, "client_stats", None)
        return getattr(stats, "risk_score", None)

    def get_client_risk_level(self, obj: Appointment) -> str | None:
        if not self._can_see_client_risk(obj):
            return None
        stats = getattr(obj.client, "client_stats", None)
        return getattr(stats, "risk_level", None)


class AppointmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = (
            "brand",
            "model",
            "lock_type",
            "has_pc",
            "description",
            "photo_lock_screen",
        )


class SetPriceSerializer(serializers.Serializer):
    total_price = serializers.IntegerField(min_value=1)


class UploadPaymentProofSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ("payment_proof",)


class MarkPaidSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(choices=PaymentMethodChoices.choices)


class AppointmentEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)

    class Meta:
        model = AppointmentEvent
        fields = (
            "id",
            "event_type",
            "from_status",
            "to_status",
            "note",
            "metadata",
            "actor",
            "actor_username",
            "created_at",
        )


class AdminManualStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=AppointmentStatusChoices.choices)
    note = serializers.CharField(required=False, allow_blank=True)
