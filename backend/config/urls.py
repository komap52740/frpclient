from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from apps.common.views import healthz

admin.site.site_header = "Панель администрирования FRP"
admin.site.site_title = "Администрирование FRP"
admin.site.index_title = "Управление системой"

urlpatterns = [
    path("healthz", healthz, name="healthz"),
    path("django-admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path(
        "api/schema/swagger/",
        SpectacularSwaggerView.as_view(url_name="api-schema"),
        name="api-schema-swagger",
    ),
    path(
        "api/schema/redoc/",
        SpectacularRedocView.as_view(url_name="api-schema"),
        name="api-schema-redoc",
    ),
    path("api/", include("apps.accounts.urls")),
    path("api/", include("apps.appointments.urls")),
    path("api/", include("apps.chat.urls")),
    path("api/", include("apps.reviews.urls")),
    path("api/", include("apps.adminpanel.urls")),
    path("api/", include("apps.common.urls")),
    path("api/", include("apps.platform.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
