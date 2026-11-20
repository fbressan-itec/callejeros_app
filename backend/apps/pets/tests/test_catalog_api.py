"""Tests de catálogo público, filtros, paginación, privacidad, ficha, listado propio y Swagger."""

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
# GET /api/pets/ — Catálogo público por defecto, is_urgent y privacidad
# ---------------------------------------------------------------------------


def test_catalog_returns_only_active_published_pets_with_public_fields_only() -> None:
    published_unvalidated = PetFactory(
        name="Loki",
        status=Pet.Status.PUBLISHED,
        contact_phone="3584000001",
        is_urgent_requested=True,
        is_urgent_validated=False,
    )
    PetHealthFactory(pet=published_unvalidated)
    active_photo = PetPhotoFactory(pet=published_unvalidated, position=0)
    inactive_photo = PetPhotoFactory(pet=published_unvalidated, position=1)
    inactive_photo.deactivate()

    PetFactory(name="EnRevision", status=Pet.Status.IN_REVIEW)
    PetFactory(name="Rechazada", status=Pet.Status.REJECTED)
    PetFactory(name="Adoptada", status=Pet.Status.ADOPTED)
    deactivated = PetFactory(name="Baja", status=Pet.Status.PUBLISHED)
    deactivated.deactivate()

    client = APIClient()
    response = client.get(PETS_URL)

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["count"] == 1
    assert body["next"] is None
    assert body["previous"] is None
    items = body["results"]
    assert [item["id"] for item in items] == [published_unvalidated.id]
    assert items[0]["is_urgent"] is False
    assert "is_urgent_requested" not in items[0]
    assert "is_urgent_validated" not in items[0]
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
    assert [item["id"] for item in response.json()["results"]] == [match.id]


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
    cachorro_items = res_cachorro.json()["results"]
    assert [item["id"] for item in cachorro_items] == [cachorro.id]
    assert cachorro_items[0]["age_group"] == AgeGroup.CACHORRO.value

    res_adulto = client.get(PETS_URL, {"age_group": AgeGroup.ADULTO.value})
    assert res_adulto.status_code == status.HTTP_200_OK
    adulto_items = res_adulto.json()["results"]
    assert {item["id"] for item in adulto_items} == {adulto_min.id, adulto_max.id}
    assert all(item["age_group"] == AgeGroup.ADULTO.value for item in adulto_items)

    res_senior = client.get(PETS_URL, {"age_group": AgeGroup.SENIOR.value})
    assert res_senior.status_code == status.HTTP_200_OK
    senior_items = res_senior.json()["results"]
    assert [item["id"] for item in senior_items] == [senior.id]
    assert senior_items[0]["age_group"] == AgeGroup.SENIOR.value


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
    items = response.json()["results"]
    assert [item["id"] for item in items] == [urgent_ok.id]
    assert items[0]["is_urgent"] is True


def test_catalog_adopted_filter_never_mixes_with_available_pets_and_is_urgent_is_false() -> None:
    available = PetFactory(name="Disponible", status=Pet.Status.PUBLISHED)
    adopted = PetFactory(
        name="Pancho",
        status=Pet.Status.ADOPTED,
        is_urgent_requested=True,
        is_urgent_validated=True,
    )
    PetFactory(name="EnRevision", status=Pet.Status.IN_REVIEW)
    inactive_adopted = PetFactory(name="AdoptadoBaja", status=Pet.Status.ADOPTED)
    inactive_adopted.deactivate()

    client = APIClient()

    res_default = client.get(PETS_URL)
    assert [item["id"] for item in res_default.json()["results"]] == [available.id]

    res_adopted = client.get(PETS_URL, {"adopted": "true"})
    assert res_adopted.status_code == status.HTTP_200_OK
    adopted_items = res_adopted.json()["results"]
    assert [item["id"] for item in adopted_items] == [adopted.id]
    assert adopted_items[0]["is_urgent"] is False


def test_catalog_search_by_name_and_rejects_invalid_filter_choice() -> None:
    loki = PetFactory(name="Loki", status=Pet.Status.PUBLISHED)
    PetFactory(name="Luna", status=Pet.Status.PUBLISHED)

    client = APIClient()

    res_search = client.get(PETS_URL, {"search": "  loK  "})
    assert res_search.status_code == status.HTTP_200_OK
    assert [item["id"] for item in res_search.json()["results"]] == [loki.id]

    res_invalid = client.get(PETS_URL, {"species": "conejo"})
    assert res_invalid.status_code == status.HTTP_400_BAD_REQUEST
    assert "species" in res_invalid.json()


