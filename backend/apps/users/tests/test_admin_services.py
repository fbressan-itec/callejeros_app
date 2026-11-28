"""Tests unitarios de servicios de administración de usuarios y roles (BK-15a)."""

import pytest
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.users.models import Role, RoleCode, UserRoleLog, UserStatusLog
from apps.users.services import (
    ADMIN_NOTE_TOO_LONG_ERROR,
    CANNOT_DEACTIVATE_SELF_ERROR,
    CANNOT_DEMOTE_SELF_ERROR,
    INVALID_ROLE_ERROR,
    LAST_ADMIN_DEACTIVATE_ERROR,
    LAST_ADMIN_ROLE_ERROR,
    MAX_ADMIN_NOTE_LENGTH,
    change_user_role,
    deactivate_user,
    issue_tokens_for_user,
    reactivate_user,
)
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "actor_role,actor_active",
    [
        (None, False),
        (RoleCode.MEMBER, True),
        (RoleCode.VERIFIED_SHELTER, True),
        (RoleCode.STAFF, True),
        (RoleCode.ADMIN, False),
    ],
)
def test_admin_services_reject_non_admin_or_inactive_actors(
    actor_role: str | None,
    actor_active: bool,
) -> None:
    actor = (
        None if actor_role is None else UserFactory(role__code=actor_role, is_active=actor_active)
    )
    target = UserFactory(role__code=RoleCode.MEMBER)

    with pytest.raises(PermissionDenied):
        change_user_role(target_user=target, new_role_code=RoleCode.STAFF, actor=actor)

    with pytest.raises(PermissionDenied):
        deactivate_user(target_user=target, actor=actor)

    inactive_target = UserFactory(role__code=RoleCode.MEMBER, is_active=False)
    with pytest.raises(PermissionDenied):
        reactivate_user(target_user=inactive_target, actor=actor)


def test_change_user_role_updates_role_and_creates_audit_log() -> None:
    admin = UserFactory(role__code=RoleCode.ADMIN)
    member = UserFactory(role__code=RoleCode.MEMBER)

    updated = change_user_role(
        target_user=member,
        new_role_code=RoleCode.VERIFIED_SHELTER,
        actor=admin,
        note="  Refugio validado por el equipo  ",
    )

    updated.refresh_from_db()
    assert updated.role.code == RoleCode.VERIFIED_SHELTER

    log = UserRoleLog.objects.get(user=member)
    assert log.previous_role.code == RoleCode.MEMBER
    assert log.new_role.code == RoleCode.VERIFIED_SHELTER
    assert log.performed_by == admin
    assert log.note == "Refugio validado por el equipo"


def test_change_user_role_is_idempotent_when_role_does_not_change() -> None:
    admin = UserFactory(role__code=RoleCode.ADMIN)
    staff = UserFactory(role__code=RoleCode.STAFF)

    result = change_user_role(
        target_user=staff,
        new_role_code=RoleCode.STAFF,
        actor=admin,
        note="Sin cambio real",
    )

    assert result.role.code == RoleCode.STAFF
    assert UserRoleLog.objects.filter(user=staff).count() == 0


def test_change_user_role_rejects_invalid_or_inactive_role_and_long_note() -> None:
    admin = UserFactory(role__code=RoleCode.ADMIN)
    member = UserFactory(role__code=RoleCode.MEMBER)

    with pytest.raises(ValidationError) as exc_info:
        change_user_role(target_user=member, new_role_code="super_mega_admin", actor=admin)
    assert INVALID_ROLE_ERROR in str(exc_info.value.detail["role"])

    with pytest.raises(ValidationError) as note_exc:
        change_user_role(
            target_user=member,
            new_role_code=RoleCode.STAFF,
            actor=admin,
            note="x" * (MAX_ADMIN_NOTE_LENGTH + 1),
        )
    assert ADMIN_NOTE_TOO_LONG_ERROR in str(note_exc.value.detail["note"])

    shelter_role = Role.objects.get(code=RoleCode.VERIFIED_SHELTER)
    shelter_role.deactivate()
    with pytest.raises(ValidationError) as inactive_exc:
        change_user_role(
            target_user=member,
            new_role_code=RoleCode.VERIFIED_SHELTER,
            actor=admin,
        )
    assert INVALID_ROLE_ERROR in str(inactive_exc.value.detail["role"])


