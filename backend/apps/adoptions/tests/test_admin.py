"""Tests de permisos, solo lectura y baja lógica en el panel de admin de `apps.adoptions`."""

import pytest
from django.contrib import messages
from django.contrib.admin.sites import AdminSite
from django.contrib.messages.storage.fallback import FallbackStorage
from django.contrib.sessions.middleware import SessionMiddleware
from django.test import RequestFactory

from apps.adoptions.admin import AdoptionRequestAdmin
from apps.adoptions.models import AdoptionRequest
from apps.adoptions.tests.factories import AdoptionRequestFactory
from apps.pets.models import Pet
from apps.pets.tests.factories import PetFactory
from apps.users.models import RoleCode
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _build_admin_request():
    request = RequestFactory().get("/admin/")
    request.user = UserFactory(role__code=RoleCode.ADMIN)
    SessionMiddleware(lambda req: None).process_request(request)
    request.session.save()
    request._messages = FallbackStorage(request)
    return request


def test_adoption_request_admin_blocks_physical_delete_and_protects_review_fields() -> None:
    request = _build_admin_request()
    adoption_request = AdoptionRequestFactory()
    model_admin = AdoptionRequestAdmin(AdoptionRequest, AdminSite())

    assert model_admin.has_delete_permission(request, adoption_request) is False
    assert "delete_selected" not in model_admin.get_actions(request)

    readonly = model_admin.get_readonly_fields(request, adoption_request)
    assert "status" in readonly
    assert "reviewed_by" in readonly
    assert "reviewed_at" in readonly

    queryset = AdoptionRequest.objects.filter(pk=adoption_request.pk)
    model_admin.deactivate_selected(request, queryset)
    adoption_request.refresh_from_db()
    assert adoption_request.is_active is False

    model_admin.reactivate_selected(request, queryset)
    adoption_request.refresh_from_db()
    assert adoption_request.is_active is True


def test_adoption_request_admin_reactivate_warns_on_pending_conflict() -> None:
    request = _build_admin_request()
    applicant = UserFactory()
    pet = PetFactory(name="Loki", status=Pet.Status.PUBLISHED)

    old_req = AdoptionRequestFactory(applicant=applicant, pet=pet, full_name="Tomás Gómez")
    old_req.deactivate()

    # Ya existe otra solicitud pendiente activa del mismo usuario para la misma mascota
    AdoptionRequestFactory(applicant=applicant, pet=pet, full_name="Tomás Gómez")

    model_admin = AdoptionRequestAdmin(AdoptionRequest, AdminSite())
    model_admin.reactivate_selected(request, AdoptionRequest.objects.filter(pk=old_req.pk))

    old_req.refresh_from_db()
    assert old_req.is_active is False

    stored_messages = list(messages.get_messages(request))
    assert any(m.level == messages.WARNING for m in stored_messages)
    assert any(f"Solicitud #{old_req.pk}" in m.message for m in stored_messages)
