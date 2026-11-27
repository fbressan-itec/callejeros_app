"""Tests de ocultamiento y restauración de solicitudes al desactivar y reactivar cuentas."""

import pytest
from rest_framework.test import APIClient

from apps.adoptions.models import AdoptionRequest
from apps.adoptions.services import (
    APPLICANT_INACTIVE_ON_APPROVE_ERROR,
    PET_NOT_AVAILABLE_ERROR,
    PET_UNAVAILABLE_ON_APPROVE_ERROR,
)
from apps.adoptions.tests.factories import AdoptionRequestFactory
from apps.pets.models import Pet
from apps.pets.tests.factories import PetFactory
from apps.users.models import RoleCode, User, UserStatusLog
from apps.users.services import deactivate_user, issue_tokens_for_user, reactivate_user
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _auth_client(user: User) -> APIClient:
    client = APIClient()
    tokens = issue_tokens_for_user(user, remember_me=False)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return client


def _valid_questionnaire_payload(pet_id: int) -> dict:
    return {
        "pet": pet_id,
        "full_name": "María Solicitante",
        "age": 30,
        "phone": "+54 9 358 4555555",
        "email": "maria@callejeros.ar",
        "address": "Av. Italia 500",
        "city": "Río Cuarto",
        "housing_type": "Casa",
        "home_ownership": AdoptionRequest.HomeOwnership.OWNED,
        "outdoor_space": "Patio cerrado con tapia",
        "household_members": "Dos adultos",
        "household_agreement": AdoptionRequest.HouseholdAgreement.YES,
        "other_pets": "Ninguno",
        "previous_pets": "Tuve un perro 10 años",
        "hours_alone": AdoptionRequest.HoursAlone.LESS_THAN_4,
        "living_space": "Adentro de la casa",
        "vacation_care": "Familiares",
        "contingency_plan": "Aviso a Callejeros",
        "accepts_commitment": True,
        "accepts_follow_up": True,
        "accepts_return_notice": True,
        "declares_truthful": True,
    }


@pytest.mark.parametrize(
    "reason",
    [UserStatusLog.Reason.ADMIN_ACTION, UserStatusLog.Reason.SELF_DELETED],
)
def test_deactivating_applicant_hides_pending_request_and_reactivating_restores(
    reason: str,
) -> None:
    admin = UserFactory(role__code=RoleCode.ADMIN)
    staff = UserFactory(role__code=RoleCode.STAFF)
    publisher = UserFactory(role__code=RoleCode.MEMBER)
    applicant = UserFactory(role__code=RoleCode.MEMBER)
    other_applicant = UserFactory(role__code=RoleCode.MEMBER)

    pet = PetFactory(status=Pet.Status.PUBLISHED, published_by=publisher)
    hidden_req = AdoptionRequestFactory(pet=pet, applicant=applicant)
    visible_req = AdoptionRequestFactory(pet=pet, applicant=other_applicant)
    staff_client = _auth_client(staff)

    actor = admin if reason == UserStatusLog.Reason.ADMIN_ACTION else applicant
    deactivate_user(target_user=applicant, actor=actor, reason=reason)

    # La fila no se modifica ni se da de baja.
    hidden_req.refresh_from_db()
    assert hidden_req.is_active is True
    assert hidden_req.status == AdoptionRequest.Status.PENDING

    # Sale de la cola de Staff.
    queue_resp = staff_client.get("/api/adoption-requests/review-queue/")
    assert queue_resp.status_code == 200
    assert [item["id"] for item in queue_resp.data["results"]] == [visible_req.pk]

    # No se puede aprobar mientras el solicitante está inactivo.
    approve_resp = staff_client.post(f"/api/adoption-requests/{hidden_req.pk}/approve/")
    assert approve_resp.status_code == 400
    assert APPLICANT_INACTIVE_ON_APPROVE_ERROR in str(approve_resp.data["applicant"])

    # Al reactivar al solicitante, reaparece en la cola y se puede aprobar.
    reactivate_user(target_user=applicant, actor=admin)

    restored_queue = staff_client.get("/api/adoption-requests/review-queue/")
    assert {item["id"] for item in restored_queue.data["results"]} == {
        hidden_req.pk,
        visible_req.pk,
    }
    approve_ok = staff_client.post(f"/api/adoption-requests/{hidden_req.pk}/approve/")
    assert approve_ok.status_code == 200
    assert approve_ok.data["status"] == AdoptionRequest.Status.APPROVED


def test_deactivating_publisher_hides_requests_blocks_apply_and_approve_and_restores() -> None:
    admin = UserFactory(role__code=RoleCode.ADMIN)
    staff = UserFactory(role__code=RoleCode.STAFF)
    publisher = UserFactory(role__code=RoleCode.MEMBER)
    applicant = UserFactory(role__code=RoleCode.MEMBER)
    new_applicant = UserFactory(role__code=RoleCode.MEMBER)

    pet = PetFactory(status=Pet.Status.PUBLISHED, is_neutered=True, published_by=publisher)
    pending_req = AdoptionRequestFactory(pet=pet, applicant=applicant)

    staff_client = _auth_client(staff)
    new_applicant_client = _auth_client(new_applicant)

    deactivate_user(target_user=publisher, actor=admin)

    # La fila sigue intacta en BD.
    pending_req.refresh_from_db()
    assert pending_req.is_active is True
    assert pending_req.status == AdoptionRequest.Status.PENDING

    # Desaparece de la cola de Staff.
    assert staff_client.get("/api/adoption-requests/review-queue/").data["results"] == []

    # Nadie puede postularse ni aprobar una solicitud sobre una mascota de usuario inactivo.
    create_resp = new_applicant_client.post(
        "/api/adoption-requests/",
        _valid_questionnaire_payload(pet.pk),
        format="json",
    )
    assert create_resp.status_code == 400
    assert PET_NOT_AVAILABLE_ERROR in str(create_resp.data["pet"])

    approve_resp = staff_client.post(f"/api/adoption-requests/{pending_req.pk}/approve/")
    assert approve_resp.status_code == 400
    assert PET_UNAVAILABLE_ON_APPROVE_ERROR in str(approve_resp.data["pet"])

    # Al reactivar al publicador, vuelve a la cola y se puede aprobar.
    reactivate_user(target_user=publisher, actor=admin)

    queue_after = staff_client.get("/api/adoption-requests/review-queue/")
    assert [item["id"] for item in queue_after.data["results"]] == [pending_req.pk]
    assert staff_client.post(f"/api/adoption-requests/{pending_req.pk}/approve/").status_code == 200
