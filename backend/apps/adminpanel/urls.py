from django.urls import path

from .views import (
    AdminActivateMasterView,
    AdminAllUsersView,
    AdminAppointmentListView,
    AdminBanUserView,
    AdminClientsView,
    AdminConfirmPaymentView,
    AdminMastersView,
    AdminSystemRunActionView,
    AdminSystemSettingsView,
    AdminSystemStatusView,
    AdminSuspendMasterView,
    AdminUnbanUserView,
    AdminUserRoleUpdateView,
)

urlpatterns = [
    path("admin/appointments/", AdminAppointmentListView.as_view(), name="admin-appointments-list"),
    path("admin/appointments/<int:appointment_id>/confirm-payment/", AdminConfirmPaymentView.as_view(), name="admin-appointments-confirm-payment-2"),
    path("admin/users/", AdminClientsView.as_view(), name="admin-users-list"),
    path("admin/users/all/", AdminAllUsersView.as_view(), name="admin-users-all"),
    path("admin/users/<int:user_id>/ban/", AdminBanUserView.as_view(), name="admin-users-ban"),
    path("admin/users/<int:user_id>/unban/", AdminUnbanUserView.as_view(), name="admin-users-unban"),
    path("admin/users/<int:user_id>/role/", AdminUserRoleUpdateView.as_view(), name="admin-users-role"),
    path("admin/masters/", AdminMastersView.as_view(), name="admin-masters-list"),
    path("admin/masters/<int:user_id>/activate/", AdminActivateMasterView.as_view(), name="admin-masters-activate"),
    path("admin/masters/<int:user_id>/suspend/", AdminSuspendMasterView.as_view(), name="admin-masters-suspend"),
    path("admin/system/status/", AdminSystemStatusView.as_view(), name="admin-system-status"),
    path("admin/system/settings/", AdminSystemSettingsView.as_view(), name="admin-system-settings"),
    path("admin/system/run-action/", AdminSystemRunActionView.as_view(), name="admin-system-run-action"),
]
