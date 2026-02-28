from django.contrib import admin

from .models import Appointment, AppointmentEvent


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "status",
        "client",
        "assigned_master",
        "total_price",
        "payment_method",
        "created_at",
    )
    list_filter = ("status", "payment_method")
    search_fields = ("brand", "model", "client__username", "assigned_master__username")


@admin.register(AppointmentEvent)
class AppointmentEventAdmin(admin.ModelAdmin):
    list_display = ("id", "appointment", "event_type", "actor", "from_status", "to_status", "created_at")
    list_filter = ("event_type", "from_status", "to_status")
    search_fields = ("appointment__id", "actor__username")
