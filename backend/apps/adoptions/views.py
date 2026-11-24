"""Vistas de API para postularse a adoptar y consultar solicitudes (BK-07a)."""

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.adoptions.models import AdoptionRequest
from apps.adoptions.serializers import (
    AdoptionRequestApproveSerializer,
    AdoptionRequestCreateSerializer,
    AdoptionRequestRejectSerializer,
    AdoptionRequestSerializer,
    PaginatedAdoptionRequestSerializer,
)
from apps.adoptions.services import (
    approve_adoption_request,
    create_adoption_request,
    get_active_adoption_request_or_404,
    get_adoption_review_queue_queryset,
    get_my_adoption_requests_queryset,
    get_visible_adoption_request_or_404,
    reject_adoption_request,
)
from apps.core.pagination import StandardPageNumberPagination
from apps.users.permissions import IsStaffOrAdmin

ADOPTIONS_TAG = "Solicitudes de adopción"


class AdoptionRequestCreateView(APIView):
    """POST /api/adoption-requests/ — Envía una solicitud de adopción para una mascota publicada."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(
        operation_id="adoption_requests_create",
        tags=[ADOPTIONS_TAG],
        summary="Enviar solicitud de adopción",
        description=(
            "Recibe el cuestionario de 4 bloques para una mascota activa en estado "
            "`published`: (1) datos personales con edad mínima 18; (2) hogar y entorno, con "
            "`housing_type` en texto libre, `home_ownership` y `rental_allows_pets` "
            "(obligatorio solo si la vivienda es `rented`); (3) experiencia y rutina, con "
            "`adoption_reason` opcional; y (4) compromiso: `accepts_commitment`, "
            "`accepts_follow_up`, `accepts_return_notice` y `declares_truthful` en `true`, y "
            "`accepts_neutering` en `true` solo si la mascota no está castrada (si ya lo está, "
            "se guarda `null`). Las respuestas abiertas admiten hasta 500 caracteres y "
            "`adoption_reason` hasta 1000. Guarda los datos declarados por el "
            "solicitante y crea la solicitud en estado `pending`. Rechaza postularse a una "
            "mascota publicada por el mismo usuario e impide enviar una segunda solicitud "
            "`pending` para la misma mascota. "
            "Permiso: usuario autenticado (`IsAuthenticated`)."
        ),
        request=AdoptionRequestCreateSerializer,
        responses={
            201: AdoptionRequestSerializer,
            400: OpenApiResponse(
                description=(
                    "Cuestionario incompleto o inválido, mascota no disponible, auto-postulación "
                    "o solicitud pendiente duplicada."
                ),
            ),
            401: OpenApiResponse(description="Sin token Bearer válido o cuenta inactiva."),
        },
    )
    def post(self, request: Request) -> Response:
        serializer = AdoptionRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated = dict(serializer.validated_data)
        pet_id = validated.pop("pet")
        adoption_request = create_adoption_request(
            applicant=request.user,
            pet_id=pet_id,
            data=validated,
        )
        return Response(
            AdoptionRequestSerializer(adoption_request, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class MyAdoptionRequestListView(APIView):
    """GET /api/adoption-requests/mine/ — Lista paginada de solicitudes del usuario autenticado."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(
        operation_id="adoption_requests_mine_list",
        tags=[ADOPTIONS_TAG],
        summary="Listar mis solicitudes de adopción",
        description=(
            "Devuelve paginadas de a 12 (`count`, `next`, `previous`, `results`) todas las "
            "solicitudes de adopción activas enviadas por el usuario autenticado, ordenadas de "
            "la más reciente a la más antigua. Permite filtrar opcionalmente por `status`. "
            "En las aprobadas incluye `foster_contact` (nombre, rol y teléfono del hogar de "
            "tránsito) y `meeting_point`, nunca la dirección. "
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
                enum=[choice for choice, _ in AdoptionRequest.Status.choices],
                description="Opcional: filtra mis solicitudes por estado.",
            ),
        ],
        responses={
            200: PaginatedAdoptionRequestSerializer,
            400: OpenApiResponse(description="Estado de filtro inválido."),
            401: OpenApiResponse(description="Sin token Bearer válido o cuenta inactiva."),
        },
    )
    def get(self, request: Request) -> Response:
        status_filter = request.query_params.get("status")
        queryset = get_my_adoption_requests_queryset(
            actor=request.user,
            status_filter=status_filter,
        )
        paginator = StandardPageNumberPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = AdoptionRequestSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)


