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
    home_ownership = AdoptionRequest.HomeOwnership.OWNED
    rental_allows_pets = ""
    outdoor_space = "Patio con tapia de 2 metros y portón cerrado"
    household_members = "Mi pareja y yo, sin niños"
    household_agreement = AdoptionRequest.HouseholdAgreement.YES
    other_pets = "No tengo otros animales actualmente"
    previous_pets = "Tuve una perra durante 12 años, hasta que falleció de vieja"
    hours_alone = AdoptionRequest.HoursAlone.FROM_4_TO_8
    living_space = "Adentro de la casa, con su cucha en el living"
    vacation_care = "Mis padres, que viven a 5 cuadras"
    contingency_plan = "Me lo llevo conmigo; si no pudiera, aviso a Callejeros"
    adoption_reason = ""
    accepts_commitment = True
    accepts_neutering = None
    accepts_follow_up = True
    accepts_return_notice = True
    declares_truthful = True
    status = AdoptionRequest.Status.PENDING
    rejection_reason = ""
    meeting_point = ""
    reviewed_by = None
    reviewed_at = None
