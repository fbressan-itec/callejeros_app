"""Tests unitarios del modelo `AdoptionRequest` y sus restricciones de base de datos."""

import pytest
from django.db import IntegrityError, transaction

from apps.adoptions.models import AdoptionRequest
from apps.adoptions.tests.factories import AdoptionRequestFactory
from apps.pets.models import Pet
from apps.pets.tests.factories import PetFactory
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def test_adoption_request_defaults_to_pending_and_active() -> None:
    pet = PetFactory(name="Loki", status=Pet.Status.PUBLISHED)
    adoption_request = AdoptionRequestFactory(pet=pet, full_name="Tomás Gómez", age=18)

    assert adoption_request.status == AdoptionRequest.Status.PENDING
    assert adoption_request.is_active is True
    assert adoption_request.rejection_reason == ""
    assert adoption_request.meeting_point == ""
    assert adoption_request.reviewed_by is None
    assert adoption_request.reviewed_at is None
    assert (
        str(adoption_request)
        == f"Solicitud #{adoption_request.pk} de Tomás Gómez por Loki (Pendiente)"
    )


def test_adoption_request_soft_delete_excludes_from_active_queryset() -> None:
    active_req = AdoptionRequestFactory()
    deleted_req = AdoptionRequestFactory()

    deleted_req.deactivate()

    assert deleted_req.is_active is False
    active_ids = list(AdoptionRequest.objects.active().values_list("id", flat=True))
    assert active_req.id in active_ids
    assert deleted_req.id not in active_ids


def test_adoption_request_db_enforces_minimum_age_18() -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        AdoptionRequestFactory(age=17)


def test_adoption_request_db_enforces_accepts_commitment_true() -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        AdoptionRequestFactory(accepts_commitment=False)


def test_adoption_request_db_enforces_unique_active_pending_per_applicant_and_pet() -> None:
    applicant = UserFactory()
    other_applicant = UserFactory()
    pet = PetFactory(status=Pet.Status.PUBLISHED)
    other_pet = PetFactory(status=Pet.Status.PUBLISHED)

    first = AdoptionRequestFactory(applicant=applicant, pet=pet)

    # No permite dos solicitudes pendientes activas del mismo solicitante para la misma mascota
    with pytest.raises(IntegrityError), transaction.atomic():
        AdoptionRequestFactory(applicant=applicant, pet=pet)

    # Sí permite otra solicitud del mismo solicitante para otra mascota
    other_pet_req = AdoptionRequestFactory(applicant=applicant, pet=other_pet)
    assert other_pet_req.pk != first.pk

    # Sí permite solicitud de otro solicitante para la misma mascota
    other_user_req = AdoptionRequestFactory(applicant=other_applicant, pet=pet)
    assert other_user_req.pk != first.pk

    # Si la anterior se da de baja lógica, sí permite una nueva solicitud pendiente
    first.deactivate()
    second = AdoptionRequestFactory(applicant=applicant, pet=pet)
    assert second.status == AdoptionRequest.Status.PENDING
    assert second.is_active is True

    # Si la anterior pasó a `rejected`, sí permite una nueva solicitud pendiente
    second.status = AdoptionRequest.Status.REJECTED
    second.rejection_reason = "Motivo de prueba"
    second.save(update_fields=["status", "rejection_reason", "updated_at"])

    third = AdoptionRequestFactory(applicant=applicant, pet=pet)
    assert third.status == AdoptionRequest.Status.PENDING
    assert third.is_active is True
