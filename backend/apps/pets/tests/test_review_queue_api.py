"""Tests de la cola de revisión del panel de Staff (BK-06c): servicio y endpoint."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient

from apps.pets.models import Pet
from apps.pets.services import get_review_queue_queryset
from apps.pets.tests.factories import PetFactory, PetHealthFactory, PetPhotoFactory
from apps.users.models import RoleCode
from apps.users.permissions import FORBIDDEN_ERROR_MESSAGE
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

QUEUE_URL = "/api/pets/review-queue/"


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _pet(*, created_days_ago: int = 0, **kwargs) -> Pet:
    pet = PetFactory(**kwargs)
    PetHealthFactory(pet=pet)
    PetPhotoFactory(pet=pet, position=0)
    if created_days_ago:
        # `created_at` usa auto_now_add: se ajusta después de crear para simular la espera.
        Pet.objects.filter(pk=pet.pk).update(
            created_at=timezone.now() - timedelta(days=created_days_ago),
        )
    return pet


@pytest.mark.parametrize("role_code", [RoleCode.STAFF, RoleCode.ADMIN])
def test_queue_lists_only_active_pets_in_review(role_code: str) -> None:
    reviewer = UserFactory(role__code=role_code)
    in_review = _pet(status=Pet.Status.IN_REVIEW)
    _pet(status=Pet.Status.PUBLISHED)
    _pet(status=Pet.Status.REJECTED)
    _pet(status=Pet.Status.ADOPTED)
    _pet(status=Pet.Status.IN_REVIEW, is_active=False)

    response = _auth_client(reviewer).get(QUEUE_URL)

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["count"] == 1
    assert [item["id"] for item in body["results"]] == [in_review.id]


def test_queue_orders_urgent_requests_first_then_oldest_first() -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    normal_old = _pet(created_days_ago=5)
    normal_new = _pet(created_days_ago=1)
    urgent_new = _pet(created_days_ago=2, is_urgent_requested=True)
    urgent_old = _pet(created_days_ago=4, is_urgent_requested=True)

    response = _auth_client(reviewer).get(QUEUE_URL)

    ids = [item["id"] for item in response.json()["results"]]
    assert ids == [urgent_old.id, urgent_new.id, normal_old.id, normal_new.id]


def test_queue_returns_management_data_needed_for_review() -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    author = UserFactory(role__code=RoleCode.VERIFIED_SHELTER)
    pet = _pet(
        published_by=author,
        is_urgent_requested=True,
        contact_phone="+54 9 358 4222222",
    )

    item = _auth_client(reviewer).get(QUEUE_URL).json()["results"][0]

    assert item["id"] == pet.id
    assert item["status"] == Pet.Status.IN_REVIEW
    assert item["contact_phone"] == "+54 9 358 4222222"
    assert item["is_urgent_requested"] is True
    assert item["is_urgent_validated"] is False
    assert item["published_by"]["id"] == author.id
    assert item["published_by"]["role"]["code"] == RoleCode.VERIFIED_SHELTER
    assert len(item["photos"]) == 1
    assert "health" in item


def test_queue_paginates_by_12() -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    for _ in range(13):
        _pet()
    client = _auth_client(reviewer)

    page_1 = client.get(QUEUE_URL).json()
    page_2 = client.get(QUEUE_URL, {"page": 2}).json()

    assert page_1["count"] == 13
    assert len(page_1["results"]) == 12
    assert page_1["next"] is not None
    assert len(page_2["results"]) == 1
    assert page_2["next"] is None


def test_queue_is_empty_when_nothing_waits_for_review() -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    _pet(status=Pet.Status.PUBLISHED)

    body = _auth_client(reviewer).get(QUEUE_URL).json()

    assert body["count"] == 0
    assert body["results"] == []


def test_approved_pet_leaves_the_queue() -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    pet = _pet()
    client = _auth_client(reviewer)
    assert client.get(QUEUE_URL).json()["count"] == 1

    client.post(f"/api/pets/{pet.id}/approve/", {}, format="json")

    assert client.get(QUEUE_URL).json()["count"] == 0


# ---------------------------------------------------------------------------
# Permisos
# ---------------------------------------------------------------------------


def test_queue_requires_authentication() -> None:
    response = APIClient().get(QUEUE_URL)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.parametrize("role_code", [RoleCode.MEMBER, RoleCode.VERIFIED_SHELTER])
def test_queue_forbidden_for_member_and_verified_shelter(role_code: str) -> None:
    user = UserFactory(role__code=role_code)
    _pet(published_by=user)

    response = _auth_client(user).get(QUEUE_URL)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["detail"] == FORBIDDEN_ERROR_MESSAGE


def test_queue_service_also_checks_role() -> None:
    """La regla vive en el servicio: aunque se llame sin pasar por la vista, controla el rol."""
    member = UserFactory(role__code=RoleCode.MEMBER)

    with pytest.raises(PermissionDenied):
        get_review_queue_queryset(actor=member)


def test_queue_endpoint_is_documented_in_openapi_schema() -> None:
    response = APIClient().get("/api/schema/", {"format": "json"})

    assert response.status_code == status.HTTP_200_OK
    operation = response.json()["paths"]["/api/pets/review-queue/"]["get"]
    assert "IsStaffOrAdmin" in operation["description"]
    assert {"200", "401", "403"} <= set(operation["responses"])
    assert "page" in {param["name"] for param in operation["parameters"]}
