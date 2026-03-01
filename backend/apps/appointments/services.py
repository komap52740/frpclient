from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import RoleChoices, User
from apps.platform.services import emit_event

from .models import (
    Appointment,
    AppointmentEvent,
    AppointmentEventType,
    AppointmentStatusChoices,
)


def add_event(
    appointment: Appointment,
    actor: User | None,
    event_type: str,
    from_status: str = "",
    to_status: str = "",
    note: str = "",
    metadata: dict | None = None,
) -> None:
    AppointmentEvent.objects.create(
        appointment=appointment,
        actor=actor,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        note=note,
        metadata=metadata or {},
    )


def assert_master_assigned(appointment: Appointment, user: User) -> None:
    if appointment.assigned_master_id != user.id:
        raise PermissionDenied("Заявка не закреплена за этим мастером")


def transition_status(appointment: Appointment, actor: User, to_status: str, note: str = "") -> Appointment:
    from_status = appointment.status
    appointment.status = to_status
    update_fields = ["status", "updated_at"]

    if to_status == AppointmentStatusChoices.IN_REVIEW and not appointment.taken_at:
        appointment.taken_at = timezone.now()
        update_fields.append("taken_at")
    if to_status == AppointmentStatusChoices.IN_PROGRESS and not appointment.started_at:
        appointment.started_at = timezone.now()
        update_fields.append("started_at")
    if to_status == AppointmentStatusChoices.COMPLETED and not appointment.completed_at:
        appointment.completed_at = timezone.now()
        update_fields.append("completed_at")

    appointment.save(update_fields=update_fields)
    add_event(
        appointment=appointment,
        actor=actor,
        event_type=AppointmentEventType.STATUS_CHANGED,
        from_status=from_status,
        to_status=to_status,
        note=note,
    )
    emit_event(
        "appointment.status_changed",
        appointment,
        actor=actor,
        payload={
            "from_status": from_status,
            "to_status": to_status,
            "note": note,
        },
    )
    if appointment.assigned_master_id:
        from apps.accounts.services import recalculate_master_stats

        recalculate_master_stats(appointment.assigned_master)
    return appointment


@transaction.atomic
def take_appointment(appointment_id: int, master: User) -> Appointment:
    if master.role != RoleChoices.MASTER:
        raise PermissionDenied("Только мастер может брать заявку")
    if not master.is_master_active:
        raise PermissionDenied("Мастер ещё не активирован администратором")

    appointment = Appointment.objects.select_for_update().get(id=appointment_id)
    if appointment.status != AppointmentStatusChoices.NEW:
        raise ValidationError("Можно взять только NEW заявку")

    appointment.assigned_master = master
    appointment.save(update_fields=["assigned_master", "updated_at"])
    updated_appointment = transition_status(appointment, master, AppointmentStatusChoices.IN_REVIEW, note="Заявка взята мастером")
    emit_event(
        "appointment.master_taken",
        updated_appointment,
        actor=master,
        payload={"assigned_master_id": master.id},
    )
    return updated_appointment
