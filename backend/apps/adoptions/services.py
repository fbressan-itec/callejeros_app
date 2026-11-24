"""Servicios de negocio para solicitudes de adopción (BK-07)."""

from collections.abc import Mapping
from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, models, transaction
from django.db.models import Prefetch, QuerySet
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.adoptions.models import (
    MAX_ADOPTION_REASON_LENGTH,
    MAX_OPEN_ANSWER_LENGTH,
    MIN_APPLICANT_AGE,
    AdoptionRequest,
)
from apps.adoptions.permissions import STAFF_OR_ADMIN_ROLES, can_view_adoption_request
from apps.pets.models import Pet, PetPhoto
from apps.users.models import User
from apps.users.permissions import FORBIDDEN_ERROR_MESSAGE, user_has_role

MAX_APPLICANT_AGE = 120
MAX_REJECTION_REASON_LENGTH = 400

MIN_AGE_ERROR = f"Para adoptar tenés que ser mayor de {MIN_APPLICANT_AGE} años."
MAX_AGE_ERROR = f"La edad no puede superar los {MAX_APPLICANT_AGE} años."
COMMITMENT_REQUIRED_ERROR = (
    "Tenés que aceptar el compromiso de adopción responsable para enviar la solicitud."
)
NEUTERING_REQUIRED_ERROR = "Tenés que comprometerte a castrarlo/a para enviar la solicitud."
FOLLOW_UP_REQUIRED_ERROR = (
    "Tenés que aceptar el seguimiento después de la adopción para enviar la solicitud."
)
RETURN_NOTICE_REQUIRED_ERROR = (
    "Tenés que comprometerte a avisar a Callejeros antes de darlo a otra persona."
)
TRUTHFUL_REQUIRED_ERROR = (
    "Tenés que declarar que los datos son verdaderos para enviar la solicitud."
)
INVALID_CHOICE_ERROR = "Elegí una opción válida."
RENTAL_ALLOWS_PETS_REQUIRED_ERROR = "Indicá si el contrato o el dueño permite animales."
PET_NOT_AVAILABLE_ERROR = "Solo podés postularte para mascotas publicadas y disponibles."
OWN_PET_ADOPTION_ERROR = "No podés postularte para adoptar una mascota que publicaste vos mismo."
DUPLICATE_PENDING_REQUEST_ERROR = "Ya tenés una solicitud pendiente para esta mascota."
INVALID_STATUS_FILTER_ERROR = "Estado de solicitud inválido."

ONLY_PENDING_REQUEST_ERROR = "Solo se puede revisar una solicitud que esté pendiente."
INACTIVE_REQUEST_ERROR = "La solicitud de adopción no está activa."
PET_UNAVAILABLE_ON_APPROVE_ERROR = "Esta mascota ya no está disponible para adopción."
REJECTION_REASON_REQUIRED_ERROR = "Indicá el motivo de desaprobación para responder al solicitante."
REJECTION_REASON_TOO_LONG_ERROR = (
    f"El motivo de desaprobación no puede superar los {MAX_REJECTION_REASON_LENGTH} caracteres."
)

REQUIRED_TEXT_FIELDS: tuple[tuple[str, str, int], ...] = (
    ("full_name", "El nombre completo es obligatorio.", 200),
    ("phone", "El WhatsApp o teléfono es obligatorio.", 30),
    ("email", "El correo electrónico es obligatorio.", 254),
    ("address", "La dirección es obligatoria.", 255),
    ("city", "La localidad es obligatoria.", 100),
    ("housing_type", "El tipo de vivienda es obligatorio.", 200),
    (
        "outdoor_space",
        "Contanos cómo es el patio, balcón o terraza y qué protecciones tiene.",
        MAX_OPEN_ANSWER_LENGTH,
    ),
    ("household_members", "Contanos quiénes viven con vos.", MAX_OPEN_ANSWER_LENGTH),
    ("other_pets", "Indicá si tenés otros animales actualmente.", 255),
    (
        "previous_pets",
        "Contanos si tuviste animales antes y qué pasó con ellos.",
        MAX_OPEN_ANSWER_LENGTH,
    ),
    ("living_space", "Contanos dónde va a dormir y pasar el día.", MAX_OPEN_ANSWER_LENGTH),
    (
        "vacation_care",
        "Contanos quién lo cuida si viajás o te vas de vacaciones.",
        MAX_OPEN_ANSWER_LENGTH,
    ),
    (
        "contingency_plan",
        "Contanos qué harías si te mudás o no podés seguir cuidándolo.",
        MAX_OPEN_ANSWER_LENGTH,
    ),
)

