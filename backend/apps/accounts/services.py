from __future__ import annotations

from django.db.models import Avg, Count, Q

from .models import ClientStats, User


def recalculate_client_stats(client: User) -> ClientStats:
    from apps.appointments.models import Appointment, AppointmentStatusChoices
    from apps.reviews.models import Review, ReviewTypeChoices

    stats, _ = ClientStats.objects.get_or_create(user=client)

    completed = Appointment.objects.filter(client=client, status=AppointmentStatusChoices.COMPLETED).count()
    cancelled = Appointment.objects.filter(client=client, status=AppointmentStatusChoices.CANCELLED).count()

    avg_rating = (
        Review.objects.filter(target=client, review_type=ReviewTypeChoices.CLIENT_REVIEW).aggregate(v=Avg("rating"))["v"]
        or 0.0
    )

    denom = completed + cancelled
    cancellation_rate = (cancelled / denom) if denom > 0 else 0.0

    stats.completed_orders_count = completed
    stats.cancelled_orders_count = cancelled
    stats.average_rating = round(float(avg_rating), 2)
    stats.cancellation_rate = round(float(cancellation_rate), 4)
    stats.recalculate_level()
    stats.save()
    return stats
