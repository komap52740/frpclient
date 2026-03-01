from __future__ import annotations

from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F
from django.utils import timezone

from .models import ClientStats, MasterStats, RiskLevelChoices, User


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


def compute_master_score(
    *,
    avg_rating: float,
    completion_rate: float,
    avg_response_seconds: float,
    active_workload: int,
    cancellation_rate: float,
) -> int:
    rating_component = min(max(avg_rating, 0.0), 5.0) / 5.0 * 40.0
    completion_component = min(max(completion_rate, 0.0), 1.0) * 25.0

    if avg_response_seconds <= 0:
        response_component = 0.0
    elif avg_response_seconds <= 300:
        response_component = 20.0
    else:
        response_component = max(0.0, (1.0 - min((avg_response_seconds - 300.0) / 3300.0, 1.0)) * 20.0)

    if active_workload <= 5:
        workload_component = 10.0
    elif active_workload <= 10:
        workload_component = 5.0
    else:
        workload_component = 2.0

    cancellation_penalty = min(max(cancellation_rate, 0.0), 1.0) * 20.0

    score = round(rating_component + completion_component + response_component + workload_component - cancellation_penalty)
    return max(0, min(100, int(score)))


def recalculate_master_stats(master: User) -> MasterStats:
    from apps.appointments.models import Appointment, AppointmentStatusChoices
    from apps.reviews.models import Review, ReviewTypeChoices

    stats, _ = MasterStats.objects.get_or_create(user=master)

    completed_count = Appointment.objects.filter(
        assigned_master=master,
        status=AppointmentStatusChoices.COMPLETED,
    ).count()
    cancelled_count = Appointment.objects.filter(
        assigned_master=master,
        status__in=[AppointmentStatusChoices.DECLINED_BY_MASTER, AppointmentStatusChoices.CANCELLED],
    ).count()
    active_workload = Appointment.objects.filter(
        assigned_master=master,
        status__in=[
            AppointmentStatusChoices.IN_REVIEW,
            AppointmentStatusChoices.AWAITING_PAYMENT,
            AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED,
            AppointmentStatusChoices.PAID,
            AppointmentStatusChoices.IN_PROGRESS,
        ],
    ).count()
    avg_rating = (
        Review.objects.filter(target=master, review_type=ReviewTypeChoices.MASTER_REVIEW).aggregate(v=Avg("rating"))["v"]
        or 0.0
    )

    total_handled = completed_count + cancelled_count
    completion_rate = (completed_count / total_handled) if total_handled > 0 else 0.0
    cancellation_rate = (cancelled_count / total_handled) if total_handled > 0 else 0.0

    response_duration = (
        Appointment.objects.filter(assigned_master=master, taken_at__isnull=False)
        .annotate(
            response_time=ExpressionWrapper(
                F("taken_at") - F("created_at"),
                output_field=DurationField(),
            )
        )
        .aggregate(v=Avg("response_time"))["v"]
    )
    avg_response_seconds = float(response_duration.total_seconds()) if response_duration else 0.0

    master_score = compute_master_score(
        avg_rating=float(avg_rating),
        completion_rate=float(completion_rate),
        avg_response_seconds=avg_response_seconds,
        active_workload=int(active_workload),
        cancellation_rate=float(cancellation_rate),
    )

    stats.avg_rating = round(float(avg_rating), 2)
    stats.completion_rate = round(float(completion_rate), 4)
    stats.avg_response_seconds = round(avg_response_seconds, 2)
    stats.active_workload = active_workload
    stats.cancellation_rate = round(float(cancellation_rate), 4)
    stats.master_score = master_score
    stats.score_updated_at = timezone.now()
    stats.save()
    return stats