REQUIRED_CHOICE_FIELDS: tuple[tuple[str, str, type[models.TextChoices]], ...] = (
    (
        "home_ownership",
        "Indicá si la vivienda es propia, alquilada u otra.",
        AdoptionRequest.HomeOwnership,
    ),
    (
        "household_agreement",
        "Indicá si todos en tu casa están de acuerdo con la adopción.",
        AdoptionRequest.HouseholdAgreement,
    ),
    (
        "hours_alone",
        "Indicá cuántas horas por día pasaría solo/a.",
        AdoptionRequest.HoursAlone,
    ),
)

REQUIRED_CHECKBOX_FIELDS: tuple[tuple[str, str], ...] = (
    ("accepts_commitment", COMMITMENT_REQUIRED_ERROR),
    ("accepts_follow_up", FOLLOW_UP_REQUIRED_ERROR),
    ("accepts_return_notice", RETURN_NOTICE_REQUIRED_ERROR),
    ("declares_truthful", TRUTHFUL_REQUIRED_ERROR),
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


def get_visible_adoption_request_or_404(*, request_id: int, actor: Any) -> AdoptionRequest:
    """Obtiene una solicitud activa si es visible para solicitante/Staff/Admin; si no, 404."""
    adoption_request = get_active_adoption_request_or_404(request_id)
    if not can_view_adoption_request(actor, adoption_request):
        raise Http404
    return adoption_request


def _validate_questionnaire_data(
    data: Mapping[str, Any],
    *,
    requires_neutering: bool,
) -> dict[str, Any]:
    """Valida los 4 bloques del cuestionario y devuelve los valores normalizados.

    `requires_neutering` indica si la mascota todavía no está castrada: en ese caso el
    compromiso de castración es obligatorio; si ya lo está, se guarda vacío.
    """
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

    for field_name, required_msg, choices in REQUIRED_CHOICE_FIELDS:
        value = data.get(field_name)
        if not value:
            errors[field_name] = [required_msg]
        elif value not in choices.values:
            errors[field_name] = [INVALID_CHOICE_ERROR]
        else:
            cleaned[field_name] = value

    rental_allows_pets = data.get("rental_allows_pets") or ""
    if cleaned.get("home_ownership") == AdoptionRequest.HomeOwnership.RENTED:
        if not rental_allows_pets:
            errors["rental_allows_pets"] = [RENTAL_ALLOWS_PETS_REQUIRED_ERROR]
        elif rental_allows_pets not in AdoptionRequest.RentalPetsPolicy.values:
            errors["rental_allows_pets"] = [INVALID_CHOICE_ERROR]
        else:
            cleaned["rental_allows_pets"] = rental_allows_pets
    else:
        # Si la vivienda no es alquilada, la respuesta sobre el alquiler no aplica.
        cleaned["rental_allows_pets"] = ""

    raw_reason = data.get("adoption_reason")
    reason = raw_reason.strip() if isinstance(raw_reason, str) else ""
    if len(reason) > MAX_ADOPTION_REASON_LENGTH:
        errors["adoption_reason"] = [
            f"Este campo no puede superar los {MAX_ADOPTION_REASON_LENGTH} caracteres."
        ]
    else:
        cleaned["adoption_reason"] = reason

    for field_name, required_msg in REQUIRED_CHECKBOX_FIELDS:
        if data.get(field_name) is not True:
            errors[field_name] = [required_msg]
        else:
            cleaned[field_name] = True

    if not requires_neutering:
        cleaned["accepts_neutering"] = None
    elif data.get("accepts_neutering") is not True:
        errors["accepts_neutering"] = [NEUTERING_REQUIRED_ERROR]
    else:
        cleaned["accepts_neutering"] = True

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

    pet = Pet.objects.active().select_related("published_by__role").filter(pk=pet_id).first()
    cleaned = _validate_questionnaire_data(
        data,
        requires_neutering=pet is not None and not pet.is_neutered,
    )

    if pet is None or pet.status != Pet.Status.PUBLISHED:
        raise ValidationError({"pet": [PET_NOT_AVAILABLE_ERROR]})

    if pet.published_by_id == applicant.id:
        raise ValidationError({"pet": [OWN_PET_ADOPTION_ERROR]})

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


def get_adoption_review_queue_queryset() -> QuerySet[AdoptionRequest]:
    """Cola de revisión de Staff: solicitudes `pending` activas, de más vieja a más nueva."""
    return (
        _base_active_adoption_requests_queryset()
        .filter(status=AdoptionRequest.Status.PENDING)
        .order_by("created_at", "id")
    )


class AdoptionRequestReviewWorkflow:
    """Flujo de revisión de solicitudes de adopción por Staff/Admin (BK-07b).

    Sigue las convenciones de `apps.core.review.ReviewWorkflow`: controla rol también en el
    servicio, bloquea la fila con `select_for_update()` dentro de una transacción atómica,
    valida estado `pending` y vigencia, y deja ganchos `on_approved` / `on_rejected` para
    notificaciones en BK-08 (#11).
    """

    def can_review(self, actor: Any) -> bool:
        """Solo Staff y Admin pueden revisar solicitudes de adopción."""
        return user_has_role(actor, STAFF_OR_ADMIN_ROLES)

    def approve(
        self,
        *,
        adoption_request: AdoptionRequest,
        actor: Any,
    ) -> AdoptionRequest:
        """Aprueba una solicitud pendiente registrando revisor y fecha.

        No pide datos extra: el solicitante recibe el contacto de quien publicó y coordinan
        el encuentro entre ellos (sin punto de encuentro fijado por Staff).
        """
        reviewed = self._apply_review(
            adoption_request=adoption_request,
            actor=actor,
            new_status=AdoptionRequest.Status.APPROVED,
            rejection_reason="",
            require_available_pet=True,
        )
        self.on_approved(adoption_request=reviewed, actor=actor)
        return reviewed

    def reject(
        self,
        *,
        adoption_request: AdoptionRequest,
        actor: Any,
        rejection_reason: str,
    ) -> AdoptionRequest:
        """Desaprueba una solicitud pendiente registrando motivo, revisor y fecha."""
        cleaned_reason = rejection_reason.strip() if isinstance(rejection_reason, str) else ""
        if not cleaned_reason:
            raise ValidationError({"rejection_reason": [REJECTION_REASON_REQUIRED_ERROR]})
        if len(cleaned_reason) > MAX_REJECTION_REASON_LENGTH:
            raise ValidationError({"rejection_reason": [REJECTION_REASON_TOO_LONG_ERROR]})

        reviewed = self._apply_review(
            adoption_request=adoption_request,
            actor=actor,
            new_status=AdoptionRequest.Status.REJECTED,
            rejection_reason=cleaned_reason,
            require_available_pet=False,
        )
        self.on_rejected(adoption_request=reviewed, actor=actor)
        return reviewed

    def on_approved(self, *, adoption_request: AdoptionRequest, actor: Any) -> None:
        """Gancho post-aprobación. BK-08 (#11) lo usa para notificar al solicitante."""

    def on_rejected(self, *, adoption_request: AdoptionRequest, actor: Any) -> None:
        """Gancho post-rechazo. BK-08 (#11) lo usa para notificar al solicitante el motivo."""

    @transaction.atomic
    def _apply_review(
        self,
        *,
        adoption_request: AdoptionRequest,
        actor: Any,
        new_status: str,
        rejection_reason: str,
        require_available_pet: bool,
    ) -> AdoptionRequest:
        if not self.can_review(actor):
            raise PermissionDenied(FORBIDDEN_ERROR_MESSAGE)

        locked = (
            AdoptionRequest.objects.select_for_update()
            .select_related("pet")
            .get(pk=adoption_request.pk)
        )
        if not locked.is_active:
            raise ValidationError({"detail": [INACTIVE_REQUEST_ERROR]})
        if locked.status != AdoptionRequest.Status.PENDING:
            raise ValidationError({"status": [ONLY_PENDING_REQUEST_ERROR]})
        if require_available_pet and (
            not locked.pet.is_active or locked.pet.status != Pet.Status.PUBLISHED
        ):
            raise ValidationError({"pet": [PET_UNAVAILABLE_ON_APPROVE_ERROR]})

        locked.status = new_status
        locked.rejection_reason = rejection_reason
        locked.reviewed_by = actor
        locked.reviewed_at = timezone.now()
        locked.save(
            update_fields=[
                "status",
                "rejection_reason",
                "reviewed_by",
                "reviewed_at",
                "updated_at",
            ]
        )
        return get_active_adoption_request_or_404(locked.pk)


adoption_request_review_workflow = AdoptionRequestReviewWorkflow()


def approve_adoption_request(
    *,
    adoption_request: AdoptionRequest,
    actor: User,
) -> AdoptionRequest:
    """Aprueba una solicitud pendiente; el solicitante pasa a ver el contacto de quien publicó."""
    return adoption_request_review_workflow.approve(
        adoption_request=adoption_request,
        actor=actor,
    )


def reject_adoption_request(
    *,
    adoption_request: AdoptionRequest,
    actor: User,
    rejection_reason: str,
) -> AdoptionRequest:
    """Desaprueba una solicitud pendiente indicando el motivo para el solicitante."""
    return adoption_request_review_workflow.reject(
        adoption_request=adoption_request,
        actor=actor,
        rejection_reason=rejection_reason,
    )
