"""Tests unitarios de los servicios de solicitudes de adopción (`apps.adoptions.services`)."""

import pytest
from django.http import Http404
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.adoptions.models import AdoptionRequest
from apps.adoptions.services import (
    COMMITMENT_REQUIRED_ERROR,
    DUPLICATE_PENDING_REQUEST_ERROR,
    FOLLOW_UP_REQUIRED_ERROR,
    INVALID_CHOICE_ERROR,
    MIN_AGE_ERROR,
    NEUTERING_REQUIRED_ERROR,
    OWN_PET_ADOPTION_ERROR,
    PET_NOT_AVAILABLE_ERROR,
    RENTAL_ALLOWS_PETS_REQUIRED_ERROR,
    RETURN_NOTICE_REQUIRED_ERROR,
    TRUTHFUL_REQUIRED_ERROR,
    create_adoption_request,
    get_my_adoption_requests_queryset,
    get_public_shelter_address,
    get_visible_adoption_request_or_404,
)
from apps.adoptions.tests.factories import AdoptionRequestFactory
from apps.pets.models import Pet
from apps.pets.tests.factories import PetFactory
from apps.users.models import RoleCode
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
        "home_ownership": AdoptionRequest.HomeOwnership.OWNED,
        "outdoor_space": "  Balcón con red de protección en todo el frente  ",
        "household_members": "  Vivo sola  ",
        "household_agreement": AdoptionRequest.HouseholdAgreement.YES,
        "other_pets": "  Una gata castrada de 3 años  ",
        "previous_pets": "  Siempre tuve gatos  ",
        "hours_alone": AdoptionRequest.HoursAlone.FROM_4_TO_8,
        "living_space": "  Adentro del departamento  ",
        "vacation_care": "  Mi hermana  ",
        "contingency_plan": "  Me la llevo conmigo  ",
        "accepts_commitment": True,
        "accepts_follow_up": True,
        "accepts_return_notice": True,
        "declares_truthful": True,
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
    assert created.outdoor_space == "Balcón con red de protección en todo el frente"
    assert created.household_members == "Vivo sola"
    assert created.previous_pets == "Siempre tuve gatos"
    assert created.living_space == "Adentro del departamento"
    assert created.vacation_care == "Mi hermana"
    assert created.contingency_plan == "Me la llevo conmigo"
    assert created.home_ownership == AdoptionRequest.HomeOwnership.OWNED
    assert created.rental_allows_pets == ""
    assert created.adoption_reason == ""
    assert created.accepts_commitment is True
    assert created.accepts_neutering is None
    assert created.accepts_follow_up is True
    assert created.accepts_return_notice is True
    assert created.declares_truthful is True


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
    [
        "full_name",
        "phone",
        "email",
        "address",
        "city",
        "housing_type",
        "outdoor_space",
        "household_members",
        "other_pets",
        "previous_pets",
        "living_space",
        "vacation_care",
        "contingency_plan",
    ],
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


def test_create_adoption_request_rejects_own_published_pet() -> None:
    publisher = UserFactory()
    pet = PetFactory(published_by=publisher, status=Pet.Status.PUBLISHED)

    with pytest.raises(ValidationError) as exc_info:
        create_adoption_request(
            applicant=publisher,
            pet_id=pet.pk,
            data=_valid_questionnaire_payload(),
        )

    assert exc_info.value.detail["pet"][0] == OWN_PET_ADOPTION_ERROR


def test_get_visible_adoption_request_or_404_hides_from_third_parties() -> None:
    applicant = UserFactory(role__code=RoleCode.MEMBER)
    other_user = UserFactory(role__code=RoleCode.MEMBER)
    staff = UserFactory(role__code=RoleCode.STAFF)
    adoption_request = AdoptionRequestFactory(applicant=applicant)

    assert (
        get_visible_adoption_request_or_404(request_id=adoption_request.pk, actor=applicant)
        == adoption_request
    )
    assert (
        get_visible_adoption_request_or_404(request_id=adoption_request.pk, actor=staff)
        == adoption_request
    )
    with pytest.raises(Http404):
        get_visible_adoption_request_or_404(request_id=adoption_request.pk, actor=other_user)


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


def _create(pet: Pet | None = None, **overrides) -> AdoptionRequest:
    return create_adoption_request(
        applicant=UserFactory(),
        pet_id=(pet or PetFactory(status=Pet.Status.PUBLISHED)).pk,
        data=_valid_questionnaire_payload(**overrides),
    )


