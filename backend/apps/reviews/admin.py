from django.contrib import admin

from .models import BehaviorFlag, Review


@admin.register(BehaviorFlag)
class BehaviorFlagAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "is_active")
    list_filter = ("is_active",)


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "appointment", "review_type", "author", "target", "rating", "created_at")
    list_filter = ("review_type", "rating")
    search_fields = ("appointment__id", "author__username", "target__username")
