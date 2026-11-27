"""Tests unitarios de los servicios del centro de notificaciones (BK-08a)."""

from datetime import timedelta

import pytest
from django.http import Http404
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.notifications.models import Notification
from apps.notifications.services import (
    create_notification,
    get_unread_notifications_count,
    get_user_notifications_queryset,
    mark_all_notifications_as_read,
    mark_notification_as_read,
)
from apps.notifications.tests.factories import NotificationFactory
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


class TestCreateNotification:
    def test_creates_notification_when_preference_is_enabled(self):
        user = UserFactory()

        notification = create_notification(
            recipient=user,
            title="  Tu publicación fue aprobada  ",
            text="  Loki ya aparece en el catálogo.  ",
            tag=Notification.Tag.POST,
            link=" /mascotas/1 ",
        )

        assert notification is not None
        assert notification.recipient == user
        assert notification.title == "Tu publicación fue aprobada"
        assert notification.text == "Loki ya aparece en el catálogo."
        assert notification.tag == Notification.Tag.POST
        assert notification.link == "/mascotas/1"
        assert notification.is_read is False
        assert notification.read_at is None

    @pytest.mark.parametrize(
        ("tag", "preference_field"),
        [
            (Notification.Tag.POST, "notify_requests_and_posts"),
            (Notification.Tag.ADOPTION, "notify_requests_and_posts"),
            (Notification.Tag.URGENT, "notify_nearby_alerts"),
            (Notification.Tag.SPONSORSHIP, "notify_sponsored_updates"),
            (Notification.Tag.COMMUNITY, "notify_news_and_events"),
            (Notification.Tag.FUNDRAISING, "notify_news_and_events"),
        ],
    )
    def test_respects_user_preferences_for_each_tag(self, tag, preference_field):
        user = UserFactory()
        setattr(user.preferences, preference_field, False)
        user.preferences.save(update_fields=[preference_field, "updated_at"])

        result = create_notification(
            recipient=user,
            title="Aviso",
            text="Detalle del aviso",
            tag=tag,
        )

        assert result is None
        assert Notification.objects.filter(recipient=user).count() == 0

    def test_explicit_preference_field_overrides_tag_mapping(self):
        user = UserFactory()
        user.preferences.notify_requests_and_posts = False
        user.preferences.save(update_fields=["notify_requests_and_posts", "updated_at"])

        result = create_notification(
            recipient=user,
            title="Aviso urgente de solicitud",
            text="Detalle",
            tag=Notification.Tag.URGENT,
            preference_field="notify_requests_and_posts",
        )

        assert result is None

    def test_skips_inactive_recipient(self):
        user = UserFactory(is_active=False)

        result = create_notification(
            recipient=user,
            title="Aviso",
            text="Detalle",
            tag=Notification.Tag.POST,
        )

        assert result is None
        assert Notification.objects.count() == 0

    def test_validates_required_fields_and_tag(self):
        user = UserFactory()

        with pytest.raises(ValidationError) as exc:
            create_notification(
                recipient=user,
                title="   ",
                text="",
                tag="invalida",
                link="x" * 256,
                preference_field="no_existe",
            )

        assert set(exc.value.detail.keys()) == {
            "title",
            "text",
            "tag",
            "link",
            "preference_field",
        }


class TestReadAndQueryNotifications:
    def test_lists_only_own_active_notifications_newest_first_with_filters(self):
        user = UserFactory()
        other = UserFactory()

        older = NotificationFactory(recipient=user, tag=Notification.Tag.POST, is_read=False)
        newer = NotificationFactory(recipient=user, tag=Notification.Tag.ADOPTION, is_read=True)
        NotificationFactory(recipient=user, is_active=False)
        NotificationFactory(recipient=other, tag=Notification.Tag.POST, is_read=False)

        all_own = list(get_user_notifications_queryset(actor=user))
        assert [n.id for n in all_own] == [newer.id, older.id]

        unread = list(get_user_notifications_queryset(actor=user, is_read_filter="false"))
        assert [n.id for n in unread] == [older.id]

        by_tag = list(get_user_notifications_queryset(actor=user, tag_filter=Notification.Tag.POST))
        assert [n.id for n in by_tag] == [older.id]

        assert get_unread_notifications_count(actor=user) == 1

    def test_invalid_filters_raise_validation_error(self):
        user = UserFactory()

        with pytest.raises(ValidationError) as exc_read:
            get_user_notifications_queryset(actor=user, is_read_filter="si")
        assert "is_read" in exc_read.value.detail

        with pytest.raises(ValidationError) as exc_tag:
            get_user_notifications_queryset(actor=user, tag_filter="desconocida")
        assert "tag" in exc_tag.value.detail

    def test_mark_notification_as_read_is_idempotent_and_protects_others(self):
        user = UserFactory()
        other = UserFactory()
        own = NotificationFactory(recipient=user, is_read=False)
        foreign = NotificationFactory(recipient=other, is_read=False)
        inactive = NotificationFactory(recipient=user, is_active=False)

        updated = mark_notification_as_read(notification_id=own.id, actor=user)
        assert updated.is_read is True
        assert updated.read_at is not None

        # Simula que fue leída antes: volver a marcarla no pisa `read_at`.
        original_read_at = timezone.now() - timedelta(hours=2)
        Notification.objects.filter(pk=own.id).update(read_at=original_read_at)
        again = mark_notification_as_read(notification_id=own.id, actor=user)
        assert again.read_at == original_read_at

        with pytest.raises(Http404):
            mark_notification_as_read(notification_id=foreign.id, actor=user)

        with pytest.raises(Http404):
            mark_notification_as_read(notification_id=inactive.id, actor=user)

    def test_mark_all_notifications_as_read_only_affects_own_active_unread(self):
        user = UserFactory()
        other = UserFactory()

        NotificationFactory.create_batch(2, recipient=user, is_read=False)
        already_read = NotificationFactory(
            recipient=user,
            is_read=True,
            read_at=timezone.now() - timedelta(days=1),
        )
        inactive = NotificationFactory(recipient=user, is_read=False, is_active=False)
        foreign = NotificationFactory(recipient=other, is_read=False)

        updated_count = mark_all_notifications_as_read(actor=user)

        assert updated_count == 2
        assert get_unread_notifications_count(actor=user) == 0

        already_read.refresh_from_db()
        inactive.refresh_from_db()
        foreign.refresh_from_db()
        assert inactive.is_read is False
        assert foreign.is_read is False
        assert already_read.read_at < timezone.now() - timedelta(hours=23)
