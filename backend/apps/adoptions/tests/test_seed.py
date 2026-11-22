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
    assert approved.meeting_point != ""
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
