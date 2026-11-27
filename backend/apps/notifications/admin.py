"""Configuración del panel de administración de Django para `apps.notifications`."""

from django.contrib import admin

from apps.core.admin import SoftDeleteAdminMixin
from apps.notifications.models import Notification


@admin.register(Notification)
class NotificationAdmin(SoftDeleteAdminMixin, admin.ModelAdmin):
    list_display = (
        "id",
        "recipient",
        "title",
        "tag",
        "is_read",
        "read_at",
        "is_active",
        "created_at",
    )
    list_filter = (
        "tag",
        "is_read",
        "is_active",
        "created_at",
    )
    search_fields = (
        "title",
        "text",
        "recipient__email",
    )
    readonly_fields = (
        "read_at",
        "created_at",
        "updated_at",
    )
