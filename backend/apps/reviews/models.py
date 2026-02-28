from __future__ import annotations

from django.db import models

from apps.common.models import TimeStampedModel


class BehaviorFlagCode(models.TextChoices):
    BAD_INTERNET = "bad_internet", "Проблемный интернет"
    WEAK_PC = "weak_pc", "Слабый ПК"
    DIFFICULT_CLIENT = "difficult_client", "Сложный клиент"
    DID_NOT_FOLLOW_INSTRUCTIONS = "did_not_follow_instructions", "Не следовал инструкциям"
    LATE_TO_SESSION = "late_to_session", "Опоздал к подключению"
    GOOD_CONNECTION = "good_connection", "Отличная связь"
    WELL_PREPARED = "well_prepared", "Подготовлен заранее"


class BehaviorFlag(TimeStampedModel):
    code = models.CharField(max_length=64, unique=True, choices=BehaviorFlagCode.choices)
    label = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("code",)


class ReviewTypeChoices(models.TextChoices):
    MASTER_REVIEW = "master_review", "Client -> Master"
    CLIENT_REVIEW = "client_review", "Master -> Client"


class Review(TimeStampedModel):
    appointment = models.ForeignKey(
        "appointments.Appointment",
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    author = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="authored_reviews",
    )
    target = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="targeted_reviews",
    )
    review_type = models.CharField(max_length=20, choices=ReviewTypeChoices.choices)
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)
    behavior_flags = models.ManyToManyField("reviews.BehaviorFlag", blank=True, related_name="reviews")

    class Meta:
        ordering = ("-id",)
        constraints = [
            models.UniqueConstraint(fields=("appointment", "review_type"), name="uniq_review_type_per_appointment"),
        ]
