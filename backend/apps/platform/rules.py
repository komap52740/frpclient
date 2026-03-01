from __future__ import annotations

from contextvars import ContextVar
from datetime import datetime
from functools import lru_cache
from typing import Any

from django.apps import apps
from django.db import transaction

from apps.accounts.models import RoleChoices, User
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.appointments.services import transition_status

from .models import Rule
from .services import create_notification

_RULE_DEPTH: ContextVar[int] = ContextVar("platform_rule_depth", default=0)
_MAX_RULE_DEPTH = 3

_RISK_LEVEL_ORDER = {"low": 1, "medium": 2, "high": 3, "critical": 4}


def _is_sequence(value: Any) -> bool:
    return isinstance(value, (list, tuple, set))


def _normalize_value(value: Any) -> Any:
    if isinstance(value, str):
        lowered = value.lower()
        if lowered in _RISK_LEVEL_ORDER:
            return _RISK_LEVEL_ORDER[lowered]
        return value
    return value


def _compare(left: Any, op: str, right: Any) -> bool:
    left_value = _normalize_value(left)
    right_value = _normalize_value(right)

    if op == "==":
        return left_value == right_value
    if op == "!=":
        return left_value != right_value
    if op == ">":
        return left_value > right_value
    if op == ">=":
        return left_value >= right_value
    if op == "<":
        return left_value < right_value
    if op == "<=":
        return left_value <= right_value
    if op == "in":
        return left_value in right_value if _is_sequence(right_value) else False
    if op == "not_in":
        return left_value not in right_value if _is_sequence(right_value) else True
    if op == "contains":
        return right_value in left_value if _is_sequence(left_value) or isinstance(left_value, str) else False
    return False


def _resolve_path(path: str, context: dict[str, Any]) -> Any:
    current: Any = context
    for part in path.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        else:
            current = getattr(current, part, None)
        if current is None:
            return None
    return current


def _evaluate_condition_node(node: dict[str, Any], context: dict[str, Any]) -> bool:
    if not node:
        return True
    if "all" in node:
        return all(_evaluate_condition_node(item, context) for item in node.get("all", []))
    if "any" in node:
        return any(_evaluate_condition_node(item, context) for item in node.get("any", []))
    if "not" in node:
        return not _evaluate_condition_node(node.get("not") or {}, context)

    field = node.get("field")
    op = node.get("op")
    right = node.get("value")
    if not field or not op:
        return False
    left = _resolve_path(field, context)
    return _compare(left, op, right)


@lru_cache(maxsize=64)
def _resolve_model(entity_type: str):
    model_map = {
        "Appointment": apps.get_model("appointments", "Appointment"),
        "Message": apps.get_model("chat", "Message"),
        "Review": apps.get_model("reviews", "Review"),
        "User": apps.get_model("accounts", "User"),
    }
    return model_map.get(entity_type)


def _load_entity(event):
    model = _resolve_model(event.entity_type)
    if model is None:
        return None
    return model.objects.filter(id=event.entity_id).first()


def _resolve_appointment(entity) -> Appointment | None:
    if isinstance(entity, Appointment):
        return entity
    if hasattr(entity, "appointment"):
        return getattr(entity, "appointment", None)
    return None


def _build_context(event, entity) -> dict[str, Any]:
    appointment = _resolve_appointment(entity)
    actor = event.actor
    context: dict[str, Any] = {
        "event": {
            "id": event.id,
            "event_type": event.event_type,
            "entity_type": event.entity_type,
            "entity_id": event.entity_id,
            "created_at": event.created_at.isoformat() if isinstance(event.created_at, datetime) else "",
            "payload": event.payload or {},
        },
        "actor": {
            "id": actor.id if actor else None,
            "role": getattr(actor, "role", None),
        },
    }

    if appointment is not None:
        client = appointment.client
        master = appointment.assigned_master
        client_stats = getattr(client, "client_stats", None) if client else None
        master_stats = getattr(master, "master_stats", None) if master else None

        context["appointment"] = {
            "id": appointment.id,
            "status": appointment.status,
            "total_price": appointment.total_price,
            "client_id": appointment.client_id,
            "assigned_master_id": appointment.assigned_master_id,
            "created_at": appointment.created_at.isoformat() if appointment.created_at else "",
            "platform_tags": appointment.platform_tags or [],
        }
        context["client"] = {
            "id": client.id if client else None,
            "risk_level": getattr(client_stats, "risk_level", "low"),
            "risk_score": getattr(client_stats, "risk_score", 0),
            "is_banned": client.is_banned if client else False,
        }
        context["master"] = {
            "id": master.id if master else None,
            "master_score": getattr(master_stats, "master_score", None),
            "is_master_active": master.is_master_active if master else False,
        }
    return context