class AdoptionRequestDetailView(APIView):
    """GET /api/adoption-requests/{request_id}/ — Ficha y respuesta de una solicitud."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(
        operation_id="adoption_requests_retrieve",
        tags=[ADOPTIONS_TAG],
        summary="Consultar detalle y respuesta de una solicitud de adopción",
        description=(
            "Devuelve los datos del cuestionario y el estado actual de la solicitud. Cuando "
            "está `approved`, incluye `foster_contact` (nombre, rol y teléfono de contacto de "
            "la publicación) y `meeting_point`, sin exponer nunca la dirección del hogar de "
            "tránsito. Cuando está `rejected`, incluye `rejection_reason`. "
            "Solo es visible para el solicitante, `staff` o `admin` (`404` para terceros, sin "
            "revelar si existe)."
        ),
        responses={
            200: AdoptionRequestSerializer,
            401: OpenApiResponse(description="Sin token Bearer válido o cuenta inactiva."),
            404: OpenApiResponse(
                description="Solicitud inexistente, dada de baja o no visible para el usuario."
            ),
        },
    )
    def get(self, request: Request, request_id: int) -> Response:
        adoption_request = get_visible_adoption_request_or_404(
            request_id=request_id,
            actor=request.user,
        )
        return Response(
            AdoptionRequestSerializer(adoption_request, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


_ADOPTION_REVIEW_ERROR_RESPONSES = {
    400: OpenApiResponse(
        description=(
            "La solicitud no está en estado `pending`, la mascota ya no está disponible "
            "(al aprobar) o faltan/superan el límite los datos de respuesta (`meeting_point` "
            "o `rejection_reason`)."
        ),
    ),
    401: OpenApiResponse(description="Sin token Bearer válido o cuenta inactiva."),
    403: OpenApiResponse(description="El usuario no tiene rol `staff` ni `admin`."),
    404: OpenApiResponse(description="Solicitud inexistente o dada de baja."),
}


class AdoptionRequestReviewQueueView(APIView):
    """GET /api/adoption-requests/review-queue/ — Cola de solicitudes del panel de Staff."""

    permission_classes = (IsAuthenticated, IsStaffOrAdmin)

    @extend_schema(
        operation_id="adoption_requests_review_queue",
        tags=[ADOPTIONS_TAG],
        summary="Listar cola de revisión de solicitudes de adopción (panel de Staff)",
        description=(
            "Devuelve paginadas de a 12 (`count`, `next`, `previous`, `results`) las "
            "solicitudes activas en estado `pending`, ordenadas de la más vieja a la más nueva "
            "(`created_at` ascendente). "
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
            200: PaginatedAdoptionRequestSerializer,
            401: OpenApiResponse(description="Sin token Bearer válido o cuenta inactiva."),
            403: OpenApiResponse(description="El usuario no tiene rol `staff` ni `admin`."),
        },
    )
    def get(self, request: Request) -> Response:
        queryset = get_adoption_review_queue_queryset()
        paginator = StandardPageNumberPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = AdoptionRequestSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)


class AdoptionRequestApproveView(APIView):
    """POST /api/adoption-requests/{request_id}/approve/ — Staff o Admin aprueba una solicitud."""

    permission_classes = (IsAuthenticated, IsStaffOrAdmin)

    @extend_schema(
        operation_id="adoption_requests_approve",
        tags=[ADOPTIONS_TAG],
        summary="Aprobar una solicitud de adopción",
        description=(
            "Cambia el estado de `pending` a `approved` siempre que la mascota siga activa y "
            "`published`, guarda el `meeting_point` (punto de encuentro público obligatorio), "
            "`reviewed_by` y `reviewed_at`, y devuelve la solicitud aprobada con "
            "`foster_contact` (nombre, rol y teléfono de contacto de la publicación) y "
            "`meeting_point`, sin exponer nunca la dirección del hogar de tránsito. "
            "Permiso: `staff` o `admin` (`IsStaffOrAdmin`)."
        ),
        request=AdoptionRequestApproveSerializer,
        responses={200: AdoptionRequestSerializer, **_ADOPTION_REVIEW_ERROR_RESPONSES},
    )
    def post(self, request: Request, request_id: int) -> Response:
        adoption_request = get_active_adoption_request_or_404(request_id)
        serializer = AdoptionRequestApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reviewed = approve_adoption_request(
            adoption_request=adoption_request,
            actor=request.user,
            meeting_point=serializer.validated_data["meeting_point"],
        )
        return Response(
            AdoptionRequestSerializer(reviewed, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class AdoptionRequestRejectView(APIView):
    """POST /api/adoption-requests/{request_id}/reject/ — Staff o Admin desaprueba una solicitud."""

    permission_classes = (IsAuthenticated, IsStaffOrAdmin)

    @extend_schema(
        operation_id="adoption_requests_reject",
        tags=[ADOPTIONS_TAG],
        summary="Desaprobar una solicitud de adopción",
        description=(
            "Cambia el estado de `pending` a `rejected` (permitido incluso si la mascota ya "
            "fue adoptada o dada de baja, para no dejar solicitudes colgadas en la cola), "
            "guarda el `rejection_reason` (motivo obligatorio para el solicitante), "
            "`reviewed_by` y `reviewed_at`, y mantiene `foster_contact` en `null`. "
            "Permiso: `staff` o `admin` (`IsStaffOrAdmin`)."
        ),
        request=AdoptionRequestRejectSerializer,
        responses={200: AdoptionRequestSerializer, **_ADOPTION_REVIEW_ERROR_RESPONSES},
    )
    def post(self, request: Request, request_id: int) -> Response:
        adoption_request = get_active_adoption_request_or_404(request_id)
        serializer = AdoptionRequestRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reviewed = reject_adoption_request(
            adoption_request=adoption_request,
            actor=request.user,
            rejection_reason=serializer.validated_data["rejection_reason"],
        )
        return Response(
            AdoptionRequestSerializer(reviewed, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )
