"""Rutas del centro de notificaciones (`/api/notifications/`)."""

from django.urls import path

from apps.notifications.views import (
    NotificationListView,
    NotificationMarkAllReadView,
    NotificationMarkReadView,
    UnreadNotificationsCountView,
)

urlpatterns = [
    path("", NotificationListView.as_view(), name="notifications-list"),
    path(
        "unread-count/", UnreadNotificationsCountView.as_view(), name="notifications-unread-count"
    ),
    path("read-all/", NotificationMarkAllReadView.as_view(), name="notifications-read-all"),
    path(
        "<int:notification_id>/read/",
        NotificationMarkReadView.as_view(),
        name="notifications-mark-read",
    ),
]
