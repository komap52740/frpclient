from __future__ import annotations

import mimetypes
import os
from urllib.parse import quote, urlencode

from django.conf import settings
from django.core import signing
from django.http import FileResponse, Http404, HttpResponse
from django.urls import reverse

from .storage_backends import media_storage_is_remote

MEDIA_SCOPE_APPOINTMENT = "appointment"
MEDIA_SCOPE_USER = "user"
MEDIA_SCOPE_MESSAGE = "message"
MEDIA_SCOPE_QUICK_REPLY = "quick_reply"

_INLINE_CONTENT_TYPES = (
    "application/pdf",
    "image/",
    "text/",
    "video/",
)


def build_signed_media_url(
    *,
    scope: str,
    object_id: int,
    field_name: str,
    file_name: str,
    request=None,
    base_url: str = "",
) -> str | None:
    normalized_name = (file_name or "").lstrip("/")
    if not normalized_name:
        return None

    token = signing.dumps(
        {
            "scope": scope,
            "object_id": int(object_id),
            "field": field_name,
            "name": normalized_name,
        },
        salt=settings.SECURE_MEDIA_SIGNING_SALT,
        compress=True,
    )
    path = f"{reverse('secure-media-download')}?{urlencode({'token': token})}"
    if request is not None:
        return request.build_absolute_uri(path)
    if base_url:
        return f"{base_url.rstrip('/')}{path}"
    return path


def build_storage_signed_media_url(file_field) -> str | None:
    file_name = str(getattr(file_field, "name", "") or "").lstrip("/")
    if not file_name:
        return None

    content_type, content_disposition = build_media_download_headers(file_name)
    storage = getattr(file_field, "storage", None)
    if storage is None or not hasattr(storage, "url"):
        return None

    url_parameters = {
        "ResponseContentDisposition": content_disposition,
        "ResponseCacheControl": "private, no-store",
    }
    if content_type:
        url_parameters["ResponseContentType"] = content_type

    try:
        return storage.url(
            file_name,
            parameters=url_parameters,
            expire=settings.SECURE_MEDIA_URL_TTL_SECONDS,
        )
    except TypeError:
        return storage.url(file_name)


def build_media_download_headers(file_name: str) -> tuple[str, str]:
    content_type, _ = mimetypes.guess_type(file_name)
    content_type = content_type or "application/octet-stream"
    filename = os.path.basename(file_name)
    disposition = "inline" if content_type.startswith(_INLINE_CONTENT_TYPES) or content_type in _INLINE_CONTENT_TYPES else "attachment"
    encoded_name = quote(filename, safe="")
    content_disposition = f"{disposition}; filename*=UTF-8''{encoded_name}"
    return content_type, content_disposition


def build_media_access_url(
    *,
    file_field,
    scope: str,
    object_id: int,
    field_name: str,
    request=None,
    base_url: str = "",
) -> str | None:
    if media_storage_is_remote():
        direct_url = build_storage_signed_media_url(file_field)
        if direct_url:
            return direct_url
    return build_signed_media_url(
        scope=scope,
        object_id=object_id,
        field_name=field_name,
        file_name=getattr(file_field, "name", ""),
        request=request,
        base_url=base_url,
    )


def build_appointment_media_url(request, appointment, field_name: str, *, base_url: str = "") -> str | None:
    file_field = getattr(appointment, field_name, None)
    if not file_field or not getattr(file_field, "name", ""):
        return None
    return build_media_access_url(
        file_field=file_field,
        scope=MEDIA_SCOPE_APPOINTMENT,
        object_id=appointment.id,
        field_name=field_name,
        request=request,
        base_url=base_url,
    )


def build_user_media_url(request, user, field_name: str, *, base_url: str = "") -> str | None:
    file_field = getattr(user, field_name, None)
    if not file_field or not getattr(file_field, "name", ""):
        return None
    return build_media_access_url(
        file_field=file_field,
        scope=MEDIA_SCOPE_USER,
        object_id=user.id,
        field_name=field_name,
        request=request,
        base_url=base_url,
    )


def build_message_file_url(request, message, *, base_url: str = "") -> str | None:
    file_field = getattr(message, "file", None)
    if not file_field or not getattr(file_field, "name", ""):
        return None
    return build_media_access_url(
        file_field=file_field,
        scope=MEDIA_SCOPE_MESSAGE,
        object_id=message.id,
        field_name="file",
        request=request,
        base_url=base_url,
    )


