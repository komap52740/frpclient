from django.urls import path

from .views import (
    AdminActivateMasterView,
    AdminAppointmentListView,
    AdminBanUserView,
    AdminClientsView,
    AdminConfirmPaymentView,
    AdminMastersView,
    AdminSuspendMasterView,
    AdminUnbanUserView,
)

urlpatterns = [
    path("admin/appointments/", AdminAppointmentListView.as_view(), name="admin-appointments-list"),
    path("admin/appointments/<int:appointment_id>/confirm-payment/", AdminConfirmPaymentView.as_view(), name="admin-appointments-confirm-payment-2"),
    path("admin/users/", AdminClientsView.as_view(), name="admin-users-list"),
    path("admin/users/<int:user_id>/ban/", AdminBanUserView.as_view(), name="admin-users-ban"),
    path("admin/users/<int:user_id>/unban/", AdminUnbanUserView.as_view(), name="admin-users-unban"),
    path("admin/masters/", AdminMastersView.as_view(), name="admin-masters-list"),
    path("admin/masters/<int:user_id>/activate/", AdminActivateMasterView.as_view(), name="admin-masters-activate"),
    path("admin/masters/<int:user_id>/suspend/", AdminSuspendMasterView.as_view(), name="admin-masters-suspend"),
]
