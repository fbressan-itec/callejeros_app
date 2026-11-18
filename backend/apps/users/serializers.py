"""Serializers de autenticación y datos básicos de cuenta."""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.users.models import Role, User
from apps.users.services import (
    INVALID_VERIFICATION_CODE_ERROR,
    MIN_PASSWORD_LENGTH,
    PASSWORD_MIN_LENGTH_ERROR,
    validate_user_password,
    verify_mock_code,
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


class RegisterSerializer(serializers.Serializer):
    """Valida los datos de registro de una cuenta nueva."""

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
            "blank": PASSWORD_MIN_LENGTH_ERROR,
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

    def validate_email(self, value: str) -> str:
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este correo electrónico.")
        return normalized

    def validate_password(self, value: str) -> str:
        if len(value) < MIN_PASSWORD_LENGTH:
            raise serializers.ValidationError(PASSWORD_MIN_LENGTH_ERROR)
        try:
            validate_user_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def validate_verification_code(self, value: str) -> str:
        cleaned = value.strip()
        if cleaned and not verify_mock_code(cleaned):
            raise serializers.ValidationError(INVALID_VERIFICATION_CODE_ERROR)
        return cleaned


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
