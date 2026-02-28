from django.conf import settings
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import ClientStats, SiteSettings, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = (
        "id",
        "username",
        "role",
        "telegram_id",
        "is_master_active",
        "is_banned",
        "is_staff",
    )
    list_filter = ("role", "is_master_active", "is_banned", "is_staff")
    fieldsets = DjangoUserAdmin.fieldsets + (
        (
            "Telegram / Roles",
            {
                "fields": (
                    "role",
                    "telegram_id",
                    "telegram_username",
                    "telegram_photo_url",
                    "is_master_active",
                    "is_banned",
                    "ban_reason",
                    "banned_at",
                )
            },
        ),
    )


@admin.register(ClientStats)
class ClientStatsAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "completed_orders_count",
        "cancelled_orders_count",
        "average_rating",
        "cancellation_rate",
        "level",
    )
    search_fields = ("user__username", "user__telegram_username")


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ("singleton_key", "updated_at")

    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()

    def save_model(self, request, obj, form, change):
        if not obj.bank_requisites:
            obj.bank_requisites = settings.DEFAULT_ADMIN_PAYMENT_BANK
        if not obj.crypto_requisites:
            obj.crypto_requisites = settings.DEFAULT_ADMIN_PAYMENT_CRYPTO
        if not obj.instructions:
            obj.instructions = settings.DEFAULT_ADMIN_PAYMENT_INSTRUCTIONS
        super().save_model(request, obj, form, change)
