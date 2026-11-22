"""Tests de la validación del caso urgente por Staff (BK-06b): servicio y endpoint."""

import pytest
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient

from apps.pets.models import Pet, PetStatusLog
from apps.pets.serializers import URGENCY_VALIDATED_REQUIRED_ERROR
from apps.pets.services import (
    URGENCY_INVALID_STATUS_ERROR,
    URGENCY_NOT_REQUESTED_ERROR,
    URGENCY_UNVALIDATED_NOTE,
    URGENCY_VALIDATED_NOTE,
    set_pet_urgency,
)
from apps.pets.tests.factories import PetFactory, PetHealthFactory, PetPhotoFactory
from apps.users.models import RoleCode
from apps.users.permissions import FORBIDDEN_ERROR_MESSAGE
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

PETS_URL = "/api/pets/"


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _urgency_url(pet_id: int) -> str:
    return f"{PETS_URL}{pet_id}/urgency/"


def _urgent_pet(**kwargs) -> Pet:
    defaults = {"is_urgent_requested": True, "status": Pet.Status.PUBLISHED}
    defaults.update(kwargs)
    pet = PetFactory(**defaults)
    PetHealthFactory(pet=pet)
    PetPhotoFactory(pet=pet, position=0)
    return pet


def _catalog_item(pet_id: int) -> dict | None:
    results = APIClient().get(PETS_URL).json()["results"]
    return next((item for item in results if item["id"] == pet_id), None)


# ---------------------------------------------------------------------------
# Validar y quitar la validación
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("role_code", [RoleCode.STAFF, RoleCode.ADMIN])
@pytest.mark.parametrize("pet_status", [Pet.Status.IN_REVIEW, Pet.Status.PUBLISHED])
def test_staff_and_admin_validate_requested_urgency(role_code: str, pet_status: str) -> None:
    reviewer = UserFactory(role__code=role_code)
    pet = _urgent_pet(status=pet_status)

    response = _auth_client(reviewer).post(
        _urgency_url(pet.id),
        {"validated": True},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["is_urgent_validated"] is True
    pet.refresh_from_db()
    assert pet.is_urgent_validated is True
    assert pet.status == pet_status

    log = PetStatusLog.objects.filter(pet=pet).latest("id")
    assert log.previous_status == log.new_status == pet_status
    assert log.performed_by_id == reviewer.id
    assert log.note == URGENCY_VALIDATED_NOTE


def test_validated_urgency_shows_badge_and_filter_in_catalog() -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    pet = _urgent_pet()
    assert _catalog_item(pet.id)["is_urgent"] is False

    _auth_client(reviewer).post(_urgency_url(pet.id), {"validated": True}, format="json")

    assert _catalog_item(pet.id)["is_urgent"] is True
    urgent_results = APIClient().get(PETS_URL, {"urgent": "true"}).json()["results"]
    assert pet.id in [item["id"] for item in urgent_results]


def test_staff_can_remove_validation_and_badge_disappears() -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    pet = _urgent_pet(is_urgent_validated=True)
    assert _catalog_item(pet.id)["is_urgent"] is True

    response = _auth_client(reviewer).post(
        _urgency_url(pet.id),
        {"validated": False},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    pet.refresh_from_db()
    assert pet.is_urgent_validated is False
    assert PetStatusLog.objects.filter(pet=pet).latest("id").note == URGENCY_UNVALIDATED_NOTE
    assert _catalog_item(pet.id)["is_urgent"] is False


@pytest.mark.parametrize("validated", [True, False])
def test_same_value_returns_200_without_changes_or_log(validated: bool) -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    pet = _urgent_pet(is_urgent_validated=validated)
    logs_before = PetStatusLog.objects.filter(pet=pet).count()

    response = _auth_client(reviewer).post(
        _urgency_url(pet.id),
        {"validated": validated},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["is_urgent_validated"] is validated
    assert PetStatusLog.objects.filter(pet=pet).count() == logs_before


# ---------------------------------------------------------------------------
# Casos inválidos
# ---------------------------------------------------------------------------


def test_cannot_validate_urgency_not_requested_by_author() -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    pet = _urgent_pet(is_urgent_requested=False)

    response = _auth_client(reviewer).post(
        _urgency_url(pet.id),
        {"validated": True},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["is_urgent_requested"] == [URGENCY_NOT_REQUESTED_ERROR]
    pet.refresh_from_db()
    assert pet.is_urgent_validated is False


@pytest.mark.parametrize("pet_status", [Pet.Status.ADOPTED, Pet.Status.REJECTED])
@pytest.mark.parametrize("validated", [True, False])
def test_cannot_change_urgency_of_adopted_or_rejected_pets(
    pet_status: str,
    validated: bool,
) -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    pet = _urgent_pet(status=pet_status, is_urgent_validated=not validated)

    response = _auth_client(reviewer).post(
        _urgency_url(pet.id),
        {"validated": validated},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["status"] == [URGENCY_INVALID_STATUS_ERROR]
    pet.refresh_from_db()
    assert pet.is_urgent_validated is (not validated)


@pytest.mark.parametrize("payload", [{}, {"validated": "quizas"}, {"validated": None}])
def test_validated_field_is_required_and_boolean(payload: dict) -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    pet = _urgent_pet()

    response = _auth_client(reviewer).post(_urgency_url(pet.id), payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["validated"] == [URGENCY_VALIDATED_REQUIRED_ERROR]


def test_urgency_returns_404_for_soft_deleted_or_missing_pet() -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    pet = _urgent_pet(is_active=False)
    client = _auth_client(reviewer)

    assert client.post(_urgency_url(pet.id), {"validated": True}, format="json").status_code == 404
    assert client.post(_urgency_url(999999), {"validated": True}, format="json").status_code == 404


# ---------------------------------------------------------------------------
# Permisos
# ---------------------------------------------------------------------------


def test_urgency_requires_authentication() -> None:
    pet = _urgent_pet()

    response = APIClient().post(_urgency_url(pet.id), {"validated": True}, format="json")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.parametrize("role_code", [RoleCode.MEMBER, RoleCode.VERIFIED_SHELTER])
def test_urgency_forbidden_for_member_and_verified_shelter_even_if_author(role_code: str) -> None:
    author = UserFactory(role__code=role_code)
    pet = _urgent_pet(published_by=author)

    response = _auth_client(author).post(_urgency_url(pet.id), {"validated": True}, format="json")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["detail"] == FORBIDDEN_ERROR_MESSAGE
    pet.refresh_from_db()
    assert pet.is_urgent_validated is False


def test_urgency_service_also_checks_role() -> None:
    """La regla vive en el servicio: aunque se llame sin pasar por la vista, controla el rol."""
    member = UserFactory(role__code=RoleCode.MEMBER)
    pet = _urgent_pet(published_by=member)

    with pytest.raises(PermissionDenied):
        set_pet_urgency(pet=pet, actor=member, validated=True)


def test_urgency_endpoint_is_documented_in_openapi_schema() -> None:
    response = APIClient().get("/api/schema/", {"format": "json"})

    assert response.status_code == status.HTTP_200_OK
    operation = response.json()["paths"]["/api/pets/{pet_id}/urgency/"]["post"]
    assert "IsStaffOrAdmin" in operation["description"]
    assert {"200", "400", "401", "403", "404"} <= set(operation["responses"])
