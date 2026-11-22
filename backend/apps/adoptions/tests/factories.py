"""Factories de `factory_boy` para los tests de `apps.adoptions`."""

import factory

from apps.adoptions.models import AdoptionRequest
from apps.pets.models import Pet
from apps.pets.tests.factories import PetFactory
from apps.users.tests.factories import UserFactory


class AdoptionRequestFactory(factory.django.DjangoModelFactory):
    """Genera una solicitud de adopción válida en estado `pending` por defecto."""

    class Meta:
        model = AdoptionRequest

    pet = factory.SubFactory(PetFactory, status=Pet.Status.PUBLISHED)
    applicant = factory.SubFactory(UserFactory)
    full_name = factory.LazyAttribute(
        lambda obj: (
            f"{obj.applicant.first_name} {obj.applicant.last_name}".strip() or "Solicitante Prueba"
        )
    )
    age = 28
    phone = "+54 9 358 4555555"
    email = factory.LazyAttribute(lambda obj: obj.applicant.email)
    address = "Av. Italia 1234"
    city = "Río Cuarto"
    housing_type = "Casa con patio cerrado"
    other_pets = "No tengo otros animales actualmente"
    accepts_commitment = True
    status = AdoptionRequest.Status.PENDING
    rejection_reason = ""
    meeting_point = ""
    reviewed_by = None
    reviewed_at = None
