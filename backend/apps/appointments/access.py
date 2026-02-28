from django.shortcuts import get_object_or_404

from apps.accounts.models import RoleChoices

from .models import Appointment, AppointmentStatusChoices


def can_access_appointment(user, appointment: Appointment) -> bool:
    if user.is_superuser or user.role == RoleChoices.ADMIN:
        return True
    if user.role == RoleChoices.CLIENT:
        return appointment.client_id == user.id
    if user.role == RoleChoices.MASTER:
        return appointment.assigned_master_id == user.id or appointment.status == AppointmentStatusChoices.NEW
    return False


def get_appointment_for_user(user, appointment_id: int) -> Appointment:
    appointment = get_object_or_404(
        Appointment.objects.select_related("client", "assigned_master", "payment_confirmed_by"),
        id=appointment_id,
    )
    if not can_access_appointment(user, appointment):
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("Нет доступа к заявке")
    return appointment
