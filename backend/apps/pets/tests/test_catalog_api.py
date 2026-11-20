"""Tests de catálogo público, filtros, búsqueda, ficha, listado propio y Swagger (BK-03c)."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.pets.models import Pet
from apps.pets.services import AgeGroup, subtract_years
from apps.pets.tests.factories import PetFactory, PetHealthFactory, PetPhotoFactory
from apps.users.models import RoleCode
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

PETS_URL = "/api/pets/"
MY_PETS_URL = "/api/pets/mine/"


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


# ---------------------------------------------------------------------------
# GET /api/pets/ — Catálogo público por defecto y privacidad
# ---------------------------------------------------------------------------


def test_catalog_returns_only_active_published_pets_without_contact_phone() -> None:
    published = PetFactory(name="Loki", status=Pet.Status.PUBLISHED, contact_phone="3584000001")
    PetHealthFactory(pet=published)
    active_photo = PetPhotoFactory(pet=published, position=0)
    inactive_photo = PetPhotoFactory(pet=published, position=1)
    inactive_photo.deactivate()

    PetFactory(name="EnRevision", status=Pet.Status.IN_REVIEW)
    PetFactory(name="Rechazada", status=Pet.Status.REJECTED)
    PetFactory(name="Adoptada", status=Pet.Status.ADOPTED)
    deactivated = PetFactory(name="Baja", status=Pet.Status.PUBLISHED)
    deactivated.deactivate()

    client = APIClient()
    response = client.get(PETS_URL)

    assert response.status_code == status.HTTP_200_OK
    items = response.json()
    assert [item["id"] for item in items] == [published.id]
    assert "contact_phone" not in items[0]
    assert [photo["id"] for photo in items[0]["photos"]] == [active_photo.id]


# ---------------------------------------------------------------------------
# Filtros con django-filter y búsqueda por nombre
# ---------------------------------------------------------------------------


def test_catalog_filters_by_species_sex_sociability_compatibility_and_neutered() -> None:
    match = PetFactory(
        name="Bora",
        status=Pet.Status.PUBLISHED,
        species=Pet.Species.DOG,
        sex=Pet.Sex.FEMALE,
        is_sociable=True,
        good_with_children=Pet.Compatibility.YES,
        good_with_animals=Pet.Compatibility.YES,
        is_neutered=False,
    )
    PetFactory(
        name="Rocco",
        status=Pet.Status.PUBLISHED,
        species=Pet.Species.DOG,
        sex=Pet.Sex.MALE,
        is_sociable=False,
        good_with_children=Pet.Compatibility.NO,
        good_with_animals=Pet.Compatibility.NO,
        is_neutered=True,
    )
    PetFactory(
        name="Luna",
        status=Pet.Status.PUBLISHED,
        species=Pet.Species.CAT,
        sex=Pet.Sex.FEMALE,
        is_sociable=True,
        good_with_children=Pet.Compatibility.YES,
        good_with_animals=Pet.Compatibility.NOT_EVALUATED,
        is_neutered=True,
    )

    client = APIClient()
    response = client.get(
        PETS_URL,
        {
            "species": Pet.Species.DOG,
            "sex": Pet.Sex.FEMALE,
            "is_sociable": "true",
            "good_with_children": Pet.Compatibility.YES,
            "good_with_animals": Pet.Compatibility.YES,
            "is_neutered": "false",
        },
    )

    assert response.status_code == status.HTTP_200_OK
    assert [item["id"] for item in response.json()] == [match.id]


def test_catalog_filters_by_age_group_including_exact_boundaries() -> None:
    today = timezone.localdate()
    cutoff_1y = subtract_years(today, 1)
    cutoff_7y = subtract_years(today, 7)

    cachorro = PetFactory(
        name="Cachorro",
        status=Pet.Status.PUBLISHED,
        estimated_birth_date=cutoff_1y + timedelta(days=1),
    )
    adulto_min = PetFactory(
        name="Adulto1Ano",
        status=Pet.Status.PUBLISHED,
        estimated_birth_date=cutoff_1y,
    )
    adulto_max = PetFactory(
        name="Adulto7Anos",
        status=Pet.Status.PUBLISHED,
        estimated_birth_date=cutoff_7y,
    )
    senior = PetFactory(
        name="Senior",
        status=Pet.Status.PUBLISHED,
        estimated_birth_date=cutoff_7y - timedelta(days=1),
    )

    client = APIClient()

    res_cachorro = client.get(PETS_URL, {"age_group": AgeGroup.CACHORRO.value})
    assert res_cachorro.status_code == status.HTTP_200_OK
    assert [item["id"] for item in res_cachorro.json()] == [cachorro.id]
    assert res_cachorro.json()[0]["age_group"] == AgeGroup.CACHORRO.value

    res_adulto = client.get(PETS_URL, {"age_group": AgeGroup.ADULTO.value})
    assert res_adulto.status_code == status.HTTP_200_OK
    assert {item["id"] for item in res_adulto.json()} == {adulto_min.id, adulto_max.id}
    assert all(item["age_group"] == AgeGroup.ADULTO.value for item in res_adulto.json())

    res_senior = client.get(PETS_URL, {"age_group": AgeGroup.SENIOR.value})
    assert res_senior.status_code == status.HTTP_200_OK
    assert [item["id"] for item in res_senior.json()] == [senior.id]
    assert res_senior.json()[0]["age_group"] == AgeGroup.SENIOR.value


def test_catalog_urgent_filter_returns_only_validated_and_non_adopted() -> None:
    urgent_ok = PetFactory(
        name="UrgenteValidado",
        status=Pet.Status.PUBLISHED,
        is_urgent_requested=True,
        is_urgent_validated=True,
    )
    PetFactory(
        name="UrgenteSinValidar",
        status=Pet.Status.PUBLISHED,
        is_urgent_requested=True,
        is_urgent_validated=False,
    )
    PetFactory(
        name="AdoptadoUrgente",
        status=Pet.Status.ADOPTED,
        is_urgent_requested=True,
        is_urgent_validated=True,
    )
    PetFactory(
        name="Normal",
        status=Pet.Status.PUBLISHED,
        is_urgent_requested=False,
        is_urgent_validated=False,
    )

    client = APIClient()
    response = client.get(PETS_URL, {"urgent": "true"})

    assert response.status_code == status.HTTP_200_OK
    assert [item["id"] for item in response.json()] == [urgent_ok.id]


def test_catalog_adopted_filter_never_mixes_with_available_pets() -> None:
    available = PetFactory(name="Disponible", status=Pet.Status.PUBLISHED)
    adopted = PetFactory(name="Pancho", status=Pet.Status.ADOPTED)
    PetFactory(name="EnRevision", status=Pet.Status.IN_REVIEW)
    inactive_adopted = PetFactory(name="AdoptadoBaja", status=Pet.Status.ADOPTED)
    inactive_adopted.deactivate()

    client = APIClient()

    res_default = client.get(PETS_URL)
    assert [item["id"] for item in res_default.json()] == [available.id]

    res_adopted = client.get(PETS_URL, {"adopted": "true"})
    assert res_adopted.status_code == status.HTTP_200_OK
    assert [item["id"] for item in res_adopted.json()] == [adopted.id]


def test_catalog_search_by_name_and_rejects_invalid_filter_choice() -> None:
    loki = PetFactory(name="Loki", status=Pet.Status.PUBLISHED)
    PetFactory(name="Luna", status=Pet.Status.PUBLISHED)

    client = APIClient()

    res_search = client.get(PETS_URL, {"search": "  loK  "})
    assert res_search.status_code == status.HTTP_200_OK
    assert [item["id"] for item in res_search.json()] == [loki.id]

    res_invalid = client.get(PETS_URL, {"species": "conejo"})
    assert res_invalid.status_code == status.HTTP_400_BAD_REQUEST
    assert "species" in res_invalid.json()


# ---------------------------------------------------------------------------
# GET /api/pets/{id}/ — Ficha pública y visibilidad por estado/rol
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("public_status", [Pet.Status.PUBLISHED, Pet.Status.ADOPTED])
def test_pet_detail_is_public_for_published_and_adopted_without_contact_phone(
    public_status: str,
) -> None:
    pet = PetFactory(name="Thor", status=public_status, contact_phone="3584999999")
    PetHealthFactory(pet=pet, general_status="Excelente")
    PetPhotoFactory(pet=pet, position=0)

    client = APIClient()
    response = client.get(f"{PETS_URL}{pet.id}/")

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["id"] == pet.id
    assert body["status"] == public_status
    assert body["health"]["general_status"] == "Excelente"
    assert len(body["photos"]) == 1
    assert "contact_phone" not in body


@pytest.mark.parametrize("private_status", [Pet.Status.IN_REVIEW, Pet.Status.REJECTED])
def test_pet_detail_in_review_or_rejected_visible_only_to_owner_staff_and_admin(
    private_status: str,
) -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    other_member = UserFactory(role__code=RoleCode.MEMBER)
    staff = UserFactory(role__code=RoleCode.STAFF)
    admin = UserFactory(role__code=RoleCode.ADMIN)
    pet = PetFactory(published_by=owner, status=private_status)
    PetHealthFactory(pet=pet)

    # Anónimo y otro miembro reciben 404
    assert APIClient().get(f"{PETS_URL}{pet.id}/").status_code == status.HTTP_404_NOT_FOUND
    assert (
        _auth_client(other_member).get(f"{PETS_URL}{pet.id}/").status_code
        == status.HTTP_404_NOT_FOUND
    )

    # Autor, Staff y Admin pueden verla sin exponer contact_phone
    for allowed_user in (owner, staff, admin):
        response = _auth_client(allowed_user).get(f"{PETS_URL}{pet.id}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["id"] == pet.id
        assert "contact_phone" not in response.json()


def test_pet_detail_returns_404_for_soft_deleted_pet() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    pet = PetFactory(published_by=owner, status=Pet.Status.PUBLISHED)
    pet.deactivate()

    assert _auth_client(owner).get(f"{PETS_URL}{pet.id}/").status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# GET /api/pets/mine/ — Listado propio
# ---------------------------------------------------------------------------


def test_my_pets_requires_authentication() -> None:
    response = APIClient().get(MY_PETS_URL)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_my_pets_returns_all_active_statuses_for_owner_and_supports_status_filter() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    other_user = UserFactory(role__code=RoleCode.MEMBER)

    own_in_review = PetFactory(published_by=owner, status=Pet.Status.IN_REVIEW)
    own_published = PetFactory(published_by=owner, status=Pet.Status.PUBLISHED)
    own_rejected = PetFactory(published_by=owner, status=Pet.Status.REJECTED)
    own_adopted = PetFactory(published_by=owner, status=Pet.Status.ADOPTED)
    own_inactive = PetFactory(published_by=owner, status=Pet.Status.PUBLISHED)
    own_inactive.deactivate()

    PetFactory(published_by=other_user, status=Pet.Status.PUBLISHED)

    client = _auth_client(owner)

    res_all = client.get(MY_PETS_URL)
    assert res_all.status_code == status.HTTP_200_OK
    assert {item["id"] for item in res_all.json()} == {
        own_in_review.id,
        own_published.id,
        own_rejected.id,
        own_adopted.id,
    }
    assert all("contact_phone" not in item for item in res_all.json())

    res_filtered = client.get(MY_PETS_URL, {"status": Pet.Status.IN_REVIEW})
    assert res_filtered.status_code == status.HTTP_200_OK
    assert [item["id"] for item in res_filtered.json()] == [own_in_review.id]

    res_invalid = client.get(MY_PETS_URL, {"status": "invalido"})
    assert res_invalid.status_code == status.HTTP_400_BAD_REQUEST


# ---------------------------------------------------------------------------
# Esquema OpenAPI (Swagger)
# ---------------------------------------------------------------------------


def test_catalog_detail_and_mine_endpoints_documented_in_openapi_schema() -> None:
    response = APIClient().get("/api/schema/", {"format": "json"})
    assert response.status_code == status.HTTP_200_OK

    paths = response.json()["paths"]
    assert "get" in paths["/api/pets/"]
    assert "post" in paths["/api/pets/"]
    assert "get" in paths["/api/pets/mine/"]
    assert "get" in paths["/api/pets/{pet_id}/"]

    catalog_params = {param["name"] for param in paths["/api/pets/"]["get"]["parameters"]}
    assert {
        "species",
        "sex",
        "age_group",
        "is_sociable",
        "good_with_children",
        "good_with_animals",
        "is_neutered",
        "urgent",
        "adopted",
        "search",
    }.issubset(catalog_params)
