"""Rutas de la API de mascotas (`/api/pets/`)."""

from django.urls import path

from apps.pets.views import (
    FavoritePetListView,
    MyPetListView,
    PetAdoptView,
    PetApproveView,
    PetDetailView,
    PetFavoriteView,
    PetListCreateView,
    PetPhotoCreateView,
    PetPhotoDeleteView,
    PetRejectView,
    PetReviewQueueView,
    PetUrgencyView,
)

app_name = "pets"

urlpatterns = [
    path("", PetListCreateView.as_view(), name="pet-list-create"),
    path("mine/", MyPetListView.as_view(), name="pet-mine"),
    path("favorites/", FavoritePetListView.as_view(), name="pet-favorites"),
    path("review-queue/", PetReviewQueueView.as_view(), name="pet-review-queue"),
    path("<int:pet_id>/", PetDetailView.as_view(), name="pet-detail"),
    path("<int:pet_id>/favorite/", PetFavoriteView.as_view(), name="pet-favorite"),
    path("<int:pet_id>/adopt/", PetAdoptView.as_view(), name="pet-adopt"),
    path("<int:pet_id>/approve/", PetApproveView.as_view(), name="pet-approve"),
    path("<int:pet_id>/reject/", PetRejectView.as_view(), name="pet-reject"),
    path("<int:pet_id>/urgency/", PetUrgencyView.as_view(), name="pet-urgency"),
    path("<int:pet_id>/photos/", PetPhotoCreateView.as_view(), name="pet-photo-create"),
    path(
        "<int:pet_id>/photos/<int:photo_id>/",
        PetPhotoDeleteView.as_view(),
        name="pet-photo-delete",
    ),
]
