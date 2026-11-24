"""Tests de los datos de prueba de cuentas (`apps/users/seed.py`)."""

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.users.models import RoleCode, User, UserPreferences


@pytest.mark.django_db
def test_seed_creates_one_user_per_role_and_is_idempotent(settings):
    settings.DEBUG = True
    settings.SEED_USER_PASSWORD = "claveSeedSegura123"

    call_command("seed")
    first_run_count = User.objects.count()
    call_command("seed")

    assert first_run_count == 4
    assert User.objects.count() == 4

    expected_roles = {
        RoleCode.MEMBER,
        RoleCode.VERIFIED_SHELTER,
        RoleCode.STAFF,
        RoleCode.ADMIN,
    }
    seeded_roles = set(User.objects.values_list("role__code", flat=True))
    assert seeded_roles == expected_roles

    shelter = User.objects.get(role__code=RoleCode.VERIFIED_SHELTER)
    assert shelter.shelter_public_address != ""
    assert set(
        User.objects.exclude(role__code=RoleCode.VERIFIED_SHELTER).values_list(
            "shelter_public_address", flat=True
        )
    ) == {""}

    for user in User.objects.all():
        assert user.check_password("claveSeedSegura123") is True
        assert UserPreferences.objects.filter(user=user).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("invalid_password", ["", "12345"])
def test_seed_fails_when_password_is_missing_or_too_short(settings, invalid_password):
    settings.DEBUG = True
    settings.SEED_USER_PASSWORD = invalid_password

    with pytest.raises(CommandError, match="SEED_USER_PASSWORD"):
        call_command("seed")
