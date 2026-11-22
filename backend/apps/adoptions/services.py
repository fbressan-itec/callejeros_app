"""Servicios de negocio para solicitudes de adopción (BK-07)."""

from collections.abc import Mapping
from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Prefetch, QuerySet
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.adoptions.models import MIN_APPLICANT_AGE, AdoptionRequest
from apps.pets.models import Pet, PetPhoto
from apps.users.models import User
from apps.users.permissions import FORBIDDEN_ERROR_MESSAGE

MAX_APPLICANT_AGE = 120

MIN_AGE_ERROR = f"Para adoptar tenés que ser mayor de {MIN_APPLICANT_AGE} años."
MAX_AGE_ERROR = f"La edad no puede superar los {MAX_APPLICANT_AGE} años."
COMMITMENT_REQUIRED_ERROR = (
    "Tenés que aceptar el compromiso de adopción responsable para enviar la solicitud."
)
PET_NOT_AVAILABLE_ERROR = "Solo podés postularte para mascotas publicadas y disponibles."
DUPLICATE_PENDING_REQUEST_ERROR = "Ya tenés una solicitud pendiente para esta mascota."
INVALID_STATUS_FILTER_ERROR = "Estado de solicitud inválido."

REQUIRED_TEXT_FIELDS: tuple[tuple[str, str, int], ...] = (
    ("full_name", "El nombre completo es obligatorio.", 200),
    ("phone", "El WhatsApp o teléfono es obligatorio.", 30),
    ("email", "El correo electrónico es obligatorio.", 254),
    ("address", "La dirección es obligatoria.", 255),
    ("city", "La localidad es obligatoria.", 100),
    ("housing_type", "El tipo de vivienda es obligatorio.", 200),
    ("other_pets", "Indicá si tenés otros animales actualmente.", 255),
)


def _base_active_adoption_requests_queryset() -> QuerySet[AdoptionRequest]:
    """QuerySet base de solicitudes activas con mascota, foto principal, solicitante y revisor."""
    active_photos_prefetch = Prefetch(
        "pet__photos",
        queryset=PetPhoto.objects.active().order_by("position", "id"),
        to_attr="prefetched_active_photos",
    )
    return (
        AdoptionRequest.objects.active()
        .select_related(
            "pet__published_by__role",
            "applicant__role",
            "reviewed_by__role",
        )
        .prefetch_related(active_photos_prefetch)
    )


def get_my_adoption_requests_queryset(
    *,
    actor: User,
    status_filter: str | None = None,
) -> QuerySet[AdoptionRequest]:
    """Devuelve las solicitudes activas enviadas por `actor`, más recientes primero."""
    queryset = _base_active_adoption_requests_queryset().filter(applicant=actor)
    if status_filter:
        valid_statuses = {choice for choice, _ in AdoptionRequest.Status.choices}
        if status_filter not in valid_statuses:
            raise ValidationError({"status": [INVALID_STATUS_FILTER_ERROR]})
        queryset = queryset.filter(status=status_filter)
    return queryset.order_by("-created_at", "-id")


def get_active_adoption_request_or_404(request_id: int) -> AdoptionRequest:
    """Obtiene una solicitud activa precargando sus relaciones o devuelve 404."""
    return get_object_or_404(_base_active_adoption_requests_queryset(), pk=request_id)


def _validate_questionnaire_data(data: Mapping[str, Any]) -> dict[str, Any]:
    """Valida los 3 bloques del cuestionario y devuelve los valores normalizados."""
    errors: dict[str, list[str]] = {}
    cleaned: dict[str, Any] = {}

    for field_name, required_msg, max_length in REQUIRED_TEXT_FIELDS:
        raw_value = data.get(field_name)
        value = raw_value.strip() if isinstance(raw_value, str) else ""
        if not value:
            errors[field_name] = [required_msg]
        elif len(value) > max_length:
            errors[field_name] = [f"Este campo no puede superar los {max_length} caracteres."]
        else:
            cleaned[field_name] = value

    if "email" in cleaned:
        try:
            validate_email(cleaned["email"])
        except DjangoValidationError:
            errors["email"] = ["Ingresá un correo electrónico válido."]
        else:
            cleaned["email"] = cleaned["email"].lower()

    age = data.get("age")
    if isinstance(age, bool) or not isinstance(age, int):
        errors["age"] = ["Ingresá una edad válida."]
    elif age < MIN_APPLICANT_AGE:
        errors["age"] = [MIN_AGE_ERROR]
    elif age > MAX_APPLICANT_AGE:
        errors["age"] = [MAX_AGE_ERROR]
    else:
        cleaned["age"] = age

    if data.get("accepts_commitment") is not True:
        errors["accepts_commitment"] = [COMMITMENT_REQUIRED_ERROR]
    else:
        cleaned["accepts_commitment"] = True

    if errors:
        raise ValidationError(errors)

    return cleaned


@transaction.atomic
def create_adoption_request(
    *,
    applicant: User,
    pet_id: int,
    data: Mapping[str, Any],
) -> AdoptionRequest:
    """Registra una solicitud de adopción en estado `pending` tras validar todas las reglas."""
    if (
        not applicant
        or not applicant.is_authenticated
        or not getattr(applicant, "is_active", False)
    ):
        raise PermissionDenied(FORBIDDEN_ERROR_MESSAGE)

    cleaned = _validate_questionnaire_data(data)

    pet = Pet.objects.active().select_related("published_by__role").filter(pk=pet_id).first()
    if pet is None or pet.status != Pet.Status.PUBLISHED:
        raise ValidationError({"pet": [PET_NOT_AVAILABLE_ERROR]})

    has_pending = (
        AdoptionRequest.objects.active()
        .filter(
            applicant=applicant,
            pet=pet,
            status=AdoptionRequest.Status.PENDING,
        )
        .exists()
    )
    if has_pending:
        raise ValidationError({"pet": [DUPLICATE_PENDING_REQUEST_ERROR]})

    try:
        adoption_request = AdoptionRequest.objects.create(
            pet=pet,
            applicant=applicant,
            status=AdoptionRequest.Status.PENDING,
            **cleaned,
        )
    except IntegrityError as exc:
        raise ValidationError({"pet": [DUPLICATE_PENDING_REQUEST_ERROR]}) from exc

    return get_active_adoption_request_or_404(adoption_request.pk)
