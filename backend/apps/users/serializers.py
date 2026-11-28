"""Serializers de autenticación, cuenta y administración de usuarios."""

from rest_framework import serializers

from apps.users.models import Role, RoleCode, User
from apps.users.services import (
    ADMIN_NOTE_TOO_LONG_ERROR,
    INVALID_ROLE_ERROR,
    MAX_ADMIN_NOTE_LENGTH,
)


class RoleSummarySerializer(serializers.ModelSerializer):
    """Resumen del rol del usuario para la sesión e insignias."""

    class Meta:
        model = Role
        fields = ("code", "name")
        read_only_fields = fields


class UserAuthSerializer(serializers.ModelSerializer):
    """Datos públicos/de sesión del usuario autenticado (nunca expone `address`)."""

    role = RoleSummarySerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "is_phone_verified",
            "photo",
            "role",
        )
        read_only_fields = fields


class AuthTokenResponseSerializer(serializers.Serializer):
    """Respuesta de autenticación con par de tokens JWT y datos del usuario."""

    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)
    user = UserAuthSerializer(read_only=True)


class RegisterSerializer(serializers.Serializer):
    """Valida el formato de entrada del registro; las reglas de negocio viven en `services.py`."""

    email = serializers.EmailField(
        error_messages={
            "required": "El correo electrónico es obligatorio.",
            "blank": "El correo electrónico es obligatorio.",
            "invalid": "Ingresá un correo electrónico válido.",
        }
    )
    password = serializers.CharField(
        write_only=True,
        allow_blank=True,
        trim_whitespace=False,
        error_messages={
            "required": "La contraseña es obligatoria.",
        },
    )
    first_name = serializers.CharField(
        max_length=100,
        error_messages={
            "required": "El nombre es obligatorio.",
            "blank": "El nombre es obligatorio.",
        },
    )
    last_name = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default="",
    )
    phone = serializers.CharField(
        max_length=30,
        required=False,
        allow_blank=True,
        default="",
    )
    verification_code = serializers.CharField(
        max_length=10,
        required=False,
        allow_blank=True,
        default="",
        write_only=True,
    )


class LoginSerializer(serializers.Serializer):
    """Valida las credenciales de inicio de sesión y la opción 'Recordarme'."""

    email = serializers.EmailField(
        error_messages={
            "required": "El correo electrónico es obligatorio.",
            "blank": "El correo electrónico es obligatorio.",
            "invalid": "Ingresá un correo electrónico válido.",
        }
    )
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        error_messages={
            "required": "La contraseña es obligatoria.",
            "blank": "La contraseña es obligatoria.",
        },
    )
    remember_me = serializers.BooleanField(required=False, default=False)


class LogoutSerializer(serializers.Serializer):
    """Valida el token de refresco a invalidar en el cierre de sesión."""

    refresh = serializers.CharField(
        error_messages={
            "required": "El token de refresco es obligatorio.",
            "blank": "El token de refresco es obligatorio.",
        }
    )


class AdminUserSerializer(serializers.ModelSerializer):
    """Datos de gestión de un usuario en el panel de Admin (nunca expone `address`/`password`)."""

    role = RoleSummarySerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "is_phone_verified",
            "photo",
            "city",
            "neighborhood",
            "shelter_public_address",
            "role",
            "is_active",
            "last_login",
            "created_at",
        )
        read_only_fields = fields


class PaginatedAdminUserSerializer(serializers.Serializer):
    """Envoltorio paginado de a 12 usuarios para documentación OpenAPI."""

    count = serializers.IntegerField(read_only=True)
    next = serializers.URLField(read_only=True, allow_null=True)
    previous = serializers.URLField(read_only=True, allow_null=True)
    results = AdminUserSerializer(many=True, read_only=True)


class AdminRoleChangeSerializer(serializers.Serializer):
    """Entrada para cambiar el rol de un usuario desde el panel de Admin."""

    role_code = serializers.ChoiceField(
        choices=RoleCode.choices,
        error_messages={
            "required": "Elegí un rol válido.",
            "invalid_choice": INVALID_ROLE_ERROR,
        },
    )
    note = serializers.CharField(
        max_length=MAX_ADMIN_NOTE_LENGTH,
        required=False,
        allow_blank=True,
        default="",
        error_messages={"max_length": ADMIN_NOTE_TOO_LONG_ERROR},
    )


class AdminUserStatusActionSerializer(serializers.Serializer):
    """Entrada opcional con nota de auditoría al desactivar o reactivar una cuenta."""

    note = serializers.CharField(
        max_length=MAX_ADMIN_NOTE_LENGTH,
        required=False,
        allow_blank=True,
        default="",
        error_messages={"max_length": ADMIN_NOTE_TOO_LONG_ERROR},
    )
