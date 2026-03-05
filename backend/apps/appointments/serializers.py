from __future__ import annotations

from rest_framework import serializers

from apps.accounts.models import WholesalePriorityChoices, WholesaleStatusChoices
from apps.chat.models import Message, ReadState

from .client_actions import CLIENT_SIGNAL_META
from .models import (
    Appointment,
    AppointmentEvent,
    AppointmentStatusChoices,
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
    latest_message_text = serializers.SerializerMethodField()
    latest_message_created_at = serializers.SerializerMethodField()
    latest_message_sender_username = serializers.SerializerMethodField()
    latest_message_sender_role = serializers.SerializerMethodField()
    client_service_center_pro = serializers.SerializerMethodField()
    client_wholesale_priority = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = (
            "id",
            "brand",
            "model",
            "lock_type",
            "has_pc",
            "contact_phone",
            "description",
            "rustdesk_id",
            "rustdesk_password",
            "photo_lock_screen",
            "photo_lock_screen_url",
            "status",
            "total_price",
            "wholesale_base_price",
            "wholesale_discount_percent_applied",
            "is_wholesale_request",
            "currency",
            "payment_method",
            "payment_requisites_note",
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
            "client_service_center_pro",
            "client_wholesale_priority",
            "latest_message_text",
            "latest_message_created_at",
            "latest_message_sender_username",
            "latest_message_sender_role",
            "taken_at",
            "started_at",
            "completed_at",
            "response_deadline_at",
            "completion_deadline_at",
            "sla_breached",
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
            "response_deadline_at",
            "completion_deadline_at",
            "sla_breached",
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

    def _get_latest_message(self, obj: Appointment):
        if hasattr(obj, "_latest_message_cached"):
            return getattr(obj, "_latest_message_cached")
        latest = (
            Message.objects.filter(appointment=obj, is_deleted=False)
            .select_related("sender")
            .order_by("-id")
            .first()
        )
        setattr(obj, "_latest_message_cached", latest)
        return latest

    def get_latest_message_text(self, obj: Appointment) -> str:
        annotated = getattr(obj, "latest_message_text", None)
        if annotated is not None:
            return annotated
        latest = self._get_latest_message(obj)
        if not latest:
            return ""
        if (latest.text or "").strip():
            return latest.text
        if latest.file:
            return "Файл"
        return ""

    def get_latest_message_created_at(self, obj: Appointment):
        annotated = getattr(obj, "latest_message_created_at", None)
        if annotated is not None:
            return annotated
        latest = self._get_latest_message(obj)
        return getattr(latest, "created_at", None)

    def get_latest_message_sender_username(self, obj: Appointment) -> str:
        annotated = getattr(obj, "latest_message_sender_username", None)
        if annotated:
            return annotated
        latest = self._get_latest_message(obj)
        if not latest:
            return ""
        return getattr(latest.sender, "username", "") if latest.sender_id else ""

    def get_latest_message_sender_role(self, obj: Appointment) -> str:
        annotated = getattr(obj, "latest_message_sender_role", None)
        if annotated:
            return annotated
        latest = self._get_latest_message(obj)
        if not latest or not latest.sender_id:
            return ""
        return getattr(latest.sender, "role", "") or ""

    def get_client_service_center_pro(self, obj: Appointment) -> bool:
        client = getattr(obj, "client", None)
        if not client:
            return False
        return bool(client.is_service_center and client.wholesale_status == WholesaleStatusChoices.APPROVED)

    def get_client_wholesale_priority(self, obj: Appointment) -> str:
        client = getattr(obj, "client", None)
        if not client:
            return WholesalePriorityChoices.STANDARD
        return client.wholesale_priority or WholesalePriorityChoices.STANDARD


class AppointmentCreateSerializer(serializers.ModelSerializer):
    is_wholesale_request = serializers.BooleanField(write_only=True, required=False, default=False)
    is_service_center = serializers.BooleanField(write_only=True, required=False, default=False)
    wholesale_company_name = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=255)
    wholesale_comment = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=500)
    wholesale_service_details = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=2000)
    wholesale_service_photo_1 = serializers.FileField(write_only=True, required=False, allow_null=True)
    wholesale_service_photo_2 = serializers.FileField(write_only=True, required=False, allow_null=True)

    def validate(self, attrs):
        wholesale_payload_detected = any(
            (
                bool(attrs.get("is_wholesale_request")),
                bool(attrs.get("is_service_center")),
                bool((attrs.get("wholesale_company_name") or "").strip()),
                bool((attrs.get("wholesale_comment") or "").strip()),
                bool((attrs.get("wholesale_service_details") or "").strip()),
                bool(attrs.get("wholesale_service_photo_1")),
                bool(attrs.get("wholesale_service_photo_2")),
            )
        )
        if wholesale_payload_detected:
            raise serializers.ValidationError(
                "Оптовый статус отправляется отдельным запросом в профиле клиента. "
                "Эта форма создает только заявку на разблокировку."
            )

        rustdesk_id = (attrs.get("rustdesk_id") or "").strip()
        rustdesk_password = (attrs.get("rustdesk_password") or "").strip()
        contact_phone = (attrs.get("contact_phone") or "").strip()

        errors = {}
        if rustdesk_id and not rustdesk_id.replace(" ", "").replace("-", "").isdigit():
            errors["rustdesk_id"] = "Логин/ID RuDesktop должен содержать только цифры"
        if rustdesk_password and len(rustdesk_password) < 4:
            errors["rustdesk_password"] = "Пароль RuDesktop слишком короткий (минимум 4 символа)"
        if errors:
            raise serializers.ValidationError(errors)

        attrs["contact_phone"] = contact_phone
        attrs["rustdesk_id"] = rustdesk_id
        attrs["rustdesk_password"] = rustdesk_password
        return attrs

    def create(self, validated_data):
        validated_data.pop("is_wholesale_request", None)
        validated_data.pop("is_service_center", None)
        validated_data.pop("wholesale_company_name", None)
        validated_data.pop("wholesale_comment", None)
        validated_data.pop("wholesale_service_details", None)
        validated_data.pop("wholesale_service_photo_1", None)
        validated_data.pop("wholesale_service_photo_2", None)
        return super().create(validated_data)

    class Meta:
        model = Appointment
        fields = (
            "brand",
            "model",
            "lock_type",
            "has_pc",
            "contact_phone",
            "description",
            "rustdesk_id",
            "rustdesk_password",
            "photo_lock_screen",
            "is_wholesale_request",
            "is_service_center",
            "wholesale_company_name",
            "wholesale_comment",
            "wholesale_service_details",
            "wholesale_service_photo_1",
            "wholesale_service_photo_2",
        )


