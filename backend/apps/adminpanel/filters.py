from __future__ import annotations

import django_filters

from apps.appointments.models import Appointment


class AdminAppointmentFilter(django_filters.FilterSet):
    status = django_filters.CharFilter(field_name="status")
    master = django_filters.NumberFilter(field_name="assigned_master_id")
    client = django_filters.NumberFilter(field_name="client_id")
    date_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    date_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")

    class Meta:
        model = Appointment
        fields = ("status", "master", "client", "date_from", "date_to")
