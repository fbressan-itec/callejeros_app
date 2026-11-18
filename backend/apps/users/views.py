"""Vistas de API para registro, login, refresco y cierre de sesión con JWT."""

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from apps.users.serializers import (
    LoginSerializer,
    LogoutSerializer,
    RegisterSerializer,
    UserAuthSerializer,
)
from apps.users.services import login_user, logout_user, register_user


class PublicAuthAPIView(APIView):
    """Vista base para endpoints públicos de autenticación con encabezado Bearer."""

    permission_classes = (AllowAny,)
    authentication_classes = ()

    def get_authenticate_header(self, request: Request) -> str:
        return 'Bearer realm="api"'


class RegisterView(PublicAuthAPIView):
    """POST /api/auth/register/ — Crea una cuenta nueva y devuelve sus tokens JWT."""

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


class RefreshView(TokenRefreshView):
    """POST /api/auth/refresh/ — Renueva el token de acceso a partir del refresh token."""

    permission_classes = (AllowAny,)
    authentication_classes = ()


class LogoutView(PublicAuthAPIView):
    """POST /api/auth/logout/ — Invalida el token de refresco (blacklist)."""

    def post(self, request: Request) -> Response:
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        logout_user(refresh_token=serializer.validated_data["refresh"])
        return Response(status=status.HTTP_204_NO_CONTENT)
