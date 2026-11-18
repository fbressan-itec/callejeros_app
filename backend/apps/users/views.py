"""Vistas de API para registro, login, refresco, cierre de sesión y perfil actual con JWT."""

from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import (
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.views import TokenRefreshView

from apps.users.serializers import (
    AuthTokenResponseSerializer,
    LoginSerializer,
    LogoutSerializer,
    RegisterSerializer,
    UserAuthSerializer,
)
from apps.users.services import login_user, logout_user, register_user

AUTH_TAG = "Autenticación"


class PublicAuthAPIView(APIView):
    """Vista base para endpoints públicos de autenticación con encabezado Bearer."""

    permission_classes = (AllowAny,)
    authentication_classes = ()

    def get_authenticate_header(self, request: Request) -> str:
        return 'Bearer realm="api"'


class RegisterView(PublicAuthAPIView):
    """POST /api/auth/register/ — Crea una cuenta nueva y devuelve sus tokens JWT."""

    @extend_schema(
        tags=[AUTH_TAG],
        summary="Registrar cuenta nueva",
        description=(
            "Crea un usuario con rol `member` por defecto y sus preferencias de notificación "
            "y privacidad. Permiso: público (`AllowAny`). La contraseña debe tener al menos "
            "6 caracteres y no ser muy común ni solo numérica."
        ),
        request=RegisterSerializer,
        responses={
            201: AuthTokenResponseSerializer,
            400: OpenApiResponse(description="Datos de registro inválidos."),
        },
        examples=[
            OpenApiExample(
                "Registro con teléfono verificado",
                value={
                    "email": "vecino@callejeros.ar",
                    "password": "ClaveSegura123!",
                    "first_name": "Lucía",
                    "last_name": "Gómez",
                    "phone": "3584123456",
                    "verification_code": "8596",
                },
                request_only=True,
            ),
        ],
    )
    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user, tokens = register_user(**serializer.validated_data)
        return Response(
            {
                **tokens,
                "user": UserAuthSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(PublicAuthAPIView):
    """POST /api/auth/login/ — Inicia sesión con email/contraseña y opción 'Recordarme'."""

    @extend_schema(
        tags=[AUTH_TAG],
        summary="Iniciar sesión con JWT",
        description=(
            "Autentica por correo electrónico (sin distinguir mayúsculas) y contraseña. "
            "Permiso: público (`AllowAny`). Si `remember_me=true`, el token de refresco dura "
            "30 días; si es `false`, dura 1 día."
        ),
        request=LoginSerializer,
        responses={
            200: AuthTokenResponseSerializer,
            400: OpenApiResponse(description="Campos obligatorios faltantes o inválidos."),
            401: OpenApiResponse(description="Credenciales inválidas o cuenta inactiva."),
        },
        examples=[
            OpenApiExample(
                "Login con Recordarme",
                value={
                    "email": "miembro@callejeros.ar",
                    "password": "cambiame-clave-seed-123",
                    "remember_me": True,
                },
                request_only=True,
            ),
        ],
    )
    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user, tokens = login_user(**serializer.validated_data)
        return Response(
            {
                **tokens,
                "user": UserAuthSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


@extend_schema(
    tags=[AUTH_TAG],
    summary="Renovar token de acceso",
    description=(
        "Emite un nuevo token `access` a partir de un token `refresh` vigente y no invalidado. "
        "Permiso: público (`AllowAny`)."
    ),
    request=TokenRefreshSerializer,
    responses={
        200: TokenRefreshSerializer,
        401: OpenApiResponse(description="Token de refresco inválido, vencido o en lista negra."),
    },
)
class RefreshView(TokenRefreshView):
    """POST /api/auth/refresh/ — Renueva el token de acceso a partir del refresh token."""

    permission_classes = (AllowAny,)
    authentication_classes = ()


class LogoutView(PublicAuthAPIView):
    """POST /api/auth/logout/ — Invalida el token de refresco (blacklist)."""

    @extend_schema(
        tags=[AUTH_TAG],
        summary="Cerrar sesión e invalidar refresh token",
        description=(
            "Agrega el token de refresco a la lista negra (`token_blacklist`) para que no "
            "pueda volver a usarse. Permiso: público (`AllowAny`)."
        ),
        request=LogoutSerializer,
        responses={
            204: OpenApiResponse(description="Sesión cerrada y token invalidado."),
            400: OpenApiResponse(description="Token de refresco inválido o ya expirado."),
        },
    )
    def post(self, request: Request) -> Response:
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        logout_user(refresh_token=serializer.validated_data["refresh"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """GET /api/auth/me/ — Devuelve los datos y el rol del usuario autenticado actual."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(
        tags=[AUTH_TAG],
        summary="Consultar usuario autenticado actual",
        description=(
            "Devuelve los datos de perfil y el rol (`member`, `verified_shelter`, `staff` o "
            "`admin`) del usuario dueño del token Bearer JWT. Permiso: requiere sesión activa "
            "(`IsAuthenticated`)."
        ),
        responses={
            200: UserAuthSerializer,
            401: OpenApiResponse(description="Sin token válido o usuario inactivo."),
        },
    )
    def get(self, request: Request) -> Response:
        return Response(UserAuthSerializer(request.user).data, status=status.HTTP_200_OK)
