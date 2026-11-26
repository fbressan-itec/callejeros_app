"""Tests del comando `python manage.py seed` para los datos de `apps.adoptions`."""

from io import StringIO

import pytest
from django.core.management import call_command

from apps.adoptions.models import AdoptionRequest

pytestmark = pytest.mark.django_db


def test_seed_command_populates_adoption_requests_idempotently(
    settings: pytest.TempPathFactory,
    tmp_path: pytest.TempPathFactory,
) -> None:
    settings.DEBUG = True
    settings.SEED_USER_PASSWORD = "clave-segura-seed-123"
    settings.MEDIA_ROOT = tmp_path

    first_out = StringIO()
    call_command("seed", stdout=first_out)
    first_output = first_out.getvalue()

    assert "adoptions: 3 solicitudes creadas, 0 actualizadas" in first_output
    assert AdoptionRequest.objects.count() == 3
    assert AdoptionRequest.objects.filter(status=AdoptionRequest.Status.PENDING).count() == 1
    assert AdoptionRequest.objects.filter(status=AdoptionRequest.Status.APPROVED).count() == 1
    assert AdoptionRequest.objects.filter(status=AdoptionRequest.Status.REJECTED).count() == 1

    approved = AdoptionRequest.objects.get(status=AdoptionRequest.Status.APPROVED)
    assert approved.reviewed_by is not None
    assert approved.reviewed_at is not None

    rejected = AdoptionRequest.objects.get(status=AdoptionRequest.Status.REJECTED)
    assert rejected.rejection_reason != ""
    assert rejected.reviewed_by is not None
    assert rejected.reviewed_at is not None

    pending = AdoptionRequest.objects.get(status=AdoptionRequest.Status.PENDING)
    assert pending.reviewed_by is None
    assert pending.reviewed_at is None

    # Segunda corrida: no duplica solicitudes
    second_out = StringIO()
    call_command("seed", stdout=second_out)
    second_output = second_out.getvalue()

    assert "adoptions: 0 solicitudes creadas, 3 actualizadas" in second_output
    assert AdoptionRequest.objects.count() == 3


def _clone_as_new_request(request: AdoptionRequest) -> AdoptionRequest:
    """Simula que el mismo usuario se volvió a postular desde la app."""
    request.pk = None
    request.status = AdoptionRequest.Status.PENDING
    request.rejection_reason = ""
    request.reviewed_by = None
    request.reviewed_at = None
    request.save()
    return request


def test_seed_does_not_fail_with_requests_created_from_the_app(
    settings: pytest.TempPathFactory,
) -> None:
    settings.DEBUG = True
    settings.SEED_USER_PASSWORD = "clave-segura-seed-123"
    call_command("seed", stdout=StringIO())

    # Rocco: la del seed está desaprobada y el usuario se vuelve a postular.
    rocco_seed = AdoptionRequest.objects.get(pet__name="Rocco")
    rocco_new = _clone_as_new_request(AdoptionRequest.objects.get(pk=rocco_seed.pk))

    # Loki: Staff aprueba la del seed (pendiente) y el usuario se vuelve a postular.
    loki_seed = AdoptionRequest.objects.get(pet__name="Loki")
    loki_seed.status = AdoptionRequest.Status.APPROVED
    loki_seed.save()
    loki_new = _clone_as_new_request(AdoptionRequest.objects.get(pk=loki_seed.pk))

    out = StringIO()
    call_command("seed", stdout=out)

    assert "adoptions: 0 solicitudes creadas, 3 actualizadas" in out.getvalue()
    assert AdoptionRequest.objects.count() == 5

    rocco_seed.refresh_from_db()
    rocco_new.refresh_from_db()
    assert rocco_seed.status == AdoptionRequest.Status.REJECTED
    assert rocco_new.status == AdoptionRequest.Status.PENDING

    # La del seed no vuelve a pendiente: ya hay otra pendiente creada desde la app.
    loki_seed.refresh_from_db()
    loki_new.refresh_from_db()
    assert loki_seed.status == AdoptionRequest.Status.APPROVED
    assert loki_new.status == AdoptionRequest.Status.PENDING
