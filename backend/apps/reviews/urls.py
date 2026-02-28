from django.urls import path

from .views import ReviewClientView, ReviewMasterView

urlpatterns = [
    path("appointments/<int:appointment_id>/review-master/", ReviewMasterView.as_view(), name="review-master"),
    path("appointments/<int:appointment_id>/review-client/", ReviewClientView.as_view(), name="review-client"),
]
