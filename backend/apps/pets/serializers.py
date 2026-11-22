"""Serializers de gestión de mascotas y fotos del carrusel (BK-03b)."""

import json
from collections.abc import Mapping

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.utils import html

from apps.pets.models import Pet, PetHealth, PetPhoto
from apps.pets.services import (
    CONTACT_PHONE_REQUIRED_ERROR,
    DESCRIPTION_REQUIRED_ERROR,
    DESCRIPTION_TOO_LONG_ERROR,
    MAX_DESCRIPTION_LENGTH,
    MAX_SPECIAL_CARE_LENGTH,
    MIN_PHOTOS_ERROR,
    NAME_REQUIRED_ERROR,
    SPECIAL_CARE_TOO_LONG_ERROR,
    AgeGroup,
    calculate_age_group,
    is_pet_urgent,
)
from apps.users.models import User
from apps.users.serializers import RoleSummarySerializer

IS_SOCIABLE_REQUIRED_ERROR = "Indicá si la mascota es sociable."
IS_NEUTERED_REQUIRED_ERROR = "Indicá si la mascota está castrada."
PET_COMPATIBILITY_CHOICES = Pet.Compatibility.choices


class PetPublisherSerializer(serializers.ModelSerializer):
    """Datos públicos mínimos de quien publicó la mascota (nunca expone dirección ni teléfono)."""

    role = RoleSummarySerializer(read_only=True)

    class Meta:
        model = User
        fields = ("id", "first_name", "last_name", "role")
        read_only_fields = fields


class PetHealthSerializer(serializers.ModelSerializer):
    """Bloque de estado de salud asociado a una mascota."""

    class Meta:
        model = PetHealth
        fields = (
            "general_status",
            "vaccines",
            "deworming",
            "flea_tick_treatment",
            "other",
        )
        read_only_fields = fields


class PetHealthInputSerializer(serializers.Serializer):
    """Valida datos opcionales de `PetHealth`, aceptando objeto JSON o string JSON en multipart."""

    general_status = serializers.CharField(max_length=255, required=False, allow_blank=True)
    vaccines = serializers.CharField(max_length=255, required=False, allow_blank=True)
    deworming = serializers.CharField(max_length=255, required=False, allow_blank=True)
    flea_tick_treatment = serializers.CharField(max_length=255, required=False, allow_blank=True)
    other = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def get_value(self, dictionary):
        if html.is_html_input(dictionary) and self.field_name in dictionary:
            raw_value = dictionary.get(self.field_name)
            if isinstance(raw_value, str):
                return raw_value
        return super().get_value(dictionary)

    def to_internal_value(self, data):
        if isinstance(data, str):
            raw = data.strip()
            if not raw:
                return {}
            try:
                data = json.loads(raw)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError(
                    "Los datos de salud deben enviarse como un objeto JSON válido."
                ) from exc
            if not isinstance(data, dict):
                raise serializers.ValidationError(
                    "Los datos de salud deben enviarse como un objeto JSON válido."
                )
        return super().to_internal_value(data)


class PetPhotoSerializer(serializers.ModelSerializer):
    """Foto activa del carrusel de una mascota."""

    class Meta:
        model = PetPhoto
        fields = ("id", "image", "position", "created_at")
        read_only_fields = fields


