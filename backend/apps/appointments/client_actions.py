from __future__ import annotations

from apps.accounts.notifications import notify_masters_about_new_appointment
from apps.appointments.models import (
    Appointment,
    AppointmentEventType,
    AppointmentStatusChoices,
)
from apps.appointments.services import add_event, initialize_response_deadline
from apps.platform.services import create_notification, emit_event

CLIENT_SIGNAL_META = {
    "ready_for_session": {
        "title": "Клиент готов к подключению",
        "message": "Клиент подтвердил готовность к удаленному подключению.",
    },
    "need_help": {
        "title": "Клиент просит помощь",
        "message": "Клиент просит пошаговую помощь по текущей заявке.",
    },
    "payment_issue": {
        "title": "Проблема с оплатой",
        "message": "Клиент сообщил о проблеме с оплатой и ожидает подсказку.",
    },
    "need_reschedule": {
        "title": "Нужно перенести сессию",
        "message": "Клиент просит перенести время подключения.",
    },
}

CLIENT_SIGNAL_CHOICES = tuple(CLIENT_SIGNAL_META.keys())


def can_client_signal(appointment: Appointment) -> bool:
    return appointment.status not in (
        AppointmentStatusChoices.COMPLETED,
        AppointmentStatusChoices.CANCELLED,
        AppointmentStatusChoices.DECLINED_BY_MASTER,
    )


def create_client_signal(
    *,
    appointment: Appointment,
    client_user,
    signal_code: str,
    comment: str = "",
) -> None:
    if signal_code not in CLIENT_SIGNAL_META:
        raise ValueError("Unknown client signal code")

    signal_meta = CLIENT_SIGNAL_META[signal_code]
    normalized_comment = (comment or "").strip()
    note = signal_meta["title"]
    if normalized_comment:
        note = f"{note}. Комментарий: {normalized_comment}"

    add_event(
        appointment,
        client_user,
        AppointmentEventType.CLIENT_SIGNAL,
        note=note,
        metadata={"signal": signal_code, "comment": normalized_comment},
    )
    emit_event(
        "appointment.client_signal",
        appointment,
        actor=client_user,
        payload={"signal": signal_code, "comment": normalized_comment},
    )

    if appointment.assigned_master_id:
        create_notification(
            user=appointment.assigned_master,
            type="appointment",
            title=f"Сигнал по заявке #{appointment.id}",
            message=signal_meta["message"],
            payload={"appointment_id": appointment.id, "signal": signal_code},
        )


def repeat_client_appointment(*, source: Appointment, client_user) -> Appointment:
    repeated = Appointment.objects.create(
        client=client_user,
        brand=source.brand,
        model=source.model,
        lock_type=source.lock_type,
        has_pc=source.has_pc,
        description=source.description,
    )
    initialize_response_deadline(repeated)
    emit_event(
        "appointment.created",
        repeated,
        actor=client_user,
        payload={
            "status": repeated.status,
            "source_appointment_id": source.id,
            "created_via": "repeat",
        },
    )
    notify_masters_about_new_appointment(repeated)
    return repeated

