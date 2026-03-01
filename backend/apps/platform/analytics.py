from __future__ import annotations

from datetime import date, datetime, time, timedelta

from django.db.models import Sum
from django.utils import timezone

from apps.accounts.models import User
from apps.appointments.models import Appointment, AppointmentStatusChoices

from .models import DailyMetrics


def _day_bounds(target_date: date):
    start = timezone.make_aware(datetime.combine(target_date, time.min))
    end = start + timedelta(days=1)
    return start, end


def compute_daily_metrics_for_date(target_date: date) -> DailyMetrics:
    start, end = _day_bounds(target_date)

    new_users = User.objects.filter(created_at__gte=start, created_at__lt=end).count()
    new_appointments_qs = Appointment.objects.filter(created_at__gte=start, created_at__lt=end)
    new_appointments = new_appointments_qs.count()
    paid_appointments = Appointment.objects.filter(payment_confirmed_at__gte=start, payment_confirmed_at__lt=end).count()
    completed_appointments = Appointment.objects.filter(completed_at__gte=start, completed_at__lt=end).count()

    gmv_sum = (
        Appointment.objects.filter(
            payment_confirmed_at__gte=start,
            payment_confirmed_at__lt=end,
            total_price__isnull=False,
            status__in=[
                AppointmentStatusChoices.PAID,
                AppointmentStatusChoices.IN_PROGRESS,
                AppointmentStatusChoices.COMPLETED,
            ],
        ).aggregate(v=Sum("total_price"))["v"]
        or 0
    )

    first_response_duration = Appointment.objects.filter(
        created_at__gte=start,
        created_at__lt=end,
        taken_at__isnull=False,
    ).values_list("created_at", "taken_at")
    response_values = [
        max((taken_at - created_at).total_seconds(), 0.0)
        for created_at, taken_at in first_response_duration
        if created_at and taken_at
    ]
    avg_time_to_first_response = (sum(response_values) / len(response_values)) if response_values else 0.0

    completion_values = [
        max((completed_at - started_at).total_seconds(), 0.0)
        for started_at, completed_at in Appointment.objects.filter(
            completed_at__gte=start,
            completed_at__lt=end,
            started_at__isnull=False,
        ).values_list("started_at", "completed_at")
        if started_at and completed_at
    ]
    avg_time_to_complete = (sum(completion_values) / len(completion_values)) if completion_values else 0.0
    conversion_new_to_paid = (paid_appointments / new_appointments) if new_appointments > 0 else 0.0

    metrics, _ = DailyMetrics.objects.update_or_create(
        date=target_date,
        defaults={
            "gmv_total": int(gmv_sum),
            "new_users": new_users,
            "new_appointments": new_appointments,
            "paid_appointments": paid_appointments,
            "completed_appointments": completed_appointments,
            "avg_time_to_first_response": round(float(avg_time_to_first_response), 2),
            "avg_time_to_complete": round(float(avg_time_to_complete), 2),
            "conversion_new_to_paid": round(float(conversion_new_to_paid), 4),
        },
    )
    return metrics
