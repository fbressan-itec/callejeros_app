"""Vistas de API solo Admin para consultar usuarios y roles, cambiar roles y estado (BK-15b)."""

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.pagination import StandardPageNumberPagination
from apps.users.models import RoleCode
from apps.users.permissions import IsAdmin
from apps.users.serializers import (
    AdminRoleChangeSerializer,
    AdminUserSerializer,
    AdminUserStatusActionSerializer,
    PaginatedAdminUserSerializer,
    RoleSummarySerializer,
)
from apps.users.services import (
    change_user_role,
    deactivate_user,
    get_admin_roles_queryset,
    get_admin_user_or_404,
    get_admin_users_queryset,
    reactivate_user,
)

ADMIN_USERS_TAG = "Administración de usuarios"


class AdminRoleListView(APIView):
    """GET /api/admin/roles/ — Lista los 4 roles activos del catálogo (solo Admin)."""

    permission_classes = (IsAuthenticated, IsAdmin)

    @extend_schema(
        operation_id="admin_roles_list",
        tags=[ADMIN_USERS_TAG],
        summary="Listar catálogo de roles",
        description=(
            "Devuelve los 4 roles del sistema (`member`, `verified_shelter`, `staff`, `admin`) "
            "con su código y nombre de insignia para los selectores del panel de Admin. "
            "Permiso: solo Admin (`IsAdmin`)."
        ),
        responses={
            200: RoleSummarySerializer(many=True),
            401: OpenApiResponse(description="Sin token Bearer válido o cuenta inactiva."),
            403: OpenApiResponse(description="El usuario no tiene rol Admin."),
        },
    )
    def get(self, request: Request) -> Response:
        roles = get_admin_roles_queryset(actor=request.user)
        return Response(RoleSummarySerializer(roles, many=True).data, status=status.HTTP_200_OK)


class AdminUserListView(APIView):
    """GET /api/admin/users/ — Listado paginado de usuarios con filtros y búsqueda (solo Admin)."""

    permission_classes = (IsAuthenticated, IsAdmin)

    @extend_schema(
        operation_id="admin_users_list",
        tags=[ADMIN_USERS_TAG],
        summary="Listar usuarios para administración",
        description=(
            "Devuelve paginados de a 12 (`count`, `next`, `previous`, `results`) los usuarios "
            "del sistema (activos e inactivos), ordenados de más reciente a más antiguo. "
            "Permite filtrar por `role` y `is_active`, y buscar por correo, nombre o apellido "
            "con `search`. Nunca expone `address` ni `password`. "
            "Permiso: solo Admin (`IsAdmin`)."
        ),
        parameters=[
            OpenApiParameter(
                name="page",
                type=OpenApiTypes.INT,
                description="Número de página (12 resultados por página).",
            ),
            OpenApiParameter(
                name="role",
                type=OpenApiTypes.STR,
                enum=[choice for choice, _ in RoleCode.choices],
                description=(
                    "Filtra por código de rol (`member`, `verified_shelter`, `staff`, `admin`)."
                ),
            ),
            OpenApiParameter(
                name="is_active",
                type=OpenApiTypes.BOOL,
                description="Filtra por estado activo (`true` o `false`).",
            ),
            OpenApiParameter(
                name="search",
                type=OpenApiTypes.STR,
                description="Búsqueda por correo, nombre o apellido (sin distinguir mayúsculas).",
            ),
        ],
        responses={
            200: PaginatedAdminUserSerializer,
            400: OpenApiResponse(description="Filtro `role` o `is_active` inválido."),
            401: OpenApiResponse(description="Sin token Bearer válido o cuenta inactiva."),
            403: OpenApiResponse(description="El usuario no tiene rol Admin."),
        },
    )
    def get(self, request: Request) -> Response:
        queryset = get_admin_users_queryset(
            actor=request.user,
            role_code=request.query_params.get("role"),
            is_active=request.query_params.get("is_active"),
            search=request.query_params.get("search"),
        )
        paginator = StandardPageNumberPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = AdminUserSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class AdminUserDetailView(APIView):
    """GET /api/admin/users/{user_id}/ — Detalle de un usuario para administración (solo Admin)."""

    permission_classes = (IsAuthenticated, IsAdmin)

    @extend_schema(
        operation_id="admin_users_retrieve",
        tags=[ADMIN_USERS_TAG],
        summary="Consultar detalle de un usuario",
        description=(
            "Devuelve los datos de gestión de un usuario (activo o inactivo), su rol y estado. "
            "Nunca expone `address` ni `password`. Permiso: solo Admin (`IsAdmin`)."
        ),
        responses={
            200: AdminUserSerializer,
            401: OpenApiResponse(description="Sin token Bearer válido o cuenta inactiva."),
            403: OpenApiResponse(description="El usuario no tiene rol Admin."),
            404: OpenApiResponse(description="Usuario no encontrado."),
        },
    )
    def get(self, request: Request, user_id: int) -> Response:
        user = get_admin_user_or_404(user_id=user_id, actor=request.user)
        return Response(AdminUserSerializer(user).data, status=status.HTTP_200_OK)


