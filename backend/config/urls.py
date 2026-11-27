"""Rutas principales del backend de Callejeros Río Cuarto."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="api-schema"),
        name="api-docs",
    ),
    path("api/auth/", include("apps.users.urls")),
    path("api/admin/", include("apps.users.admin_urls")),
    path("api/pets/", include("apps.pets.urls")),
    path("api/adoption-requests/", include("apps.adoptions.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
]

# Solo en desarrollo: Django sirve las fotos subidas (`/media/...`) para que el front
# las muestre. En producción las sirve el servidor web, no Django.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
