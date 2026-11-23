"""Rutas de la API de solicitudes de adopción (`/api/adoption-requests/`)."""

from django.urls import path

from apps.adoptions.views import (
    AdoptionRequestCreateView,
    AdoptionRequestDetailView,
    MyAdoptionRequestListView,
)

app_name = "adoptions"

urlpatterns = [
    path("", AdoptionRequestCreateView.as_view(), name="adoption-request-create"),
    path("mine/", MyAdoptionRequestListView.as_view(), name="adoption-request-mine"),
    path(
        "<int:request_id>/",
        AdoptionRequestDetailView.as_view(),
        name="adoption-request-detail",
    ),
]
