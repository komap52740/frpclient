from __future__ import annotations

from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole

from .models import FeatureFlag, Notification
from .serializers import (
    FeatureFlagSerializer,
    NotificationMarkReadSerializer,
    NotificationSerializer,
    PlatformEventSerializer,
)
from .models import PlatformEvent


class FeatureFlagListCreateView(generics.ListCreateAPIView):
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)
    serializer_class = FeatureFlagSerializer
    queryset = FeatureFlag.objects.prefetch_related("users").all()


class FeatureFlagDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)
    serializer_class = FeatureFlagSerializer
    queryset = FeatureFlag.objects.prefetch_related("users").all()
    lookup_field = "id"
    lookup_url_kwarg = "flag_id"


class NotificationListView(generics.ListAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = NotificationSerializer

    def get_queryset(self):
        queryset = Notification.objects.filter(user=self.request.user).order_by("-id")
        is_read = self.request.query_params.get("is_read")
        if is_read in {"0", "1"}:
            queryset = queryset.filter(is_read=is_read == "1")
        return queryset


class NotificationMarkReadView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = NotificationMarkReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save(user=request.user)
        return Response({"updated": updated})


class NotificationUnreadCountView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"unread_count": count})


class PlatformEventListView(generics.ListAPIView):
    permission_classes = (permissions.IsAuthenticated, IsAdminRole)
    serializer_class = PlatformEventSerializer

    def get_queryset(self):
        queryset = PlatformEvent.objects.select_related("actor").all()
        event_type = self.request.query_params.get("event_type")
        entity_type = self.request.query_params.get("entity_type")
        entity_id = self.request.query_params.get("entity_id")
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        if entity_id:
            queryset = queryset.filter(entity_id=entity_id)
        return queryset[:200]
