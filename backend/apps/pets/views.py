"""Vistas de API para publicar, editar, adoptar, revisar, dar de baja mascotas y gestionar fotos."""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.pagination import StandardPageNumberPagination
from apps.pets.filters import PetCatalogFilter
from apps.pets.models import Pet, PetPhoto
from apps.pets.permissions import IsPetOwnerOrStaffOrAdmin, can_manage_pet
from apps.pets.serializers import (
    PaginatedPetManageSerializer,
    PaginatedPetPublicSerializer,
    PetAdoptSerializer,
    PetCreateSerializer,
    PetManageSerializer,
    PetPhotoSerializer,
    PetPhotoUploadSerializer,
    PetPublicSerializer,
    PetReviewSerializer,
    PetUpdateSerializer,
    PetUrgencySerializer,
)
from apps.pets.services import (
    AgeGroup,
    add_pet_photo,
    adopt_pet,
    approve_pet,
    create_pet,
    deactivate_pet,
    get_catalog_pets_queryset,
    get_my_pets_queryset,
    get_review_queue_queryset,
    get_visible_pet_or_404,
    reject_pet,
    remove_pet_photo,
    set_pet_urgency,
    update_pet,
)
from apps.users.permissions import IsStaffOrAdmin

PETS_TAG = "Mascotas"


def _get_active_pet_or_404(pet_id: int) -> Pet:
    """Obtiene una mascota activa precargando autor, rol y salud o devuelve 404."""
    return get_object_or_404(
        Pet.objects.active().select_related("published_by__role", "health"),
        pk=pet_id,
    )


