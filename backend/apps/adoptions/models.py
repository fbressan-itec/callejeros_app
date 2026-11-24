"""Modelos de solicitudes de adopción según el diseño de DB-01 (README)."""

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel

MIN_APPLICANT_AGE = 18
MAX_OPEN_ANSWER_LENGTH = 500
MAX_ADOPTION_REASON_LENGTH = 1000


class AdoptionRequest(BaseModel):
    """Solicitud de adopción con el cuestionario de 4 bloques y la respuesta de Staff.

    Copia los datos de contacto declarados por el solicitante al momento de postularse
    (nombre, email, teléfono, dirección y localidad) y conserva la respuesta de Staff.
    Bloques: datos personales, hogar y entorno, experiencia y rutina, y compromiso.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente"
        APPROVED = "approved", "Aprobada"
        REJECTED = "rejected", "Desaprobada"

    class HomeOwnership(models.TextChoices):
        OWNED = "owned", "Propia"
        RENTED = "rented", "Alquilada"
        OTHER = "other", "Otra"

    class RentalPetsPolicy(models.TextChoices):
        YES = "yes", "Sí"
        NO = "no", "No"
        UNKNOWN = "unknown", "No sé"

    class HouseholdAgreement(models.TextChoices):
        YES = "yes", "Sí"
        NOT_DISCUSSED = "not_discussed", "Todavía no lo hablamos"

    class HoursAlone(models.TextChoices):
        LESS_THAN_4 = "less_than_4", "Menos de 4"
        FROM_4_TO_8 = "4_to_8", "4 a 8"
        MORE_THAN_8 = "more_than_8", "Más de 8"

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
    # Bloque 2: Hogar y entorno
    housing_type = models.CharField("tipo de vivienda", max_length=200)
    home_ownership = models.CharField(
        "la vivienda es",
        max_length=20,
        choices=HomeOwnership.choices,
    )
    rental_allows_pets = models.CharField(
        "el alquiler permite animales",
        max_length=20,
        choices=RentalPetsPolicy.choices,
        blank=True,
        help_text="Solo se completa si la vivienda es alquilada.",
    )
    outdoor_space = models.CharField(
        "patio, balcón o terraza y protecciones",
        max_length=MAX_OPEN_ANSWER_LENGTH,
    )
    household_members = models.CharField("quiénes viven", max_length=MAX_OPEN_ANSWER_LENGTH)
    household_agreement = models.CharField(
        "convivientes de acuerdo",
        max_length=20,
        choices=HouseholdAgreement.choices,
    )
    other_pets = models.CharField("otros animales", max_length=255)
    # Bloque 3: Experiencia y rutina
    previous_pets = models.CharField("experiencia previa", max_length=MAX_OPEN_ANSWER_LENGTH)
    hours_alone = models.CharField(
        "horas por día solo/a",
        max_length=20,
        choices=HoursAlone.choices,
    )
    living_space = models.CharField(
        "dónde va a dormir y pasar el día",
        max_length=MAX_OPEN_ANSWER_LENGTH,
    )
    vacation_care = models.CharField(
        "quién lo cuida en viajes o vacaciones",
        max_length=MAX_OPEN_ANSWER_LENGTH,
    )
    contingency_plan = models.CharField(
        "qué haría si no puede seguir cuidándolo",
        max_length=MAX_OPEN_ANSWER_LENGTH,
    )
    adoption_reason = models.CharField(
        "por qué quiere adoptar",
        max_length=MAX_ADOPTION_REASON_LENGTH,
        blank=True,
    )
    # Bloque 4: Compromiso
    accepts_commitment = models.BooleanField("acepta compromiso")
    accepts_neutering = models.BooleanField(
        "acepta castrar",
        null=True,
        blank=True,
        help_text="Solo se pide si la mascota no está castrada; si ya lo está, queda vacío.",
    )
    accepts_follow_up = models.BooleanField("acepta seguimiento")
    accepts_return_notice = models.BooleanField("avisa antes de darlo a otra persona")
    declares_truthful = models.BooleanField("declara datos verdaderos")
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
            models.CheckConstraint(
                condition=models.Q(
                    accepts_follow_up=True,
                    accepts_return_notice=True,
                    declares_truthful=True,
                ),
                name="adoption_request_requires_follow_up_notice_truthful",
            ),
            models.CheckConstraint(
                condition=(models.Q(home_ownership="rented") & ~models.Q(rental_allows_pets=""))
                | (~models.Q(home_ownership="rented") & models.Q(rental_allows_pets="")),
                name="adoption_request_rental_answer_only_when_rented",
            ),
            models.CheckConstraint(
                condition=models.Q(accepts_neutering__isnull=True)
                | models.Q(accepts_neutering=True),
                name="adoption_request_neutering_true_or_empty",
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