class PetPublicSerializer(serializers.ModelSerializer):
    """Respuesta pública de catálogo y ficha (expone solo `is_urgent`, nunca `contact_phone`)."""

    published_by = PetPublisherSerializer(read_only=True)
    health = PetHealthSerializer(read_only=True)
    age_group = serializers.SerializerMethodField()
    is_urgent = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()

    class Meta:
        model = Pet
        fields = (
            "id",
            "name",
            "species",
            "sex",
            "estimated_birth_date",
            "age_group",
            "is_sociable",
            "good_with_children",
            "good_with_animals",
            "is_neutered",
            "is_urgent",
            "special_care",
            "description",
            "notes",
            "status",
            "published_by",
            "health",
            "photos",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    @extend_schema_field(serializers.ChoiceField(choices=[group.value for group in AgeGroup]))
    def get_age_group(self, obj: Pet) -> str:
        return calculate_age_group(obj.estimated_birth_date)

    @extend_schema_field(serializers.BooleanField())
    def get_is_urgent(self, obj: Pet) -> bool:
        return is_pet_urgent(obj)

    @extend_schema_field(PetPhotoSerializer(many=True))
    def get_photos(self, obj: Pet) -> list[dict]:
        active_photos = getattr(obj, "prefetched_active_photos", None)
        if active_photos is None:
            active_photos = obj.photos.active().order_by("position", "id")
        return PetPhotoSerializer(active_photos, many=True, context=self.context).data


class PetManageSerializer(PetPublicSerializer):
    """Respuesta de gestión para autor, Staff o Admin (incluye `contact_phone` y flags internos)."""

    class Meta(PetPublicSerializer.Meta):
        fields = (
            "id",
            "name",
            "species",
            "sex",
            "estimated_birth_date",
            "age_group",
            "is_sociable",
            "good_with_children",
            "good_with_animals",
            "is_neutered",
            "is_urgent",
            "is_urgent_requested",
            "is_urgent_validated",
            "special_care",
            "description",
            "notes",
            "contact_phone",
            "status",
            "published_by",
            "health",
            "photos",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class PaginatedPetPublicSerializer(serializers.Serializer):
    """Respuesta paginada del catálogo público de mascotas (12 resultados por página)."""

    count = serializers.IntegerField(read_only=True)
    next = serializers.URLField(allow_null=True, read_only=True)
    previous = serializers.URLField(allow_null=True, read_only=True)
    results = PetPublicSerializer(many=True, read_only=True)


class PaginatedPetManageSerializer(serializers.Serializer):
    """Respuesta paginada del listado propio de mascotas (12 resultados por página)."""

    count = serializers.IntegerField(read_only=True)
    next = serializers.URLField(allow_null=True, read_only=True)
    previous = serializers.URLField(allow_null=True, read_only=True)
    results = PetManageSerializer(many=True, read_only=True)


class PetCreateSerializer(serializers.Serializer):
    """Valida el formato de entrada para publicar una mascota con al menos una foto."""

    name = serializers.CharField(
        max_length=100,
        error_messages={
            "required": NAME_REQUIRED_ERROR,
            "blank": NAME_REQUIRED_ERROR,
        },
    )
    species = serializers.ChoiceField(choices=Pet.Species.choices)
    sex = serializers.ChoiceField(choices=Pet.Sex.choices)
    estimated_birth_date = serializers.DateField()
    is_sociable = serializers.BooleanField()
    good_with_children = serializers.ChoiceField(
        choices=Pet.Compatibility.choices,
        required=False,
        default=Pet.Compatibility.NOT_EVALUATED,
    )
    good_with_animals = serializers.ChoiceField(
        choices=Pet.Compatibility.choices,
        required=False,
        default=Pet.Compatibility.NOT_EVALUATED,
    )
    is_neutered = serializers.BooleanField()
    is_urgent_requested = serializers.BooleanField(required=False, default=False)
    special_care = serializers.CharField(
        max_length=MAX_SPECIAL_CARE_LENGTH,
        required=False,
        allow_blank=True,
        default="",
        error_messages={"max_length": SPECIAL_CARE_TOO_LONG_ERROR},
    )
    description = serializers.CharField(
        max_length=MAX_DESCRIPTION_LENGTH,
        error_messages={
            "required": DESCRIPTION_REQUIRED_ERROR,
            "blank": DESCRIPTION_REQUIRED_ERROR,
            "max_length": DESCRIPTION_TOO_LONG_ERROR,
        },
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    contact_phone = serializers.CharField(
        max_length=30,
        write_only=True,
        error_messages={
            "required": CONTACT_PHONE_REQUIRED_ERROR,
            "blank": CONTACT_PHONE_REQUIRED_ERROR,
        },
    )
    health = PetHealthInputSerializer(required=False)
    photos = serializers.ListField(
        child=serializers.FileField(),
        allow_empty=False,
        write_only=True,
        error_messages={
            "required": MIN_PHOTOS_ERROR,
            "empty": MIN_PHOTOS_ERROR,
        },
    )

    def validate(self, attrs: dict) -> dict:
        """Exige envío explícito de `is_sociable` e `is_neutered` (también en multipart)."""
        raw_data = self.initial_data if isinstance(self.initial_data, Mapping) else {}
        errors: dict[str, list[str]] = {}

        for field_name, error_message in (
            ("is_sociable", IS_SOCIABLE_REQUIRED_ERROR),
            ("is_neutered", IS_NEUTERED_REQUIRED_ERROR),
        ):
            if field_name not in raw_data:
                errors[field_name] = [error_message]
                continue
            raw_value = raw_data.get(field_name)
            if raw_value is None or (isinstance(raw_value, str) and not raw_value.strip()):
                errors[field_name] = [error_message]

        if errors:
            raise serializers.ValidationError(errors)

        return attrs


class PetUpdateSerializer(serializers.Serializer):
    """Valida edición parcial; excluye `status`, `is_urgent_validated` y `published_by`."""

    name = serializers.CharField(
        max_length=100,
        required=False,
        error_messages={"blank": NAME_REQUIRED_ERROR},
    )
    species = serializers.ChoiceField(choices=Pet.Species.choices, required=False)
    sex = serializers.ChoiceField(choices=Pet.Sex.choices, required=False)
    estimated_birth_date = serializers.DateField(required=False)
    is_sociable = serializers.BooleanField(required=False)
    good_with_children = serializers.ChoiceField(
        choices=Pet.Compatibility.choices,
        required=False,
    )
    good_with_animals = serializers.ChoiceField(
        choices=Pet.Compatibility.choices,
        required=False,
    )
    is_neutered = serializers.BooleanField(required=False)
    is_urgent_requested = serializers.BooleanField(required=False)
    special_care = serializers.CharField(
        max_length=MAX_SPECIAL_CARE_LENGTH,
        required=False,
        allow_blank=True,
        error_messages={"max_length": SPECIAL_CARE_TOO_LONG_ERROR},
    )
    description = serializers.CharField(
        max_length=MAX_DESCRIPTION_LENGTH,
        required=False,
        error_messages={
            "blank": DESCRIPTION_REQUIRED_ERROR,
            "max_length": DESCRIPTION_TOO_LONG_ERROR,
        },
    )
    notes = serializers.CharField(required=False, allow_blank=True)
    contact_phone = serializers.CharField(
        max_length=30,
        required=False,
        write_only=True,
        error_messages={"blank": CONTACT_PHONE_REQUIRED_ERROR},
    )
    health = PetHealthInputSerializer(required=False)


class PetAdoptSerializer(serializers.Serializer):
    """Valida la nota opcional al marcar una mascota como adoptada."""

    note = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class PetReviewSerializer(serializers.Serializer):
    """Valida el motivo opcional al aprobar o rechazar una mascota (BK-06a).

    Si llega vacío, el servicio guarda un texto por defecto en `PetStatusLog`.
    """

    note = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


URGENCY_VALIDATED_REQUIRED_ERROR = "Indicá si el caso urgente queda validado (true o false)."


class PetUrgencySerializer(serializers.Serializer):
    """Valida el pedido de Staff para validar o no el caso urgente de una mascota (BK-06b)."""

    validated = serializers.BooleanField(
        required=True,
        error_messages={
            "required": URGENCY_VALIDATED_REQUIRED_ERROR,
            "invalid": URGENCY_VALIDATED_REQUIRED_ERROR,
            "null": URGENCY_VALIDATED_REQUIRED_ERROR,
        },
    )


class PetPhotoUploadSerializer(serializers.Serializer):
    """Valida la subida de una nueva foto al carrusel de una mascota."""

    image = serializers.FileField(
        write_only=True,
        error_messages={"required": MIN_PHOTOS_ERROR},
    )
