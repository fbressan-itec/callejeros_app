"""Tests unitarios del flujo de revisión reutilizable aplicado a mascotas (BK-06a)."""

import pytest
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.core.review import (
    DEFAULT_APPROVE_NOTE,
    DEFAULT_REJECT_NOTE,
    INACTIVE_REVIEW_OBJECT_ERROR,
    ONLY_IN_REVIEW_ERROR,
)
from apps.pets.models import Pet, PetStatusLog
from apps.pets.services import PetReviewWorkflow, approve_pet, reject_pet
from apps.pets.tests.factories import PetFactory
from apps.users.models import RoleCode
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _last_log(pet: Pet) -> PetStatusLog:
    return PetStatusLog.objects.filter(pet=pet).latest("id")


@pytest.mark.parametrize("role_code", [RoleCode.STAFF, RoleCode.ADMIN])
def test_approve_moves_in_review_to_published_and_logs_default_note(role_code: str) -> None:
    reviewer = UserFactory(role__code=role_code)
    pet = PetFactory(status=Pet.Status.IN_REVIEW)

    approved = approve_pet(pet=pet, actor=reviewer)

    pet.refresh_from_db()
    assert approved.status == pet.status == Pet.Status.PUBLISHED
    log = _last_log(pet)
    assert log.previous_status == Pet.Status.IN_REVIEW
    assert log.new_status == Pet.Status.PUBLISHED
    assert log.performed_by == reviewer
    assert log.note == DEFAULT_APPROVE_NOTE


def test_approve_keeps_custom_note_stripped() -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    pet = PetFactory()

    approve_pet(pet=pet, actor=reviewer, note="  Fotos y datos verificados.  ")

    assert _last_log(pet).note == "Fotos y datos verificados."


@pytest.mark.parametrize("role_code", [RoleCode.STAFF, RoleCode.ADMIN])
def test_reject_moves_in_review_to_rejected_with_reason(role_code: str) -> None:
    reviewer = UserFactory(role__code=role_code)
    pet = PetFactory()

    reject_pet(pet=pet, actor=reviewer, note="Las fotos no son de la mascota.")

    pet.refresh_from_db()
    assert pet.status == Pet.Status.REJECTED
    log = _last_log(pet)
    assert log.previous_status == Pet.Status.IN_REVIEW
    assert log.new_status == Pet.Status.REJECTED
    assert log.performed_by == reviewer
    assert log.note == "Las fotos no son de la mascota."


@pytest.mark.parametrize("blank_note", ["", "   "])
def test_reject_without_reason_uses_generic_default_note(blank_note: str) -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    pet = PetFactory()

    reject_pet(pet=pet, actor=reviewer, note=blank_note)

    assert _last_log(pet).note == DEFAULT_REJECT_NOTE


@pytest.mark.parametrize("review", [approve_pet, reject_pet])
@pytest.mark.parametrize(
    "initial_status",
    [Pet.Status.PUBLISHED, Pet.Status.REJECTED, Pet.Status.ADOPTED],
)
def test_review_rejects_pets_not_in_review(review, initial_status: str) -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    pet = PetFactory(status=initial_status)
    logs_before = PetStatusLog.objects.count()

    with pytest.raises(ValidationError) as exc_info:
        review(pet=pet, actor=reviewer)

    assert exc_info.value.detail["status"] == [ONLY_IN_REVIEW_ERROR]
    pet.refresh_from_db()
    assert pet.status == initial_status
    assert PetStatusLog.objects.count() == logs_before


@pytest.mark.parametrize("review", [approve_pet, reject_pet])
def test_review_rejects_inactive_pets(review) -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    pet = PetFactory(is_active=False)

    with pytest.raises(ValidationError) as exc_info:
        review(pet=pet, actor=reviewer)

    assert exc_info.value.detail["detail"] == [INACTIVE_REVIEW_OBJECT_ERROR]


@pytest.mark.parametrize("review", [approve_pet, reject_pet])
@pytest.mark.parametrize("role_code", [RoleCode.MEMBER, RoleCode.VERIFIED_SHELTER])
def test_review_forbidden_for_member_and_verified_shelter(review, role_code: str) -> None:
    actor = UserFactory(role__code=role_code)
    pet = PetFactory(published_by=actor)

    with pytest.raises(PermissionDenied):
        review(pet=pet, actor=actor)

    pet.refresh_from_db()
    assert pet.status == Pet.Status.IN_REVIEW


def test_review_forbidden_for_inactive_staff() -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF, is_active=False)
    pet = PetFactory()

    with pytest.raises(PermissionDenied):
        approve_pet(pet=pet, actor=reviewer)


def test_review_rejects_reason_longer_than_log_note_field() -> None:
    reviewer = UserFactory(role__code=RoleCode.STAFF)
    pet = PetFactory()

    with pytest.raises(ValidationError) as exc_info:
        reject_pet(pet=pet, actor=reviewer, note="x" * 256)

    assert "note" in exc_info.value.detail
    pet.refresh_from_db()
    assert pet.status == Pet.Status.IN_REVIEW


def test_workflow_hooks_allow_extending_without_touching_the_base_logic() -> None:
    """Una clase hija engancha acciones extra (como hará BK-08 con las notificaciones)."""
    calls: list[tuple[str, int]] = []

    class RecordingWorkflow(PetReviewWorkflow):
        def on_approved(self, *, obj, actor) -> None:
            calls.append(("approved", obj.pk))

        def on_rejected(self, *, obj, actor) -> None:
            calls.append(("rejected", obj.pk))

    reviewer = UserFactory(role__code=RoleCode.STAFF)
    first, second = PetFactory(), PetFactory()

    workflow = RecordingWorkflow()
    workflow.approve(obj=first, actor=reviewer)
    workflow.reject(obj=second, actor=reviewer)

    assert calls == [("approved", first.pk), ("rejected", second.pk)]
