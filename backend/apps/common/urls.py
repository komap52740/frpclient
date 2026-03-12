from django.urls import path

from .views import ApiHealthView, ApiInternalHealthView, SignedMediaDownloadView

urlpatterns = [
    path("health/", ApiHealthView.as_view(), name="api-health"),
    path("health/internal/", ApiInternalHealthView.as_view(), name="api-health-internal"),
    path("media/signed/", SignedMediaDownloadView.as_view(), name="secure-media-download"),
]
