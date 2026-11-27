"""Tests del seed idempotente de notificaciones (`apps/notifications/seed.py`)."""

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from apps.notifications import seed as notifications_seed
from apps.notifications.models import Notification
from apps.users.models import User

pytestmark = pytest.mark.django_db


class TestNotificationsSeed:
    @override_settings(DEBUG=True, SEED_USER_PASSWORD="clave-seed-test-123")
    def test_seed_command_creates_notifications_idempotently(self):
        call_command("seed")
        first_count = Notification.objects.count()
        assert first_count == len(notifications_seed.SEED_NOTIFICATIONS)

        member = User.objects.get(email="miembro@callejeros.ar")
        assert Notification.objects.active().filter(recipient=member, is_read=False).count() == 3
        assert Notification.objects.active().filter(recipient=member, is_read=True).count() == 2

        # Correr seed una segunda vez actualiza sin duplicar.
        call_command("seed")
        assert Notification.objects.count() == first_count

    def test_seed_raises_clear_error_without_users(self):
        with pytest.raises(CommandError, match="No se encontró el usuario de prueba"):
            notifications_seed.run()