@pytest.mark.parametrize(
    ("field_name", "message"),
    [
        ("accepts_follow_up", FOLLOW_UP_REQUIRED_ERROR),
        ("accepts_return_notice", RETURN_NOTICE_REQUIRED_ERROR),
        ("declares_truthful", TRUTHFUL_REQUIRED_ERROR),
    ],
)
def test_create_adoption_request_requires_every_commitment_checkbox(
    field_name: str, message: str
) -> None:
    with pytest.raises(ValidationError) as exc_info:
        _create(**{field_name: False})

    assert exc_info.value.detail[field_name] == [message]


@pytest.mark.parametrize("field_name", ["home_ownership", "household_agreement", "hours_alone"])
def test_create_adoption_request_validates_required_choices(field_name: str) -> None:
    with pytest.raises(ValidationError) as missing_exc:
        _create(**{field_name: ""})
    assert field_name in missing_exc.value.detail

    with pytest.raises(ValidationError) as invalid_exc:
        _create(**{field_name: "otra_cosa"})
    assert invalid_exc.value.detail[field_name] == [INVALID_CHOICE_ERROR]


def test_create_adoption_request_requires_rental_answer_only_when_rented() -> None:
    with pytest.raises(ValidationError) as exc_info:
        _create(home_ownership=AdoptionRequest.HomeOwnership.RENTED)
    assert exc_info.value.detail["rental_allows_pets"] == [RENTAL_ALLOWS_PETS_REQUIRED_ERROR]

    with pytest.raises(ValidationError) as invalid_exc:
        _create(home_ownership=AdoptionRequest.HomeOwnership.RENTED, rental_allows_pets="quizas")
    assert invalid_exc.value.detail["rental_allows_pets"] == [INVALID_CHOICE_ERROR]

    rented = _create(
        home_ownership=AdoptionRequest.HomeOwnership.RENTED,
        rental_allows_pets=AdoptionRequest.RentalPetsPolicy.UNKNOWN,
    )
    assert rented.rental_allows_pets == AdoptionRequest.RentalPetsPolicy.UNKNOWN

    # Si la vivienda no es alquilada, la respuesta sobre el alquiler se descarta.
    owned = _create(
        home_ownership=AdoptionRequest.HomeOwnership.OWNED,
        rental_allows_pets=AdoptionRequest.RentalPetsPolicy.NO,
    )
    assert owned.rental_allows_pets == ""


def test_create_adoption_request_requires_neutering_only_for_unneutered_pets() -> None:
    unneutered_pet = PetFactory(status=Pet.Status.PUBLISHED, is_neutered=False)
    with pytest.raises(ValidationError) as exc_info:
        _create(pet=unneutered_pet)
    assert exc_info.value.detail["accepts_neutering"] == [NEUTERING_REQUIRED_ERROR]

    accepted = _create(pet=unneutered_pet, accepts_neutering=True)
    assert accepted.accepts_neutering is True

    # Si la mascota ya está castrada, el compromiso no aplica y se guarda vacío.
    neutered_pet = PetFactory(status=Pet.Status.PUBLISHED, is_neutered=True)
    neutered = _create(pet=neutered_pet, accepts_neutering=True)
    assert neutered.accepts_neutering is None


def test_create_adoption_request_adoption_reason_is_optional_and_limited() -> None:
    without_reason = _create()
    assert without_reason.adoption_reason == ""

    with_reason = _create(adoption_reason="  Porque me enamoré de su historia  ")
    assert with_reason.adoption_reason == "Porque me enamoré de su historia"

    with pytest.raises(ValidationError) as exc_info:
        _create(adoption_reason="a" * 1001)
    assert "adoption_reason" in exc_info.value.detail


def test_create_adoption_request_limits_open_answers_to_500_characters() -> None:
    with pytest.raises(ValidationError) as exc_info:
        _create(contingency_plan="a" * 501)
    assert "contingency_plan" in exc_info.value.detail


@pytest.mark.parametrize(
    ("role_code", "public_address", "expected"),
    [
        (RoleCode.VERIFIED_SHELTER, "  Sobremonte 1250  ", "Sobremonte 1250"),
        (RoleCode.VERIFIED_SHELTER, "   ", None),
        (RoleCode.MEMBER, "Mi casa 123", None),
        (RoleCode.STAFF, "Oficina 1", None),
        (RoleCode.ADMIN, "Oficina 2", None),
    ],
)
def test_get_public_shelter_address_only_for_verified_shelters(
    role_code: str, public_address: str, expected: str | None
) -> None:
    publisher = UserFactory(
        role__code=role_code,
        address="Dirección privada 999",
        shelter_public_address=public_address,
    )

    assert get_public_shelter_address(publisher) == expected
