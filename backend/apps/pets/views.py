"""Vistas de API para publicar, editar, adoptar, dar de baja mascotas y gestionar fotos."""

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.pets.models import Pet, PetPhoto
from apps.pets.permissions import IsPetOwnerOrStaffOrAdmin
from apps.pets.serializers import (
    PetAdoptSerializer,
    PetCreateSerializer,
    PetManageSerializer,
    PetPhotoSerializer,
    PetPhotoUploadSerializer,
    PetUpdateSerializer,
)
from apps.pets.services import (
    add_pet_photo,
    adopt_pet,
    create_pet,
    deactivate_pet,
    remove_pet_photo,
    update_pet,
)


def _get_active_pet_or_404(pet_id: int) -> Pet:
    """Obtiene una mascota activa precargando autor, rol y salud o devuelve 404."""
    return get_object_or_404(
        Pet.objects.active().select_related("published_by__role", "health"),
        pk=pet_id,
    )


class PetCreateView(APIView):
    """POST /api/pets/ — Publica una mascota en revisión con sus fotos y salud."""

    permission_classes = (IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def post(self, request: Request) -> Response:
        serializer = PetCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated = dict(serializer.validated_data)
        photos = validated.pop("photos")
        health_data = validated.pop("health", None)

        pet = create_pet(
            actor=request.user,
            data=validated,
            photos=photos,
            health_data=health_data,
        )
        pet = _get_active_pet_or_404(pet.id)
        return Response(
            PetManageSerializer(pet, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class PetDetailView(APIView):
    """PATCH/DELETE /api/pets/{id}/ — Edita o da de baja lógica una mascota."""

    permission_classes = (IsAuthenticated, IsPetOwnerOrStaffOrAdmin)

    def patch(self, request: Request, pet_id: int) -> Response:
        pet = _get_active_pet_or_404(pet_id)
        self.check_object_permissions(request, pet)

        serializer = PetUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        validated = dict(serializer.validated_data)
        health_data = validated.pop("health", None)

        pet = update_pet(
            pet=pet,
            actor=request.user,
            data=validated,
            health_data=health_data,
        )
        pet = _get_active_pet_or_404(pet.id)
        return Response(
            PetManageSerializer(pet, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    def delete(self, request: Request, pet_id: int) -> Response:
        pet = _get_active_pet_or_404(pet_id)
        self.check_object_permissions(request, pet)

        deactivate_pet(pet=pet, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PetAdoptView(APIView):
    """POST /api/pets/{id}/adopt/ — Marca una mascota publicada como adoptada."""

    permission_classes = (IsAuthenticated, IsPetOwnerOrStaffOrAdmin)

    def post(self, request: Request, pet_id: int) -> Response:
        pet = _get_active_pet_or_404(pet_id)
        self.check_object_permissions(request, pet)

        serializer = PetAdoptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        pet = adopt_pet(
            pet=pet,
            actor=request.user,
            note=serializer.validated_data["note"],
        )
        pet = _get_active_pet_or_404(pet.id)
        return Response(
            PetManageSerializer(pet, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class PetPhotoCreateView(APIView):
    """POST /api/pets/{id}/photos/ — Agrega una foto validada al carrusel de la mascota."""

    permission_classes = (IsAuthenticated, IsPetOwnerOrStaffOrAdmin)
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request: Request, pet_id: int) -> Response:
        pet = _get_active_pet_or_404(pet_id)
        self.check_object_permissions(request, pet)

        serializer = PetPhotoUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        photo = add_pet_photo(
            pet=pet,
            actor=request.user,
            image=serializer.validated_data["image"],
        )
        return Response(
            PetPhotoSerializer(photo, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class PetPhotoDeleteView(APIView):
    """DELETE /api/pets/{id}/photos/{photo_id}/ — Da de baja lógica una foto del carrusel."""

    permission_classes = (IsAuthenticated, IsPetOwnerOrStaffOrAdmin)

    def delete(self, request: Request, pet_id: int, photo_id: int) -> Response:
        pet = _get_active_pet_or_404(pet_id)
        self.check_object_permissions(request, pet)

        photo = get_object_or_404(PetPhoto.objects.active(), pk=photo_id, pet=pet)
        remove_pet_photo(pet=pet, photo=photo, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
