from __future__ import annotations

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from apps.common.secure_media import build_message_file_url, build_quick_reply_media_url
from apps.common.upload_security import chat_file_upload_policy, quick_reply_media_upload_policy, sanitize_upload

from .models import MasterQuickReply, Message


class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source="sender.username", read_only=True)
    sender_role = serializers.CharField(source="sender.role", read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = (
            "id",
            "appointment",
            "sender",
            "sender_username",
            "sender_role",
            "text",
            "file",
            "file_url",
            "is_deleted",
            "deleted_at",
            "created_at",
        )
        read_only_fields = (
            "sender",
            "is_deleted",
            "deleted_at",
            "created_at",
        )
        extra_kwargs = {
            "file": {"write_only": True},
        }

    def get_file_url(self, obj: Message) -> str | None:
        if obj.is_deleted:
            return None
        return build_message_file_url(self.context.get("request"), obj)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.is_deleted:
            data["text"] = None
            data["file_url"] = None
        return data


class MessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ("text", "file")

    def validate_file(self, value):
        return sanitize_upload(value, chat_file_upload_policy(settings.CHAT_FILE_MAX_UPLOAD_MB * 1024 * 1024))

    def validate(self, attrs):
        text = attrs.get("text", "").strip()
        file_obj = attrs.get("file")
        if not text and not file_obj:
            raise serializers.ValidationError("Нужно передать text или file")
        return attrs


class ReadStateSerializer(serializers.Serializer):
    last_read_message_id = serializers.IntegerField(min_value=0)


class MasterQuickReplySerializer(serializers.ModelSerializer):
    media_url = serializers.SerializerMethodField()
    media_kind = serializers.SerializerMethodField()
    remove_media = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = MasterQuickReply
        fields = (
            "id",
            "command",
            "title",
            "text",
            "media_file",
            "remove_media",
            "media_url",
            "media_kind",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
        extra_kwargs = {
            "media_file": {"write_only": True},
        }

    def validate_command(self, value: str) -> str:
        command = (value or "").strip()
        if command.startswith("/"):
            command = command[1:]
        command = command.lower()
        if not command:
            raise serializers.ValidationError("Укажите команду, например 1 или привет.")
        if len(command) > 20:
            raise serializers.ValidationError("Команда не должна быть длиннее 20 символов.")
        if not all(ch.isalnum() or ch in {"_", "-"} for ch in command):
            raise serializers.ValidationError("Команда может содержать только буквы, цифры, '_' и '-'.")
        return command

    def validate_text(self, value: str) -> str:
        return (value or "").strip()

    def validate_media_file(self, value):
        return sanitize_upload(
            value,
            quick_reply_media_upload_policy(settings.QUICK_REPLY_MEDIA_MAX_UPLOAD_MB * 1024 * 1024),
        )

    def validate(self, attrs):
        remove_media = bool(attrs.get("remove_media"))
        if remove_media:
            attrs["media_file"] = None

        if self.instance is not None:
            next_text = attrs.get("text", self.instance.text)
            next_media = attrs.get("media_file", self.instance.media_file)
        else:
            next_text = attrs.get("text", "")
            next_media = attrs.get("media_file")

        if not (next_text or next_media):
            raise serializers.ValidationError("Заполните текст шаблона или прикрепите фото/видео.")
        return attrs

    def create(self, validated_data):
        validated_data.pop("remove_media", None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("remove_media", None)
        return super().update(instance, validated_data)

    def get_media_url(self, obj: MasterQuickReply) -> str | None:
        return build_quick_reply_media_url(self.context.get("request"), obj)

    def get_media_kind(self, obj: MasterQuickReply) -> str:
        if not obj.media_file:
            return ""
        name = (obj.media_file.name or "").lower()
        if name.endswith((".jpg", ".jpeg", ".png", ".webp")):
            return "image"
        if name.endswith((".mp4", ".mov", ".webm", ".m4v")):
            return "video"
        return "file"
