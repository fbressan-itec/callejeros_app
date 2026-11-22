"""Modelos de solicitudes de adopción según el diseño de DB-01 (README)."""

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel

MIN_APPLICANT_AGE = 18


class AdoptionRequest(BaseModel):
    """Solicitud de adopción con el cuestionario de 3 bloques y la respuesta de Staff.

    Copia los datos de contacto declarados por el solicitante al momento de postularse
    (nombre, email, teléfono, dirección y localidad) y conserva la respuesta de Staff.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente"
        APPROVED = "approved", "Aprobada"
        REJECTED = "rejected", "Desaprobada"

    pet = models.ForeignKey(
        "pets.Pet",
        on_delete=models.PROTECT,
        related_name="adoption_requests",
        verbose_name="mascota",
    )
    applicant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="adoption_requests",
        verbose_name="solicitante",
    )
    full_name = models.CharField("nombre completo", max_length=200)
    age = models.PositiveSmallIntegerField("edad")
    phone = models.CharField("teléfono", max_length=30)
    email = models.EmailField("correo electrónico")
    address = models.CharField("dirección", max_length=255)
    city = models.CharField("localidad", max_length=100)
    housing_type = models.CharField("tipo de vivienda", max_length=200)
    other_pets = models.CharField("otros animales", max_length=255)
    accepts_commitment = models.BooleanField("acepta compromiso")
    status = models.CharField(
        "estado",
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    rejection_reason = models.CharField(
        "motivo de desaprobación",
        max_length=400,
        blank=True,
    )
    meeting_point = models.CharField(
        "punto de encuentro",
        max_length=255,
        blank=True,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reviewed_adoption_requests",
        verbose_name="revisada por",
    )
    reviewed_at = models.DateTimeField(
        "fecha de revisión",
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "solicitud de adopción"
        verbose_name_plural = "solicitudes de adopción"
        indexes = [
            models.Index(
                fields=["status", "created_at"],
                name="adoption_status_created_idx",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(age__gte=MIN_APPLICANT_AGE),
                name="adoption_request_min_age_18",
            ),
            models.CheckConstraint(
                condition=models.Q(accepts_commitment=True),
                name="adoption_request_requires_commitment",
            ),
            models.UniqueConstraint(
                fields=["applicant", "pet"],
                condition=models.Q(status="pending", is_active=True),
                name="unique_active_pending_adoption_request",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"Solicitud #{self.pk} de {self.full_name} por {self.pet.name} "
            f"({self.get_status_display()})"
        )
