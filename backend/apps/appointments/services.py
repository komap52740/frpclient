from __future__ import annotations

from datetime import timedelta

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


def initialize_response_deadline(appointment: Appointment) -> None:
    if appointment.response_deadline_at:
        return
    from apps.accounts.models import SiteSettings

    settings_obj = SiteSettings.load()
    base_time = appointment.created_at or timezone.now()
    appointment.response_deadline_at = base_time + timedelta(minutes=max(1, settings_obj.sla_response_minutes))
    appointment.save(update_fields=["response_deadline_at", "updated_at"])


def _set_completion_deadline_from_paid(appointment: Appointment) -> None:
    from apps.accounts.models import SiteSettings

    settings_obj = SiteSettings.load()
    appointment.completion_deadline_at = timezone.now() + timedelta(hours=max(1, settings_obj.sla_completion_hours))


def mark_sla_breach(appointment: Appointment, actor: User | None, reason: str, metadata: dict | None = None) -> None:
    if appointment.sla_breached:
        return
    appointment.sla_breached = True
    appointment.save(update_fields=["sla_breached", "updated_at"])
    emit_event(
        "sla.breached",
        appointment,
        actor=actor,
        payload={"reason": reason, **(metadata or {})},
    )


def evaluate_response_sla(appointment: Appointment, actor: User | None) -> None:
    if appointment.response_deadline_at and timezone.now() > appointment.response_deadline_at:
        mark_sla_breach(appointment, actor, reason="response_timeout")


def evaluate_completion_sla(appointment: Appointment, actor: User | None) -> None:
    if not appointment.completed_at or not appointment.completion_deadline_at:
        return
    if appointment.completed_at > appointment.completion_deadline_at:
        overtime_seconds = int((appointment.completed_at - appointment.completion_deadline_at).total_seconds())
        mark_sla_breach(appointment, actor, reason="completion_timeout", metadata={"overtime_seconds": overtime_seconds})


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
    if to_status == AppointmentStatusChoices.PAID:
        _set_completion_deadline_from_paid(appointment)
        update_fields.append("completion_deadline_at")
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
    if to_status == AppointmentStatusChoices.IN_REVIEW:
        evaluate_response_sla(appointment, actor)
    if to_status == AppointmentStatusChoices.COMPLETED:
        evaluate_completion_sla(appointment, actor)
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
