from django.urls import path

from .views import ApiHealthView

urlpatterns = [
    path("health/", ApiHealthView.as_view(), name="api-health"),
]
