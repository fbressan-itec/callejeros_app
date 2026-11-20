"""Tests del comando `python manage.py seed` y del descubrimiento de `seed.py` por app."""

from io import StringIO
from types import SimpleNamespace

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.core.management.commands import seed as seed_command
from apps.users import seed as users_seed


def test_get_seed_modules_finds_the_seed_of_each_own_app():
    seed_modules = dict(seed_command.get_seed_modules())

    assert seed_modules["users"] is users_seed
    assert all(hasattr(module, "run") for module in seed_modules.values())


@pytest.mark.django_db
def test_seed_runs_every_app_seed_in_order(settings, monkeypatch):
    settings.DEBUG = True
    calls = []
    fake_modules = [
        ("users", SimpleNamespace(run=lambda: calls.append("users") or "4 usuarios")),
        ("pets", SimpleNamespace(run=lambda: calls.append("pets") or "2 mascotas")),
    ]
    monkeypatch.setattr(seed_command, "get_seed_modules", lambda: fake_modules)
    stdout = StringIO()

    call_command("seed", stdout=stdout)

    assert calls == ["users", "pets"]
    output = stdout.getvalue()
    assert "users: 4 usuarios." in output
    assert "pets: 2 mascotas." in output
    assert "Seed completado." in output


@pytest.mark.django_db
def test_seed_fails_when_debug_is_false(settings, monkeypatch):
    settings.DEBUG = False
    calls = []
    fake_modules = [("users", SimpleNamespace(run=lambda: calls.append("users") or ""))]
    monkeypatch.setattr(seed_command, "get_seed_modules", lambda: fake_modules)

    with pytest.raises(CommandError, match="DJANGO_DEBUG=True"):
        call_command("seed")

    assert calls == []
