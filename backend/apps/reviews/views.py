from __future__ import annotations

from django.conf import settings
from django.db import transaction
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import RoleChoices
from apps.accounts.permissions import IsAdminRole, IsAuthenticatedAndNotBanned
from apps.accounts.services import recalculate_client_stats, recalculate_master_stats
from apps.appointments.access import get_appointment_for_user
from apps.appointments.models import AppointmentStatusChoices
from apps.common.api_limits import BoundedListAPIView
from apps.platform.services import emit_event

from .models import BehaviorFlag, BehaviorFlagCode, Review, ReviewTypeChoices
from .serializers import ReviewClientCreateSerializer, ReviewMasterCreateSerializer, ReviewSerializer


def ensure_behavior_flags_seeded() -> None:
    for code, label in BehaviorFlagCode.choices:
        BehaviorFlag.objects.get_or_create(code=code, defaults={"label": label})


class ReviewMasterView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    @transaction.atomic
    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.CLIENT or appointment.client_id != request.user.id:
            return Response({"detail": "Только клиент по своей заявке"}, status=status.HTTP_403_FORBIDDEN)
        if appointment.status != AppointmentStatusChoices.COMPLETED:
            return Response({"detail": "Отзыв можно оставить только после COMPLETED"}, status=status.HTTP_400_BAD_REQUEST)
        if Review.objects.filter(appointment=appointment, review_type=ReviewTypeChoices.MASTER_REVIEW).exists():
            return Response({"detail": "Отзыв мастеру уже оставлен"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ReviewMasterCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        review = Review.objects.create(
            appointment=appointment,
            author=request.user,
            target=appointment.assigned_master,
            review_type=ReviewTypeChoices.MASTER_REVIEW,
            rating=serializer.validated_data["rating"],
            comment=serializer.validated_data.get("comment", ""),
        )
        emit_event(
            "review.master_created",
            review,
            actor=request.user,
            payload={"appointment_id": appointment.id, "rating": review.rating},
        )
        recalculate_master_stats(appointment.assigned_master)
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


class ReviewClientView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    @transaction.atomic
    def post(self, request, appointment_id: int):
        appointment = get_appointment_for_user(request.user, appointment_id)
        if request.user.role != RoleChoices.MASTER or appointment.assigned_master_id != request.user.id:
            return Response({"detail": "Только назначенный мастер"}, status=status.HTTP_403_FORBIDDEN)
        if appointment.status != AppointmentStatusChoices.COMPLETED:
            return Response({"detail": "Оценка клиента доступна только после COMPLETED"}, status=status.HTTP_400_BAD_REQUEST)
        if Review.objects.filter(appointment=appointment, review_type=ReviewTypeChoices.CLIENT_REVIEW).exists():
            return Response({"detail": "Оценка клиента уже выставлена"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ReviewClientCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ensure_behavior_flags_seeded()

        review = Review.objects.create(
            appointment=appointment,
            author=request.user,
            target=appointment.client,
            review_type=ReviewTypeChoices.CLIENT_REVIEW,
            rating=serializer.validated_data["rating"],
            comment=serializer.validated_data.get("comment", ""),
        )
        flag_codes = serializer.validated_data.get("behavior_flags", [])
        if flag_codes:
            flags = list(BehaviorFlag.objects.filter(code__in=flag_codes, is_active=True))
            review.behavior_flags.set(flags)

        emit_event(
            "review.client_created",
            review,
            actor=request.user,
            payload={"appointment_id": appointment.id, "rating": review.rating, "behavior_flags": flag_codes},
        )
        recalculate_client_stats(appointment.client)
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


class MyReviewsView(BoundedListAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)
    serializer_class = ReviewSerializer
    default_list_limit = settings.DEFAULT_API_LIST_LIMIT
    max_list_limit = settings.MAX_API_LIST_LIMIT

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Review.objects.none()
        return (
            Review.objects.filter(target=self.request.user)
            .select_related("appointment", "author", "target")
            .prefetch_related("behavior_flags")
            .order_by("-id")
        )


class AdminReviewListView(BoundedListAPIView):
    permission_classes = (IsAuthenticatedAndNotBanned, IsAdminRole)
    serializer_class = ReviewSerializer
    default_list_limit = settings.ADMIN_API_LIST_LIMIT
    max_list_limit = settings.ADMIN_API_MAX_LIST_LIMIT

    def get_queryset(self):
        queryset = (
            Review.objects.select_related("appointment", "author", "target")
            .prefetch_related("behavior_flags")
            .order_by("-id")
        )

        review_type = self.request.query_params.get("review_type")
        if review_type in ReviewTypeChoices.values:
            queryset = queryset.filter(review_type=review_type)

        target_role = self.request.query_params.get("target_role")
        if target_role in RoleChoices.values:
            queryset = queryset.filter(target__role=target_role)

        target_id = self.request.query_params.get("target_id")
        if target_id and str(target_id).isdigit():
            queryset = queryset.filter(target_id=int(target_id))

        return queryset

