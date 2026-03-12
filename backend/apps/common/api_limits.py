from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.db.models import QuerySet
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response


TRUE_VALUES = {"1", "true", "yes", "on"}


@dataclass(frozen=True, slots=True)
class ListWindow:
    limit: int
    offset: int
    include_meta: bool


def parse_bool_param(raw_value: Any, *, default: bool = False) -> bool:
    if raw_value is None:
        return default
    return str(raw_value).strip().lower() in TRUE_VALUES


def parse_non_negative_int_param(raw_value: Any, *, field_name: str, default: int = 0) -> int:
    if raw_value in (None, ""):
        return default
    try:
        value = int(str(raw_value).strip())
    except (TypeError, ValueError) as exc:
        raise ValidationError({field_name: f"Параметр {field_name} должен быть целым числом."}) from exc
    if value < 0:
        raise ValidationError({field_name: f"Параметр {field_name} должен быть не меньше 0."})
    return value


def parse_positive_int_param(raw_value: Any, *, field_name: str, default: int) -> int:
    if raw_value in (None, ""):
        return default
    try:
        value = int(str(raw_value).strip())
    except (TypeError, ValueError) as exc:
        raise ValidationError({field_name: f"Параметр {field_name} должен быть целым числом."}) from exc
    if value < 1:
        raise ValidationError({field_name: f"Параметр {field_name} должен быть не меньше 1."})
    return value


def resolve_list_window(
    request,
    *,
    default_limit: int | None = None,
    max_limit: int | None = None,
    default_offset: int = 0,
    max_offset: int | None = None,
) -> ListWindow:
    effective_default_limit = default_limit or settings.DEFAULT_API_LIST_LIMIT
    effective_max_limit = max_limit or settings.MAX_API_LIST_LIMIT
    effective_max_offset = max_offset or settings.API_LIST_MAX_OFFSET

    limit = parse_positive_int_param(
        request.query_params.get("limit"),
        field_name="limit",
        default=effective_default_limit,
    )
    offset = parse_non_negative_int_param(
        request.query_params.get("offset"),
        field_name="offset",
        default=default_offset,
    )
    if offset > effective_max_offset:
        raise ValidationError({"offset": f"Параметр offset не должен быть больше {effective_max_offset}."})

    return ListWindow(
        limit=min(limit, effective_max_limit),
        offset=offset,
        include_meta=parse_bool_param(request.query_params.get("include_meta")),
    )


def apply_list_window(queryset_or_list, window: ListWindow):
    return queryset_or_list[window.offset : window.offset + window.limit]


def collection_count(queryset_or_list) -> int:
    if isinstance(queryset_or_list, QuerySet):
        return queryset_or_list.count()
    return len(queryset_or_list)


def render_bounded_list_response(
    serialized_data,
    *,
    window: ListWindow,
    total: int | None = None,
    response_status: int = 200,
) -> Response:
    if window.include_meta:
        return Response(
            {
                "count": total if total is not None else len(serialized_data),
                "limit": window.limit,
                "offset": window.offset,
                "results": serialized_data,
            },
            status=response_status,
        )
    return Response(serialized_data, status=response_status)


def serialize_bounded_queryset(
    request,
    queryset,
    serializer_class,
    *,
    serializer_context: dict[str, Any] | None = None,
    serializer_kwargs: dict[str, Any] | None = None,
    default_limit: int | None = None,
    max_limit: int | None = None,
    max_offset: int | None = None,
    response_status: int = 200,
) -> Response:
    window = resolve_list_window(
        request,
        default_limit=default_limit,
        max_limit=max_limit,
        max_offset=max_offset,
    )
    total = collection_count(queryset) if window.include_meta else None
    page = apply_list_window(queryset, window)
    effective_kwargs = dict(serializer_kwargs or {})
    if serializer_context is not None and "context" not in effective_kwargs:
        effective_kwargs["context"] = serializer_context
    serializer = serializer_class(page, many=True, **effective_kwargs)
    return render_bounded_list_response(
        serializer.data,
        window=window,
        total=total,
        response_status=response_status,
    )


class BoundedListAPIView(generics.ListAPIView):
    default_list_limit: int | None = None
    max_list_limit: int | None = None
    max_list_offset: int | None = None

    def get_list_window(self) -> ListWindow:
        return resolve_list_window(
            self.request,
            default_limit=self.default_list_limit,
            max_limit=self.max_list_limit,
            max_offset=self.max_list_offset,
        )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        window = self.get_list_window()
        total = collection_count(queryset) if window.include_meta else None
        page = apply_list_window(queryset, window)
        serializer = self.get_serializer(page, many=True)
        return render_bounded_list_response(serializer.data, window=window, total=total)
