"""Tests de integración de la API de notificaciones y esquema OpenAPI (BK-08a)."""

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.notifications.models import Notification
from apps.notifications.tests.factories import NotificationFactory
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


class TestNotificationsApi:
    def test_anonymous_requests_are_rejected_with_401(self):
        client = APIClient()
        notification = NotificationFactory()

        assert client.get(reverse("notifications-list")).status_code == status.HTTP_401_UNAUTHORIZED
        assert (
            client.get(reverse("notifications-unread-count")).status_code
            == status.HTTP_401_UNAUTHORIZED
        )
        assert (
            client.post(reverse("notifications-mark-read", args=[notification.id])).status_code
            == status.HTTP_401_UNAUTHORIZED
        )
        assert (
            client.post(reverse("notifications-read-all")).status_code
            == status.HTTP_401_UNAUTHORIZED
        )

    def test_list_returns_paginated_own_notifications_with_filters(self):
        user = UserFactory()
        other = UserFactory()

        NotificationFactory.create_batch(14, recipient=user, tag=Notification.Tag.COMMUNITY)
        unread_post = NotificationFactory(
            recipient=user,
            title="Publicación aprobada",
            tag=Notification.Tag.POST,
            is_read=False,
            link="/mascotas/1",
        )
        NotificationFactory(recipient=other, title="Ajena")

        client = _auth_client(user)

        res_page_1 = client.get(reverse("notifications-list"))
        assert res_page_1.status_code == status.HTTP_200_OK
        assert res_page_1.data["count"] == 15
        assert len(res_page_1.data["results"]) == 12
        assert res_page_1.data["next"] is not None
        first = res_page_1.data["results"][0]
        assert first["id"] == unread_post.id
        assert first["tag"] == Notification.Tag.POST
        assert first["tag_label"] == "Publicación"
        assert first["link"] == "/mascotas/1"
        assert first["is_read"] is False
        assert first["read_at"] is None

        res_page_2 = client.get(reverse("notifications-list"), {"page": 2})
        assert res_page_2.status_code == status.HTTP_200_OK
        assert len(res_page_2.data["results"]) == 3

        res_filtered = client.get(
            reverse("notifications-list"),
            {"is_read": "false", "tag": Notification.Tag.POST},
        )
        assert res_filtered.status_code == status.HTTP_200_OK
        assert res_filtered.data["count"] == 1
        assert res_filtered.data["results"][0]["id"] == unread_post.id

        res_bad = client.get(reverse("notifications-list"), {"is_read": "invalid"})
        assert res_bad.status_code == status.HTTP_400_BAD_REQUEST

        res_bad_tag = client.get(reverse("notifications-list"), {"tag": "inexistente"})
        assert res_bad_tag.status_code == status.HTTP_400_BAD_REQUEST

    def test_unread_count_and_mark_read_endpoints(self):
        user = UserFactory()
        other = UserFactory()
        n1 = NotificationFactory(recipient=user, is_read=False)
        n2 = NotificationFactory(recipient=user, is_read=False)
        NotificationFactory(recipient=user, is_read=True)
        NotificationFactory(recipient=user, is_read=False, is_active=False)
        foreign = NotificationFactory(recipient=other, is_read=False)

        client = _auth_client(user)

        count_res = client.get(reverse("notifications-unread-count"))
        assert count_res.status_code == status.HTTP_200_OK
        assert count_res.data == {"unread_count": 2}

        # Marcar una propia
        read_res = client.post(reverse("notifications-mark-read", args=[n1.id]))
        assert read_res.status_code == status.HTTP_200_OK
        assert read_res.data["id"] == n1.id
        assert read_res.data["is_read"] is True
        assert read_res.data["read_at"] is not None

        # Volver a marcar la misma es idempotente
        read_again = client.post(reverse("notifications-mark-read", args=[n1.id]))
        assert read_again.status_code == status.HTTP_200_OK
        assert read_again.data["read_at"] == read_res.data["read_at"]

        # Ajena o inexistente devuelve 404
        assert (
            client.post(reverse("notifications-mark-read", args=[foreign.id])).status_code
            == status.HTTP_404_NOT_FOUND
        )
        assert (
            client.post(reverse("notifications-mark-read", args=[999999])).status_code
            == status.HTTP_404_NOT_FOUND
        )

        # Marcar todas las restantes
        read_all_res = client.post(reverse("notifications-read-all"))
        assert read_all_res.status_code == status.HTTP_200_OK
        assert read_all_res.data == {"updated_count": 1}

        n2.refresh_from_db()
        foreign.refresh_from_db()
        assert n2.is_read is True
        assert foreign.is_read is False

        assert client.get(reverse("notifications-unread-count")).data == {"unread_count": 0}

    def test_openapi_schema_includes_notifications_endpoints(self):
        client = APIClient()
        response = client.get(reverse("api-schema"), {"format": "json"})

        assert response.status_code == status.HTTP_200_OK
        paths = response.data["paths"]
        assert "/api/notifications/" in paths
        assert "/api/notifications/unread-count/" in paths
        assert "/api/notifications/read-all/" in paths
        assert "/api/notifications/{notification_id}/read/" in paths
