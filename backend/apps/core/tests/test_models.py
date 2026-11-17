"""Tests del BaseModel: fechas de auditoría y baja lógica."""

from datetime import timedelta
from unittest import mock

import pytest
from django.apps.registry import Apps
from django.db import connection, models
from django.utils import timezone

from apps.core.models import BaseModel


class DummyModel(BaseModel):
    """Modelo de prueba que hereda BaseModel (que es abstracto y no tiene tabla).

    Usa un registro de apps propio para no mezclarse con los modelos reales: su
    tabla se crea solo durante estos tests y no genera migraciones.
    """

    name = models.CharField(max_length=50)

    class Meta:
        app_label = "core"
        apps = Apps()


@pytest.fixture(scope="module", autouse=True)
def dummy_table(django_db_setup, django_db_blocker):
    with django_db_blocker.unblock():
        with connection.schema_editor() as editor:
            editor.create_model(DummyModel)
        yield
        with connection.schema_editor() as editor:
            editor.delete_model(DummyModel)


@pytest.mark.django_db
def test_new_row_is_active_and_has_audit_dates():
    row = DummyModel.objects.create(name="Loki")

    assert row.is_active is True
    assert row.created_at is not None
    assert row.updated_at is not None


@pytest.mark.django_db
def test_saving_again_updates_only_updated_at():
    row = DummyModel.objects.create(name="Loki")
    created_at = row.created_at
    later = timezone.now() + timedelta(minutes=5)

    with mock.patch("django.utils.timezone.now", return_value=later):
        row.name = "Loki II"
        row.save()

    row.refresh_from_db()
    assert row.created_at == created_at
    assert row.updated_at == later


@pytest.mark.django_db
def test_deactivate_marks_inactive_without_deleting():
    row = DummyModel.objects.create(name="Loki")

    row.deactivate()

    row.refresh_from_db()
    assert row.is_active is False
    assert DummyModel.objects.filter(pk=row.pk).exists()


@pytest.mark.django_db
def test_active_returns_only_active_rows():
    active = DummyModel.objects.create(name="Loki")
    inactive = DummyModel.objects.create(name="Luna")
    inactive.deactivate()

    result = list(DummyModel.objects.active())

    assert result == [active]