def test_admin_cannot_demote_self_even_with_another_active_admin() -> None:
    admin_1 = UserFactory(role__code=RoleCode.ADMIN)
    UserFactory(role__code=RoleCode.ADMIN)

    with pytest.raises(ValidationError) as exc_info:
        change_user_role(target_user=admin_1, new_role_code=RoleCode.STAFF, actor=admin_1)

    assert CANNOT_DEMOTE_SELF_ERROR in str(exc_info.value.detail["role"])
    admin_1.refresh_from_db()
    assert admin_1.role.code == RoleCode.ADMIN
    assert UserRoleLog.objects.count() == 0


def test_admin_can_demote_another_admin_while_keeping_at_least_one_active() -> None:
    admin_1 = UserFactory(role__code=RoleCode.ADMIN)
    admin_2 = UserFactory(role__code=RoleCode.ADMIN)

    updated = change_user_role(
        target_user=admin_2,
        new_role_code=RoleCode.STAFF,
        actor=admin_1,
        note="Pasa a rol Staff",
    )

    assert updated.role.code == RoleCode.STAFF
    log = UserRoleLog.objects.get(user=admin_2)
    assert log.previous_role.code == RoleCode.ADMIN
    assert log.new_role.code == RoleCode.STAFF
    assert log.performed_by == admin_1


def test_cannot_demote_last_active_admin(monkeypatch: pytest.MonkeyPatch) -> None:
    only_admin = UserFactory(role__code=RoleCode.ADMIN)
    other_actor = UserFactory(role__code=RoleCode.ADMIN, is_active=False)

    # Simulamos un actor distinto aprobado por permisos para ejercitar la guarda de último Admin.
    monkeypatch.setattr("apps.users.services._ensure_admin_actor", lambda actor: None)

    with pytest.raises(ValidationError) as exc_info:
        change_user_role(target_user=only_admin, new_role_code=RoleCode.STAFF, actor=other_actor)

    assert LAST_ADMIN_ROLE_ERROR in str(exc_info.value.detail["role"])
    only_admin.refresh_from_db()
    assert only_admin.role.code == RoleCode.ADMIN


def test_deactivate_user_sets_inactive_logs_action_and_blacklists_refresh_tokens() -> None:
    admin = UserFactory(role__code=RoleCode.ADMIN)
    member = UserFactory(role__code=RoleCode.MEMBER)

    tokens_1 = issue_tokens_for_user(member, remember_me=False)
    tokens_2 = issue_tokens_for_user(member, remember_me=True)
    assert OutstandingToken.objects.filter(user=member).count() == 2

    deactivated = deactivate_user(
        target_user=member,
        actor=admin,
        note="  Incumplimiento reiterado  ",
    )

    deactivated.refresh_from_db()
    assert deactivated.is_active is False

    log = UserStatusLog.objects.get(user=member)
    assert log.action == UserStatusLog.Action.DEACTIVATED
    assert log.reason == UserStatusLog.Reason.ADMIN_ACTION
    assert log.performed_by == admin
    assert log.note == "Incumplimiento reiterado"

    # Todos los refresh tokens emitidos quedaron en lista negra y fallan al refrescar.
    assert BlacklistedToken.objects.filter(token__user=member).count() == 2
    client = APIClient()
    for token_pair in (tokens_1, tokens_2):
        response = client.post("/api/auth/refresh/", {"refresh": token_pair["refresh"]})
        assert response.status_code == 401


def test_deactivate_user_is_idempotent_and_validates_note_length() -> None:
    admin = UserFactory(role__code=RoleCode.ADMIN)
    inactive_member = UserFactory(role__code=RoleCode.MEMBER, is_active=False)
    issue_tokens_for_user(inactive_member, remember_me=False)

    result = deactivate_user(target_user=inactive_member, actor=admin)

    assert result.is_active is False
    assert UserStatusLog.objects.filter(user=inactive_member).count() == 0
    assert BlacklistedToken.objects.filter(token__user=inactive_member).count() == 1

    active_member = UserFactory(role__code=RoleCode.MEMBER)
    with pytest.raises(ValidationError) as exc_info:
        deactivate_user(
            target_user=active_member,
            actor=admin,
            note="a" * (MAX_ADMIN_NOTE_LENGTH + 1),
        )
    assert ADMIN_NOTE_TOO_LONG_ERROR in str(exc_info.value.detail["note"])


