"""Vistas de API para el centro de notificaciones (BK-08a)."""

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.pagination import StandardPageNumberPagination
from apps.notifications.models import Notification
from apps.notifications.serializers import (
    MarkAllNotificationsReadResponseSerializer,
    NotificationSerializer,
    PaginatedNotificationSerializer,
    UnreadNotificationsCountSerializer,
)
from apps.notifications.services import (
    get_unread_notifications_count,
    get_user_notifications_queryset,
    mark_all_notifications_as_read,
    mark_notification_as_read,
)

NOTIFICATIONS_TAG = "Notificaciones"


class NotificationListView(APIView):
    """GET /api/notifications/ — Lista paginada de notificaciones del usuario autenticado."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(
        operation_id="notifications_list",
        tags=[NOTIFICATIONS_TAG],
        summary="Listar mis notificaciones",
        description=(
            "Devuelve paginadas de a 12 (`count`, `next`, `previous`, `results`) las "
            "notificaciones activas del usuario autenticado, ordenadas de la más reciente a "
            "la más antigua. Permite filtrar opcionalmente por estado de lectura "
            "(`?is_read=true|false`) y etiqueta (`?tag=`). "
            "Permiso: usuario autenticado (`IsAuthenticated`)."
        ),
        parameters=[
            OpenApiParameter(
                name="page",
                type=OpenApiTypes.INT,
                description="Número de página (12 resultados por página).",
            ),
            OpenApiParameter(
                name="is_read",
                type=OpenApiTypes.BOOL,
                description="Opcional: filtra por leídas (`true`) o no leídas (`false`).",
            ),
            OpenApiParameter(
                name="tag",
                type=OpenApiTypes.STR,
                enum=[choice for choice, _ in Notification.Tag.choices],
                description="Opcional: filtra por etiqueta de notificación.",
            ),
        ],
        responses={
            200: PaginatedNotificationSerializer,
            400: OpenApiResponse(description="Parámetro de filtro inválido (`is_read` o `tag`)."),
            401: OpenApiResponse(description="Sin token Bearer válido o cuenta inactiva."),
        },
    )
    def get(self, request: Request) -> Response:
        queryset = get_user_notifications_queryset(
            actor=request.user,
            is_read_filter=request.query_params.get("is_read"),
            tag_filter=request.query_params.get("tag"),
        )
        paginator = StandardPageNumberPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = NotificationSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class UnreadNotificationsCountView(APIView):
    """GET /api/notifications/unread-count/ — Cantidad de notificaciones sin leer."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(
        operation_id="notifications_unread_count",
        tags=[NOTIFICATIONS_TAG],
        summary="Contar mis notificaciones sin leer",
        description=(
            "Devuelve la cantidad de notificaciones activas sin leer del usuario autenticado. "
            "Pensado para el polling liviano de la campanita cada 30–60 s. "
            "Permiso: usuario autenticado (`IsAuthenticated`)."
        ),
        responses={
            200: UnreadNotificationsCountSerializer,
            401: OpenApiResponse(description="Sin token Bearer válido o cuenta inactiva."),
        },
    )
    def get(self, request: Request) -> Response:
        unread_count = get_unread_notifications_count(actor=request.user)
        return Response(
            UnreadNotificationsCountSerializer({"unread_count": unread_count}).data,
            status=status.HTTP_200_OK,
        )


class NotificationMarkReadView(APIView):
    """POST /api/notifications/{notification_id}/read/ — Marca una notificación como leída."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(
        operation_id="notifications_mark_read",
        tags=[NOTIFICATIONS_TAG],
        summary="Marcar una notificación como leída",
        description=(
            "Marca como leída una notificación propia activa y registra `read_at`. "
            "Es idempotente: si ya estaba leída responde `200` sin sobrescribir `read_at`. "
            "Ante una notificación inexistente, dada de baja o perteneciente a otro usuario "
            "responde `404` para no revelar su existencia. "
            "Permiso: usuario autenticado (`IsAuthenticated`)."
        ),
        request=None,
        responses={
            200: NotificationSerializer,
            401: OpenApiResponse(description="Sin token Bearer válido o cuenta inactiva."),
            404: OpenApiResponse(
                description="Notificación inexistente, dada de baja o perteneciente a otro usuario."
            ),
        },
    )
    def post(self, request: Request, notification_id: int) -> Response:
        notification = mark_notification_as_read(
            notification_id=notification_id,
            actor=request.user,
        )
        return Response(
            NotificationSerializer(notification).data,
            status=status.HTTP_200_OK,
        )


class NotificationMarkAllReadView(APIView):
    """POST /api/notifications/read-all/ — Marca todas las notificaciones como leídas."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(
        operation_id="notifications_mark_all_read",
        tags=[NOTIFICATIONS_TAG],
        summary="Marcar todas mis notificaciones como leídas",
        description=(
            "Marca como leídas todas las notificaciones activas sin leer del usuario "
            "autenticado en una transacción atómica y devuelve cuántas se actualizaron. "
            "Permiso: usuario autenticado (`IsAuthenticated`)."
        ),
        request=None,
        responses={
            200: MarkAllNotificationsReadResponseSerializer,
            401: OpenApiResponse(description="Sin token Bearer válido o cuenta inactiva."),
        },
    )
    def post(self, request: Request) -> Response:
        updated_count = mark_all_notifications_as_read(actor=request.user)
        return Response(
            MarkAllNotificationsReadResponseSerializer({"updated_count": updated_count}).data,
            status=status.HTTP_200_OK,
        )
