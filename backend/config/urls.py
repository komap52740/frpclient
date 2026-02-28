from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path

admin.site.site_header = "Панель администрирования FRP"
admin.site.site_title = "Администрирование FRP"
admin.site.index_title = "Управление системой"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.accounts.urls")),
    path("api/", include("apps.appointments.urls")),
    path("api/", include("apps.chat.urls")),
    path("api/", include("apps.reviews.urls")),
    path("api/", include("apps.adminpanel.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
