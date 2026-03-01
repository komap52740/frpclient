from __future__ import annotations

from .models import FeatureFlag, Notification, PlatformEvent


def emit_event(event_type: str, entity, actor=None, payload: dict | None = None) -> PlatformEvent:
    entity_type = entity.__class__.__name__
    entity_id = str(getattr(entity, "id"))
    return PlatformEvent.objects.create(
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        actor=actor,
        payload=payload or {},
    )


def is_feature_enabled(name: str, *, user=None, role: str | None = None) -> bool:
    flag = FeatureFlag.objects.filter(name=name).first()
    if not flag:
        return False
    return flag.evaluate(user=user, role=role)


def create_notification(*, user, type: str, title: str, message: str = "", payload: dict | None = None) -> Notification:
    return Notification.objects.create(
        user=user,
        type=type,
        title=title,
        message=message,
        payload=payload or {},
    )