class AdminUserRoleChangeView(APIView):
    """POST /api/admin/users/{user_id}/role/ — Cambia el rol de un usuario (solo Admin)."""

    permission_classes = (IsAuthenticated, IsAdmin)

    @extend_schema(
        operation_id="admin_users_change_role",
        tags=[ADMIN_USERS_TAG],
        summary="Cambiar rol de un usuario",
        description=(
            "Asigna un nuevo rol (`member`, `verified_shelter`, `staff` o `admin`) al usuario "
            "indicado y registra el cambio en `UserRoleLog` (si ya tenía ese rol, responde `200` "
            "sin duplicar el historial). Impide que un Admin se quite su propio rol o baje al "
            "último Admin activo del sistema. Permiso: solo Admin (`IsAdmin`)."
        ),
        request=AdminRoleChangeSerializer,
        responses={
            200: AdminUserSerializer,
            400: OpenApiResponse(
                description=(
                    "Rol inválido, nota demasiado larga o intento de auto-degradación / bajar al "
                    "último Admin activo."
                )
            ),
            401: OpenApiResponse(description="Sin token Bearer válido o cuenta inactiva."),
            403: OpenApiResponse(description="El usuario no tiene rol Admin."),
            404: OpenApiResponse(description="Usuario no encontrado."),
        },
    )
    def post(self, request: Request, user_id: int) -> Response:
        serializer = AdminRoleChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_user = get_admin_user_or_404(user_id=user_id, actor=request.user)
        updated = change_user_role(
            target_user=target_user,
            new_role_code=serializer.validated_data["role_code"],
            actor=request.user,
            note=serializer.validated_data.get("note", ""),
        )
        return Response(AdminUserSerializer(updated).data, status=status.HTTP_200_OK)


class AdminUserDeactivateView(APIView):
    """POST /api/admin/users/{user_id}/deactivate/ — Desactiva un usuario (solo Admin)."""

    permission_classes = (IsAuthenticated, IsAdmin)

    @extend_schema(
        operation_id="admin_users_deactivate",
        tags=[ADMIN_USERS_TAG],
        summary="Desactivar cuenta de usuario",
        description=(
            "Aplica baja lógica (`is_active=False`), registra `UserStatusLog` con motivo "
            "`admin_action` e invalida los tokens de refresco vigentes del usuario en "
            "`token_blacklist`. Si ya estaba inactivo, responde `200` sin duplicar historial. "
            "Impide auto-desactivarse y desactivar al último Admin activo. "
            "Permiso: solo Admin (`IsAdmin`)."
        ),
        request=AdminUserStatusActionSerializer,
        responses={
            200: AdminUserSerializer,
            400: OpenApiResponse(
                description=(
                    "Nota demasiado larga o intento de auto-desactivación / desactivar al último "
                    "Admin activo."
                )
            ),
            401: OpenApiResponse(description="Sin token Bearer válido o cuenta inactiva."),
            403: OpenApiResponse(description="El usuario no tiene rol Admin."),
            404: OpenApiResponse(description="Usuario no encontrado."),
        },
    )
    def post(self, request: Request, user_id: int) -> Response:
        serializer = AdminUserStatusActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_user = get_admin_user_or_404(user_id=user_id, actor=request.user)
        updated = deactivate_user(
            target_user=target_user,
            actor=request.user,
            note=serializer.validated_data.get("note", ""),
        )
        return Response(AdminUserSerializer(updated).data, status=status.HTTP_200_OK)


class AdminUserReactivateView(APIView):
    """POST /api/admin/users/{user_id}/reactivate/ — Reactiva un usuario (solo Admin)."""

    permission_classes = (IsAuthenticated, IsAdmin)

    @extend_schema(
        operation_id="admin_users_reactivate",
        tags=[ADMIN_USERS_TAG],
        summary="Reactivar cuenta de usuario",
        description=(
            "Reactiva una cuenta desactivada (`is_active=True`) y registra `UserStatusLog` con "
            "motivo `admin_action`. Si ya estaba activa, responde `200` sin duplicar historial. "
            "Permiso: solo Admin (`IsAdmin`)."
        ),
        request=AdminUserStatusActionSerializer,
        responses={
            200: AdminUserSerializer,
            400: OpenApiResponse(description="Nota demasiado larga."),
            401: OpenApiResponse(description="Sin token Bearer válido o cuenta inactiva."),
            403: OpenApiResponse(description="El usuario no tiene rol Admin."),
            404: OpenApiResponse(description="Usuario no encontrado."),
        },
    )
    def post(self, request: Request, user_id: int) -> Response:
        serializer = AdminUserStatusActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_user = get_admin_user_or_404(user_id=user_id, actor=request.user)
        updated = reactivate_user(
            target_user=target_user,
            actor=request.user,
            note=serializer.validated_data.get("note", ""),
        )
        return Response(AdminUserSerializer(updated).data, status=status.HTTP_200_OK)
