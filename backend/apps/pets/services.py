"""Servicios de negocio para publicar, editar, adoptar, dar de baja mascotas y gestionar fotos."""

from collections.abc import Sequence
from datetime import date
from enum import StrEnum
from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Max, Prefetch, QuerySet
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.core.review import ReviewWorkflow
from apps.core.validators import validate_image_file
from apps.pets.models import Pet, PetHealth, PetPhoto, PetStatusLog
from apps.pets.permissions import can_manage_pet, can_view_pet, is_staff_or_admin
from apps.users.models import User
from apps.users.permissions import FORBIDDEN_ERROR_MESSAGE

MAX_DESCRIPTION_LENGTH = 400
MAX_SPECIAL_CARE_LENGTH = 150


class AgeGroup(StrEnum):
    """Grupos de edad compartidos entre insignias y filtros del catálogo."""

    CACHORRO = "cachorro"
    ADULTO = "adulto"
    SENIOR = "senior"


AGE_GROUP_CHOICES = (
    (AgeGroup.CACHORRO.value, "Cachorro"),
    (AgeGroup.ADULTO.value, "Adulto"),
    (AgeGroup.SENIOR.value, "Senior"),
)

MIN_PHOTOS_ERROR = "Debés subir al menos una foto de la mascota."
LAST_PHOTO_ERROR = "La mascota debe conservar al menos una foto activa."
NAME_REQUIRED_ERROR = "El nombre de la mascota es obligatorio."
CONTACT_PHONE_REQUIRED_ERROR = "El teléfono de contacto es obligatorio."
DESCRIPTION_REQUIRED_ERROR = "La descripción es obligatoria."
DESCRIPTION_TOO_LONG_ERROR = (
    f"La descripción no puede superar los {MAX_DESCRIPTION_LENGTH} caracteres."
)
SPECIAL_CARE_TOO_LONG_ERROR = (
    f"El cuidado especial no puede superar los {MAX_SPECIAL_CARE_LENGTH} caracteres."
)
FUTURE_BIRTH_DATE_ERROR = "La fecha de nacimiento estimada no puede ser futura."
ADOPT_ONLY_PUBLISHED_ERROR = "Solo se puede marcar como adoptada una mascota que esté publicada."
INACTIVE_PET_ERROR = "La publicación de la mascota no está activa."
REJECTED_PET_NOT_EDITABLE_ERROR = (
    "Una publicación rechazada no se puede editar. Para volver a publicarla, cargala de nuevo."
)
PHOTO_NOT_FOUND_ERROR = "La foto no pertenece a esta mascota o ya fue dada de baja."

EDITABLE_PET_FIELDS = (
    "name",
    "species",
    "sex",
    "estimated_birth_date",
    "is_sociable",
    "good_with_children",
    "good_with_animals",
    "is_neutered",
    "is_urgent_requested",
    "special_care",
    "description",
    "notes",
    "contact_phone",
)

HEALTH_FIELDS = (
    "general_status",
    "vaccines",
    "deworming",
    "flea_tick_treatment",
    "other",
)

TEXT_PET_FIELDS = frozenset({"name", "special_care", "description", "notes", "contact_phone"})


def subtract_years(reference_date: date, years: int) -> date:
    """Resta años calendario exactos manejando el 29 de febrero."""
    try:
        return reference_date.replace(year=reference_date.year - years)
    except ValueError:
        return reference_date.replace(year=reference_date.year - years, day=28)


def calculate_age_group(estimated_birth_date: date, *, today: date | None = None) -> str:
    """Calcula el grupo de edad (`cachorro` < 1 año, `adulto` 1-7 años, `senior` > 7)."""
    reference = today or timezone.localdate()
    if estimated_birth_date > subtract_years(reference, 1):
        return AgeGroup.CACHORRO.value
    if estimated_birth_date >= subtract_years(reference, 7):
        return AgeGroup.ADULTO.value
    return AgeGroup.SENIOR.value


def is_pet_urgent(pet: Pet) -> bool:
    """Devuelve True solo si la urgencia fue pedida, validada por Staff y no está adoptada."""
    return bool(
        pet.is_urgent_requested and pet.is_urgent_validated and pet.status != Pet.Status.ADOPTED
    )


def _base_active_pets_queryset() -> QuerySet[Pet]:
    """QuerySet base de mascotas activas con autor, rol, salud y fotos activas precargadas."""
    active_photos_prefetch = Prefetch(
        "photos",
        queryset=PetPhoto.objects.active().order_by("position", "id"),
        to_attr="prefetched_active_photos",
    )
    return (
        Pet.objects.active()
        .select_related("published_by__role", "health")
        .prefetch_related(active_photos_prefetch)
    )


