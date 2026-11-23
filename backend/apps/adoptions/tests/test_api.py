"""Tests de integración para los endpoints del solicitante en `/api/adoption-requests/`."""

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.adoptions.models import AdoptionRequest
from apps.adoptions.services import OWN_PET_ADOPTION_ERROR
from apps.adoptions.tests.factories import AdoptionRequestFactory
from apps.pets.models import Pet
from apps.pets.tests.factories import PetFactory, PetPhotoFactory
from apps.users.models import RoleCode
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _valid_request_body(pet_id: int, **overrides) -> dict:
    body = {
        "pet": pet_id,
        "full_name": "Tomás Gómez",
        "age": 29,
        "phone": "+54 9 358 4111222",
        "email": "tomas@callejeros.ar",
        "address": "Belgrano 750",
        "city": "Río Cuarto",
        "housing_type": "PH interno con patio cerrado y medianeras altas",
        "other_pets": "1 perro castrado y vacunado",
        "accepts_commitment": True,
    }
    body.update(overrides)
    return body


def test_create_adoption_request_requires_authentication() -> None:
    pet = PetFactory(status=Pet.Status.PUBLISHED)

    response = APIClient().post(
        reverse("adoptions:adoption-request-create"),
        data=_valid_request_body(pet.pk),
        format="json",
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.parametrize(
    "role_code",
    [RoleCode.MEMBER, RoleCode.VERIFIED_SHELTER, RoleCode.STAFF, RoleCode.ADMIN],
)
def test_create_adoption_request_succeeds_for_any_authenticated_role(role_code: str) -> None:
    applicant = UserFactory(role__code=role_code)
    pet = PetFactory(name="Loki", status=Pet.Status.PUBLISHED)
    client = _auth_client(applicant)

    response = client.post(
        reverse("adoptions:adoption-request-create"),
        data=_valid_request_body(
            pet.pk,
            # El cliente intenta inyectar campos internos que deben ignorarse
            status=AdoptionRequest.Status.APPROVED,
            meeting_point="Punto inventado",
            rejection_reason="Motivo inventado",
        ),
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["status"] == AdoptionRequest.Status.PENDING
    assert data["pet"]["id"] == pet.pk
    assert data["pet"]["name"] == "Loki"
    assert "contact_phone" not in data["pet"]
    assert data["housing_type"] == "PH interno con patio cerrado y medianeras altas"
    assert data["foster_contact"] is None
    assert data["meeting_point"] == ""
    assert data["rejection_reason"] == ""
    assert data["reviewed_by"] is None
    assert data["reviewed_at"] is None


def test_create_adoption_request_copies_applicant_snapshot() -> None:
    applicant = UserFactory(
        first_name="Tomás",
        last_name="Gómez",
        email="original@callejeros.ar",
        phone="+54 9 358 4111111",
    )
    pet = PetFactory(status=Pet.Status.PUBLISHED)
    client = _auth_client(applicant)

    create_resp = client.post(
        reverse("adoptions:adoption-request-create"),
        data=_valid_request_body(
            pet.pk,
            full_name="Tomás Gómez",
            email="original@callejeros.ar",
            phone="+54 9 358 4111111",
        ),
        format="json",
    )
    assert create_resp.status_code == status.HTTP_201_CREATED
    req_id = create_resp.json()["id"]

    # El usuario cambia luego sus datos en la cuenta
    applicant.first_name = "Otro Nombre"
    applicant.email = "nuevo@callejeros.ar"
    applicant.phone = "+54 9 358 4999999"
    applicant.save(update_fields=["first_name", "email", "phone", "updated_at"])

    detail_resp = client.get(
        reverse("adoptions:adoption-request-detail", kwargs={"request_id": req_id})
    )
    assert detail_resp.status_code == status.HTTP_200_OK
    detail = detail_resp.json()
    assert detail["full_name"] == "Tomás Gómez"
    assert detail["email"] == "original@callejeros.ar"
    assert detail["phone"] == "+54 9 358 4111111"


def test_create_adoption_request_validates_three_blocks() -> None:
    applicant = UserFactory()
    pet = PetFactory(status=Pet.Status.PUBLISHED)
    client = _auth_client(applicant)
    url = reverse("adoptions:adoption-request-create")

    # Menor de 18
    underage_resp = client.post(url, data=_valid_request_body(pet.pk, age=17), format="json")
    assert underage_resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "age" in underage_resp.json()

    # Sin compromiso
    no_commit_resp = client.post(
        url,
        data=_valid_request_body(pet.pk, accepts_commitment=False),
        format="json",
    )
    assert no_commit_resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "accepts_commitment" in no_commit_resp.json()

    # Cuestionario incompleto (falta housing_type y other_pets)
    incomplete = _valid_request_body(pet.pk)
    incomplete.pop("housing_type")
    incomplete.pop("other_pets")
    incomplete_resp = client.post(url, data=incomplete, format="json")
    assert incomplete_resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "housing_type" in incomplete_resp.json()
    assert "other_pets" in incomplete_resp.json()


@pytest.mark.parametrize(
    "pet_status",
    [Pet.Status.IN_REVIEW, Pet.Status.REJECTED, Pet.Status.ADOPTED],
)
def test_create_adoption_request_rejects_non_published_pet(pet_status: str) -> None:
    applicant = UserFactory()
    pet = PetFactory(status=pet_status)

    response = _auth_client(applicant).post(
        reverse("adoptions:adoption-request-create"),
        data=_valid_request_body(pet.pk),
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "pet" in response.json()


def test_create_adoption_request_rejects_own_pet_for_any_role() -> None:
    for role_code in (RoleCode.MEMBER, RoleCode.VERIFIED_SHELTER, RoleCode.STAFF, RoleCode.ADMIN):
        publisher = UserFactory(role__code=role_code)
        pet = PetFactory(published_by=publisher, status=Pet.Status.PUBLISHED)

        response = _auth_client(publisher).post(
            reverse("adoptions:adoption-request-create"),
            data=_valid_request_body(pet.pk),
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.json()["pet"] == [OWN_PET_ADOPTION_ERROR]


def test_create_adoption_request_blocks_duplicate_pending_via_api() -> None:
    applicant = UserFactory()
    pet = PetFactory(status=Pet.Status.PUBLISHED)
    client = _auth_client(applicant)
    url = reverse("adoptions:adoption-request-create")

    first = client.post(url, data=_valid_request_body(pet.pk), format="json")
    assert first.status_code == status.HTTP_201_CREATED

    duplicate = client.post(url, data=_valid_request_body(pet.pk), format="json")
    assert duplicate.status_code == status.HTTP_400_BAD_REQUEST
    assert "pet" in duplicate.json()


def test_my_adoption_requests_list_is_paginated_scoped_and_filterable() -> None:
    assert APIClient().get(reverse("adoptions:adoption-request-mine")).status_code == (
        status.HTTP_401_UNAUTHORIZED
    )

    applicant = UserFactory()
    other_user = UserFactory()
    pending = AdoptionRequestFactory(applicant=applicant, status=AdoptionRequest.Status.PENDING)
    approved = AdoptionRequestFactory(
        applicant=applicant,
        status=AdoptionRequest.Status.APPROVED,
        meeting_point="Plaza Roca",
    )
    inactive = AdoptionRequestFactory(applicant=applicant, status=AdoptionRequest.Status.REJECTED)
    inactive.deactivate()
    AdoptionRequestFactory(applicant=other_user, status=AdoptionRequest.Status.PENDING)

    client = _auth_client(applicant)
    url = reverse("adoptions:adoption-request-mine")

    response = client.get(url)
    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert payload["count"] == 2
    assert [item["id"] for item in payload["results"]] == [approved.pk, pending.pk]

    filtered = client.get(url, {"status": "approved"})
    assert filtered.status_code == status.HTTP_200_OK
    assert [item["id"] for item in filtered.json()["results"]] == [approved.pk]

    invalid = client.get(url, {"status": "invalida"})
    assert invalid.status_code == status.HTTP_400_BAD_REQUEST
    assert "status" in invalid.json()


def test_adoption_request_detail_permissions_and_soft_delete() -> None:
    applicant = UserFactory(role__code=RoleCode.MEMBER)
    other_member = UserFactory(role__code=RoleCode.MEMBER)
    other_shelter = UserFactory(role__code=RoleCode.VERIFIED_SHELTER)
    staff = UserFactory(role__code=RoleCode.STAFF)
    admin = UserFactory(role__code=RoleCode.ADMIN)

    adoption_request = AdoptionRequestFactory(applicant=applicant)
    url = reverse("adoptions:adoption-request-detail", kwargs={"request_id": adoption_request.pk})

    assert APIClient().get(url).status_code == status.HTTP_401_UNAUTHORIZED
    assert _auth_client(other_member).get(url).status_code == status.HTTP_404_NOT_FOUND
    assert _auth_client(other_shelter).get(url).status_code == status.HTTP_404_NOT_FOUND
    assert _auth_client(applicant).get(url).status_code == status.HTTP_200_OK
    assert _auth_client(staff).get(url).status_code == status.HTTP_200_OK
    assert _auth_client(admin).get(url).status_code == status.HTTP_200_OK

    adoption_request.deactivate()
    assert _auth_client(applicant).get(url).status_code == status.HTTP_404_NOT_FOUND
    assert _auth_client(staff).get(url).status_code == status.HTTP_404_NOT_FOUND


def test_approved_response_exposes_foster_contact_and_meeting_point_without_address(
    settings,
    tmp_path,
) -> None:
    settings.MEDIA_ROOT = tmp_path
    publisher = UserFactory(
        first_name="Refugio",
        last_name="Patitas",
        role__code=RoleCode.VERIFIED_SHELTER,
        address="Calle Privada Secreta 999",
        city="Río Cuarto",
        neighborhood="Centro Privado",
    )
    pet = PetFactory(
        name="Bora",
        published_by=publisher,
        contact_phone="+54 9 358 4222222",
        status=Pet.Status.PUBLISHED,
    )
    PetPhotoFactory(pet=pet, position=0)

    applicant = UserFactory()
    staff = UserFactory(role__code=RoleCode.STAFF)
    approved = AdoptionRequestFactory(
        pet=pet,
        applicant=applicant,
        status=AdoptionRequest.Status.APPROVED,
        meeting_point="Centro Vecinal Alberdi (Av. Colombres y Pasteur)",
        reviewed_by=staff,
        reviewed_at=timezone.now(),
    )

    response = _auth_client(applicant).get(
        reverse("adoptions:adoption-request-detail", kwargs={"request_id": approved.pk})
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    assert data["status"] == AdoptionRequest.Status.APPROVED
    assert data["meeting_point"] == "Centro Vecinal Alberdi (Av. Colombres y Pasteur)"
    assert data["foster_contact"] == {
        "name": "Refugio Patitas",
        "role": {"code": RoleCode.VERIFIED_SHELTER, "name": "Refugio verificado"},
        "contact_phone": "+54 9 358 4222222",
    }
    assert data["pet"]["main_photo"] is not None
    # Nunca se expone la dirección privada de quien publicó la mascota
    assert "Calle Privada Secreta 999" not in str(data["foster_contact"])
    assert "Calle Privada Secreta 999" not in str(data["pet"])
    assert "address" not in data["foster_contact"]


def test_rejected_response_hides_foster_contact_and_shows_reason() -> None:
    publisher = UserFactory(address="Dirección Oculta 123")
    pet = PetFactory(
        published_by=publisher,
        contact_phone="+54 9 358 4333333",
        status=Pet.Status.PUBLISHED,
    )
    applicant = UserFactory()
    staff = UserFactory(role__code=RoleCode.STAFF)
    rejected = AdoptionRequestFactory(
        pet=pet,
        applicant=applicant,
        status=AdoptionRequest.Status.REJECTED,
        rejection_reason="La vivienda no cuenta con cerramiento seguro para un cachorro.",
        reviewed_by=staff,
        reviewed_at=timezone.now(),
    )

    response = _auth_client(applicant).get(
        reverse("adoptions:adoption-request-detail", kwargs={"request_id": rejected.pk})
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    assert data["status"] == AdoptionRequest.Status.REJECTED
    assert (
        data["rejection_reason"] == "La vivienda no cuenta con cerramiento seguro para un cachorro."
    )
    assert data["foster_contact"] is None
    assert "+54 9 358 4333333" not in str(data)


def test_openapi_schema_documents_adoption_request_endpoints() -> None:
    response = APIClient().get(reverse("api-schema"), HTTP_ACCEPT="application/json")
    assert response.status_code == status.HTTP_200_OK

    paths = response.json()["paths"]
    assert "/api/adoption-requests/" in paths
    assert "post" in paths["/api/adoption-requests/"]
    assert "/api/adoption-requests/mine/" in paths
    assert "get" in paths["/api/adoption-requests/mine/"]
    assert "/api/adoption-requests/{request_id}/" in paths
    assert "get" in paths["/api/adoption-requests/{request_id}/"]