def _allowed_status_transition(current_status: str, to_status: str) -> bool:
    allowed_transitions = {
        AppointmentStatusChoices.NEW: {AppointmentStatusChoices.IN_REVIEW, AppointmentStatusChoices.CANCELLED},
        AppointmentStatusChoices.IN_REVIEW: {
            AppointmentStatusChoices.AWAITING_PAYMENT,
            AppointmentStatusChoices.DECLINED_BY_MASTER,
            AppointmentStatusChoices.CANCELLED,
        },
        AppointmentStatusChoices.AWAITING_PAYMENT: {
            AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED,
            AppointmentStatusChoices.DECLINED_BY_MASTER,
            AppointmentStatusChoices.CANCELLED,
        },
        AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED: {
            AppointmentStatusChoices.PAID,
            AppointmentStatusChoices.CANCELLED,
        },
        AppointmentStatusChoices.PAID: {AppointmentStatusChoices.IN_PROGRESS, AppointmentStatusChoices.CANCELLED},
        AppointmentStatusChoices.IN_PROGRESS: {AppointmentStatusChoices.COMPLETED, AppointmentStatusChoices.CANCELLED},
        AppointmentStatusChoices.COMPLETED: set(),
        AppointmentStatusChoices.DECLINED_BY_MASTER: set(),
        AppointmentStatusChoices.CANCELLED: set(),
    }
    return to_status in allowed_transitions.get(current_status, set())


def _action_recipients(action: dict[str, Any], event, entity, appointment: Appointment | None) -> list[User]:
    target = action.get("target", "")
    if target == "actor" and event.actor:
        return [event.actor]
    if target == "client" and appointment and appointment.client:
        return [appointment.client]
    if target == "master" and appointment and appointment.assigned_master:
        return [appointment.assigned_master]
    if target == "admins":
        return list(User.objects.filter(role=RoleChoices.ADMIN) | User.objects.filter(is_superuser=True))
    if target == "user":
        user_id = action.get("user_id")
        if user_id:
            user = User.objects.filter(id=user_id).first()
            return [user] if user else []
    if target == "role":
        role = action.get("role")
        if role in RoleChoices.values:
            return list(User.objects.filter(role=role))
    return []


def _execute_action(rule: Rule, action: dict[str, Any], event, entity, context: dict[str, Any]) -> None:
    action_type = action.get("type")
    appointment = _resolve_appointment(entity)

    if action_type == "create_notification":
        recipients = _action_recipients(action, event, entity, appointment)
        if not recipients:
            return
        title = action.get("title") or f"Правило: {rule.name}"
        message = action.get("message") or f"Сработало правило для события {event.event_type}"
        for recipient in recipients:
            create_notification(
                user=recipient,
                type=action.get("notification_type", "system"),
                title=title,
                message=message,
                payload={
                    "rule_id": rule.id,
                    "event_id": event.id,
                    **(action.get("payload") or {}),
                },
            )
        return

    if action_type == "change_status":
        if appointment is None:
            return
        to_status = action.get("to_status")
        if not to_status or appointment.status == to_status:
            return
        if not _allowed_status_transition(appointment.status, to_status):
            return
        actor = event.actor or appointment.assigned_master or appointment.client
        if actor is None:
            return
        transition_status(appointment, actor, to_status, note=f"[rule:{rule.name}] auto change")
        return

    if action_type in {"assign_tag", "assign_flag"}:
        if appointment is None:
            return
        tag = action.get("tag") or action.get("flag")
        if not tag:
            return
        tags = list(appointment.platform_tags or [])
        if tag not in tags:
            tags.append(tag)
            appointment.platform_tags = tags
            appointment.save(update_fields=["platform_tags", "updated_at"])
        return

    if action_type == "request_admin_attention":
        title = action.get("title") or "Требуется внимание администратора"
        message = action.get("message") or f"Правило {rule.name}: {event.event_type}"
        for admin_user in User.objects.filter(role=RoleChoices.ADMIN):
            create_notification(
                user=admin_user,
                type="system",
                title=title,
                message=message,
                payload={"rule_id": rule.id, "event_id": event.id},
            )


def _iter_actions(rule: Rule) -> list[dict[str, Any]]:
    action_payload = rule.action_json or {}
    if isinstance(action_payload, list):
        return [item for item in action_payload if isinstance(item, dict)]
    if isinstance(action_payload, dict):
        return [action_payload]
    return []


@transaction.atomic
def process_event_rules(event) -> int:
    depth = _RULE_DEPTH.get()
    if depth >= _MAX_RULE_DEPTH:
        return 0

    rules = list(Rule.objects.filter(is_active=True, trigger_event_type=event.event_type).order_by("id")[:50])
    if not rules:
        return 0

    entity = _load_entity(event)
    context = _build_context(event, entity)
    token = _RULE_DEPTH.set(depth + 1)
    executed = 0
    try:
        for rule in rules:
            if not _evaluate_condition_node(rule.condition_json or {}, context):
                continue
            for action in _iter_actions(rule):
                _execute_action(rule, action, event, entity, context)
                executed += 1
    finally:
        _RULE_DEPTH.reset(token)
    return executed
