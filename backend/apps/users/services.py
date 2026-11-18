"""Servicios de negocio para registro, inicio y cierre de sesión con JWT."""

from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.users.models import User

MIN_PASSWORD_LENGTH = 6
PASSWORD_MIN_LENGTH_ERROR = "La contraseña debe tener al menos 6 caracteres"
DUPLICATE_EMAIL_ERROR = "Ya existe una cuenta con este correo electrónico."
INVALID_CREDENTIALS_ERROR = "Correo electrónico o contraseña incorrectos."
INVALID_REFRESH_TOKEN_ERROR = "El token de refresco es inválido o ya expiró."
INVALID_VERIFICATION_CODE_ERROR = "El código de verificación es incorrecto."


class ConfigurableAccessToken(AccessToken):
    """Token de acceso cuya duración se lee de la configuración actual."""

    @property
    def lifetime(self) -> timedelta:
        return timedelta(minutes=settings.JWT_ACCESS_LIFETIME_MINUTES)


class StandardRefreshToken(RefreshToken):
    """Token de refresco estándar (sin 'Recordarme': máx. 1 día por defecto)."""

    access_token_class = ConfigurableAccessToken

    @property
    def lifetime(self) -> timedelta:
        return timedelta(days=settings.JWT_REFRESH_LIFETIME_DAYS)


class RememberMeRefreshToken(RefreshToken):
    """Token de refresco extendido (con 'Recordarme': 30 días por defecto)."""

    access_token_class = ConfigurableAccessToken

    @property
    def lifetime(self) -> timedelta:
        return timedelta(days=settings.JWT_REMEMBER_ME_REFRESH_LIFETIME_DAYS)


def validate_user_password(password: str, user: User | None = None) -> None:
    """Valida la contraseña exigiendo mínimo 6 caracteres con el mensaje exacto."""
    if len(password) < MIN_PASSWORD_LENGTH:
        raise DjangoValidationError([PASSWORD_MIN_LENGTH_ERROR])
    validate_password(password, user=user)


def verify_mock_code(code: str) -> bool:
    """Compara el código ingresado con MOCK_VERIFICATION_CODE de la configuración."""
    expected = str(settings.MOCK_VERIFICATION_CODE).strip()
    return bool(expected) and code.strip() == expected


def issue_tokens_for_user(user: User, *, remember_me: bool = False) -> dict[str, str]:
    """Genera el par de tokens JWT (`access` y `refresh`) según `remember_me`."""
    token_cls = RememberMeRefreshToken if remember_me else StandardRefreshToken
    refresh = token_cls.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


@transaction.atomic
def register_user(
    *,
    email: str,
    password: str,
    first_name: str,
    last_name: str = "",
    phone: str = "",
    verification_code: str = "",
) -> tuple[User, dict[str, str]]:
    """Registra un usuario nuevo con rol `member`, preferencias y tokens JWT."""
    normalized_email = email.strip().lower()
    cleaned_phone = phone.strip()
    cleaned_code = verification_code.strip()

    errors: dict[str, list[str]] = {}

    if User.objects.filter(email__iexact=normalized_email).exists():
        errors["email"] = [DUPLICATE_EMAIL_ERROR]

    try:
        validate_user_password(password)
    except DjangoValidationError as exc:
        errors["password"] = list(exc.messages)

    is_phone_verified = False
    if cleaned_code:
        if not verify_mock_code(cleaned_code):
            errors["verification_code"] = [INVALID_VERIFICATION_CODE_ERROR]
        else:
            is_phone_verified = bool(cleaned_phone)

    if errors:
        raise ValidationError(errors)

    user = User.objects.create_user(
        email=normalized_email,
        password=password,
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        phone=cleaned_phone,
        is_phone_verified=is_phone_verified,
    )
    update_last_login(None, user)
    tokens = issue_tokens_for_user(user, remember_me=False)
    return user, tokens


def login_user(
    *,
    email: str,
    password: str,
    remember_me: bool = False,
) -> tuple[User, dict[str, str]]:
    """Autentica al usuario por email y emite sus tokens JWT."""
    user = authenticate(username=email.strip(), password=password)
    if user is None or not user.is_active:
        raise AuthenticationFailed(INVALID_CREDENTIALS_ERROR)

    update_last_login(None, user)
    tokens = issue_tokens_for_user(user, remember_me=remember_me)
    return user, tokens


def logout_user(*, refresh_token: str) -> None:
    """Invalida el token de refresco agregándolo a la lista negra."""
    try:
        token = StandardRefreshToken(refresh_token)
        token.blacklist()
    except TokenError as exc:
        raise ValidationError({"refresh": [INVALID_REFRESH_TOKEN_ERROR]}) from exc
