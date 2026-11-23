"""Tests del comando `python manage.py seed` para los datos de `apps.pets`."""

from io import StringIO

import pytest
from django.core.management import call_command

from apps.pets.models import Favorite, Pet, PetHealth, PetPhoto, PetStatusLog

pytestmark = pytest.mark.django_db


def test_seed_command_populates_pets_idempotently(
    settings: pytest.TempPathFactory,
    tmp_path: pytest.TempPathFactory,
) -> None:
    settings.DEBUG = True
    settings.SEED_USER_PASSWORD = "clave-segura-seed-123"
    settings.MEDIA_ROOT = tmp_path

    first_out = StringIO()
    call_command("seed", stdout=first_out)
    first_output = first_out.getvalue()

    assert (
        "pets: 9 mascotas creadas, 0 actualizadas; 5 favoritos creados, 0 actualizados"
        in first_output
    )
    assert Pet.objects.count() == 9
    assert Favorite.objects.active().count() == 5
    assert Favorite.objects.active().filter(user__email="miembro@callejeros.ar").count() == 3
    assert Pet.objects.filter(status=Pet.Status.PUBLISHED).count() == 6
    assert Pet.objects.filter(status=Pet.Status.ADOPTED).count() == 1
    assert Pet.objects.filter(status=Pet.Status.IN_REVIEW).count() == 1
    assert Pet.objects.filter(status=Pet.Status.REJECTED).count() == 1
    assert PetHealth.objects.count() == 9

    loki = Pet.objects.get(name="Loki")
    assert loki.photos.active().count() == 2
    assert PetPhoto.objects.active().count() == 10

    rocco = Pet.objects.get(name="Rocco")
    assert rocco.is_urgent_requested is True
    assert rocco.is_urgent_validated is True
    assert rocco.special_care != ""

    nala = Pet.objects.get(name="Nala")
    assert nala.status == Pet.Status.IN_REVIEW
    assert nala.is_urgent_requested is True
    assert nala.is_urgent_validated is False

    initial_log_count = PetStatusLog.objects.count()
    assert initial_log_count > 0

    # Si un favorito semilla se da de baja lógica, volver a correr seed lo reactiva sin duplicar
    sample_favorite = Favorite.objects.get(user__email="miembro@callejeros.ar", pet__name="Loki")
    sample_favorite.deactivate()

    # Segunda corrida: no duplica mascotas, fotos, favoritos ni logs de estado
    second_out = StringIO()
    call_command("seed", stdout=second_out)
    second_output = second_out.getvalue()

    assert (
        "pets: 0 mascotas creadas, 9 actualizadas; 0 favoritos creados, 5 actualizados"
        in second_output
    )
    assert Pet.objects.count() == 9
    assert PetHealth.objects.count() == 9
    assert PetPhoto.objects.active().count() == 10
    assert Favorite.objects.count() == 5
    assert Favorite.objects.active().count() == 5
    assert PetStatusLog.objects.count() == initial_log_count