# ---------------------------------------------------------------------------
# Paginación (12 resultados por página) en catálogo y listado propio
# ---------------------------------------------------------------------------


def test_catalog_paginates_by_12_and_combines_with_filters() -> None:
    for idx in range(14):
        PetFactory(
            name=f"Perro {idx}",
            species=Pet.Species.DOG,
            status=Pet.Status.PUBLISHED,
        )
    for idx in range(3):
        PetFactory(
            name=f"Gato {idx}",
            species=Pet.Species.CAT,
            status=Pet.Status.PUBLISHED,
        )

    client = APIClient()

    # Página 1 del catálogo completo (17 totales -> 12 en página 1, 5 en página 2)
    page_1 = client.get(PETS_URL)
    assert page_1.status_code == status.HTTP_200_OK
    body_1 = page_1.json()
    assert body_1["count"] == 17
    assert len(body_1["results"]) == 12
    assert body_1["previous"] is None
    assert body_1["next"] is not None

    page_2 = client.get(PETS_URL, {"page": 2})
    assert page_2.status_code == status.HTTP_200_OK
    body_2 = page_2.json()
    assert body_2["count"] == 17
    assert len(body_2["results"]) == 5
    assert body_2["previous"] is not None
    assert body_2["next"] is None

    # Filtro + página (14 perros -> 12 en página 1, 2 en página 2)
    filtered_page_2 = client.get(PETS_URL, {"species": Pet.Species.DOG, "page": 2})
    assert filtered_page_2.status_code == status.HTTP_200_OK
    filtered_body = filtered_page_2.json()
    assert filtered_body["count"] == 14
    assert len(filtered_body["results"]) == 2
    assert all(item["species"] == Pet.Species.DOG for item in filtered_body["results"])


def test_my_pets_paginates_by_12() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    for idx in range(14):
        PetFactory(name=f"Mia {idx}", published_by=owner, status=Pet.Status.IN_REVIEW)

    client = _auth_client(owner)

    page_1 = client.get(MY_PETS_URL)
    assert page_1.status_code == status.HTTP_200_OK
    assert page_1.json()["count"] == 14
    assert len(page_1.json()["results"]) == 12
    assert page_1.json()["next"] is not None

    page_2 = client.get(MY_PETS_URL, {"page": 2})
    assert page_2.status_code == status.HTTP_200_OK
    assert page_2.json()["count"] == 14
    assert len(page_2.json()["results"]) == 2
    assert page_2.json()["previous"] is not None
    assert page_2.json()["next"] is None


# ---------------------------------------------------------------------------
# GET /api/pets/{id}/ — Ficha pública, visibilidad y contact_phone por rol
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("public_status", [Pet.Status.PUBLISHED, Pet.Status.ADOPTED])
def test_pet_detail_hides_contact_phone_and_internal_flags_from_public_and_other_members(
    public_status: str,
) -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    other_member = UserFactory(role__code=RoleCode.MEMBER)
    pet = PetFactory(
        name="Thor",
        published_by=owner,
        status=public_status,
        contact_phone="3584999999",
        is_urgent_requested=True,
        is_urgent_validated=False,
    )
    PetHealthFactory(pet=pet, general_status="Excelente")
    PetPhotoFactory(pet=pet, position=0)

    for client in (APIClient(), _auth_client(other_member)):
        response = client.get(f"{PETS_URL}{pet.id}/")
        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["id"] == pet.id
        assert body["status"] == public_status
        assert body["health"]["general_status"] == "Excelente"
        assert len(body["photos"]) == 1
        assert body["is_urgent"] is False
        assert "contact_phone" not in body
        assert "is_urgent_requested" not in body
        assert "is_urgent_validated" not in body


def test_pet_detail_exposes_contact_phone_to_owner_staff_and_admin() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    staff = UserFactory(role__code=RoleCode.STAFF)
    admin = UserFactory(role__code=RoleCode.ADMIN)
    pet = PetFactory(
        name="Loki",
        published_by=owner,
        status=Pet.Status.PUBLISHED,
        contact_phone="3584888777",
        is_urgent_requested=True,
        is_urgent_validated=False,
    )
    PetHealthFactory(pet=pet)

    for allowed_user in (owner, staff, admin):
        response = _auth_client(allowed_user).get(f"{PETS_URL}{pet.id}/")
        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["contact_phone"] == "3584888777"
        assert body["is_urgent_requested"] is True
        assert body["is_urgent_validated"] is False
        assert body["is_urgent"] is False


