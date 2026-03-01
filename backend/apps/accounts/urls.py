from django.urls import path

from .views import (
    AuthLogoutView,
    BootstrapCreateAdminView,
    BootstrapStatusView,
    CookieTokenRefreshView,
    DashboardSummaryView,
    MeView,
    PasswordLoginView,
    RegisterView,
    TelegramAuthView,
)

urlpatterns = [
    path("auth/bootstrap-status/", BootstrapStatusView.as_view(), name="auth-bootstrap-status"),
    path("auth/bootstrap-admin/", BootstrapCreateAdminView.as_view(), name="auth-bootstrap-admin"),
    path("auth/login/", PasswordLoginView.as_view(), name="auth-login"),
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/telegram/", TelegramAuthView.as_view(), name="auth-telegram"),
    path("auth/logout/", AuthLogoutView.as_view(), name="auth-logout"),
    path("auth/refresh/", CookieTokenRefreshView.as_view(), name="auth-refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("dashboard/", DashboardSummaryView.as_view(), name="dashboard-summary"),
]
