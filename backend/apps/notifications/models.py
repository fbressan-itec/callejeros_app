"""Modelos del centro de notificaciones según el diseño de DB-01 (README)."""

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class Notification(BaseModel):
    """Notificación en la app generada por eventos para un usuario destinatario."""

    class Tag(models.TextChoices):
        URGENT = "urgent", "Urgente"
        COMMUNITY = "community", "Comunidad"
        ADOPTION = "adoption", "Adopción"
        FUNDRAISING = "fundraising", "Colecta"
        POST = "post", "Publicación"
        SPONSORSHIP = "sponsorship", "Apadrinamiento"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        verbose_name="destinatario",
    )
    title = models.CharField("título", max_length=200)
    text = models.TextField("texto")
    tag = models.CharField("etiqueta", max_length=20, choices=Tag.choices)
    link = models.CharField("enlace", max_length=255, blank=True, default="")
    is_read = models.BooleanField("leída", default=False)
    read_at = models.DateTimeField("leída el", null=True, blank=True)

    class Meta:
        verbose_name = "notificación"
        verbose_name_plural = "notificaciones"
        indexes = [
            models.Index(
                fields=["recipient", "is_read", "created_at"],
                name="notif_recip_read_created_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.recipient.email})"
