from django.urls import path

from .views import AdminReviewListView, MyReviewsView, ReviewClientView, ReviewMasterView

urlpatterns = [
    path("appointments/<int:appointment_id>/review-master/", ReviewMasterView.as_view(), name="review-master"),
    path("appointments/<int:appointment_id>/review-client/", ReviewClientView.as_view(), name="review-client"),
    path("reviews/my/", MyReviewsView.as_view(), name="reviews-my"),
    path("admin/reviews/", AdminReviewListView.as_view(), name="admin-reviews"),
]
