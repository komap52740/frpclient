from __future__ import annotations

import hashlib

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class SoftDeleteAuditMixin(models.Model):
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="%(class)s_deleted_items",
    )

    class Meta:
        abstract = True

    @property
    def is_soft_deleted(self) -> bool:
        return self.deleted_at is not None

    def soft_delete(self, deleted_by=None, *, save=True):
        if self.deleted_at:
            return
        self.deleted_at = timezone.now()
        self.deleted_by = deleted_by
        if save:
            self.save(update_fields=["deleted_at", "deleted_by"])


class PlatformEvent(models.Model):
    event_type = models.CharField(max_length=120, db_index=True)
    entity_type = models.CharField(max_length=120)
    entity_id = models.CharField(max_length=120)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="platform_events",
    )
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-id",)
        indexes = [
            models.Index(fields=("event_type", "created_at")),
            models.Index(fields=("entity_type", "entity_id")),
        ]

    def __str__(self) -> str:
        return f"{self.event_type} {self.entity_type}:{self.entity_id}"


class FeatureFlagScope(models.TextChoices):
    GLOBAL = "global", "Global"
    PER_USER = "per_user", "Per user"
    PER_ROLE = "per_role", "Per role"


class FeatureFlag(models.Model):
    name = models.CharField(max_length=120, unique=True)
    is_enabled = models.BooleanField(default=False)
    rollout_percentage = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    scope = models.CharField(max_length=20, choices=FeatureFlagScope.choices, default=FeatureFlagScope.GLOBAL)
    conditions = models.JSONField(default=dict, blank=True)
    users = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="feature_flags")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name

    def bucket_for(self, key: str) -> int:
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        return int(digest[:8], 16) % 100

    def evaluate(self, *, user=None, role: str | None = None) -> bool:
        if not self.is_enabled:
            return False

        resolved_role = role or getattr(user, "role", None)
        allowed_roles = set(self.conditions.get("roles", []))

        if self.scope == FeatureFlagScope.GLOBAL:
            if allowed_roles and resolved_role not in allowed_roles:
                return False
            if self.rollout_percentage >= 100:
                return True
            if user is None:
                return self.rollout_percentage > 0
            return self.bucket_for(f"{self.name}:{user.id}") < self.rollout_percentage

        if self.scope == FeatureFlagScope.PER_USER:
            if user is None:
                return False
            if self.users.filter(id=user.id).exists():
                return True
            if self.rollout_percentage <= 0:
                return False
            return self.bucket_for(f"{self.name}:{user.id}") < self.rollout_percentage

        # PER_ROLE
        if not resolved_role:
            return False
        if allowed_roles and resolved_role not in allowed_roles:
            return False
        if self.rollout_percentage >= 100:
            return True
        return self.bucket_for(f"{self.name}:{resolved_role}") < self.rollout_percentage


class NotificationType(models.TextChoices):
    SYSTEM = "system", "System"
    APPOINTMENT = "appointment", "Appointment"
    PAYMENT = "payment", "Payment"
    SECURITY = "security", "Security"


class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    type = models.CharField(max_length=32, choices=NotificationType.choices, default=NotificationType.SYSTEM)
    title = models.CharField(max_length=255)
    message = models.TextField(blank=True)
    payload = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-id",)
        indexes = [
            models.Index(fields=("user", "is_read", "created_at")),
        ]

    def mark_read(self):
        if self.is_read:
            return
        self.is_read = True
        self.read_at = timezone.now()
        self.save(update_fields=["is_read", "read_at"])


class Rule(models.Model):
    name = models.CharField(max_length=150, unique=True)
    is_active = models.BooleanField(default=True, db_index=True)
    trigger_event_type = models.CharField(max_length=120, db_index=True)
    condition_json = models.JSONField(default=dict, blank=True)
    action_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        indexes = [
            models.Index(fields=("is_active", "trigger_event_type")),
        ]

    def __str__(self) -> str:
        return self.name


class DailyMetrics(models.Model):
    date = models.DateField(unique=True, db_index=True)
    gmv_total = models.BigIntegerField(default=0)
    new_users = models.PositiveIntegerField(default=0)
    new_appointments = models.PositiveIntegerField(default=0)
    paid_appointments = models.PositiveIntegerField(default=0)
    completed_appointments = models.PositiveIntegerField(default=0)
    avg_time_to_first_response = models.FloatField(default=0.0)
    avg_time_to_complete = models.FloatField(default=0.0)
    conversion_new_to_paid = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-date",)

    def __str__(self) -> str:
        return str(self.date)
