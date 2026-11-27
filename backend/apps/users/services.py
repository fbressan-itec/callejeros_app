"""Servicios de negocio para autenticación JWT y administración de usuarios y roles."""

from datetime import timedelta
from typing import Any

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, ValidationError
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.users.models import Role, RoleCode, User, UserRoleLog, UserStatusLog
from apps.users.permissions import FORBIDDEN_ERROR_MESSAGE, user_has_role

MIN_PASSWORD_LENGTH = 6
MAX_ADMIN_NOTE_LENGTH = 255
PASSWORD_MIN_LENGTH_ERROR = "La contraseña debe tener al menos 6 caracteres"
DUPLICATE_EMAIL_ERROR = "Ya existe una cuenta con este correo electrónico."
INVALID_CREDENTIALS_ERROR = "Correo electrónico o contraseña incorrectos."
INVALID_REFRESH_TOKEN_ERROR = "El token de refresco es inválido o ya expiró."
INVALID_VERIFICATION_CODE_ERROR = "El código de verificación es incorrecto."
ADMIN_NOTE_TOO_LONG_ERROR = f"La nota no puede superar los {MAX_ADMIN_NOTE_LENGTH} caracteres."
INVALID_ROLE_ERROR = "El rol indicado no existe o no está disponible."
CANNOT_DEMOTE_SELF_ERROR = "No podés quitarte tu propio rol de Admin."
LAST_ADMIN_ROLE_ERROR = "No se puede cambiar el rol del último Admin activo del sistema."
CANNOT_DEACTIVATE_SELF_ERROR = "No podés desactivar tu propia cuenta."
LAST_ADMIN_DEACTIVATE_ERROR = "No se puede desactivar al último Admin activo del sistema."


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


def _ensure_admin_actor(actor: Any) -> None:
    """Exige que quien ejecuta la acción sea un usuario activo con rol `admin`."""
    if not user_has_role(actor, (RoleCode.ADMIN,)):
        raise PermissionDenied(FORBIDDEN_ERROR_MESSAGE)


def _clean_admin_note(note: str) -> str:
    """Normaliza la nota opcional de auditoría y controla su longitud máxima."""
    cleaned = note.strip() if isinstance(note, str) else ""
    if len(cleaned) > MAX_ADMIN_NOTE_LENGTH:
        raise ValidationError({"note": [ADMIN_NOTE_TOO_LONG_ERROR]})
    return cleaned


def _has_other_active_admin(excluded_user_id: int) -> bool:
    """Indica si existe al menos otro usuario activo con rol `admin` además del excluido."""
    return (
        User.objects.select_for_update()
        .filter(is_active=True, role__code=RoleCode.ADMIN)
        .exclude(pk=excluded_user_id)
        .exists()
    )


def blacklist_user_refresh_tokens(user: User) -> int:
    """Agrega a la lista negra todos los tokens de refresco emitidos para el usuario."""
    blacklisted_count = 0
    for outstanding in OutstandingToken.objects.filter(user=user):
        _, created = BlacklistedToken.objects.get_or_create(token=outstanding)
        if created:
            blacklisted_count += 1
    return blacklisted_count


@transaction.atomic
def change_user_role(
    *,
    target_user: User,
    new_role_code: str,
    actor: Any,
    note: str = "",
) -> User:
    """Cambia el rol de un usuario registrando el cambio en `UserRoleLog` (solo Admin).

    Protecciones:
    - Un Admin no puede quitarse su propio rol de Admin.
    - No se puede bajar de rol al último Admin activo del sistema.
    - Un Admin sí puede cambiar el rol de otro Admin mientras quede al menos uno activo.
    - Pedir el mismo rol que ya tiene no modifica ni duplica el historial.
    """
    _ensure_admin_actor(actor)
    cleaned_note = _clean_admin_note(note)

    normalized_code = new_role_code.strip() if isinstance(new_role_code, str) else ""
    new_role = Role.objects.active().filter(code=normalized_code).first()
    if new_role is None:
        raise ValidationError({"role": [INVALID_ROLE_ERROR]})

    locked = User.objects.select_for_update().select_related("role").get(pk=target_user.pk)

    if locked.role_id == new_role.id:
        return locked

    if locked.role.code == RoleCode.ADMIN and new_role.code != RoleCode.ADMIN:
        if actor.pk == locked.pk:
            raise ValidationError({"role": [CANNOT_DEMOTE_SELF_ERROR]})
        if locked.is_active and not _has_other_active_admin(locked.pk):
            raise ValidationError({"role": [LAST_ADMIN_ROLE_ERROR]})

    previous_role = locked.role
    locked.role = new_role
    locked.save(update_fields=["role", "updated_at"])

    UserRoleLog.objects.create(
        user=locked,
        previous_role=previous_role,
        new_role=new_role,
        performed_by=actor,
        note=cleaned_note,
    )
    return locked


@transaction.atomic
def deactivate_user(
    *,
    target_user: User,
    actor: Any,
    note: str = "",
    reason: str = UserStatusLog.Reason.ADMIN_ACTION,
) -> User:
    """Desactiva una cuenta (baja lógica), registra `UserStatusLog` e invalida sus sesiones.

    Por defecto (`admin_action`) exige rol `admin` e impide que un Admin se desactive a sí
    mismo. En todos los casos impide desactivar al último Admin activo del sistema.
    """
    if reason == UserStatusLog.Reason.ADMIN_ACTION:
        _ensure_admin_actor(actor)
    elif (
        not actor
        or not getattr(actor, "is_authenticated", False)
        or not getattr(actor, "is_active", False)
        or actor.pk != target_user.pk
    ):
        raise PermissionDenied(FORBIDDEN_ERROR_MESSAGE)

    cleaned_note = _clean_admin_note(note)

    locked = User.objects.select_for_update().select_related("role").get(pk=target_user.pk)

    if reason == UserStatusLog.Reason.ADMIN_ACTION and actor.pk == locked.pk:
        raise ValidationError({"is_active": [CANNOT_DEACTIVATE_SELF_ERROR]})

    if not locked.is_active:
        blacklist_user_refresh_tokens(locked)
        return locked

    if locked.role.code == RoleCode.ADMIN and not _has_other_active_admin(locked.pk):
        raise ValidationError({"is_active": [LAST_ADMIN_DEACTIVATE_ERROR]})

    locked.is_active = False
    locked.save(update_fields=["is_active", "updated_at"])

    UserStatusLog.objects.create(
        user=locked,
        action=UserStatusLog.Action.DEACTIVATED,
        reason=reason,
        performed_by=actor,
        note=cleaned_note,
    )
    blacklist_user_refresh_tokens(locked)
    return locked


@transaction.atomic
def reactivate_user(
    *,
    target_user: User,
    actor: Any,
    note: str = "",
) -> User:
    """Reactiva una cuenta desactivada y registra `UserStatusLog` (solo Admin).

    Si la cuenta ya está activa, responde sin modificar ni duplicar el historial.
    """
    _ensure_admin_actor(actor)
    cleaned_note = _clean_admin_note(note)

    locked = User.objects.select_for_update().select_related("role").get(pk=target_user.pk)

    if locked.is_active:
        return locked

    locked.is_active = True
    locked.save(update_fields=["is_active", "updated_at"])

    UserStatusLog.objects.create(
        user=locked,
        action=UserStatusLog.Action.REACTIVATED,
        reason=UserStatusLog.Reason.ADMIN_ACTION,
        performed_by=actor,
        note=cleaned_note,
    )
    return locked
