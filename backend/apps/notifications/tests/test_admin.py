"""Tests de la configuración de Django Admin para `apps.notifications`."""

import pytest
from django.contrib import admin
from django.contrib.messages.storage.fallback import FallbackStorage
from django.test import RequestFactory

from apps.notifications.models import Notification
from apps.notifications.tests.factories import NotificationFactory
from apps.users.models import RoleCode
from apps.users.tests.factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db


def _build_admin_request():
    admin_user = UserFactory(role=RoleFactory(code=RoleCode.ADMIN))
    request = RequestFactory().get("/admin/notifications/notification/")
    request.user = admin_user
    request.session = {}
    request._messages = FallbackStorage(request)
    return request


class TestNotificationAdmin:
    def test_notification_registered_without_physical_delete(self):
        model_admin = admin.site._registry[Notification]
        request = _build_admin_request()
        notification = NotificationFactory()

        assert model_admin.has_delete_permission(request, notification) is False
        actions = model_admin.get_actions(request)
        assert "delete_selected" not in actions
        assert "deactivate_selected" in actions
        assert "reactivate_selected" in actions

    def test_soft_delete_and_reactivate_actions_work(self):
        model_admin = admin.site._registry[Notification]
        request = _build_admin_request()
        notification = NotificationFactory(is_active=True)

        queryset = Notification.objects.filter(pk=notification.pk)
        model_admin.deactivate_selected(request, queryset)
        notification.refresh_from_db()
        assert notification.is_active is False

        model_admin.reactivate_selected(request, queryset)
        notification.refresh_from_db()
        assert notification.is_active is True
