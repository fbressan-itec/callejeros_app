"""Tests de integración de insignias calculadas en la API de mascotas y Swagger (BK-04b)."""

import json
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.pets.badges import BadgeIcon, BadgeKey, BadgeTone, get_pet_badges, subtract_years
from apps.pets.models import Pet
from apps.pets.tests.factories import PetFactory, make_test_image_file
from apps.users.models import RoleCode
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

PETS_URL = "/api/pets/"
MY_PETS_URL = "/api/pets/mine/"


def _pet_detail_url(pet_id: int) -> str:
    return f"/api/pets/{pet_id}/"


def _pet_adopt_url(pet_id: int) -> str:
    return f"/api/pets/{pet_id}/adopt/"


def _pet_urgency_url(pet_id: int) -> str:
    return f"/api/pets/{pet_id}/urgency/"


def test_catalog_exposes_calculated_badges_for_published_and_adopted_pets() -> None:
    today = timezone.localdate()
    urgent_pet = PetFactory(
        name="Milo",
        species=Pet.Species.DOG,
        sex=Pet.Sex.MALE,
        estimated_birth_date=subtract_years(today, 2),
        is_sociable=True,
        good_with_children=Pet.Compatibility.YES,
        good_with_animals=Pet.Compatibility.NO,
        is_neutered=False,
        is_urgent_requested=True,
        is_urgent_validated=True,
        special_care="Dieta renal",
        status=Pet.Status.PUBLISHED,
    )
    unvalidated_urgent_pet = PetFactory(
        name="Kira",
        is_urgent_requested=True,
        is_urgent_validated=False,
        status=Pet.Status.PUBLISHED,
    )
    adopted_pet = PetFactory(
        name="Toby",
        is_urgent_requested=True,
        is_urgent_validated=True,
        status=Pet.Status.ADOPTED,
    )

    client = APIClient()

    res_published = client.get(PETS_URL)
    assert res_published.status_code == status.HTTP_200_OK
    by_id = {item["id"]: item for item in res_published.json()["results"]}

    assert by_id[urgent_pet.id]["badges"] == get_pet_badges(urgent_pet)
    assert [badge["key"] for badge in by_id[urgent_pet.id]["badges"]] == [
        BadgeKey.URGENT.value,
        BadgeKey.SPECIES.value,
        BadgeKey.SEX.value,
        BadgeKey.AGE.value,
        BadgeKey.SOCIABILITY.value,
        BadgeKey.CHILDREN.value,
        BadgeKey.ANIMALS.value,
        BadgeKey.NEUTERED.value,
        BadgeKey.SPECIAL_CARE.value,
    ]
    assert BadgeKey.URGENT.value not in [
        badge["key"] for badge in by_id[unvalidated_urgent_pet.id]["badges"]
    ]

    res_adopted = client.get(PETS_URL, {"adopted": "true"})
    assert res_adopted.status_code == status.HTTP_200_OK
    adopted_results = res_adopted.json()["results"]
    assert len(adopted_results) == 1
    assert adopted_results[0]["id"] == adopted_pet.id
    assert adopted_results[0]["badges"][0] == {
        "key": BadgeKey.ADOPTED.value,
        "tone": BadgeTone.ORANGE.value,
        "icon": BadgeIcon.ADOPTED.value,
        "text": "¡Ya encontró hogar! 🧡",
    }
    assert BadgeKey.URGENT.value not in [badge["key"] for badge in adopted_results[0]["badges"]]


def test_pet_detail_and_mine_expose_calculated_badges() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    published_pet = PetFactory(
        published_by=owner,
        species=Pet.Species.CAT,
        sex=Pet.Sex.FEMALE,
        is_neutered=True,
        status=Pet.Status.PUBLISHED,
    )
    in_review_pet = PetFactory(
        published_by=owner,
        is_urgent_requested=True,
        is_urgent_validated=False,
        status=Pet.Status.IN_REVIEW,
    )

    anon_response = APIClient().get(_pet_detail_url(published_pet.id))
    assert anon_response.status_code == status.HTTP_200_OK
    assert anon_response.json()["badges"] == get_pet_badges(published_pet)

    auth_client = APIClient()
    auth_client.force_authenticate(user=owner)

    owner_detail = auth_client.get(_pet_detail_url(published_pet.id))
    assert owner_detail.status_code == status.HTTP_200_OK
    assert owner_detail.json()["badges"] == get_pet_badges(published_pet)

    mine_response = auth_client.get(MY_PETS_URL)
    assert mine_response.status_code == status.HTTP_200_OK
    mine_by_id = {item["id"]: item for item in mine_response.json()["results"]}
    assert mine_by_id[published_pet.id]["badges"] == get_pet_badges(published_pet)
    assert mine_by_id[in_review_pet.id]["badges"] == get_pet_badges(in_review_pet)


