"""Rutas de la API de solicitudes de adopción (`/api/adoption-requests/`)."""

from django.urls import path

from apps.adoptions.views import (
    AdoptionRequestApproveView,
    AdoptionRequestCreateView,
    AdoptionRequestDetailView,
    AdoptionRequestRejectView,
    AdoptionRequestReviewQueueView,
    MyAdoptionRequestListView,
)

app_name = "adoptions"

urlpatterns = [
    path("", AdoptionRequestCreateView.as_view(), name="adoption-request-create"),
    path("mine/", MyAdoptionRequestListView.as_view(), name="adoption-request-mine"),
    path(
        "review-queue/",
        AdoptionRequestReviewQueueView.as_view(),
        name="adoption-request-review-queue",
    ),
    path(
        "<int:request_id>/",
        AdoptionRequestDetailView.as_view(),
        name="adoption-request-detail",
    ),
    path(
        "<int:request_id>/approve/",
        AdoptionRequestApproveView.as_view(),
        name="adoption-request-approve",
    ),
    path(
        "<int:request_id>/reject/",
        AdoptionRequestRejectView.as_view(),
        name="adoption-request-reject",
    ),
]