def get_catalog_pets_queryset() -> QuerySet[Pet]:
    """Devuelve mascotas activas elegibles para catálogo público (`published` o `adopted`)."""
    return (
        _base_active_pets_queryset()
        .filter(status__in=(Pet.Status.PUBLISHED, Pet.Status.ADOPTED))
        .order_by("-created_at", "-id")
    )


def get_my_pets_queryset(*, actor: User, status_filter: str | None = None) -> QuerySet[Pet]:
    """Devuelve todas las mascotas activas publicadas por `actor` en cualquier estado."""
    queryset = _base_active_pets_queryset().filter(published_by=actor)
    if status_filter:
        valid_statuses = {choice for choice, _ in Pet.Status.choices}
        if status_filter not in valid_statuses:
            raise ValidationError({"status": ["Estado de mascota inválido."]})
        queryset = queryset.filter(status=status_filter)
    return queryset.order_by("-created_at", "-id")


def get_visible_pet_or_404(*, pet_id: int, actor: Any) -> Pet:
    """Obtiene una ficha si es pública (`published`/`adopted`) o visible para autor/Staff/Admin."""
    pet = get_object_or_404(_base_active_pets_queryset(), pk=pet_id)
    if not can_view_pet(actor, pet):
        raise Http404
    return pet


def _ensure_can_manage_pet(pet: Pet, actor: User) -> None:
    """Verifica permisos de autor/Staff/Admin y que la mascota siga activa."""
    if not can_manage_pet(actor, pet):
        raise PermissionDenied(FORBIDDEN_ERROR_MESSAGE)
    if not pet.is_active:
        raise ValidationError({"detail": [INACTIVE_PET_ERROR]})


def _ensure_not_rejected(pet: Pet) -> None:
    """Una publicación rechazada es final: no se edita ni se cambian sus fotos (BK-06a).

    Para volver a intentar, el autor la carga de nuevo. Darla de baja sí está permitido.
    """
    if pet.status == Pet.Status.REJECTED:
        raise ValidationError({"status": [REJECTED_PET_NOT_EDITABLE_ERROR]})


def _return_to_review_if_edited_by_author(pet: Pet, actor: User, *, note: str) -> None:
    """Si un autor (no Staff/Admin) edita una mascota publicada, vuelve a `in_review`."""
    if pet.status != Pet.Status.PUBLISHED or is_staff_or_admin(actor):
        return

    previous_status = pet.status
    pet.status = Pet.Status.IN_REVIEW
    pet.save(update_fields=["status", "updated_at"])

    PetStatusLog.objects.create(
        pet=pet,
        previous_status=previous_status,
        new_status=Pet.Status.IN_REVIEW,
        performed_by=actor,
        note=note,
    )


def _validate_pet_fields(
    data: dict[str, Any],
    *,
    partial: bool = False,
) -> dict[str, Any]:
    """Normaliza y valida reglas de negocio sobre los campos editables de `Pet`."""
    cleaned: dict[str, Any] = {}
    errors: dict[str, list[str]] = {}

    for field in EDITABLE_PET_FIELDS:
        if field not in data:
            continue
        value = data[field]
        if field in TEXT_PET_FIELDS and isinstance(value, str):
            value = value.strip()
        cleaned[field] = value

    if not partial or "name" in cleaned:
        name = cleaned.get("name", "")
        if not name:
            errors["name"] = [NAME_REQUIRED_ERROR]

    if not partial or "contact_phone" in cleaned:
        contact_phone = cleaned.get("contact_phone", "")
        if not contact_phone:
            errors["contact_phone"] = [CONTACT_PHONE_REQUIRED_ERROR]

    if not partial or "description" in cleaned:
        description = cleaned.get("description", "")
        if not description:
            errors["description"] = [DESCRIPTION_REQUIRED_ERROR]
        elif len(description) > MAX_DESCRIPTION_LENGTH:
            errors["description"] = [DESCRIPTION_TOO_LONG_ERROR]

    if "special_care" in cleaned:
        special_care = cleaned["special_care"] or ""
        cleaned["special_care"] = special_care
        if len(special_care) > MAX_SPECIAL_CARE_LENGTH:
            errors["special_care"] = [SPECIAL_CARE_TOO_LONG_ERROR]

    if not partial or "estimated_birth_date" in cleaned:
        birth_date = cleaned.get("estimated_birth_date")
        if isinstance(birth_date, date) and birth_date > timezone.localdate():
            errors["estimated_birth_date"] = [FUTURE_BIRTH_DATE_ERROR]

    if errors:
        raise ValidationError(errors)

    return cleaned


