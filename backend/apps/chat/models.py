from __future__ import annotations

import os

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import TimeStampedModel


def validate_chat_file(value):
    if not value:
        return
    ext = os.path.splitext(value.name.lower())[1]
    allowed = {".jpg", ".jpeg", ".png", ".pdf", ".txt", ".log", ".zip"}
    if ext not in allowed:
        raise ValidationError("Недопустимый тип файла")
    if value.size > 10 * 1024 * 1024:
        raise ValidationError("Максимальный размер файла 10MB")


class Message(TimeStampedModel):
    appointment = models.ForeignKey(
        "appointments.Appointment",
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="messages",
    )
    text = models.TextField(blank=True)
    file = models.FileField(upload_to="chat_files/", null=True, blank=True, validators=[validate_chat_file])

    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="deleted_messages",
    )

    class Meta:
        ordering = ("id",)


class ReadState(TimeStampedModel):
    appointment = models.ForeignKey(
        "appointments.Appointment",
        on_delete=models.CASCADE,
        related_name="read_states",
    )
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="read_states",
    )
    last_read_message_id = models.BigIntegerField(default=0)

    class Meta:
        unique_together = ("appointment", "user")


class MasterQuickReply(TimeStampedModel):
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="master_quick_replies",
    )
    command = models.CharField(max_length=20)
    title = models.CharField(max_length=120, blank=True)
    text = models.TextField()

    class Meta:
        ordering = ("command", "id")
        unique_together = ("user", "command")
        indexes = [
            models.Index(fields=("user", "command")),
        ]

    def __str__(self) -> str:
        return f"/{self.command}"
