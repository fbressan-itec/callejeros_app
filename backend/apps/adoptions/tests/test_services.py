"""Tests unitarios de los servicios de solicitudes de adopción (`apps.adoptions.services`)."""

import pytest
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.adoptions.models import AdoptionRequest
from apps.adoptions.services import (
    COMMITMENT_REQUIRED_ERROR,
    DUPLICATE_PENDING_REQUEST_ERROR,
    MIN_AGE_ERROR,
    PET_NOT_AVAILABLE_ERROR,
    create_adoption_request,
    get_my_adoption_requests_queryset,
)
from apps.adoptions.tests.factories import AdoptionRequestFactory
from apps.pets.models import Pet
from apps.pets.tests.factories import PetFactory
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _valid_questionnaire_payload(**overrides) -> dict:
    payload = {
        "full_name": "  Tomás Gómez  ",
        "age": 25,
        "phone": "  +54 9 358 4123456  ",
        "email": "  TOMAS@EJEMPLO.AR  ",
        "address": "  Sobremonte 450  ",
        "city": "  Río Cuarto  ",
        "housing_type": "  Departamento con balcón con red de protección  ",
        "other_pets": "  Una gata castrada de 3 años  ",
        "accepts_commitment": True,
    }
    payload.update(overrides)
    return payload


def test_create_adoption_request_normalizes_fields_and_starts_pending() -> None:
    applicant = UserFactory()
    pet = PetFactory(status=Pet.Status.PUBLISHED)

    created = create_adoption_request(
        applicant=applicant,
        pet_id=pet.pk,
        data=_valid_questionnaire_payload(),
    )

    assert created.status == AdoptionRequest.Status.PENDING
    assert created.applicant_id == applicant.pk
    assert created.pet_id == pet.pk
    assert created.full_name == "Tomás Gómez"
    assert created.phone == "+54 9 358 4123456"
    assert created.email == "tomas@ejemplo.ar"
    assert created.address == "Sobremonte 450"
    assert created.city == "Río Cuarto"
    assert created.housing_type == "Departamento con balcón con red de protección"
    assert created.other_pets == "Una gata castrada de 3 años"
    assert created.accepts_commitment is True


@pytest.mark.parametrize("invalid_age", [0, 17, 121, True, "25"])
def test_create_adoption_request_rejects_invalid_age(invalid_age) -> None:
    applicant = UserFactory()
    pet = PetFactory(status=Pet.Status.PUBLISHED)

    with pytest.raises(ValidationError) as exc_info:
        create_adoption_request(
            applicant=applicant,
            pet_id=pet.pk,
            data=_valid_questionnaire_payload(age=invalid_age),
        )

    assert "age" in exc_info.value.detail
    if invalid_age == 17:
        assert exc_info.value.detail["age"][0] == MIN_AGE_ERROR


def test_create_adoption_request_requires_commitment() -> None:
    applicant = UserFactory()
    pet = PetFactory(status=Pet.Status.PUBLISHED)

    with pytest.raises(ValidationError) as exc_info:
        create_adoption_request(
            applicant=applicant,
            pet_id=pet.pk,
            data=_valid_questionnaire_payload(accepts_commitment=False),
        )

    assert exc_info.value.detail["accepts_commitment"][0] == COMMITMENT_REQUIRED_ERROR


@pytest.mark.parametrize(
    "field_name",
    ["full_name", "phone", "email", "address", "city", "housing_type", "other_pets"],
)
def test_create_adoption_request_rejects_blank_required_fields(field_name: str) -> None:
    applicant = UserFactory()
    pet = PetFactory(status=Pet.Status.PUBLISHED)

    with pytest.raises(ValidationError) as exc_info:
        create_adoption_request(
            applicant=applicant,
            pet_id=pet.pk,
            data=_valid_questionnaire_payload(**{field_name: "   "}),
        )

    assert field_name in exc_info.value.detail


@pytest.mark.parametrize(
    "pet_status",
    [Pet.Status.IN_REVIEW, Pet.Status.REJECTED, Pet.Status.ADOPTED],
)
def test_create_adoption_request_rejects_unavailable_pet_statuses(pet_status: str) -> None:
    applicant = UserFactory()
    pet = PetFactory(status=pet_status)

    with pytest.raises(ValidationError) as exc_info:
        create_adoption_request(
            applicant=applicant,
            pet_id=pet.pk,
            data=_valid_questionnaire_payload(),
        )

    assert exc_info.value.detail["pet"][0] == PET_NOT_AVAILABLE_ERROR


def test_create_adoption_request_rejects_inactive_pet() -> None:
    applicant = UserFactory()
    pet = PetFactory(status=Pet.Status.PUBLISHED)
    pet.deactivate()

    with pytest.raises(ValidationError) as exc_info:
        create_adoption_request(
            applicant=applicant,
            pet_id=pet.pk,
            data=_valid_questionnaire_payload(),
        )

    assert exc_info.value.detail["pet"][0] == PET_NOT_AVAILABLE_ERROR


def test_create_adoption_request_blocks_duplicate_pending_but_allows_after_rejected() -> None:
    applicant = UserFactory()
    pet = PetFactory(status=Pet.Status.PUBLISHED)

    first = create_adoption_request(
        applicant=applicant,
        pet_id=pet.pk,
        data=_valid_questionnaire_payload(),
    )

    with pytest.raises(ValidationError) as exc_info:
        create_adoption_request(
            applicant=applicant,
            pet_id=pet.pk,
            data=_valid_questionnaire_payload(),
        )
    assert exc_info.value.detail["pet"][0] == DUPLICATE_PENDING_REQUEST_ERROR

    first.status = AdoptionRequest.Status.REJECTED
    first.rejection_reason = "Necesitamos confirmar cerramiento del patio."
    first.save(update_fields=["status", "rejection_reason", "updated_at"])

    second = create_adoption_request(
        applicant=applicant,
        pet_id=pet.pk,
        data=_valid_questionnaire_payload(housing_type="Casa con tapia cerrada de 2m"),
    )
    assert second.pk != first.pk
    assert second.status == AdoptionRequest.Status.PENDING


def test_create_adoption_request_rejects_inactive_applicant() -> None:
    applicant = UserFactory()
    applicant.deactivate()
    pet = PetFactory(status=Pet.Status.PUBLISHED)

    with pytest.raises(PermissionDenied):
        create_adoption_request(
            applicant=applicant,
            pet_id=pet.pk,
            data=_valid_questionnaire_payload(),
        )


def test_get_my_adoption_requests_queryset_filters_by_status_and_validates() -> None:
    applicant = UserFactory()
    pending = AdoptionRequestFactory(applicant=applicant, status=AdoptionRequest.Status.PENDING)
    approved = AdoptionRequestFactory(applicant=applicant, status=AdoptionRequest.Status.APPROVED)
    AdoptionRequestFactory(status=AdoptionRequest.Status.PENDING)  # de otro usuario

    assert list(get_my_adoption_requests_queryset(actor=applicant)) == [approved, pending]
    assert list(get_my_adoption_requests_queryset(actor=applicant, status_filter="approved")) == [
        approved
    ]

    with pytest.raises(ValidationError) as exc_info:
        get_my_adoption_requests_queryset(actor=applicant, status_filter="unknown")
    assert "status" in exc_info.value.detail
