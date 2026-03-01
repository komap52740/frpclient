from __future__ import annotations

from django.db import transaction
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import RoleChoices
from apps.accounts.services import recalculate_client_stats, recalculate_master_stats
from apps.appointments.access import get_appointment_for_user
from apps.appointments.models import AppointmentStatusChoices
from apps.platform.services import emit_event

from .models import BehaviorFlag, BehaviorFlagCode, Review, ReviewTypeChoices
from .serializers import ReviewClientCreateSerializer, ReviewMasterCreateSerializer, ReviewSerializer


def ensure_behavior_flags_seeded() -> None:
    for code, label in BehaviorFlagCode.choices:
        BehaviorFlag.objects.get_or_create(code=code, defaults={"label": label})


class ReviewMasterView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

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
    permission_classes = (permissions.IsAuthenticated,)

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
