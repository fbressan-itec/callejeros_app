"""Tests del modelo `Notification` (DB-01)."""

import pytest

from apps.notifications.models import Notification
from apps.notifications.tests.factories import NotificationFactory

pytestmark = pytest.mark.django_db


class TestNotificationModel:
    def test_defaults_and_str(self):
        notification = NotificationFactory(
            title="¡Tu publicación fue aprobada!",
            tag=Notification.Tag.POST,
        )

        assert notification.is_active is True
        assert notification.is_read is False
        assert notification.read_at is None
        assert notification.created_at is not None
        assert notification.updated_at is not None
        assert str(notification) == (
            f"¡Tu publicación fue aprobada! ({notification.recipient.email})"
        )

    def test_tag_choices_match_db01(self):
        assert set(Notification.Tag.values) == {
            "urgent",
            "community",
            "adoption",
            "fundraising",
            "post",
            "sponsorship",
        }

    def test_soft_delete_hides_from_active_queryset(self):
        notification = NotificationFactory()

        notification.deactivate()
        notification.refresh_from_db()

        assert notification.is_active is False
        assert not Notification.objects.active().filter(pk=notification.pk).exists()
        assert Notification.objects.filter(pk=notification.pk).exists()

    def test_composite_index_defined_on_recipient_is_read_created_at(self):
        index_fields = [tuple(idx.fields) for idx in Notification._meta.indexes]
        assert ("recipient", "is_read", "created_at") in index_fields