def build_quick_reply_media_url(request, reply, *, base_url: str = "") -> str | None:
    file_field = getattr(reply, "media_file", None)
    if not file_field or not getattr(file_field, "name", ""):
        return None
    return build_media_access_url(
        file_field=file_field,
        scope=MEDIA_SCOPE_QUICK_REPLY,
        object_id=reply.id,
        field_name="media_file",
        request=request,
        base_url=base_url,
    )


def resolve_signed_media_file(token: str):
    try:
        payload = signing.loads(
            token,
            salt=settings.SECURE_MEDIA_SIGNING_SALT,
            max_age=settings.SECURE_MEDIA_URL_TTL_SECONDS,
        )
    except signing.SignatureExpired as exc:
        raise Http404("Media link expired") from exc
    except signing.BadSignature as exc:
        raise Http404("Invalid media token") from exc

    if not isinstance(payload, dict):
        raise Http404("Invalid media payload")

    scope = payload.get("scope")
    object_id = payload.get("object_id")
    field_name = payload.get("field")
    expected_name = str(payload.get("name") or "").lstrip("/")

    if scope not in {
        MEDIA_SCOPE_APPOINTMENT,
        MEDIA_SCOPE_USER,
        MEDIA_SCOPE_MESSAGE,
        MEDIA_SCOPE_QUICK_REPLY,
    }:
        raise Http404("Unknown media scope")
    if not isinstance(object_id, int) or object_id <= 0 or not expected_name or not field_name:
        raise Http404("Invalid media payload")

    if scope == MEDIA_SCOPE_APPOINTMENT:
        file_field = _resolve_appointment_media(object_id, field_name)
    elif scope == MEDIA_SCOPE_USER:
        file_field = _resolve_user_media(object_id, field_name)
    elif scope == MEDIA_SCOPE_MESSAGE:
        file_field = _resolve_message_media(object_id, field_name)
    else:
        file_field = _resolve_quick_reply_media(object_id, field_name)

    current_name = str(getattr(file_field, "name", "") or "").lstrip("/")
    if current_name != expected_name:
        raise Http404("Media file changed")
    return file_field


def build_secure_media_response(file_field):
    file_name = str(getattr(file_field, "name", "") or "").lstrip("/")
    if not file_name:
        raise Http404("Missing media file")

    content_type, content_disposition = build_media_download_headers(file_name)

    if settings.SECURE_MEDIA_ACCEL_REDIRECT:
        response = HttpResponse(content_type=content_type)
        response["X-Accel-Redirect"] = f"{settings.SECURE_MEDIA_INTERNAL_PREFIX.rstrip('/')}/{quote(file_name, safe='/')}"
    else:
        response = FileResponse(file_field.open("rb"), content_type=content_type)

    response["Content-Disposition"] = content_disposition
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


def _resolve_appointment_media(object_id: int, field_name: str):
    from apps.appointments.models import Appointment

    if field_name not in {"photo_lock_screen", "payment_proof"}:
        raise Http404("Unknown appointment media field")
    appointment = Appointment.objects.filter(id=object_id).first()
    if appointment is None:
        raise Http404("Appointment not found")
    file_field = getattr(appointment, field_name, None)
    if not file_field or not getattr(file_field, "name", ""):
        raise Http404("Appointment media not found")
    return file_field


def _resolve_user_media(object_id: int, field_name: str):
    from apps.accounts.models import User

    if field_name not in {"profile_photo", "wholesale_service_photo_1", "wholesale_service_photo_2"}:
        raise Http404("Unknown user media field")
    user = User.objects.filter(id=object_id).first()
    if user is None:
        raise Http404("User not found")
    file_field = getattr(user, field_name, None)
    if not file_field or not getattr(file_field, "name", ""):
        raise Http404("User media not found")
    return file_field


def _resolve_message_media(object_id: int, field_name: str):
    from apps.chat.models import Message

    if field_name != "file":
        raise Http404("Unknown message media field")
    message = Message.objects.filter(id=object_id, is_deleted=False).first()
    if message is None:
        raise Http404("Message not found")
    file_field = getattr(message, "file", None)
    if not file_field or not getattr(file_field, "name", ""):
        raise Http404("Message media not found")
    return file_field


def _resolve_quick_reply_media(object_id: int, field_name: str):
    from apps.chat.models import MasterQuickReply

    if field_name != "media_file":
        raise Http404("Unknown quick reply media field")
    reply = MasterQuickReply.objects.filter(id=object_id).first()
    if reply is None:
        raise Http404("Quick reply not found")
    file_field = getattr(reply, "media_file", None)
    if not file_field or not getattr(file_field, "name", ""):
        raise Http404("Quick reply media not found")
    return file_field