def test_admin_cannot_deactivate_self_even_with_another_active_admin() -> None:
    admin_1 = UserFactory(role__code=RoleCode.ADMIN)
    UserFactory(role__code=RoleCode.ADMIN)

    with pytest.raises(ValidationError) as exc_info:
        deactivate_user(target_user=admin_1, actor=admin_1)

    assert CANNOT_DEACTIVATE_SELF_ERROR in str(exc_info.value.detail["is_active"])
    admin_1.refresh_from_db()
    assert admin_1.is_active is True
    assert UserStatusLog.objects.count() == 0


def test_admin_can_deactivate_another_active_admin_when_another_remains() -> None:
    admin_1 = UserFactory(role__code=RoleCode.ADMIN)
    admin_2 = UserFactory(role__code=RoleCode.ADMIN)
    issue_tokens_for_user(admin_2, remember_me=True)

    deactivated = deactivate_user(target_user=admin_2, actor=admin_1, note="Baja temporal")

    assert deactivated.is_active is False
    assert BlacklistedToken.objects.filter(token__user=admin_2).count() == 1
    log = UserStatusLog.objects.get(user=admin_2)
    assert log.action == UserStatusLog.Action.DEACTIVATED
    assert log.reason == UserStatusLog.Reason.ADMIN_ACTION
    assert log.performed_by == admin_1


def test_cannot_deactivate_last_active_admin_even_via_self_delete() -> None:
    only_admin = UserFactory(role__code=RoleCode.ADMIN)

    with pytest.raises(ValidationError) as exc_info:
        deactivate_user(
            target_user=only_admin,
            actor=only_admin,
            reason=UserStatusLog.Reason.SELF_DELETED,
        )

    assert LAST_ADMIN_DEACTIVATE_ERROR in str(exc_info.value.detail["is_active"])
    only_admin.refresh_from_db()
    assert only_admin.is_active is True


def test_self_delete_only_allowed_for_own_account() -> None:
    member_1 = UserFactory(role__code=RoleCode.MEMBER)
    member_2 = UserFactory(role__code=RoleCode.MEMBER)

    with pytest.raises(PermissionDenied):
        deactivate_user(
            target_user=member_2,
            actor=member_1,
            reason=UserStatusLog.Reason.SELF_DELETED,
        )

    deactivate_user(
        target_user=member_1,
        actor=member_1,
        reason=UserStatusLog.Reason.SELF_DELETED,
    )
    member_1.refresh_from_db()
    assert member_1.is_active is False
    log = UserStatusLog.objects.get(user=member_1)
    assert log.reason == UserStatusLog.Reason.SELF_DELETED


def test_reactivate_user_sets_active_logs_action_and_is_idempotent() -> None:
    admin = UserFactory(role__code=RoleCode.ADMIN)
    member = UserFactory(role__code=RoleCode.MEMBER, is_active=False)

    reactivated = reactivate_user(
        target_user=member,
        actor=admin,
        note="  Cuenta verificada nuevamente  ",
    )

    reactivated.refresh_from_db()
    assert reactivated.is_active is True

    log = UserStatusLog.objects.get(user=member)
    assert log.action == UserStatusLog.Action.REACTIVATED
    assert log.reason == UserStatusLog.Reason.ADMIN_ACTION
    assert log.performed_by == admin
    assert log.note == "Cuenta verificada nuevamente"

    # Llamar de nuevo no duplica el log.
    reactivate_user(target_user=member, actor=admin)
    assert UserStatusLog.objects.filter(user=member).count() == 1

    with pytest.raises(ValidationError) as exc_info:
        reactivate_user(
            target_user=member,
            actor=admin,
            note="z" * (MAX_ADMIN_NOTE_LENGTH + 1),
        )
    assert ADMIN_NOTE_TOO_LONG_ERROR in str(exc_info.value.detail["note"])
