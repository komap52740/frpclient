from django.contrib import admin

from .models import FeatureFlag, Notification, PlatformEvent


@admin.register(PlatformEvent)
class PlatformEventAdmin(admin.ModelAdmin):
    list_display = ("id", "event_type", "entity_type", "entity_id", "actor", "created_at")
    list_filter = ("event_type", "entity_type")
    search_fields = ("entity_id", "actor__username")


@admin.register(FeatureFlag)
class FeatureFlagAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "is_enabled", "scope", "rollout_percentage", "updated_at")
    list_filter = ("is_enabled", "scope")
    search_fields = ("name",)
    filter_horizontal = ("users",)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "type", "title", "is_read", "created_at")
    list_filter = ("type", "is_read")
    search_fields = ("user__username", "title", "message")
