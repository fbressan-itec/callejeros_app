"""Modelos de mascotas y adopción según el diseño de DB-01 (README)."""

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel
from apps.core.validators import validate_image_file


class Pet(BaseModel):
    """Publicación de adopción de una mascota.

    Arranca en `in_review` y aparece en el catálogo recién cuando Staff la aprueba.
    """

    class Species(models.TextChoices):
        DOG = "dog", "Perro"
        CAT = "cat", "Gato"

    class Sex(models.TextChoices):
        MALE = "male", "Macho"
        FEMALE = "female", "Hembra"

    class Compatibility(models.TextChoices):
        YES = "yes", "Sí"
        NO = "no", "No"
        NOT_EVALUATED = "not_evaluated", "Sin evaluar"

    class Status(models.TextChoices):
        IN_REVIEW = "in_review", "En revisión"
        PUBLISHED = "published", "Publicada"
        REJECTED = "rejected", "Rechazada"
        ADOPTED = "adopted", "Adoptada"

    name = models.CharField("nombre", max_length=100)
    species = models.CharField("especie", max_length=10, choices=Species.choices)
    sex = models.CharField("sexo", max_length=10, choices=Sex.choices)
    estimated_birth_date = models.DateField("fecha de nacimiento estimada")
    is_sociable = models.BooleanField("sociable")
    good_with_children = models.CharField(
        "convive con niños",
        max_length=20,
        choices=Compatibility.choices,
        default=Compatibility.NOT_EVALUATED,
    )
    good_with_animals = models.CharField(
        "convive con otros animales",
        max_length=20,
        choices=Compatibility.choices,
        default=Compatibility.NOT_EVALUATED,
    )
    is_neutered = models.BooleanField("castrado/a")
    is_urgent_requested = models.BooleanField("urgente solicitado", default=False)
    is_urgent_validated = models.BooleanField("urgente validado", default=False)
    special_care = models.CharField(
        "cuidados especiales",
        max_length=150,
        blank=True,
    )
    description = models.CharField("descripción", max_length=400)
    notes = models.TextField("notas", blank=True)
    contact_phone = models.CharField("teléfono de contacto", max_length=30)
    status = models.CharField(
        "estado",
        max_length=20,
        choices=Status.choices,
        default=Status.IN_REVIEW,
    )
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="pets",
        verbose_name="publicada por",
    )

    class Meta:
        verbose_name = "mascota"
        verbose_name_plural = "mascotas"
        indexes = [
            models.Index(
                fields=["status", "species", "sex"],
                name="pet_catalog_filter_idx",
            ),
            models.Index(
                fields=["estimated_birth_date"],
                name="pet_birth_date_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.get_species_display()} - {self.get_status_display()})"


class PetHealth(models.Model):
    """Bloque 'Estado de salud' de la ficha (uno a uno con `Pet`)."""

    pet = models.OneToOneField(
        Pet,
        on_delete=models.CASCADE,
        related_name="health",
        verbose_name="mascota",
    )
    general_status = models.CharField("estado general", max_length=255, blank=True)
    vaccines = models.CharField("vacunas", max_length=255, blank=True)
    deworming = models.CharField("desparasitación", max_length=255, blank=True)
    flea_tick_treatment = models.CharField(
        "tratamiento contra pulgas y garrapatas",
        max_length=255,
        blank=True,
    )
    other = models.CharField("otros", max_length=255, blank=True)
    created_at = models.DateTimeField("creado", auto_now_add=True)
    updated_at = models.DateTimeField("modificado", auto_now=True)

    class Meta:
        verbose_name = "estado de salud de mascota"
        verbose_name_plural = "estados de salud de mascotas"

    def __str__(self) -> str:
        return f"Salud de {self.pet.name}"


class PetPhoto(BaseModel):
    """Fotos del carrusel de una mascota; la de `position` 0 es la principal."""

    pet = models.ForeignKey(
        Pet,
        on_delete=models.CASCADE,
        related_name="photos",
        verbose_name="mascota",
    )
    image = models.ImageField(
        "imagen",
        upload_to="pets/photos/",
        validators=[validate_image_file],
    )
    position = models.PositiveSmallIntegerField("posición", default=0)

    class Meta:
        verbose_name = "foto de mascota"
        verbose_name_plural = "fotos de mascotas"
        ordering = ["position", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["pet", "position"],
                condition=models.Q(is_active=True),
                name="unique_active_pet_photo_position",
            ),
        ]

    def __str__(self) -> str:
        return f"Foto #{self.position} de {self.pet.name}"


class PetStatusLog(models.Model):
    """Historial de revisiones y cambios de estado de una mascota (solo lectura)."""

    pet = models.ForeignKey(
        Pet,
        on_delete=models.CASCADE,
        related_name="status_logs",
        verbose_name="mascota",
    )
    previous_status = models.CharField(
        "estado anterior",
        max_length=20,
        choices=Pet.Status.choices,
        blank=True,
    )
    new_status = models.CharField(
        "estado nuevo",
        max_length=20,
        choices=Pet.Status.choices,
    )
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="performed_pet_status_logs",
        verbose_name="realizado por",
    )
    note = models.CharField("nota", max_length=255, blank=True)
    created_at = models.DateTimeField("creado", auto_now_add=True)

    class Meta:
        verbose_name = "historial de estado de mascota"
        verbose_name_plural = "historial de estados de mascotas"

    def __str__(self) -> str:
        prev = self.previous_status or "alta"
        return f"{self.pet.name}: {prev} -> {self.new_status}"


class Favorite(BaseModel):
    """Relación usuario ↔ mascota para los favoritos del catálogo (BK-05).

    Restricción única por `(user, pet)`: al desmarcar se aplica baja lógica
    (`is_active=False`) y al volver a marcar se reactiva el mismo registro.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="favorites",
        verbose_name="usuario",
    )
    pet = models.ForeignKey(
        Pet,
        on_delete=models.PROTECT,
        related_name="favorites",
        verbose_name="mascota",
    )

    class Meta:
        verbose_name = "favorito"
        verbose_name_plural = "favoritos"
        ordering = ["-updated_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "pet"],
                name="unique_user_pet_favorite",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user.email} ♥ {self.pet.name}"
