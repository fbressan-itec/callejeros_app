"""Rutas de la API de mascotas (`/api/pets/`)."""

from django.urls import path

from apps.pets.views import (
    MyPetListView,
    PetAdoptView,
    PetDetailView,
    PetListCreateView,
    PetPhotoCreateView,
    PetPhotoDeleteView,
)

app_name = "pets"

urlpatterns = [
    path("", PetListCreateView.as_view(), name="pet-list-create"),
    path("mine/", MyPetListView.as_view(), name="pet-mine"),
    path("<int:pet_id>/", PetDetailView.as_view(), name="pet-detail"),
    path("<int:pet_id>/adopt/", PetAdoptView.as_view(), name="pet-adopt"),
    path("<int:pet_id>/photos/", PetPhotoCreateView.as_view(), name="pet-photo-create"),
    path(
        "<int:pet_id>/photos/<int:photo_id>/",
        PetPhotoDeleteView.as_view(),
        name="pet-photo-delete",
    ),
]
