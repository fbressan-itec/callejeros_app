"""Factories de notificaciones para tests con factory_boy."""

import factory
from factory.django import DjangoModelFactory

from apps.notifications.models import Notification
from apps.users.tests.factories import UserFactory


class NotificationFactory(DjangoModelFactory):
    """Crea una notificación activa y sin leer para un usuario."""

    class Meta:
        model = Notification

    recipient = factory.SubFactory(UserFactory)
    title = factory.Sequence(lambda n: f"Notificación de prueba {n}")
    text = "Contenido informativo de la notificación."
    tag = Notification.Tag.COMMUNITY
    link = "/notificaciones"
    is_read = False
    read_at = None
    is_active = True
