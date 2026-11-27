"""Servicios de negocio del centro de notificaciones (BK-08)."""

from django.db import transaction
from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.notifications.models import Notification
from apps.users.models import User, UserPreferences
from apps.users.permissions import FORBIDDEN_ERROR_MESSAGE

MAX_TITLE_LENGTH = 200
MAX_LINK_LENGTH = 255

TITLE_REQUIRED_ERROR = "El título de la notificación es obligatorio."
TITLE_TOO_LONG_ERROR = f"El título no puede superar los {MAX_TITLE_LENGTH} caracteres."
TEXT_REQUIRED_ERROR = "El texto de la notificación es obligatorio."
INVALID_TAG_ERROR = "Etiqueta de notificación inválida."
LINK_TOO_LONG_ERROR = f"El enlace no puede superar los {MAX_LINK_LENGTH} caracteres."
INVALID_IS_READ_FILTER_ERROR = "El filtro is_read debe ser true o false."
INVALID_PREFERENCE_FIELD_ERROR = "Preferencia de notificación inválida."

TAG_PREFERENCE_MAP: dict[str, str] = {
    Notification.Tag.POST: "notify_requests_and_posts",
    Notification.Tag.ADOPTION: "notify_requests_and_posts",
    Notification.Tag.URGENT: "notify_nearby_alerts",
    Notification.Tag.SPONSORSHIP: "notify_sponsored_updates",
    Notification.Tag.COMMUNITY: "notify_news_and_events",
    Notification.Tag.FUNDRAISING: "notify_news_and_events",
}

VALID_PREFERENCE_FIELDS = frozenset(
    {
        "notify_requests_and_posts",
        "notify_nearby_alerts",
        "notify_sponsored_updates",
        "notify_news_and_events",
    }
)


def _ensure_authenticated_active_user(actor: User) -> None:
    if not actor or not actor.is_authenticated or not getattr(actor, "is_active", False):
        raise PermissionDenied(FORBIDDEN_ERROR_MESSAGE)


def _recipient_allows_notification(
    recipient: User,
    *,
    tag: str,
    preference_field: str | None = None,
) -> bool:
    """Evalúa si las preferencias de `recipient` permiten crear esta notificación."""
    field_name = preference_field or TAG_PREFERENCE_MAP.get(tag)
    if not field_name:
        return True

    enabled = (
        UserPreferences.objects.filter(user=recipient).values_list(field_name, flat=True).first()
    )
    if enabled is None:
        return True
    return bool(enabled)


@transaction.atomic
def create_notification(
    *,
    recipient: User,
    title: str,
    text: str,
    tag: str,
    link: str = "",
    preference_field: str | None = None,
) -> Notification | None:
    """Crea una notificación respetando `UserPreferences` y el estado activo del destinatario.

    Si el destinatario está inactivo o tiene desactivada la preferencia asociada,
    no crea la fila y devuelve `None`.
    """
    cleaned_title = title.strip() if isinstance(title, str) else ""
    cleaned_text = text.strip() if isinstance(text, str) else ""
    cleaned_link = link.strip() if isinstance(link, str) else ""

    errors: dict[str, list[str]] = {}
    if not cleaned_title:
        errors["title"] = [TITLE_REQUIRED_ERROR]
    elif len(cleaned_title) > MAX_TITLE_LENGTH:
        errors["title"] = [TITLE_TOO_LONG_ERROR]

    if not cleaned_text:
        errors["text"] = [TEXT_REQUIRED_ERROR]

    if tag not in Notification.Tag.values:
        errors["tag"] = [INVALID_TAG_ERROR]

    if len(cleaned_link) > MAX_LINK_LENGTH:
        errors["link"] = [LINK_TOO_LONG_ERROR]

    if preference_field is not None and preference_field not in VALID_PREFERENCE_FIELDS:
        errors["preference_field"] = [INVALID_PREFERENCE_FIELD_ERROR]

    if errors:
        raise ValidationError(errors)

    if not recipient or not getattr(recipient, "is_active", False):
        return None

    if not _recipient_allows_notification(
        recipient,
        tag=tag,
        preference_field=preference_field,
    ):
        return None

    return Notification.objects.create(
        recipient=recipient,
        title=cleaned_title,
        text=cleaned_text,
        tag=tag,
        link=cleaned_link,
        is_read=False,
        read_at=None,
        is_active=True,
    )


def parse_is_read_filter(raw_value: str | None) -> bool | None:
    """Convierte el parámetro `?is_read=true|false` a booleano o lanza `ValidationError`."""
    if raw_value is None or raw_value == "":
        return None
    normalized = raw_value.strip().lower()
    if normalized == "true":
        return True
    if normalized == "false":
        return False
    raise ValidationError({"is_read": [INVALID_IS_READ_FILTER_ERROR]})


def get_user_notifications_queryset(
    *,
    actor: User,
    is_read_filter: str | None = None,
    tag_filter: str | None = None,
) -> QuerySet[Notification]:
    """Devuelve las notificaciones activas de `actor`, de la más reciente a la más antigua."""
    _ensure_authenticated_active_user(actor)

    queryset = Notification.objects.active().filter(recipient=actor)

    is_read = parse_is_read_filter(is_read_filter)
    if is_read is not None:
        queryset = queryset.filter(is_read=is_read)

    if tag_filter:
        if tag_filter not in Notification.Tag.values:
            raise ValidationError({"tag": [INVALID_TAG_ERROR]})
        queryset = queryset.filter(tag=tag_filter)

    return queryset.order_by("-created_at", "-id")


def get_unread_notifications_count(*, actor: User) -> int:
    """Cuenta las notificaciones activas sin leer de `actor` (usa el índice compuesto)."""
    _ensure_authenticated_active_user(actor)
    return Notification.objects.active().filter(recipient=actor, is_read=False).count()


@transaction.atomic
def mark_notification_as_read(*, notification_id: int, actor: User) -> Notification:
    """Marca como leída una notificación propia activa (idempotente; 404 si es ajena)."""
    _ensure_authenticated_active_user(actor)

    notification = get_object_or_404(
        Notification.objects.select_for_update().active().filter(recipient=actor),
        pk=notification_id,
    )
    if notification.is_read:
        return notification

    notification.is_read = True
    notification.read_at = timezone.now()
    notification.save(update_fields=["is_read", "read_at", "updated_at"])
    return notification


@transaction.atomic
def mark_all_notifications_as_read(*, actor: User) -> int:
    """Marca como leídas todas las notificaciones activas sin leer de `actor`."""
    _ensure_authenticated_active_user(actor)

    now = timezone.now()
    return (
        Notification.objects.active()
        .filter(recipient=actor, is_read=False)
        .update(is_read=True, read_at=now, updated_at=now)
    )
