"""Tests de los modelos de cuentas, migración de roles y createsuperuser."""

import pytest
from django.contrib.auth import authenticate
from django.core.management import call_command

from apps.users.models import (
    Role,
    RoleCode,
    User,
    UserPreferences,
    UserRoleLog,
    UserStatusLog,
)
from apps.users.tests.factories import RoleFactory, UserFactory


@pytest.mark.django_db
def test_data_migration_creates_the_four_roles():
    roles = dict(Role.objects.active().values_list("code", "name"))

    assert roles == {
        RoleCode.MEMBER: "Miembro de la comunidad",
        RoleCode.VERIFIED_SHELTER: "Refugio verificado",
        RoleCode.STAFF: "Staff Callejeros",
        RoleCode.ADMIN: "Admin",
    }


@pytest.mark.django_db
def test_create_user_assigns_member_role_and_default_preferences():
    user = User.objects.create_user(
        email="  Vecino@Callejeros.AR ",
        password="miPassword123",
        first_name="Lucía",
    )

    assert user.email == "vecino@callejeros.ar"
    assert user.check_password("miPassword123") is True
    assert user.password != "miPassword123"
    assert user.role.code == RoleCode.MEMBER
    assert user.is_active is True
    assert user.is_staff is False
    assert user.is_superuser is False

    prefs = UserPreferences.objects.get(user=user)
    assert prefs.notify_requests_and_posts is True
    assert prefs.notify_nearby_alerts is True
    assert prefs.notify_sponsored_updates is True
    assert prefs.notify_news_and_events is True
    assert prefs.notify_extra_channel is False
    assert prefs.show_phone_in_alerts is True
    assert prefs.show_photo_in_comments is True


@pytest.mark.django_db
def test_authenticate_matches_email_case_insensitively():
    user = User.objects.create_user(
        email="vecino@callejeros.ar",
        password="miPassword123",
        first_name="Lucía",
    )

    authenticated = authenticate(email="  VECINO@Callejeros.AR ", password="miPassword123")

    assert authenticated == user


@pytest.mark.django_db
def test_create_user_without_email_raises_value_error():
    with pytest.raises(ValueError, match="correo electrónico"):
        User.objects.create_user(email="", password="miPassword123", first_name="SinEmail")


@pytest.mark.django_db
def test_createsuperuser_command_assigns_admin_role(monkeypatch):
    monkeypatch.setenv("DJANGO_SUPERUSER_PASSWORD", "adminClaveSegura123")

    call_command(
        "createsuperuser",
        "--noinput",
        "--email=primeradmin@callejeros.ar",
        "--first_name=Franco",
    )

    admin_user = User.objects.get(email="primeradmin@callejeros.ar")
    assert admin_user.role.code == RoleCode.ADMIN
    assert admin_user.is_staff is True
    assert admin_user.is_superuser is True
    assert admin_user.check_password("adminClaveSegura123") is True
    assert UserPreferences.objects.filter(user=admin_user).exists()


@pytest.mark.django_db
def test_user_soft_delete_and_audit_logs():
    member = UserFactory(email="miembro1@callejeros.ar")
    admin_role = RoleFactory(code=RoleCode.ADMIN)
    admin = UserFactory(email="admin1@callejeros.ar", role=admin_role)
    staff_role = RoleFactory(code=RoleCode.STAFF)

    role_log = UserRoleLog.objects.create(
        user=member,
        previous_role=member.role,
        new_role=staff_role,
        performed_by=admin,
        note="Sumado al equipo de moderación",
    )
    member.role = staff_role
    member.save(update_fields=["role", "updated_at"])

    member.deactivate()
    status_log = UserStatusLog.objects.create(
        user=member,
        action=UserStatusLog.Action.DEACTIVATED,
        reason=UserStatusLog.Reason.SELF_DELETED,
        performed_by=member,
    )

    assert member.is_active is False
    assert member not in User.objects.active()
    assert role_log.new_role.code == RoleCode.STAFF
    assert status_log.action == UserStatusLog.Action.DEACTIVATED
