"""Tests unitarios del flujo de revisión de solicitudes de adopción (BK-07b)."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.adoptions.models import AdoptionRequest
from apps.adoptions.services import (
    INACTIVE_REQUEST_ERROR,
    MAX_MEETING_POINT_LENGTH,
    MAX_REJECTION_REASON_LENGTH,
    MEETING_POINT_REQUIRED_ERROR,
    MEETING_POINT_TOO_LONG_ERROR,
    ONLY_PENDING_REQUEST_ERROR,
    REJECTION_REASON_REQUIRED_ERROR,
    REJECTION_REASON_TOO_LONG_ERROR,
    AdoptionRequestReviewWorkflow,
    approve_adoption_request,
    get_adoption_review_queue_queryset,
    reject_adoption_request,
)
from apps.adoptions.tests.factories import AdoptionRequestFactory
from apps.users.models import RoleCode
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("role_code", [RoleCode.STAFF, RoleCode.ADMIN])
def test_approve_adoption_request_updates_status_and_metadata(role_code: str) -> None:
    reviewer = UserFactory(role__code=role_code)
    adoption_request = AdoptionRequestFactory()

    reviewed = approve_adoption_request(
        adoption_request=adoption_request,
        actor=reviewer,
        meeting_point="  Plaza Roca (frente a la Municipalidad)  ",
    )

    assert reviewed.status == AdoptionRequest.Status.APPROVED
    assert reviewed.meeting_point == "Plaza Roca (frente a la Municipalidad)"
    assert reviewed.rejection_reason == ""
    assert reviewed.reviewed_by_id == reviewer.pk
    assert reviewed.reviewed_at is not None


@pytest.mark.parametrize("role_code", [RoleCode.STAFF, RoleCode.ADMIN])
def test_reject_adoption_request_updates_status_and_metadata(role_code: str) -> None:
    reviewer = UserFactory(role__code=role_code)
    adoption_request = AdoptionRequestFactory()

    reviewed = reject_adoption_request(
        adoption_request=adoption_request,
        actor=reviewer,
        rejection_reason="  El patio no está cerrado y el animal requiere contención.  ",
    )

    assert reviewed.status == AdoptionRequest.Status.REJECTED
    assert reviewed.rejection_reason == "El patio no está cerrado y el animal requiere contención."
    assert reviewed.meeting_point == ""
    assert reviewed.reviewed_by_id == reviewer.pk
    assert reviewed.reviewed_at is not None


@pytest.mark.parametrize("role_code", [RoleCode.MEMBER, RoleCode.VERIFIED_SHELTER])
def test_non_staff_cannot_approve_or_reject_in_service(role_code: str) -> None:
    actor = UserFactory(role__code=role_code)
    adoption_request = AdoptionRequestFactory()

    with pytest.raises(PermissionDenied):
        approve_adoption_request(
            adoption_request=adoption_request,
            actor=actor,
            meeting_point="Plaza Roca",
        )

    with pytest.raises(PermissionDenied):
        reject_adoption_request(
            adoption_request=adoption_request,
            actor=actor,
            rejection_reason="Motivo de prueba",
        )


def test_inactive_staff_cannot_review_in_service() -> None:
    staff = UserFactory(role__code=RoleCode.STAFF)
    staff.deactivate()
    adoption_request = AdoptionRequestFactory()

    with pytest.raises(PermissionDenied):
        approve_adoption_request(
            adoption_request=adoption_request,
            actor=staff,
            meeting_point="Plaza Roca",
        )


def test_approve_validates_meeting_point_required_and_max_length() -> None:
    staff = UserFactory(role__code=RoleCode.STAFF)
    adoption_request = AdoptionRequestFactory()

    with pytest.raises(ValidationError) as blank_exc:
        approve_adoption_request(
            adoption_request=adoption_request,
            actor=staff,
            meeting_point="   ",
        )
    assert blank_exc.value.detail["meeting_point"] == [MEETING_POINT_REQUIRED_ERROR]

    with pytest.raises(ValidationError) as long_exc:
        approve_adoption_request(
            adoption_request=adoption_request,
            actor=staff,
            meeting_point="x" * (MAX_MEETING_POINT_LENGTH + 1),
        )
    assert long_exc.value.detail["meeting_point"] == [MEETING_POINT_TOO_LONG_ERROR]


def test_reject_validates_rejection_reason_required_and_max_length() -> None:
    staff = UserFactory(role__code=RoleCode.STAFF)
    adoption_request = AdoptionRequestFactory()

    with pytest.raises(ValidationError) as blank_exc:
        reject_adoption_request(
            adoption_request=adoption_request,
            actor=staff,
            rejection_reason="   ",
        )
    assert blank_exc.value.detail["rejection_reason"] == [REJECTION_REASON_REQUIRED_ERROR]

    with pytest.raises(ValidationError) as long_exc:
        reject_adoption_request(
            adoption_request=adoption_request,
            actor=staff,
            rejection_reason="x" * (MAX_REJECTION_REASON_LENGTH + 1),
        )
    assert long_exc.value.detail["rejection_reason"] == [REJECTION_REASON_TOO_LONG_ERROR]


@pytest.mark.parametrize(
    "current_status",
    [AdoptionRequest.Status.APPROVED, AdoptionRequest.Status.REJECTED],
)
def test_cannot_review_already_resolved_request(current_status: str) -> None:
    staff = UserFactory(role__code=RoleCode.STAFF)
    adoption_request = AdoptionRequestFactory(status=current_status)

    with pytest.raises(ValidationError) as approve_exc:
        approve_adoption_request(
            adoption_request=adoption_request,
            actor=staff,
            meeting_point="Plaza Roca",
        )
    assert approve_exc.value.detail["status"] == [ONLY_PENDING_REQUEST_ERROR]

    with pytest.raises(ValidationError) as reject_exc:
        reject_adoption_request(
            adoption_request=adoption_request,
            actor=staff,
            rejection_reason="Motivo",
        )
    assert reject_exc.value.detail["status"] == [ONLY_PENDING_REQUEST_ERROR]


def test_cannot_review_inactive_request() -> None:
    staff = UserFactory(role__code=RoleCode.STAFF)
    adoption_request = AdoptionRequestFactory()
    adoption_request.deactivate()

    with pytest.raises(ValidationError) as exc_info:
        approve_adoption_request(
            adoption_request=adoption_request,
            actor=staff,
            meeting_point="Plaza Roca",
        )
    assert exc_info.value.detail["detail"] == [INACTIVE_REQUEST_ERROR]


def test_workflow_invokes_notification_hooks() -> None:
    events: list[tuple[str, int, int]] = []

    class TrackingWorkflow(AdoptionRequestReviewWorkflow):
        def on_approved(self, *, adoption_request, actor) -> None:
            events.append(("approved", adoption_request.pk, actor.pk))

        def on_rejected(self, *, adoption_request, actor) -> None:
            events.append(("rejected", adoption_request.pk, actor.pk))

    workflow = TrackingWorkflow()
    staff = UserFactory(role__code=RoleCode.STAFF)
    req_a = AdoptionRequestFactory()
    req_b = AdoptionRequestFactory()

    workflow.approve(adoption_request=req_a, actor=staff, meeting_point="Plaza Olmos")
    workflow.reject(adoption_request=req_b, actor=staff, rejection_reason="Motivo")

    assert events == [
        ("approved", req_a.pk, staff.pk),
        ("rejected", req_b.pk, staff.pk),
    ]


def test_review_queue_queryset_returns_active_pending_oldest_first() -> None:
    now = timezone.now()
    newer = AdoptionRequestFactory(status=AdoptionRequest.Status.PENDING)
    older = AdoptionRequestFactory(status=AdoptionRequest.Status.PENDING)
    AdoptionRequest.objects.filter(pk=older.pk).update(created_at=now - timedelta(days=3))
    AdoptionRequest.objects.filter(pk=newer.pk).update(created_at=now - timedelta(days=1))

    AdoptionRequestFactory(status=AdoptionRequest.Status.APPROVED)
    AdoptionRequestFactory(status=AdoptionRequest.Status.REJECTED)
    inactive = AdoptionRequestFactory(status=AdoptionRequest.Status.PENDING)
    inactive.deactivate()

    assert list(get_adoption_review_queue_queryset()) == [older, newer]
