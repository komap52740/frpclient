from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from .models import Message


class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source="sender.username", read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = (
            "id",
            "appointment",
            "sender",
            "sender_username",
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

    def get_file_url(self, obj: Message) -> str | None:
        if obj.is_deleted:
            return None
        request = self.context.get("request")
        if obj.file and hasattr(obj.file, "url"):
            return request.build_absolute_uri(obj.file.url) if request else obj.file.url
        return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.is_deleted:
            data["text"] = None
            data["file"] = None
            data["file_url"] = None
        return data


class MessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ("text", "file")

    def validate(self, attrs):
        text = attrs.get("text", "").strip()
        file_obj = attrs.get("file")
        if not text and not file_obj:
            raise serializers.ValidationError("Нужно передать text или file")
        return attrs


class ReadStateSerializer(serializers.Serializer):
    last_read_message_id = serializers.IntegerField(min_value=0)
