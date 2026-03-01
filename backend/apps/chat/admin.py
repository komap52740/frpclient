from django.contrib import admin

from .models import MasterQuickReply, Message, ReadState


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "appointment", "sender", "is_deleted", "created_at")
    list_filter = ("is_deleted",)
    search_fields = ("appointment__id", "sender__username", "text")


@admin.register(ReadState)
class ReadStateAdmin(admin.ModelAdmin):
    list_display = ("appointment", "user", "last_read_message_id", "updated_at")
    search_fields = ("appointment__id", "user__username")


@admin.register(MasterQuickReply)
class MasterQuickReplyAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "command", "title", "updated_at")
    search_fields = ("user__username", "command", "title", "text")
