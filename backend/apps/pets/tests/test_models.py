"""Tests unitarios de los modelos de `apps.pets` (Pet, PetHealth, PetPhoto y PetStatusLog)."""

import pytest
from django.db import IntegrityError, transaction

from apps.pets.models import Pet, PetPhoto
from apps.pets.tests.factories import (
    PetFactory,
    PetHealthFactory,
    PetPhotoFactory,
    PetStatusLogFactory,
)
from apps.users.models import RoleCode
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def test_pet_defaults_to_in_review_and_unvalidated_urgent() -> None:
    pet = PetFactory(name="Loki")

    assert pet.status == Pet.Status.IN_REVIEW
    assert pet.is_urgent_requested is False
    assert pet.is_urgent_validated is False
    assert pet.good_with_children == Pet.Compatibility.NOT_EVALUATED
    assert pet.good_with_animals == Pet.Compatibility.NOT_EVALUATED
    assert pet.is_active is True
    assert str(pet) == "Loki (Perro - En revisión)"


def test_pet_soft_delete_excludes_from_active_queryset() -> None:
    active_pet = PetFactory(name="Activa")
    deleted_pet = PetFactory(name="Dada de baja")

    deleted_pet.deactivate()

    assert deleted_pet.is_active is False
    active_ids = list(Pet.objects.active().values_list("id", flat=True))
    assert active_pet.id in active_ids
    assert deleted_pet.id not in active_ids


def test_pet_health_one_to_one_relationship() -> None:
    pet = PetFactory(name="Luna", species=Pet.Species.CAT)
    health = PetHealthFactory(
        pet=pet,
        general_status="Excelente estado",
        vaccines="Triple felina",
    )

    assert pet.health == health
    assert str(health) == "Salud de Luna"


def test_pet_photo_unique_active_position_constraint(
    settings: pytest.TempPathFactory,
    tmp_path: pytest.TempPathFactory,
) -> None:
    settings.MEDIA_ROOT = tmp_path
    pet = PetFactory(name="Loki")

    first_photo = PetPhotoFactory(pet=pet, position=0)
    second_photo = PetPhotoFactory(pet=pet, position=1)

    assert list(pet.photos.active()) == [first_photo, second_photo]
    assert str(first_photo) == "Foto #0 de Loki"

    # No permite dos fotos activas en la misma posición para la misma mascota
    with pytest.raises(IntegrityError), transaction.atomic():
        PetPhotoFactory(pet=pet, position=0)

    # Si la foto principal anterior se da de baja lógica, sí permite una nueva en posición 0
    first_photo.deactivate()
    replacement_photo = PetPhotoFactory(pet=pet, position=0)
    assert replacement_photo.is_active is True
    assert list(PetPhoto.objects.active().filter(pet=pet)) == [
        replacement_photo,
        second_photo,
    ]


def test_pet_status_log_tracks_transitions() -> None:
    pet = PetFactory(name="Rocco")
    staff = UserFactory(role__code=RoleCode.STAFF)

    initial_log = PetStatusLogFactory(
        pet=pet,
        previous_status="",
        new_status=Pet.Status.IN_REVIEW,
        performed_by=pet.published_by,
    )
    approval_log = PetStatusLogFactory(
        pet=pet,
        previous_status=Pet.Status.IN_REVIEW,
        new_status=Pet.Status.PUBLISHED,
        performed_by=staff,
        note="Publicación aprobada y caso urgente validado.",
    )

    assert str(initial_log) == "Rocco: alta -> in_review"
    assert str(approval_log) == "Rocco: in_review -> published"
    assert pet.status_logs.count() == 2
