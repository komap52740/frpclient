from django.contrib import admin

from .models import DailyMetrics, FeatureFlag, Notification, PlatformEvent, Rule


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


@admin.register(Rule)
class RuleAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "is_active", "trigger_event_type", "updated_at")
    list_filter = ("is_active", "trigger_event_type")
    search_fields = ("name", "trigger_event_type")


@admin.register(DailyMetrics)
class DailyMetricsAdmin(admin.ModelAdmin):
    list_display = ("date", "gmv_total", "new_users", "new_appointments", "paid_appointments", "completed_appointments")
    list_filter = ("date",)
    date_hierarchy = "date"
