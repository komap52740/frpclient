from __future__ import annotations

from django.conf import settings
from django.contrib.auth.models import AbstractUser, UserManager
from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import TimeStampedModel


class RoleChoices(models.TextChoices):
    CLIENT = "client", "Клиент"
    MASTER = "master", "Мастер"
    ADMIN = "admin", "Администратор"


class User(AbstractUser, TimeStampedModel):
    role = models.CharField(max_length=20, choices=RoleChoices.choices, default=RoleChoices.CLIENT)
    telegram_id = models.BigIntegerField(unique=True, null=True, blank=True)
    telegram_username = models.CharField(max_length=255, blank=True)
    telegram_photo_url = models.URLField(blank=True)

    is_master_active = models.BooleanField(default=False)

    is_banned = models.BooleanField(default=False)
    ban_reason = models.TextField(blank=True)
    banned_at = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    class Meta:
        ordering = ("-id",)

    @property
    def is_client(self) -> bool:
        return self.role == RoleChoices.CLIENT

    @property
    def is_master(self) -> bool:
        return self.role == RoleChoices.MASTER

    @property
    def is_admin_role(self) -> bool:
        return self.role == RoleChoices.ADMIN or self.is_superuser


class ClientLevelChoices(models.TextChoices):
    NEWBIE = "newbie", "Новичок"
    TRUSTED = "trusted", "Проверенный"
    RELIABLE = "reliable", "Надёжный"
    PROBLEMATIC = "problematic", "Проблемный"


class RiskLevelChoices(models.TextChoices):
    LOW = "low", "Низкий"
    MEDIUM = "medium", "Средний"
    HIGH = "high", "Высокий"
    CRITICAL = "critical", "Критический"


class ClientStats(TimeStampedModel):
    user = models.OneToOneField(
        "accounts.User",
        related_name="client_stats",
        on_delete=models.CASCADE,
    )
    completed_orders_count = models.PositiveIntegerField(default=0)
    cancelled_orders_count = models.PositiveIntegerField(default=0)
    average_rating = models.FloatField(default=0.0)
    cancellation_rate = models.FloatField(default=0.0)
    level = models.CharField(max_length=20, choices=ClientLevelChoices.choices, default=ClientLevelChoices.NEWBIE)
    risk_score = models.PositiveSmallIntegerField(default=0)
    risk_level = models.CharField(max_length=20, choices=RiskLevelChoices.choices, default=RiskLevelChoices.LOW)
    risk_updated_at = models.DateTimeField(null=True, blank=True)

    def clean(self) -> None:
        if not self.user.is_client:
            raise ValidationError("ClientStats доступна только для пользователей с ролью client")

    def recalculate_level(self) -> None:
        if self.cancellation_rate > 0.30 or self.average_rating < 3.0:
            self.level = ClientLevelChoices.PROBLEMATIC
            return

        if self.completed_orders_count >= 10 and self.average_rating >= 4.5:
            self.level = ClientLevelChoices.RELIABLE
            return

        if self.completed_orders_count >= 3 and self.average_rating >= 4.0:
            self.level = ClientLevelChoices.TRUSTED
            return

        self.level = ClientLevelChoices.NEWBIE


class SiteSettings(TimeStampedModel):
    """Singleton: реквизиты главного администратора для ручной оплаты."""

    singleton_key = models.PositiveSmallIntegerField(default=1, unique=True, editable=False)
    bank_requisites = models.TextField(blank=True)
    crypto_requisites = models.TextField(blank=True)
    instructions = models.TextField(blank=True)

    class Meta:
        verbose_name = "Настройки оплаты"
        verbose_name_plural = "Настройки оплаты"

    @classmethod
    def load(cls) -> "SiteSettings":
        obj, _ = cls.objects.get_or_create(
            singleton_key=1,
            defaults={
                "bank_requisites": settings.DEFAULT_ADMIN_PAYMENT_BANK,
                "crypto_requisites": settings.DEFAULT_ADMIN_PAYMENT_CRYPTO,
                "instructions": settings.DEFAULT_ADMIN_PAYMENT_INSTRUCTIONS,
            },
        )
        return obj


class MasterStats(TimeStampedModel):
    user = models.OneToOneField(
        "accounts.User",
        related_name="master_stats",
        on_delete=models.CASCADE,
    )
    avg_rating = models.FloatField(default=0.0)
    completion_rate = models.FloatField(default=0.0)
    avg_response_seconds = models.FloatField(default=0.0)
    active_workload = models.PositiveIntegerField(default=0)
    cancellation_rate = models.FloatField(default=0.0)
    master_score = models.PositiveSmallIntegerField(default=0)
    score_updated_at = models.DateTimeField(null=True, blank=True)

    def clean(self) -> None:
        if not self.user.is_master:
            raise ValidationError("MasterStats доступна только для пользователей с ролью master")

