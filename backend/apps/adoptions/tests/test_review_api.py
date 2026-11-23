"""Tests de integración para la revisión de solicitudes en el panel de Staff (BK-07b)."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.adoptions.models import AdoptionRequest
from apps.adoptions.services import (
    MAX_MEETING_POINT_LENGTH,
    MAX_REJECTION_REASON_LENGTH,
    ONLY_PENDING_REQUEST_ERROR,
    PET_UNAVAILABLE_ON_APPROVE_ERROR,
)
from apps.adoptions.tests.factories import AdoptionRequestFactory
from apps.pets.models import Pet
from apps.pets.tests.factories import PetFactory
from apps.users.models import RoleCode
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_review_queue_requires_staff_or_admin() -> None:
    url = reverse("adoptions:adoption-request-review-queue")

    assert APIClient().get(url).status_code == status.HTTP_401_UNAUTHORIZED
    assert (
        _auth_client(UserFactory(role__code=RoleCode.MEMBER)).get(url).status_code
        == status.HTTP_403_FORBIDDEN
    )
    assert (
        _auth_client(UserFactory(role__code=RoleCode.VERIFIED_SHELTER)).get(url).status_code
        == status.HTTP_403_FORBIDDEN
    )
    assert (
        _auth_client(UserFactory(role__code=RoleCode.STAFF)).get(url).status_code
        == status.HTTP_200_OK
    )
    assert (
        _auth_client(UserFactory(role__code=RoleCode.ADMIN)).get(url).status_code
        == status.HTTP_200_OK
    )


def test_review_queue_orders_oldest_first_and_paginates() -> None:
    staff = UserFactory(role__code=RoleCode.STAFF)
    now = timezone.now()

    # 13 pendientes con fechas crecientes para verificar orden y paginación de a 12
    pending_requests = []
    for idx in range(13):
        req = AdoptionRequestFactory(status=AdoptionRequest.Status.PENDING)
        AdoptionRequest.objects.filter(pk=req.pk).update(created_at=now - timedelta(hours=20 - idx))
        pending_requests.append(req)

    # No deben aparecer en la cola
    AdoptionRequestFactory(status=AdoptionRequest.Status.APPROVED)
    AdoptionRequestFactory(status=AdoptionRequest.Status.REJECTED)
    inactive = AdoptionRequestFactory(status=AdoptionRequest.Status.PENDING)
    inactive.deactivate()

    client = _auth_client(staff)
    url = reverse("adoptions:adoption-request-review-queue")

    page1 = client.get(url)
    assert page1.status_code == status.HTTP_200_OK
    payload1 = page1.json()
    assert payload1["count"] == 13
    assert payload1["next"] is not None
    assert payload1["previous"] is None
    assert [item["id"] for item in payload1["results"]] == [req.pk for req in pending_requests[:12]]

    page2 = client.get(url, {"page": 2})
    assert page2.status_code == status.HTTP_200_OK
    payload2 = page2.json()
    assert [item["id"] for item in payload2["results"]] == [pending_requests[12].pk]


def test_approve_endpoint_permissions() -> None:
    adoption_request = AdoptionRequestFactory()
    url = reverse("adoptions:adoption-request-approve", kwargs={"request_id": adoption_request.pk})
    body = {"meeting_point": "Plaza Roca"}

    assert (
        APIClient().post(url, data=body, format="json").status_code == status.HTTP_401_UNAUTHORIZED
    )
    assert (
        _auth_client(UserFactory(role__code=RoleCode.MEMBER))
        .post(url, data=body, format="json")
        .status_code
        == status.HTTP_403_FORBIDDEN
    )
    assert (
        _auth_client(UserFactory(role__code=RoleCode.VERIFIED_SHELTER))
        .post(url, data=body, format="json")
        .status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.parametrize("role_code", [RoleCode.STAFF, RoleCode.ADMIN])
def test_approve_endpoint_exposes_foster_contact_without_address(role_code: str) -> None:
    publisher = UserFactory(
        first_name="Refugio",
        last_name="Patitas",
        role__code=RoleCode.VERIFIED_SHELTER,
        address="Dirección Secreta del Tránsito 456",
    )
    pet = PetFactory(
        published_by=publisher,
        contact_phone="+54 9 358 4222222",
        status=Pet.Status.PUBLISHED,
    )
    adoption_request = AdoptionRequestFactory(pet=pet)
    reviewer = UserFactory(role__code=role_code)

    response = _auth_client(reviewer).post(
        reverse("adoptions:adoption-request-approve", kwargs={"request_id": adoption_request.pk}),
        data={"meeting_point": "Centro Vecinal Alberdi (Av. Colombres y Pasteur)"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == AdoptionRequest.Status.APPROVED
    assert data["meeting_point"] == "Centro Vecinal Alberdi (Av. Colombres y Pasteur)"
    assert data["rejection_reason"] == ""
    assert data["reviewed_by"]["id"] == reviewer.pk
    assert data["reviewed_at"] is not None
    assert data["foster_contact"] == {
        "name": "Refugio Patitas",
        "role": {"code": RoleCode.VERIFIED_SHELTER, "name": "Refugio verificado"},
        "contact_phone": "+54 9 358 4222222",
    }
    assert "Dirección Secreta del Tránsito 456" not in str(data["foster_contact"])
    assert "address" not in data["foster_contact"]


def test_approve_endpoint_validates_meeting_point_and_state() -> None:
    staff = UserFactory(role__code=RoleCode.STAFF)
    client = _auth_client(staff)
    adoption_request = AdoptionRequestFactory()
    url = reverse("adoptions:adoption-request-approve", kwargs={"request_id": adoption_request.pk})

    # Sin meeting_point / vacío / demasiado largo
    assert client.post(url, data={}, format="json").status_code == status.HTTP_400_BAD_REQUEST
    assert (
        client.post(url, data={"meeting_point": "   "}, format="json").status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert (
        client.post(
            url,
            data={"meeting_point": "a" * (MAX_MEETING_POINT_LENGTH + 1)},
            format="json",
        ).status_code
        == status.HTTP_400_BAD_REQUEST
    )

    # Aprobar una vez funciona; intentar aprobar de nuevo falla con 400
    assert (
        client.post(url, data={"meeting_point": "Plaza Roca"}, format="json").status_code
        == status.HTTP_200_OK
    )
    second = client.post(url, data={"meeting_point": "Otro punto"}, format="json")
    assert second.status_code == status.HTTP_400_BAD_REQUEST
    assert second.json()["status"] == [ONLY_PENDING_REQUEST_ERROR]

    # Solicitud inactiva devuelve 404
    inactive = AdoptionRequestFactory()
    inactive.deactivate()
    inactive_url = reverse("adoptions:adoption-request-approve", kwargs={"request_id": inactive.pk})
    assert (
        client.post(inactive_url, data={"meeting_point": "Plaza Roca"}, format="json").status_code
        == status.HTTP_404_NOT_FOUND
    )


def test_reject_endpoint_permissions_validation_and_privacy() -> None:
    publisher = UserFactory(address="Calle Privada 123")
    pet = PetFactory(
        published_by=publisher,
        contact_phone="+54 9 358 4999999",
        status=Pet.Status.PUBLISHED,
    )
    adoption_request = AdoptionRequestFactory(pet=pet)
    url = reverse("adoptions:adoption-request-reject", kwargs={"request_id": adoption_request.pk})
    body = {"rejection_reason": "Necesitamos confirmar cerramiento del patio."}

    # Permisos
    assert (
        APIClient().post(url, data=body, format="json").status_code == status.HTTP_401_UNAUTHORIZED
    )
    assert (
        _auth_client(UserFactory(role__code=RoleCode.MEMBER))
        .post(url, data=body, format="json")
        .status_code
        == status.HTTP_403_FORBIDDEN
    )
    assert (
        _auth_client(UserFactory(role__code=RoleCode.VERIFIED_SHELTER))
        .post(url, data=body, format="json")
        .status_code
        == status.HTTP_403_FORBIDDEN
    )

    admin = UserFactory(role__code=RoleCode.ADMIN)
    client = _auth_client(admin)

    # Validación de motivo obligatorio y longitud máxima
    assert client.post(url, data={}, format="json").status_code == status.HTTP_400_BAD_REQUEST
    assert (
        client.post(url, data={"rejection_reason": "   "}, format="json").status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert (
        client.post(
            url,
            data={"rejection_reason": "x" * (MAX_REJECTION_REASON_LENGTH + 1)},
            format="json",
        ).status_code
        == status.HTTP_400_BAD_REQUEST
    )

    # Rechazo válido
    response = client.post(url, data=body, format="json")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == AdoptionRequest.Status.REJECTED
    assert data["rejection_reason"] == "Necesitamos confirmar cerramiento del patio."
    assert data["meeting_point"] == ""
    assert data["foster_contact"] is None
    assert data["reviewed_by"]["id"] == admin.pk
    assert data["reviewed_at"] is not None
    assert "+54 9 358 4999999" not in str(data)

    # No se puede volver a revisar ni aprobar una ya rechazada
    re_reject = client.post(url, data=body, format="json")
    assert re_reject.status_code == status.HTTP_400_BAD_REQUEST
    assert re_reject.json()["status"] == [ONLY_PENDING_REQUEST_ERROR]

    approve_after_reject = client.post(
        reverse("adoptions:adoption-request-approve", kwargs={"request_id": adoption_request.pk}),
        data={"meeting_point": "Plaza Roca"},
        format="json",
    )
    assert approve_after_reject.status_code == status.HTTP_400_BAD_REQUEST
    assert approve_after_reject.json()["status"] == [ONLY_PENDING_REQUEST_ERROR]


def test_approve_fails_and_reject_succeeds_when_pet_is_adopted_or_inactive() -> None:
    staff = UserFactory(role__code=RoleCode.STAFF)
    client = _auth_client(staff)

    adopted_pet = PetFactory(status=Pet.Status.ADOPTED)
    adopted_req = AdoptionRequestFactory(pet=adopted_pet)

    approve_adopted = client.post(
        reverse("adoptions:adoption-request-approve", kwargs={"request_id": adopted_req.pk}),
        data={"meeting_point": "Plaza Roca"},
        format="json",
    )
    assert approve_adopted.status_code == status.HTTP_400_BAD_REQUEST
    assert approve_adopted.json()["pet"] == [PET_UNAVAILABLE_ON_APPROVE_ERROR]

    reject_adopted = client.post(
        reverse("adoptions:adoption-request-reject", kwargs={"request_id": adopted_req.pk}),
        data={"rejection_reason": "La mascota ya fue adoptada por otra familia."},
        format="json",
    )
    assert reject_adopted.status_code == status.HTTP_200_OK
    assert reject_adopted.json()["status"] == AdoptionRequest.Status.REJECTED

    inactive_pet = PetFactory(status=Pet.Status.PUBLISHED)
    inactive_pet_req = AdoptionRequestFactory(pet=inactive_pet)
    inactive_pet.deactivate()

    approve_inactive = client.post(
        reverse("adoptions:adoption-request-approve", kwargs={"request_id": inactive_pet_req.pk}),
        data={"meeting_point": "Plaza Roca"},
        format="json",
    )
    assert approve_inactive.status_code == status.HTTP_400_BAD_REQUEST
    assert approve_inactive.json()["pet"] == [PET_UNAVAILABLE_ON_APPROVE_ERROR]

    reject_inactive = client.post(
        reverse("adoptions:adoption-request-reject", kwargs={"request_id": inactive_pet_req.pk}),
        data={"rejection_reason": "La publicación de la mascota fue dada de baja."},
        format="json",
    )
    assert reject_inactive.status_code == status.HTTP_200_OK
    assert reject_inactive.json()["status"] == AdoptionRequest.Status.REJECTED


def test_openapi_schema_documents_staff_review_endpoints() -> None:
    response = APIClient().get(reverse("api-schema"), HTTP_ACCEPT="application/json")
    assert response.status_code == status.HTTP_200_OK

    paths = response.json()["paths"]
    assert "/api/adoption-requests/review-queue/" in paths
    assert "get" in paths["/api/adoption-requests/review-queue/"]
    assert "/api/adoption-requests/{request_id}/approve/" in paths
    assert "post" in paths["/api/adoption-requests/{request_id}/approve/"]
    assert "/api/adoption-requests/{request_id}/reject/" in paths
    assert "post" in paths["/api/adoption-requests/{request_id}/reject/"]