class SetPriceSerializer(serializers.Serializer):
    total_price = serializers.IntegerField(min_value=1)


class ClientAccessUpdateSerializer(serializers.Serializer):
    rustdesk_id = serializers.CharField(required=False, allow_blank=True, max_length=64)
    rustdesk_password = serializers.CharField(required=False, allow_blank=True, max_length=128)

    def validate(self, attrs):
        rustdesk_id = (attrs.get("rustdesk_id") or "").strip()
        rustdesk_password = (attrs.get("rustdesk_password") or "").strip()

        if not rustdesk_id and not rustdesk_password:
            raise serializers.ValidationError("Передайте логин/ID и/или пароль RuDesktop")
        if rustdesk_id and not rustdesk_id.replace(" ", "").replace("-", "").isdigit():
            raise serializers.ValidationError({"rustdesk_id": "Логин/ID должен содержать только цифры"})
        if rustdesk_password and len(rustdesk_password) < 4:
            raise serializers.ValidationError({"rustdesk_password": "Пароль слишком короткий (минимум 4 символа)"})

        attrs["rustdesk_id"] = rustdesk_id
        attrs["rustdesk_password"] = rustdesk_password
        return attrs


class UploadPaymentProofSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ("payment_proof",)


class MarkPaidSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(choices=PaymentMethodChoices.choices)
    payment_requisites_note = serializers.CharField(max_length=255)

    def validate_payment_requisites_note(self, value: str) -> str:
        note = (value or "").strip()
        if len(note) < 3:
            raise serializers.ValidationError("Укажите реквизиты оплаты (минимум 3 символа)")
        return note


class ClientSignalSerializer(serializers.Serializer):
    signal = serializers.ChoiceField(choices=tuple((code, meta["title"]) for code, meta in CLIENT_SIGNAL_META.items()))
    comment = serializers.CharField(required=False, allow_blank=True, max_length=500)


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
