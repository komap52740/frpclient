from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.common.crypto_fields import EncryptedTextField
from apps.common.models import TimeStampedModel
from apps.common.upload_security import image_upload_policy, payment_proof_upload_policy, validate_upload


def validate_image_file(value):
    if not value:
        return
    validate_upload(value, image_upload_policy(settings.LOCK_SCREEN_MAX_UPLOAD_MB * 1024 * 1024))


def validate_payment_proof(value):
    if not value:
        return
    validate_upload(value, payment_proof_upload_policy(settings.PAYMENT_PROOF_MAX_UPLOAD_MB * 1024 * 1024))


class LockTypeChoices(models.TextChoices):
    GOOGLE = "GOOGLE", "GOOGLE"
    HUAWEI_ID = "HUAWEI_ID", "HUAWEI_ID"
    MI_ACC = "MI_ACC", "MI_ACC"
    APPLE_ID = "APPLE_ID", "APPLE_ID"
    OTHER = "OTHER", "OTHER"
    PIN = "PIN", "PIN"


class AppointmentStatusChoices(models.TextChoices):
    NEW = "NEW", "Новая"
    IN_REVIEW = "IN_REVIEW", "В работе мастера"
    AWAITING_PAYMENT = "AWAITING_PAYMENT", "Ожидает оплату"
    PAYMENT_PROOF_UPLOADED = "PAYMENT_PROOF_UPLOADED", "Чек загружен"
    PAID = "PAID", "Оплачено"
    IN_PROGRESS = "IN_PROGRESS", "В процессе"
    COMPLETED = "COMPLETED", "Завершено"
    DECLINED_BY_MASTER = "DECLINED_BY_MASTER", "Отклонено мастером"
    CANCELLED = "CANCELLED", "Отменено"


class PaymentMethodChoices(models.TextChoices):
    CRYPTO = "crypto", "Crypto"
    BANK_TRANSFER = "bank_transfer", "Bank transfer"


class Appointment(TimeStampedModel):
    client = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="client_appointments",
    )
    assigned_master = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="master_appointments",
    )

    brand = models.CharField(max_length=255)
    model = models.CharField(max_length=255)
    lock_type = models.CharField(max_length=20, choices=LockTypeChoices.choices)
    has_pc = models.BooleanField(default=False)
    contact_phone = models.CharField(max_length=32, blank=True, default="")
    description = models.TextField()
    rustdesk_id = EncryptedTextField(blank=True, default="")
    rustdesk_password = EncryptedTextField(blank=True, default="")
    photo_lock_screen = models.FileField(
        upload_to="lock_screen/",
        null=True,
        blank=True,
        validators=[validate_image_file],
    )

    status = models.CharField(
        max_length=40,
        choices=AppointmentStatusChoices.choices,
        default=AppointmentStatusChoices.NEW,
        db_index=True,
    )
    total_price = models.PositiveIntegerField(null=True, blank=True)
    wholesale_base_price = models.PositiveIntegerField(null=True, blank=True)
    wholesale_discount_percent_applied = models.PositiveSmallIntegerField(default=0)
    is_wholesale_request = models.BooleanField(default=False, db_index=True)
    currency = models.CharField(max_length=3, default="RUB")

    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethodChoices.choices,
        null=True,
        blank=True,
    )
    payment_requisites_note = models.CharField(max_length=255, blank=True, default="")
    payment_proof = models.FileField(
        upload_to="payment_proofs/",
        null=True,
        blank=True,
        validators=[validate_payment_proof],
    )
    payment_marked_at = models.DateTimeField(null=True, blank=True)
    payment_confirmed_at = models.DateTimeField(null=True, blank=True)
    payment_confirmed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="confirmed_payments",
    )

    taken_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    response_deadline_at = models.DateTimeField(null=True, blank=True, db_index=True)
    completion_deadline_at = models.DateTimeField(null=True, blank=True, db_index=True)
    sla_breached = models.BooleanField(default=False, db_index=True)
    platform_tags = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ("-created_at",)


class AppointmentEventType(models.TextChoices):
    STATUS_CHANGED = "status_changed", "Status changed"
    PRICE_SET = "price_set", "Price set"
    PAYMENT_PROOF_UPLOADED = "payment_proof_uploaded", "Payment proof uploaded"
    PAYMENT_MARKED = "payment_marked", "Payment marked"
    PAYMENT_CONFIRMED = "payment_confirmed", "Payment confirmed"
    MESSAGE_DELETED = "message_deleted", "Message deleted"
    CLIENT_SIGNAL = "client_signal", "Client signal"


class AppointmentEvent(TimeStampedModel):
    appointment = models.ForeignKey(
        "appointments.Appointment",
        on_delete=models.CASCADE,
        related_name="events",
    )
    actor = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="appointment_events",
    )
    event_type = models.CharField(max_length=40, choices=AppointmentEventType.choices)
    from_status = models.CharField(max_length=40, blank=True)
    to_status = models.CharField(max_length=40, blank=True)
    note = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("-id",)
