from __future__ import annotations

import os

from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import TimeStampedModel


def validate_image_file(value):
    if not value:
        return
    ext = os.path.splitext(value.name.lower())[1]
    if ext not in {".jpg", ".jpeg", ".png"}:
        raise ValidationError("Разрешены только .jpg/.jpeg/.png")
    if value.size > 10 * 1024 * 1024:
        raise ValidationError("Максимальный размер файла 10MB")


def validate_payment_proof(value):
    if not value:
        return
    ext = os.path.splitext(value.name.lower())[1]
    if ext not in {".jpg", ".jpeg", ".png", ".pdf"}:
        raise ValidationError("Чек должен быть jpg/png/pdf")
    if value.size > 10 * 1024 * 1024:
        raise ValidationError("Максимальный размер файла 10MB")


class LockTypeChoices(models.TextChoices):
    PIN = "PIN", "PIN"
    GOOGLE = "GOOGLE", "GOOGLE"
    APPLE_ID = "APPLE_ID", "APPLE_ID"
    OTHER = "OTHER", "OTHER"


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
    description = models.TextField()
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
    currency = models.CharField(max_length=3, default="RUB")

    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethodChoices.choices,
        null=True,
        blank=True,
    )
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

    class Meta:
        ordering = ("-created_at",)


class AppointmentEventType(models.TextChoices):
    STATUS_CHANGED = "status_changed", "Status changed"
    PRICE_SET = "price_set", "Price set"
    PAYMENT_PROOF_UPLOADED = "payment_proof_uploaded", "Payment proof uploaded"
    PAYMENT_MARKED = "payment_marked", "Payment marked"
    PAYMENT_CONFIRMED = "payment_confirmed", "Payment confirmed"
    MESSAGE_DELETED = "message_deleted", "Message deleted"


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
