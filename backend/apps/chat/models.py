from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel
from apps.common.upload_security import chat_file_upload_policy, quick_reply_media_upload_policy, validate_upload


def validate_chat_file(value):
    if not value:
        return
    validate_upload(value, chat_file_upload_policy(settings.CHAT_FILE_MAX_UPLOAD_MB * 1024 * 1024))


def validate_quick_reply_media(value):
    if not value:
        return
    validate_upload(value, quick_reply_media_upload_policy(settings.QUICK_REPLY_MEDIA_MAX_UPLOAD_MB * 1024 * 1024))


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
    text = models.TextField(blank=True)
    media_file = models.FileField(
        upload_to="quick_reply_media/",
        null=True,
        blank=True,
        validators=[validate_quick_reply_media],
    )

    class Meta:
        ordering = ("command", "id")
        unique_together = ("user", "command")
        indexes = [
            models.Index(fields=("user", "command")),
        ]

    def __str__(self) -> str:
        return f"/{self.command}"
