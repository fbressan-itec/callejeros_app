"""Vistas de API para publicar, editar, adoptar, dar de baja mascotas y gestionar fotos."""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
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

PETS_TAG = "Mascotas"


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

    @extend_schema(
        tags=[PETS_TAG],
        summary="Publicar una mascota en adopción",
        description=(
            "Crea una nueva publicación en estado `in_review` con `is_urgent_validated=False`, "
            "sus datos de salud (`PetHealth`), al menos una foto válida (JPG, PNG o WEBP de "
            "hasta 5 MB) y el registro inicial en `PetStatusLog`. "
            "Permiso: usuario autenticado (`IsAuthenticated`)."
        ),
        request={"multipart/form-data": PetCreateSerializer},
        responses={
            201: PetManageSerializer,
            400: OpenApiResponse(description="Datos inválidos, faltan fotos o archivo no válido."),
            401: OpenApiResponse(description="Sin token Bearer válido o cuenta inactiva."),
        },
    )
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

    @extend_schema(
        tags=[PETS_TAG],
        summary="Editar una publicación de mascota",
        description=(
            "Actualiza los campos editables y el bloque `health` sin permitir modificar "
            "`status`, `is_urgent_validated` ni `published_by`. Si el autor (no Staff/Admin) "
            "edita una mascota en estado `published`, vuelve automáticamente a `in_review` "
            "y se registra en `PetStatusLog`. "
            "Permiso: autor de la mascota, `staff` o `admin` (`IsPetOwnerOrStaffOrAdmin`)."
        ),
        request=PetUpdateSerializer,
        responses={
            200: PetManageSerializer,
            400: OpenApiResponse(description="Datos de edición inválidos."),
            401: OpenApiResponse(description="Sin token Bearer válido."),
            403: OpenApiResponse(description="No es autor de la mascota ni Staff/Admin."),
            404: OpenApiResponse(description="Mascota inexistente o dada de baja."),
        },
    )
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

    @extend_schema(
        tags=[PETS_TAG],
        summary="Dar de baja lógica una mascota",
        description=(
            "Marca la publicación como inactiva (`is_active=False`) sin borrar el registro "
            "físico de la base. "
            "Permiso: autor de la mascota, `staff` o `admin` (`IsPetOwnerOrStaffOrAdmin`)."
        ),
        responses={
            204: OpenApiResponse(description="Mascota dada de baja lógica."),
            401: OpenApiResponse(description="Sin token Bearer válido."),
            403: OpenApiResponse(description="No es autor de la mascota ni Staff/Admin."),
            404: OpenApiResponse(description="Mascota inexistente o ya dada de baja."),
        },
    )
    def delete(self, request: Request, pet_id: int) -> Response:
        pet = _get_active_pet_or_404(pet_id)
        self.check_object_permissions(request, pet)

        deactivate_pet(pet=pet, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PetAdoptView(APIView):
    """POST /api/pets/{id}/adopt/ — Marca una mascota publicada como adoptada."""

    permission_classes = (IsAuthenticated, IsPetOwnerOrStaffOrAdmin)

    @extend_schema(
        tags=[PETS_TAG],
        summary="Marcar una mascota como adoptada",
        description=(
            "Cambia el estado de `published` a `adopted` y registra la transición en "
            "`PetStatusLog`. Rechaza mascotas en `in_review`, `rejected` o ya `adopted`. "
            "Permiso: autor de la mascota, `staff` o `admin` (`IsPetOwnerOrStaffOrAdmin`)."
        ),
        request=PetAdoptSerializer,
        responses={
            200: PetManageSerializer,
            400: OpenApiResponse(description="La mascota no está en estado `published`."),
            401: OpenApiResponse(description="Sin token Bearer válido."),
            403: OpenApiResponse(description="No es autor de la mascota ni Staff/Admin."),
            404: OpenApiResponse(description="Mascota inexistente o dada de baja."),
        },
    )
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

    @extend_schema(
        tags=[PETS_TAG],
        summary="Agregar una foto al carrusel de la mascota",
        description=(
            "Sube una imagen válida (JPG, PNG o WEBP de hasta 5 MB) al final del carrusel "
            "activo. Si el autor (no Staff/Admin) agrega una foto a una mascota `published`, "
            "la publicación vuelve a `in_review` y se registra en `PetStatusLog`. "
            "Permiso: autor de la mascota, `staff` o `admin` (`IsPetOwnerOrStaffOrAdmin`)."
        ),
        request={"multipart/form-data": PetPhotoUploadSerializer},
        responses={
            201: PetPhotoSerializer,
            400: OpenApiResponse(description="Archivo faltante, formato inválido o mayor a 5 MB."),
            401: OpenApiResponse(description="Sin token Bearer válido."),
            403: OpenApiResponse(description="No es autor de la mascota ni Staff/Admin."),
            404: OpenApiResponse(description="Mascota inexistente o dada de baja."),
        },
    )
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

    @extend_schema(
        tags=[PETS_TAG],
        summary="Dar de baja lógica una foto del carrusel",
        description=(
            "Marca la foto como inactiva (`is_active=False`) y reordena las posiciones "
            "activas restantes desde `0`. Impide dejar a la mascota sin fotos activas. "
            "Si el autor (no Staff/Admin) borra una foto de una mascota `published`, "
            "la publicación vuelve a `in_review` y se registra en `PetStatusLog`. "
            "Permiso: autor de la mascota, `staff` o `admin` (`IsPetOwnerOrStaffOrAdmin`)."
        ),
        responses={
            204: OpenApiResponse(description="Foto dada de baja lógica."),
            400: OpenApiResponse(description="Es la última foto activa de la mascota."),
            401: OpenApiResponse(description="Sin token Bearer válido."),
            403: OpenApiResponse(description="No es autor de la mascota ni Staff/Admin."),
            404: OpenApiResponse(description="Mascota o foto inexistente o dada de baja."),
        },
    )
    def delete(self, request: Request, pet_id: int, photo_id: int) -> Response:
        pet = _get_active_pet_or_404(pet_id)
        self.check_object_permissions(request, pet)

        photo = get_object_or_404(PetPhoto.objects.active(), pk=photo_id, pet=pet)
        remove_pet_photo(pet=pet, photo=photo, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
