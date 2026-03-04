from __future__ import annotations

from django.conf import settings
from django.contrib.auth.models import AbstractUser, UserManager
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel


class RoleChoices(models.TextChoices):
    CLIENT = "client", "Клиент"
    MASTER = "master", "Мастер"
    ADMIN = "admin", "Администратор"


class MasterLevelChoices(models.TextChoices):
    TRAINEE = "trainee", "Стажер"
    JUNIOR = "junior", "Junior"
    MIDDLE = "middle", "Middle"
    SENIOR = "senior", "Senior"
    LEAD = "lead", "Lead"


class WholesaleStatusChoices(models.TextChoices):
    NONE = "none", "Не запрошено"
    PENDING = "pending", "На рассмотрении"
    APPROVED = "approved", "Одобрено"
    REJECTED = "rejected", "Отклонено"


def validate_service_photo(value):
    if not value:
        return
    name = (value.name or "").lower()
    if not name.endswith((".jpg", ".jpeg", ".png", ".webp")):
        raise ValidationError("Фото сервиса должно быть jpg/jpeg/png/webp")
    if value.size > 10 * 1024 * 1024:
        raise ValidationError("Максимальный размер фото сервиса — 10 МБ")


def validate_profile_photo(value):
    if not value:
        return
    name = (value.name or "").lower()
    if not name.endswith((".jpg", ".jpeg", ".png", ".webp")):
        raise ValidationError("Фото профиля должно быть jpg/jpeg/png/webp")
    if value.size > 5 * 1024 * 1024:
        raise ValidationError("Максимальный размер фото профиля — 5 МБ")


class User(AbstractUser, TimeStampedModel):
    role = models.CharField(max_length=20, choices=RoleChoices.choices, default=RoleChoices.CLIENT)
    telegram_id = models.BigIntegerField(unique=True, null=True, blank=True)
    telegram_username = models.CharField(max_length=255, blank=True)
    telegram_photo_url = models.URLField(blank=True)
    is_email_verified = models.BooleanField(default=False, db_index=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    profile_photo = models.FileField(
        upload_to="profile_photos/",
        null=True,
        blank=True,
        validators=[validate_profile_photo],
    )

    is_master_active = models.BooleanField(default=False)
    master_level = models.CharField(max_length=20, choices=MasterLevelChoices.choices, default=MasterLevelChoices.JUNIOR)
    master_specializations = models.CharField(max_length=255, blank=True)
    master_quality_approved = models.BooleanField(default=False)
    master_quality_approved_at = models.DateTimeField(null=True, blank=True)
    master_quality_comment = models.CharField(max_length=255, blank=True)

    is_service_center = models.BooleanField(default=False)
    wholesale_status = models.CharField(
        max_length=20,
        choices=WholesaleStatusChoices.choices,
        default=WholesaleStatusChoices.NONE,
        db_index=True,
    )
    wholesale_discount_percent = models.PositiveSmallIntegerField(default=0)
    wholesale_company_name = models.CharField(max_length=255, blank=True)
    wholesale_city = models.CharField(max_length=128, blank=True)
    wholesale_address = models.CharField(max_length=255, blank=True)
    wholesale_comment = models.CharField(max_length=500, blank=True)
    wholesale_service_details = models.TextField(blank=True)
    wholesale_service_photo_1 = models.FileField(
        upload_to="service_centers/",
        null=True,
        blank=True,
        validators=[validate_service_photo],
    )
    wholesale_service_photo_2 = models.FileField(
        upload_to="service_centers/",
        null=True,
        blank=True,
        validators=[validate_service_photo],
    )
    wholesale_requested_at = models.DateTimeField(null=True, blank=True)
    wholesale_reviewed_at = models.DateTimeField(null=True, blank=True)
    wholesale_review_comment = models.CharField(max_length=255, blank=True)

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
    sla_response_minutes = models.PositiveIntegerField(default=15)
    sla_completion_hours = models.PositiveIntegerField(default=24)

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
                "sla_response_minutes": settings.DEFAULT_SLA_RESPONSE_MINUTES,
                "sla_completion_hours": settings.DEFAULT_SLA_COMPLETION_HOURS,
            },
        )
        return obj


class EmailVerificationToken(TimeStampedModel):
    user = models.ForeignKey(
        "accounts.User",
        related_name="email_verification_tokens",
        on_delete=models.CASCADE,
    )
    token = models.CharField(max_length=96, unique=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-id",)
        indexes = [
            models.Index(fields=("user", "used_at")),
            models.Index(fields=("expires_at",)),
        ]

    @property
    def is_expired(self) -> bool:
        return self.expires_at <= timezone.now()


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