def _validate_photos(photos: Sequence[Any]) -> list[Any]:
    """Valida que exista al menos una foto y que cada archivo sea una imagen válida ≤ 5 MB."""
    photo_list = [photo for photo in photos if photo is not None]
    if not photo_list:
        raise ValidationError({"photos": [MIN_PHOTOS_ERROR]})

    photo_errors: list[str] = []
    for photo in photo_list:
        try:
            validate_image_file(photo)
        except DjangoValidationError as exc:
            photo_errors.extend(exc.messages)

    if photo_errors:
        # Conserva el orden eliminando duplicados cuando varias fotos fallan por el mismo motivo.
        unique_errors = list(dict.fromkeys(photo_errors))
        raise ValidationError({"photos": unique_errors})

    return photo_list


def _clean_health_data(health_data: dict[str, Any] | None) -> dict[str, str]:
    """Filtra y limpia los campos válidos de `PetHealth`."""
    if not health_data:
        return {}
    cleaned: dict[str, str] = {}
    for field in HEALTH_FIELDS:
        if field in health_data:
            raw_value = health_data[field]
            cleaned[field] = raw_value.strip() if isinstance(raw_value, str) else ""
    return cleaned


@transaction.atomic
def create_pet(
    *,
    actor: User,
    data: dict[str, Any],
    photos: Sequence[Any],
    health_data: dict[str, Any] | None = None,
) -> Pet:
    """Crea una mascota con salud, fotos e historial inicial.

    Nace en `in_review`, salvo que la cargue un Admin: entonces nace en `published` (BK-06a).
    """
    if not actor or not actor.is_authenticated or not actor.is_active:
        raise PermissionDenied(FORBIDDEN_ERROR_MESSAGE)

    cleaned_data = _validate_pet_fields(data, partial=False)
    valid_photos = _validate_photos(photos)
    cleaned_health = _clean_health_data(health_data)

    # Solo Admin publica sin revisión; si pide "urgente", su urgencia queda validada (BK-06a).
    initial_status = pet_review_workflow.get_initial_status(actor)
    publishes_directly = pet_review_workflow.publishes_directly(actor)
    is_urgent_requested = cleaned_data.get("is_urgent_requested", False)

    pet = Pet.objects.create(
        name=cleaned_data["name"],
        species=cleaned_data["species"],
        sex=cleaned_data["sex"],
        estimated_birth_date=cleaned_data["estimated_birth_date"],
        is_sociable=cleaned_data["is_sociable"],
        good_with_children=cleaned_data.get("good_with_children", Pet.Compatibility.NOT_EVALUATED),
        good_with_animals=cleaned_data.get("good_with_animals", Pet.Compatibility.NOT_EVALUATED),
        is_neutered=cleaned_data["is_neutered"],
        is_urgent_requested=is_urgent_requested,
        is_urgent_validated=is_urgent_requested and publishes_directly,
        special_care=cleaned_data.get("special_care", ""),
        description=cleaned_data["description"],
        notes=cleaned_data.get("notes", ""),
        contact_phone=cleaned_data["contact_phone"],
        status=initial_status,
        published_by=actor,
        is_active=True,
    )

    PetHealth.objects.create(pet=pet, **cleaned_health)

    for position, image in enumerate(valid_photos):
        PetPhoto.objects.create(
            pet=pet,
            image=image,
            position=position,
            is_active=True,
        )

    pet_review_workflow.log_status_change(
        obj=pet,
        actor=actor,
        previous_status="",
        new_status=initial_status,
        note=pet_review_workflow.get_creation_note(actor),
    )

    return pet


@transaction.atomic
def update_pet(
    *,
    pet: Pet,
    actor: User,
    data: dict[str, Any],
    health_data: dict[str, Any] | None = None,
) -> Pet:
    """Edita los campos permitidos de una mascota sin tocar estado, validación ni autor."""
    _ensure_can_manage_pet(pet, actor)
    _ensure_not_rejected(pet)

    cleaned_data = _validate_pet_fields(data, partial=True)
    cleaned_health = _clean_health_data(health_data)

    updated_fields: list[str] = []
    for field, value in cleaned_data.items():
        setattr(pet, field, value)
        updated_fields.append(field)

    if cleaned_data.get("is_urgent_requested") is False and pet.is_urgent_validated:
        pet.is_urgent_validated = False
        updated_fields.append("is_urgent_validated")

    if updated_fields:
        updated_fields.append("updated_at")
        pet.save(update_fields=updated_fields)

    if cleaned_health:
        health, _ = PetHealth.objects.get_or_create(pet=pet)
        for field, value in cleaned_health.items():
            setattr(health, field, value)
        health.save(update_fields=[*cleaned_health.keys(), "updated_at"])

    if updated_fields or cleaned_health:
        _return_to_review_if_edited_by_author(
            pet,
            actor,
            note="Publicación editada por el autor; vuelve a revisión.",
        )

    return pet


