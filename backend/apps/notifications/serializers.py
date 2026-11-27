"""Serializers del centro de notificaciones (BK-08a)."""

from rest_framework import serializers

from apps.notifications.models import Notification

NOTIFICATION_TAG_CHOICES = Notification.Tag.choices


class NotificationSerializer(serializers.ModelSerializer):
    """Representación de lectura de una notificación del usuario autenticado."""

    tag = serializers.ChoiceField(choices=NOTIFICATION_TAG_CHOICES, read_only=True)
    tag_label = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id",
            "title",
            "text",
            "tag",
            "tag_label",
            "link",
            "is_read",
            "read_at",
            "created_at",
        )
        read_only_fields = fields

    def get_tag_label(self, obj: Notification) -> str:
        return obj.get_tag_display()


class PaginatedNotificationSerializer(serializers.Serializer):
    """Esquema OpenAPI de respuesta paginada de notificaciones."""

    count = serializers.IntegerField()
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)
    results = NotificationSerializer(many=True)


class UnreadNotificationsCountSerializer(serializers.Serializer):
    """Cantidad de notificaciones activas sin leer del usuario autenticado."""

    unread_count = serializers.IntegerField(min_value=0)


class MarkAllNotificationsReadResponseSerializer(serializers.Serializer):
    """Resultado de marcar todas las notificaciones no leídas como leídas."""

    updated_count = serializers.IntegerField(min_value=0)