@pytest.mark.parametrize("private_status", [Pet.Status.IN_REVIEW, Pet.Status.REJECTED])
def test_pet_detail_in_review_or_rejected_visible_only_to_owner_staff_and_admin(
    private_status: str,
) -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    other_member = UserFactory(role__code=RoleCode.MEMBER)
    staff = UserFactory(role__code=RoleCode.STAFF)
    admin = UserFactory(role__code=RoleCode.ADMIN)
    pet = PetFactory(published_by=owner, status=private_status, contact_phone="3584777666")
    PetHealthFactory(pet=pet)

    # Anónimo y otro miembro reciben 404
    assert APIClient().get(f"{PETS_URL}{pet.id}/").status_code == status.HTTP_404_NOT_FOUND
    assert (
        _auth_client(other_member).get(f"{PETS_URL}{pet.id}/").status_code
        == status.HTTP_404_NOT_FOUND
    )

    # Autor, Staff y Admin pueden verla con contact_phone para edición/gestión
    for allowed_user in (owner, staff, admin):
        response = _auth_client(allowed_user).get(f"{PETS_URL}{pet.id}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["id"] == pet.id
        assert response.json()["contact_phone"] == "3584777666"


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


def test_my_pets_returns_all_active_statuses_for_owner_with_contact_phone() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    other_user = UserFactory(role__code=RoleCode.MEMBER)

    own_in_review = PetFactory(
        published_by=owner,
        status=Pet.Status.IN_REVIEW,
        contact_phone="3584111222",
    )
    own_published = PetFactory(
        published_by=owner,
        status=Pet.Status.PUBLISHED,
        contact_phone="3584111222",
    )
    own_rejected = PetFactory(
        published_by=owner,
        status=Pet.Status.REJECTED,
        contact_phone="3584111222",
    )
    own_adopted = PetFactory(
        published_by=owner,
        status=Pet.Status.ADOPTED,
        contact_phone="3584111222",
    )
    own_inactive = PetFactory(published_by=owner, status=Pet.Status.PUBLISHED)
    own_inactive.deactivate()

    PetFactory(published_by=other_user, status=Pet.Status.PUBLISHED)

    client = _auth_client(owner)

    res_all = client.get(MY_PETS_URL)
    assert res_all.status_code == status.HTTP_200_OK
    items = res_all.json()["results"]
    assert res_all.json()["count"] == 4
    assert {item["id"] for item in items} == {
        own_in_review.id,
        own_published.id,
        own_rejected.id,
        own_adopted.id,
    }
    assert all(item["contact_phone"] == "3584111222" for item in items)

    res_filtered = client.get(MY_PETS_URL, {"status": Pet.Status.IN_REVIEW})
    assert res_filtered.status_code == status.HTTP_200_OK
    assert [item["id"] for item in res_filtered.json()["results"]] == [own_in_review.id]

    res_invalid = client.get(MY_PETS_URL, {"status": "invalido"})
    assert res_invalid.status_code == status.HTTP_400_BAD_REQUEST


# ---------------------------------------------------------------------------
# Esquema OpenAPI (Swagger)
# ---------------------------------------------------------------------------


def test_catalog_detail_and_mine_endpoints_documented_in_openapi_schema() -> None:
    response = APIClient().get("/api/schema/", {"format": "json"})
    assert response.status_code == status.HTTP_200_OK

    schema = response.json()
    paths = schema["paths"]
    assert "get" in paths["/api/pets/"]
    assert "post" in paths["/api/pets/"]
    assert "get" in paths["/api/pets/mine/"]
    assert "get" in paths["/api/pets/{pet_id}/"]

    catalog_params = {param["name"] for param in paths["/api/pets/"]["get"]["parameters"]}
    assert {
        "page",
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

    mine_params = {param["name"] for param in paths["/api/pets/mine/"]["get"]["parameters"]}
    assert {"page", "status"}.issubset(mine_params)

    paginated_public = schema["components"]["schemas"]["PaginatedPetPublic"]
    assert {"count", "next", "previous", "results"}.issubset(paginated_public["properties"])
