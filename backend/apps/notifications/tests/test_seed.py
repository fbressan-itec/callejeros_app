"""Tests del seed idempotente de notificaciones (`apps/notifications/seed.py`)."""

from datetime import timedelta

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings
from django.utils import timezone

from apps.notifications import seed as notifications_seed
from apps.notifications.models import Notification
from apps.notifications.services import get_user_notifications_queryset
from apps.users.models import User

pytestmark = pytest.mark.django_db


class TestNotificationsSeed:
    @override_settings(DEBUG=True, SEED_USER_PASSWORD="clave-seed-test-123")
    def test_seed_command_creates_notifications_idempotently_and_in_mockup_order(self):
        call_command("seed")
        first_count = Notification.objects.count()
        assert first_count == len(notifications_seed.SEED_NOTIFICATIONS)

        member = User.objects.get(email="miembro@callejeros.ar")
        assert Notification.objects.active().filter(recipient=member, is_read=False).count() == 3
        assert Notification.objects.active().filter(recipient=member, is_read=True).count() == 2

        ordered_titles = list(
            get_user_notifications_queryset(actor=member).values_list("title", flat=True)
        )
        assert ordered_titles == [
            "Alerta Perro Perdido en Centro",
            "Jornada de Castración Gratuita",
            "Cachorritos Huérfanos Rescatados",
            "¡Final Feliz!",
            "Colecta de Mantas y Alimento",
        ]

        # Preserva el `read_at` de las notificaciones ya leídas al volver a correr `seed`.
        read_notification = Notification.objects.get(recipient=member, title="¡Final Feliz!")
        original_read_at = timezone.now() - timedelta(hours=5)
        Notification.objects.filter(pk=read_notification.pk).update(read_at=original_read_at)

        call_command("seed")
        assert Notification.objects.count() == first_count

        read_notification.refresh_from_db()
        assert read_notification.read_at == original_read_at

    def test_seed_raises_clear_error_without_users(self):
        with pytest.raises(CommandError, match="No se encontró el usuario de prueba"):
            notifications_seed.run()
