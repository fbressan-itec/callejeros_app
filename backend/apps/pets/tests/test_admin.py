"""Tests de permisos, solo lectura y baja lógica en el panel de admin de `apps.pets`."""

import pytest
from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory

from apps.pets.admin import (
    PetAdmin,
    PetHealthAdmin,
    PetPhotoAdmin,
    PetPhotoInline,
    PetStatusLogAdmin,
    PetStatusLogInline,
)
from apps.pets.models import Pet, PetHealth, PetPhoto, PetStatusLog
from apps.pets.tests.factories import PetFactory, PetPhotoFactory, PetStatusLogFactory
from apps.users.models import RoleCode
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _build_admin_request():
    request = RequestFactory().get("/admin/")
    request.user = UserFactory(role__code=RoleCode.ADMIN)
    return request


def test_pet_admin_blocks_physical_delete_and_protects_review_fields() -> None:
    request = _build_admin_request()
    pet = PetFactory(name="Loki")
    model_admin = PetAdmin(Pet, AdminSite())

    assert model_admin.has_delete_permission(request, pet) is False
    assert "delete_selected" not in model_admin.get_actions(request)
    assert "status" in model_admin.get_readonly_fields(request, pet)
    assert "is_urgent_validated" in model_admin.get_readonly_fields(request, pet)

    # Acciones de baja lógica y reactivación
    queryset = Pet.objects.filter(pk=pet.pk)
    model_admin.deactivate_selected(request, queryset)
    pet.refresh_from_db()
    assert pet.is_active is False

    model_admin.reactivate_selected(request, queryset)
    pet.refresh_from_db()
    assert pet.is_active is True


def test_pet_photo_and_health_admin_block_physical_delete() -> None:
    request = _build_admin_request()
    pet = PetFactory(name="Luna")
    photo = PetPhotoFactory(pet=pet, position=0)

    photo_admin = PetPhotoAdmin(PetPhoto, AdminSite())
    photo_inline = PetPhotoInline(Pet, AdminSite())
    health_admin = PetHealthAdmin(PetHealth, AdminSite())

    assert photo_admin.has_delete_permission(request, photo) is False
    assert "delete_selected" not in photo_admin.get_actions(request)
    assert photo_inline.has_delete_permission(request, pet) is False
    assert health_admin.has_delete_permission(request) is False
    assert "delete_selected" not in health_admin.get_actions(request)

    photo_admin.deactivate_selected(request, PetPhoto.objects.filter(pk=photo.pk))
    photo.refresh_from_db()
    assert photo.is_active is False


def test_pet_status_log_admin_is_strictly_read_only() -> None:
    request = _build_admin_request()
    log = PetStatusLogFactory()

    log_admin = PetStatusLogAdmin(PetStatusLog, AdminSite())
    log_inline = PetStatusLogInline(Pet, AdminSite())

    assert log_admin.has_add_permission(request) is False
    assert log_admin.has_change_permission(request, log) is False
    assert log_admin.has_delete_permission(request, log) is False
    assert "delete_selected" not in log_admin.get_actions(request)

    assert log_inline.has_add_permission(request, log.pet) is False
    assert log_inline.has_change_permission(request, log.pet) is False
    assert log_inline.has_delete_permission(request, log.pet) is False
