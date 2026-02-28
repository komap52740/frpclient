from django.urls import path

from .views import (
    AdminManualStatusView,
    AppointmentCreateView,
    AppointmentDetailView,
    AppointmentEventsView,
    MarkPaidView,
    MasterActiveAppointmentsView,
    MasterCompleteView,
    MasterConfirmPaymentView,
    MasterDeclineView,
    MasterNewAppointmentsView,
    MasterSetPriceView,
    MasterStartView,
    MasterTakeView,
    MyAppointmentsView,
    UploadPaymentProofView,
)

urlpatterns = [
    path("appointments/", AppointmentCreateView.as_view(), name="appointments-create"),
    path("appointments/my/", MyAppointmentsView.as_view(), name="appointments-my"),
    path("appointments/new/", MasterNewAppointmentsView.as_view(), name="appointments-new"),
    path("appointments/active/", MasterActiveAppointmentsView.as_view(), name="appointments-active"),
    path("appointments/<int:appointment_id>/", AppointmentDetailView.as_view(), name="appointments-detail"),
    path("appointments/<int:appointment_id>/events/", AppointmentEventsView.as_view(), name="appointments-events"),
    path("appointments/<int:appointment_id>/upload-payment-proof/", UploadPaymentProofView.as_view(), name="appointments-upload-payment-proof"),
    path("appointments/<int:appointment_id>/mark-paid/", MarkPaidView.as_view(), name="appointments-mark-paid"),
    path("appointments/<int:appointment_id>/take/", MasterTakeView.as_view(), name="appointments-take"),
    path("appointments/<int:appointment_id>/decline/", MasterDeclineView.as_view(), name="appointments-decline"),
    path("appointments/<int:appointment_id>/set-price/", MasterSetPriceView.as_view(), name="appointments-set-price"),
    path("appointments/<int:appointment_id>/confirm-payment/", MasterConfirmPaymentView.as_view(), name="appointments-confirm-payment"),
    path("appointments/<int:appointment_id>/start/", MasterStartView.as_view(), name="appointments-start"),
    path("appointments/<int:appointment_id>/complete/", MasterCompleteView.as_view(), name="appointments-complete"),
    path("admin/appointments/<int:appointment_id>/set-status/", AdminManualStatusView.as_view(), name="admin-appointments-set-status"),
]
