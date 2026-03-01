from django.urls import path

from .views import (
    FeatureFlagDetailView,
    FeatureFlagListCreateView,
    NotificationListView,
    NotificationMarkReadView,
    NotificationUnreadCountView,
    PlatformEventListView,
    RuleDetailView,
    RuleListCreateView,
)

urlpatterns = [
    path("notifications/", NotificationListView.as_view(), name="notifications-list"),
    path("notifications/mark-read/", NotificationMarkReadView.as_view(), name="notifications-mark-read"),
    path("notifications/unread-count/", NotificationUnreadCountView.as_view(), name="notifications-unread-count"),
    path("admin/feature-flags/", FeatureFlagListCreateView.as_view(), name="feature-flags-list"),
    path("admin/feature-flags/<int:flag_id>/", FeatureFlagDetailView.as_view(), name="feature-flags-detail"),
    path("v1/events/", PlatformEventListView.as_view(), name="platform-events-list"),
    path("v1/admin/rules/", RuleListCreateView.as_view(), name="rules-list"),
    path("v1/admin/rules/<int:rule_id>/", RuleDetailView.as_view(), name="rules-detail"),
]