def test_create_pet_calculates_badges_and_ignores_client_supplied_badges(
    settings: pytest.TempPathFactory,
    tmp_path: pytest.TempPathFactory,
) -> None:
    settings.MEDIA_ROOT = tmp_path
    member = UserFactory(role__code=RoleCode.MEMBER)
    client = APIClient()
    client.force_authenticate(user=member)

    birth_date = (timezone.localdate() - timedelta(days=180)).isoformat()
    fake_badges = json.dumps(
        [{"key": "urgent", "tone": "urgent", "icon": "urgent", "text": "Falso"}]
    )

    response = client.post(
        PETS_URL,
        {
            "name": "Nube",
            "species": Pet.Species.CAT,
            "sex": Pet.Sex.FEMALE,
            "estimated_birth_date": birth_date,
            "is_sociable": "false",
            "good_with_children": Pet.Compatibility.NOT_EVALUATED,
            "good_with_animals": Pet.Compatibility.YES,
            "is_neutered": "false",
            "is_urgent_requested": "true",
            "description": "Gatita rescatada en el centro.",
            "contact_phone": "+54 9 358 4123456",
            "photos": [make_test_image_file("nube.jpg")],
            "badges": fake_badges,
        },
        format="multipart",
    )

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    pet = Pet.objects.get(pk=body["id"])

    assert body["badges"] == get_pet_badges(pet)
    assert BadgeKey.URGENT.value not in [badge["key"] for badge in body["badges"]]
    assert all(badge["text"] != "Falso" for badge in body["badges"])


def test_update_pet_recalculates_badges_and_ignores_client_supplied_badges() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    pet = PetFactory(
        published_by=owner,
        sex=Pet.Sex.FEMALE,
        is_neutered=False,
        good_with_children=Pet.Compatibility.NOT_EVALUATED,
        special_care="",
        status=Pet.Status.IN_REVIEW,
    )
    client = APIClient()
    client.force_authenticate(user=owner)

    response = client.patch(
        _pet_detail_url(pet.id),
        {
            "is_neutered": True,
            "good_with_children": Pet.Compatibility.YES,
            "special_care": "Gotas oculares",
            "badges": [{"key": "adopted", "tone": "orange", "icon": "adopted", "text": "Fake"}],
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    pet.refresh_from_db()
    badges = response.json()["badges"]

    assert badges == get_pet_badges(pet)
    by_key = {badge["key"]: badge for badge in badges}
    assert BadgeKey.ADOPTED.value not in by_key
    assert by_key[BadgeKey.NEUTERED.value]["text"] == "Castrada"
    assert by_key[BadgeKey.CHILDREN.value]["tone"] == BadgeTone.GREEN.value
    assert by_key[BadgeKey.SPECIAL_CARE.value]["text"] == (
        "Necesita cuidados de salud: Gotas oculares"
    )


def test_adopt_pet_replaces_urgent_badge_with_adopted_badge() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    pet = PetFactory(
        published_by=owner,
        is_urgent_requested=True,
        is_urgent_validated=True,
        status=Pet.Status.PUBLISHED,
    )
    client = APIClient()
    client.force_authenticate(user=owner)

    response = client.post(_pet_adopt_url(pet.id), {"note": "Adoptada"}, format="json")

    assert response.status_code == status.HTTP_200_OK
    badges = response.json()["badges"]
    assert badges[0]["key"] == BadgeKey.ADOPTED.value
    assert badges[0]["text"] == "¡Ya encontró hogar! 🧡"
    assert BadgeKey.URGENT.value not in [badge["key"] for badge in badges]


def test_staff_urgency_validation_toggles_urgent_badge_in_response() -> None:
    staff = UserFactory(role__code=RoleCode.STAFF)
    pet = PetFactory(
        is_urgent_requested=True,
        is_urgent_validated=False,
        status=Pet.Status.PUBLISHED,
    )
    client = APIClient()
    client.force_authenticate(user=staff)

    res_validate = client.post(_pet_urgency_url(pet.id), {"validated": True}, format="json")
    assert res_validate.status_code == status.HTTP_200_OK
    assert res_validate.json()["badges"][0]["key"] == BadgeKey.URGENT.value

    res_revoke = client.post(_pet_urgency_url(pet.id), {"validated": False}, format="json")
    assert res_revoke.status_code == status.HTTP_200_OK
    assert BadgeKey.URGENT.value not in [badge["key"] for badge in res_revoke.json()["badges"]]


def test_openapi_schema_documents_read_only_pet_badges() -> None:
    response = APIClient().get("/api/schema/", {"format": "json"})
    assert response.status_code == status.HTTP_200_OK

    schemas = response.json()["components"]["schemas"]
    pet_badge_schema = schemas["PetBadge"]
    assert {"key", "tone", "icon", "text"} == set(pet_badge_schema["properties"].keys())
    assert all(prop.get("readOnly") is True for prop in pet_badge_schema["properties"].values())

    for schema_name in ("PetPublic", "PetManage"):
        badges_prop = schemas[schema_name]["properties"]["badges"]
        assert badges_prop["type"] == "array"
        assert badges_prop["readOnly"] is True
        assert badges_prop["items"]["$ref"] == "#/components/schemas/PetBadge"

    for input_schema_name in ("PetCreate", "PatchedPetUpdate"):
        assert "badges" not in schemas[input_schema_name]["properties"]