@transaction.atomic
def deactivate_pet(*, pet: Pet, actor: User) -> Pet:
    """Da de baja lógica una mascota (nunca borrado físico)."""
    _ensure_can_manage_pet(pet, actor)
    pet.deactivate()
    return pet


@transaction.atomic
def adopt_pet(*, pet: Pet, actor: User, note: str = "") -> Pet:
    """Marca como adoptada una mascota publicada y registra el cambio en `PetStatusLog`."""
    _ensure_can_manage_pet(pet, actor)

    if pet.status != Pet.Status.PUBLISHED:
        raise ValidationError({"status": [ADOPT_ONLY_PUBLISHED_ERROR]})

    previous_status = pet.status
    pet.status = Pet.Status.ADOPTED
    pet.save(update_fields=["status", "updated_at"])

    PetStatusLog.objects.create(
        pet=pet,
        previous_status=previous_status,
        new_status=Pet.Status.ADOPTED,
        performed_by=actor,
        note=note.strip() or "Mascota marcada como adoptada.",
    )

    return pet


@transaction.atomic
def add_pet_photo(*, pet: Pet, actor: User, image: Any) -> PetPhoto:
    """Agrega una foto validada al final del carrusel activo de la mascota."""
    _ensure_can_manage_pet(pet, actor)
    _ensure_not_rejected(pet)

    if image is None:
        raise ValidationError({"image": [MIN_PHOTOS_ERROR]})

    try:
        validate_image_file(image)
    except DjangoValidationError as exc:
        raise ValidationError({"image": list(exc.messages)}) from exc

    max_position = pet.photos.active().aggregate(max_pos=Max("position"))["max_pos"]
    next_position = 0 if max_position is None else max_position + 1

    photo = PetPhoto.objects.create(
        pet=pet,
        image=image,
        position=next_position,
        is_active=True,
    )
    _return_to_review_if_edited_by_author(
        pet,
        actor,
        note="Fotos editadas por el autor; vuelve a revisión.",
    )
    return photo


@transaction.atomic
def remove_pet_photo(*, pet: Pet, photo: PetPhoto, actor: User) -> PetPhoto:
    """Da de baja lógica una foto del carrusel sin dejar a la mascota sin fotos activas."""
    _ensure_can_manage_pet(pet, actor)
    _ensure_not_rejected(pet)

    if photo.pet_id != pet.id or not photo.is_active:
        raise ValidationError({"photo": [PHOTO_NOT_FOUND_ERROR]})

    active_photos = list(pet.photos.active().order_by("position", "id"))
    if len(active_photos) <= 1:
        raise ValidationError({"photos": [LAST_PHOTO_ERROR]})

    photo.deactivate()

    # Compacta posiciones para garantizar que siempre exista una foto principal en `position=0`.
    remaining = [item for item in active_photos if item.id != photo.id]
    for new_position, item in enumerate(remaining):
        if item.position != new_position:
            item.position = new_position
            item.save(update_fields=["position", "updated_at"])

    _return_to_review_if_edited_by_author(
        pet,
        actor,
        note="Fotos editadas por el autor; vuelve a revisión.",
    )

    return photo


class PetReviewWorkflow(ReviewWorkflow):
    """Flujo de revisión de publicaciones de mascotas (BK-06): historial en `PetStatusLog`."""

    log_model = PetStatusLog
    log_object_field = "pet"


pet_review_workflow = PetReviewWorkflow()


def approve_pet(*, pet: Pet, actor: User, note: str = "") -> Pet:
    """Aprueba una mascota en revisión (Staff o Admin): pasa a `published` y se registra."""
    return pet_review_workflow.approve(obj=pet, actor=actor, note=note)


def reject_pet(*, pet: Pet, actor: User, note: str = "") -> Pet:
    """Rechaza una mascota en revisión (Staff o Admin) con motivo: pasa a `rejected`."""
    return pet_review_workflow.reject(obj=pet, actor=actor, note=note)
