"""Tests de integración de los endpoints de revisión de mascotas (BK-06a)."""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.core.review import DEFAULT_REJECT_NOTE, ONLY_IN_REVIEW_ERROR
from apps.pets.models import Pet, PetStatusLog
from apps.pets.tests.factories import (
    PetFactory,
    PetHealthFactory,
    PetPhotoFactory,
    make_test_image_file,
)
from apps.users.models import RoleCode
from apps.users.permissions import FORBIDDEN_ERROR_MESSAGE
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

PETS_URL = "/api/pets/"
REVIEW_ACTIONS = ["approve", "reject"]


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _pet_in_review(**kwargs) -> Pet:
    pet = PetFactory(status=Pet.Status.IN_REVIEW, **kwargs)
    PetHealthFactory(pet=pet)
    PetPhotoFactory(pet=pet, position=0)
    return pet


def _review_url(pet_id: int, action: str) -> str:
    return f"{PETS_URL}{pet_id}/{action}/"


@pytest.mark.parametrize("role_code", [RoleCode.STAFF, RoleCode.ADMIN])
def test_approve_publishes_pet_and_shows_it_in_catalog(role_code: str) -> None:
    reviewer = UserFactory(role__code=role_code)
    pet = _pet_in_review()

    response = _auth_client(reviewer).post(
        _review_url(pet.id, "approve"),
        {"note": "Datos y fotos verificados."},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == Pet.Status.PUBLISHED

    log = PetStatusLog.objects.filter(pet=pet).latest("id")
    assert log.previous_status == Pet.Status.IN_REVIEW
    assert log.new_status == Pet.Status.PUBLISHED
    assert log.performed_by_id == reviewer.id
    assert log.note == "Datos y fotos verificados."

    catalog_ids = [item["id"] for item in APIClient().get(PETS_URL).json()["results"]]
    assert pet.id in catalog_ids


@pytest.mark.parametrize("role_code", [RoleCode.STAFF, RoleCode.ADMIN])
def test_reject_sets_rejected_with_reason_and_keeps_pet_out_of_catalog(role_code: str) -> None:
    reviewer = UserFactory(role__code=role_code)
    pet = _pet_in_review()

    response = _auth_client(reviewer).post(
        _review_url(pet.id, "reject"),
        {"note": "La foto no corresponde a la mascota."},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == Pet.Status.REJECTED

    log = PetStatusLog.objects.filter(pet=pet).latest("id")
    assert log.new_status == Pet.Status.REJECTED
    assert log.performed_by_id == reviewer.id
    assert log.note == "La foto no corresponde a la mascota."

    catalog_ids = [item["id"] for item in APIClient().get(PETS_URL).json()["results"]]
    assert pet.id not in catalog_ids


def test_reject_without_body_saves_generic_reason() -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    pet = _pet_in_review()

    response = _auth_client(reviewer).post(_review_url(pet.id, "reject"), {}, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert PetStatusLog.objects.filter(pet=pet).latest("id").note == DEFAULT_REJECT_NOTE


@pytest.mark.parametrize("action", REVIEW_ACTIONS)
def test_review_requires_authentication(action: str) -> None:
    pet = _pet_in_review()

    response = APIClient().post(_review_url(pet.id, action), {}, format="json")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    pet.refresh_from_db()
    assert pet.status == Pet.Status.IN_REVIEW


@pytest.mark.parametrize("action", REVIEW_ACTIONS)
@pytest.mark.parametrize("role_code", [RoleCode.MEMBER, RoleCode.VERIFIED_SHELTER])
def test_review_forbidden_for_member_and_verified_shelter_even_if_author(
    action: str,
    role_code: str,
) -> None:
    author = UserFactory(role__code=role_code)
    pet = _pet_in_review(published_by=author)

    response = _auth_client(author).post(_review_url(pet.id, action), {}, format="json")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["detail"] == FORBIDDEN_ERROR_MESSAGE
    pet.refresh_from_db()
    assert pet.status == Pet.Status.IN_REVIEW


@pytest.mark.parametrize("action", REVIEW_ACTIONS)
@pytest.mark.parametrize(
    "initial_status",
    [Pet.Status.PUBLISHED, Pet.Status.REJECTED, Pet.Status.ADOPTED],
)
def test_review_returns_400_when_pet_is_not_in_review(action: str, initial_status: str) -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    pet = PetFactory(status=initial_status)

    response = _auth_client(reviewer).post(_review_url(pet.id, action), {}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["status"] == [ONLY_IN_REVIEW_ERROR]
    pet.refresh_from_db()
    assert pet.status == initial_status


@pytest.mark.parametrize("action", REVIEW_ACTIONS)
def test_review_returns_404_for_soft_deleted_or_missing_pet(action: str) -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    pet = PetFactory(is_active=False)
    client = _auth_client(reviewer)

    assert client.post(_review_url(pet.id, action), {}).status_code == 404
    assert client.post(_review_url(999999, action), {}).status_code == 404


@pytest.mark.parametrize("action", REVIEW_ACTIONS)
def test_review_rejects_reason_longer_than_255_characters(action: str) -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    pet = _pet_in_review()

    response = _auth_client(reviewer).post(
        _review_url(pet.id, action),
        {"note": "x" * 256},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "note" in response.json()
    pet.refresh_from_db()
    assert pet.status == Pet.Status.IN_REVIEW


def test_staff_can_approve_own_publication() -> None:
    """Decisión 2026-11-22: se permite y queda en el historial quién aprobó."""
    staff = UserFactory(role__code=RoleCode.STAFF)
    pet = _pet_in_review(published_by=staff)

    response = _auth_client(staff).post(_review_url(pet.id, "approve"), {}, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert PetStatusLog.objects.filter(pet=pet).latest("id").performed_by_id == staff.id


def test_review_endpoints_are_documented_in_openapi_schema() -> None:
    response = APIClient().get("/api/schema/", {"format": "json"})

    assert response.status_code == status.HTTP_200_OK
    paths = response.json()["paths"]
    for action in REVIEW_ACTIONS:
        operation = paths[f"/api/pets/{{pet_id}}/{action}/"]["post"]
        assert "IsStaffOrAdmin" in operation["description"]
        assert {"200", "400", "401", "403", "404"} <= set(operation["responses"])


# ---------------------------------------------------------------------------
# Alta: solo Admin publica sin revisión (decisión 2026-11-22)
# ---------------------------------------------------------------------------


def _create_payload(**overrides) -> dict:
    payload = {
        "name": "Lola",
        "species": Pet.Species.CAT,
        "sex": Pet.Sex.FEMALE,
        "estimated_birth_date": "2024-01-10",
        "is_sociable": "true",
        "is_neutered": "true",
        "is_urgent_requested": "true",
        "description": "Gatita rescatada en barrio Centro.",
        "contact_phone": "+54 9 358 4111111",
        "photos": [make_test_image_file()],
    }
    payload.update(overrides)
    return payload


@pytest.mark.parametrize("urgent", ["true", "false"])
def test_admin_creates_pet_published_directly_with_urgency_validated(urgent: str) -> None:
    admin = UserFactory(role__code=RoleCode.ADMIN)

    response = _auth_client(admin).post(
        PETS_URL,
        _create_payload(is_urgent_requested=urgent),
        format="multipart",
    )

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["status"] == Pet.Status.PUBLISHED
    assert body["is_urgent_validated"] is (urgent == "true")
    assert body["is_urgent"] is (urgent == "true")

    log = PetStatusLog.objects.get(pet_id=body["id"])
    assert log.previous_status == ""
    assert log.new_status == Pet.Status.PUBLISHED
    assert log.performed_by_id == admin.id
    assert log.note == "Publicada directamente por Admin, sin revisión."

    catalog_ids = [item["id"] for item in APIClient().get(PETS_URL).json()["results"]]
    assert body["id"] in catalog_ids


@pytest.mark.parametrize(
    "role_code",
    [RoleCode.MEMBER, RoleCode.VERIFIED_SHELTER, RoleCode.STAFF],
)
def test_non_admin_creates_pet_in_review_without_validated_urgency(role_code: str) -> None:
    author = UserFactory(role__code=role_code)

    response = _auth_client(author).post(PETS_URL, _create_payload(), format="multipart")

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["status"] == Pet.Status.IN_REVIEW
    assert body["is_urgent_requested"] is True
    assert body["is_urgent_validated"] is False

    log = PetStatusLog.objects.get(pet_id=body["id"])
    assert log.new_status == Pet.Status.IN_REVIEW
    assert log.note == "Alta inicial de la publicación."

    catalog_ids = [item["id"] for item in APIClient().get(PETS_URL).json()["results"]]
    assert body["id"] not in catalog_ids
