from __future__ import annotations

from django.db.models import Avg, Count
from django.utils import timezone

from .models import ClientStats, RiskLevelChoices, User


def _risk_level_from_score(score: int) -> str:
    if score >= 75:
        return RiskLevelChoices.CRITICAL
    if score >= 50:
        return RiskLevelChoices.HIGH
    if score >= 25:
        return RiskLevelChoices.MEDIUM
    return RiskLevelChoices.LOW


def compute_client_risk(*, client: User, completed: int, cancellation_rate: float, average_rating: float, negative_flags: int) -> tuple[int, str]:
    account_age_days = max((timezone.now() - client.date_joined).days, 0)
    cancellation_component = min(cancellation_rate, 1.0) * 45.0
    behavior_component = min(max(negative_flags, 0) * 8.0, 25.0)
    age_component = 0.0 if account_age_days >= 30 else ((30 - account_age_days) / 30.0) * 15.0
    experience_component = 0.0 if completed >= 5 else ((5 - completed) / 5.0) * 10.0
    rating_component = 0.0 if average_rating >= 5.0 else ((5.0 - max(average_rating, 0.0)) / 4.0) * 20.0

    risk_score = round(cancellation_component + behavior_component + age_component + experience_component + rating_component)
    risk_score = max(0, min(100, int(risk_score)))
    return risk_score, _risk_level_from_score(risk_score)


def recalculate_client_stats(client: User) -> ClientStats:
    from apps.appointments.models import Appointment, AppointmentStatusChoices
    from apps.reviews.models import BehaviorFlagCode, Review, ReviewTypeChoices

    stats, _ = ClientStats.objects.get_or_create(user=client)

    completed = Appointment.objects.filter(client=client, status=AppointmentStatusChoices.COMPLETED).count()
    cancelled = Appointment.objects.filter(client=client, status=AppointmentStatusChoices.CANCELLED).count()

    avg_rating = (
        Review.objects.filter(target=client, review_type=ReviewTypeChoices.CLIENT_REVIEW).aggregate(v=Avg("rating"))["v"]
        or 0.0
    )
    negative_flags = (
        Review.objects.filter(target=client, review_type=ReviewTypeChoices.CLIENT_REVIEW)
        .exclude(behavior_flags__code__in=[BehaviorFlagCode.GOOD_CONNECTION, BehaviorFlagCode.WELL_PREPARED])
        .aggregate(v=Count("behavior_flags"))["v"]
        or 0
    )

    denom = completed + cancelled
    cancellation_rate = (cancelled / denom) if denom > 0 else 0.0
    risk_score, risk_level = compute_client_risk(
        client=client,
        completed=completed,
        cancellation_rate=float(cancellation_rate),
        average_rating=float(avg_rating),
        negative_flags=int(negative_flags),
    )

    stats.completed_orders_count = completed
    stats.cancelled_orders_count = cancelled
    stats.average_rating = round(float(avg_rating), 2)
    stats.cancellation_rate = round(float(cancellation_rate), 4)
    stats.recalculate_level()
    stats.risk_score = risk_score
    stats.risk_level = risk_level
    stats.risk_updated_at = timezone.now()
    stats.save()
    return stats