class PetListCreateView(APIView):
    """GET/POST /api/pets/ — Catálogo público con filtros y alta de mascotas."""

    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    @extend_schema(
        operation_id="pets_list",
        tags=[PETS_TAG],
        summary="Explorar catálogo público de mascotas",
        description=(
            "Devuelve paginado de a 12 (`count`, `next`, `previous`, `results`) las mascotas "
            "activas en estado `published` por defecto, con `is_urgent` calculado (validado "
            "por Staff y no adoptada) y sin exponer `contact_phone` ni campos internos de "
            "revisión. Con `adopted=true` devuelve únicamente mascotas en estado `adopted` "
            "(nunca se mezclan disponibles con adoptadas). "
            "Permiso: público (`AllowAny`)."
        ),
        parameters=[
            OpenApiParameter(
                name="page",
                type=OpenApiTypes.INT,
                description="Número de página (12 resultados por página).",
            ),
            OpenApiParameter(
                name="species",
                type=OpenApiTypes.STR,
                enum=[choice for choice, _ in Pet.Species.choices],
                description="Filtra por especie (`dog` o `cat`).",
            ),
            OpenApiParameter(
                name="sex",
                type=OpenApiTypes.STR,
                enum=[choice for choice, _ in Pet.Sex.choices],
                description="Filtra por sexo (`male` o `female`).",
            ),
            OpenApiParameter(
                name="age_group",
                type=OpenApiTypes.STR,
                enum=[group.value for group in AgeGroup],
                description="Filtra por grupo de edad (`cachorro`, `adulto` o `senior`).",
            ),
            OpenApiParameter(
                name="is_sociable",
                type=OpenApiTypes.BOOL,
                description="Filtra por sociabilidad (`true` o `false`).",
            ),
            OpenApiParameter(
                name="good_with_children",
                type=OpenApiTypes.STR,
                enum=[choice for choice, _ in Pet.Compatibility.choices],
                description="Filtra por convivencia con niños (`yes`, `no`, `not_evaluated`).",
            ),
            OpenApiParameter(
                name="good_with_animals",
                type=OpenApiTypes.STR,
                enum=[choice for choice, _ in Pet.Compatibility.choices],
                description=(
                    "Filtra por convivencia con otros animales (`yes`, `no`, `not_evaluated`)."
                ),
            ),
            OpenApiParameter(
                name="is_neutered",
                type=OpenApiTypes.BOOL,
                description="Filtra por castración (`true` o `false`).",
            ),
            OpenApiParameter(
                name="urgent",
                type=OpenApiTypes.BOOL,
                description="Con `true`, devuelve solo casos urgentes validados (no adoptados).",
            ),
            OpenApiParameter(
                name="adopted",
                type=OpenApiTypes.BOOL,
                description="Con `true`, devuelve solo mascotas adoptadas en lugar de disponibles.",
            ),
            OpenApiParameter(
                name="search",
                type=OpenApiTypes.STR,
                description="Busca mascotas por nombre (insensible a mayúsculas).",
            ),
        ],
        responses={
            200: PaginatedPetPublicSerializer,
            400: OpenApiResponse(description="Parámetro de filtro o página inválido."),
        },
    )
    def get(self, request: Request) -> Response:
        filterset = PetCatalogFilter(
            request.query_params,
            queryset=get_catalog_pets_queryset(),
        )
        if not filterset.is_valid():
            raise ValidationError(filterset.errors)

        paginator = StandardPageNumberPagination()
        page = paginator.paginate_queryset(filterset.qs, request, view=self)
        serializer = PetPublicSerializer(
            page,
            many=True,
            context={"request": request},
        )
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(
        tags=[PETS_TAG],
        summary="Publicar una mascota en adopción",
        description=(
            "Crea una nueva publicación con sus datos de salud (`PetHealth`), al menos una foto "
            "válida (JPG, PNG o WEBP de hasta 5 MB) y el registro inicial en `PetStatusLog`. "
            "Si la carga Miembro, Refugio verificado o Staff, nace en `in_review` con "
            "`is_urgent_validated=False`; si la carga un `admin`, nace en `published` y, si "
            "pidió urgente, con la urgencia ya validada. "
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


class MyPetListView(APIView):
    """GET /api/pets/mine/ — Lista paginada de mascotas activas del usuario autenticado."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(
        operation_id="pets_mine_list",
        tags=[PETS_TAG],
        summary="Listar mis publicaciones de mascotas",
        description=(
            "Devuelve paginadas de a 12 (`count`, `next`, `previous`, `results`) todas las "
            "mascotas activas publicadas por el usuario autenticado en cualquier estado "
            "(`in_review`, `published`, `rejected` o `adopted`), incluyendo `contact_phone` "
            "y flags de urgencia para gestión/edición. "
            "Permiso: usuario autenticado (`IsAuthenticated`)."
        ),
        parameters=[
            OpenApiParameter(
                name="page",
                type=OpenApiTypes.INT,
                description="Número de página (12 resultados por página).",
            ),
            OpenApiParameter(
                name="status",
                type=OpenApiTypes.STR,
                enum=[choice for choice, _ in Pet.Status.choices],
                description="Opcional: filtra las publicaciones propias por estado.",
            ),
        ],
        responses={
            200: PaginatedPetManageSerializer,
            400: OpenApiResponse(description="Estado de filtro inválido."),
            401: OpenApiResponse(description="Sin token Bearer válido o cuenta inactiva."),
        },
    )
    def get(self, request: Request) -> Response:
        status_filter = request.query_params.get("status")
        pets = get_my_pets_queryset(actor=request.user, status_filter=status_filter)
        paginator = StandardPageNumberPagination()
        page = paginator.paginate_queryset(pets, request, view=self)
        serializer = PetManageSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)


class PetDetailView(APIView):
    """GET/PATCH/DELETE /api/pets/{id}/ — Ficha de mascota, edición o baja lógica."""

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated(), IsPetOwnerOrStaffOrAdmin()]

    @extend_schema(
        tags=[PETS_TAG],
        summary="Consultar ficha completa de una mascota",
        description=(
            "Devuelve la ficha completa. Para el público devuelve `is_urgent` calculado y "
            "nunca expone `contact_phone` ni los flags internos `is_urgent_requested` / "
            "`is_urgent_validated`. Cuando consulta el autor, `staff` o `admin`, incluye "
            "además `contact_phone` y esos flags internos para gestión/edición. "
            "Es pública para `published` y `adopted`; para `in_review` y `rejected`, solo "
            "es visible para autor, `staff` o `admin` (`404` para terceros)."
        ),
        responses={
            200: PetPublicSerializer,
            404: OpenApiResponse(description="Mascota inexistente, inactiva o no visible."),
        },
    )
    def get(self, request: Request, pet_id: int) -> Response:
        pet = get_visible_pet_or_404(pet_id=pet_id, actor=request.user)
        serializer_cls = (
            PetManageSerializer if can_manage_pet(request.user, pet) else PetPublicSerializer
        )
        return Response(
            serializer_cls(pet, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

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
            400: OpenApiResponse(
                description="Datos de edición inválidos o mascota rechazada (no se edita)."
            ),
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
            400: OpenApiResponse(
                description=(
                    "Archivo faltante, formato inválido, mayor a 5 MB o mascota rechazada."
                )
            ),
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
            400: OpenApiResponse(
                description="Es la última foto activa o la mascota está rechazada."
            ),
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


_REVIEW_ERROR_RESPONSES = {
    400: OpenApiResponse(
        description=(
            "La mascota no está en `in_review` (ya fue revisada, está adoptada o rechazada) "
            "o el motivo supera los 255 caracteres."
        )
    ),
    401: OpenApiResponse(description="Sin token Bearer válido."),
    403: OpenApiResponse(description="El usuario no tiene rol `staff` ni `admin`."),
    404: OpenApiResponse(description="Mascota inexistente o dada de baja."),
}


class _PetReviewBaseView(APIView):
    """Base de las acciones de revisión: mismo permiso, validación y respuesta (BK-06a)."""

    permission_classes = (IsAuthenticated, IsStaffOrAdmin)

    def _review(self, request: Request, pet_id: int, review_service) -> Response:
        pet = _get_active_pet_or_404(pet_id)

        serializer = PetReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        pet = review_service(
            pet=pet,
            actor=request.user,
            note=serializer.validated_data["note"],
        )
        pet = _get_active_pet_or_404(pet.id)
        return Response(
            PetManageSerializer(pet, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class PetApproveView(_PetReviewBaseView):
    """POST /api/pets/{id}/approve/ — Staff o Admin aprueba una mascota en revisión."""

    @extend_schema(
        tags=[PETS_TAG],
        summary="Aprobar una publicación de mascota",
        description=(
            "Cambia el estado de `in_review` a `published` (la mascota aparece en el catálogo) "
            "y registra la transición en `PetStatusLog` con quién aprobó y el motivo. "
            '`note` es opcional: si llega vacío se guarda "Publicación aprobada por Staff.". '
            "Permiso: `staff` o `admin` (`IsStaffOrAdmin`)."
        ),
        request=PetReviewSerializer,
        responses={200: PetManageSerializer, **_REVIEW_ERROR_RESPONSES},
    )
    def post(self, request: Request, pet_id: int) -> Response:
        return self._review(request, pet_id, approve_pet)


class PetRejectView(_PetReviewBaseView):
    """POST /api/pets/{id}/reject/ — Staff o Admin rechaza una mascota en revisión."""

    @extend_schema(
        tags=[PETS_TAG],
        summary="Rechazar una publicación de mascota",
        description=(
            "Cambia el estado de `in_review` a `rejected` y registra en `PetStatusLog` quién "
            "rechazó y el motivo. Si `note` llega vacío se guarda el motivo genérico "
            '"Tu publicación no fue aprobada porque no cumple con las pautas de Callejeros '
            'Río Cuarto.". Una mascota rechazada es final: para volver a intentar, el autor '
            "la carga de nuevo. "
            "Permiso: `staff` o `admin` (`IsStaffOrAdmin`)."
        ),
        request=PetReviewSerializer,
        responses={200: PetManageSerializer, **_REVIEW_ERROR_RESPONSES},
    )
    def post(self, request: Request, pet_id: int) -> Response:
        return self._review(request, pet_id, reject_pet)


class PetUrgencyView(APIView):
    """POST /api/pets/{id}/urgency/ — Staff o Admin valida o no el caso urgente (BK-06b)."""

    permission_classes = (IsAuthenticated, IsStaffOrAdmin)

    @extend_schema(
        tags=[PETS_TAG],
        summary="Validar o no el caso urgente de una mascota",
        description=(
            'Con `validated=true` valida el "caso urgente" que pidió quien publicó '
            "(`is_urgent_requested`); con `validated=false` le quita la validación. La "
            "insignia y el filtro `urgent` del catálogo muestran solo urgencias pedidas, "
            "validadas y no adoptadas. Se puede usar en mascotas `in_review` o `published`. "
            "Cada cambio queda en `PetStatusLog` (mismo estado antes y después, con nota); "
            "pedir el valor que ya tiene responde `200` sin cambios ni registro. "
            "Permiso: `staff` o `admin` (`IsStaffOrAdmin`)."
        ),
        request=PetUrgencySerializer,
        responses={
            200: PetManageSerializer,
            400: OpenApiResponse(
                description=(
                    "Falta `validated`, la mascota no está `in_review` ni `published` o "
                    "se quiere validar una urgencia que quien publicó no pidió."
                )
            ),
            401: OpenApiResponse(description="Sin token Bearer válido."),
            403: OpenApiResponse(description="El usuario no tiene rol `staff` ni `admin`."),
            404: OpenApiResponse(description="Mascota inexistente o dada de baja."),
        },
    )
    def post(self, request: Request, pet_id: int) -> Response:
        pet = _get_active_pet_or_404(pet_id)

        serializer = PetUrgencySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        pet = set_pet_urgency(
            pet=pet,
            actor=request.user,
            validated=serializer.validated_data["validated"],
        )
        pet = _get_active_pet_or_404(pet.id)
        return Response(
            PetManageSerializer(pet, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class PetReviewQueueView(APIView):
    """GET /api/pets/review-queue/ — Cola de revisión del panel de Staff (BK-06c)."""

    permission_classes = (IsAuthenticated, IsStaffOrAdmin)

    @extend_schema(
        operation_id="pets_review_queue_list",
        tags=[PETS_TAG],
        summary="Listar la cola de revisión del panel de Staff",
        description=(
            "Devuelve paginadas de a 12 (`count`, `next`, `previous`, `results`) las mascotas "
            "activas en estado `in_review`, con la ficha de gestión (autor con su rol, "
            "`contact_phone`, `is_urgent_requested`, `is_urgent_validated`, fotos y salud). "
            "Orden: primero las que pidieron caso urgente y, dentro de cada grupo, de la más "
            "vieja a la más nueva. Desde acá Staff usa `/approve/`, `/reject/` y `/urgency/`. "
            "Permiso: `staff` o `admin` (`IsStaffOrAdmin`)."
        ),
        parameters=[
            OpenApiParameter(
                name="page",
                type=OpenApiTypes.INT,
                description="Número de página (12 resultados por página).",
            ),
        ],
        responses={
            200: PaginatedPetManageSerializer,
            401: OpenApiResponse(description="Sin token Bearer válido."),
            403: OpenApiResponse(description="El usuario no tiene rol `staff` ni `admin`."),
            404: OpenApiResponse(description="Número de página inexistente."),
        },
    )
    def get(self, request: Request) -> Response:
        pets = get_review_queue_queryset(actor=request.user)
        paginator = StandardPageNumberPagination()
        page = paginator.paginate_queryset(pets, request, view=self)
        serializer = PetManageSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)
