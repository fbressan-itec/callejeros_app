"""Serializers de solicitudes de adopción (BK-07)."""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.adoptions.models import MIN_APPLICANT_AGE, AdoptionRequest
from apps.adoptions.services import (
    COMMITMENT_REQUIRED_ERROR,
    MAX_AGE_ERROR,
    MAX_APPLICANT_AGE,
    MIN_AGE_ERROR,
)
from apps.pets.models import Pet
from apps.users.models import User
from apps.users.serializers import RoleSummarySerializer

ADOPTION_REQUEST_STATUS_CHOICES = AdoptionRequest.Status.choices


class AdoptionUserSummarySerializer(serializers.ModelSerializer):
    """Datos mínimos del solicitante o revisor (sin dirección ni teléfono privado)."""

    role = RoleSummarySerializer(read_only=True)

    class Meta:
        model = User
        fields = ("id", "first_name", "last_name", "role")
        read_only_fields = fields


class AdoptionPetSummarySerializer(serializers.ModelSerializer):
    """Resumen público de la mascota asociada a la solicitud (nunca expone `contact_phone`)."""

    main_photo = serializers.SerializerMethodField()

    class Meta:
        model = Pet
        fields = ("id", "name", "species", "sex", "status", "main_photo")
        read_only_fields = fields

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_main_photo(self, obj: Pet) -> str | None:
        active_photos = getattr(obj, "prefetched_active_photos", None)
        if active_photos is None:
            active_photos = list(obj.photos.active().order_by("position", "id")[:1])
        if not active_photos:
            return None
        image_url = active_photos[0].image.url
        request = self.context.get("request")
        if request is not None:
            return request.build_absolute_uri(image_url)
        return image_url


class FosterContactSerializer(serializers.Serializer):
    """Contacto del hogar de tránsito visible solo en solicitudes aprobadas (sin dirección)."""

    name = serializers.CharField(read_only=True)
    role = RoleSummarySerializer(read_only=True)
    contact_phone = serializers.CharField(read_only=True)


class AdoptionRequestCreateSerializer(serializers.Serializer):
    """Valida el cuestionario de 3 bloques para postularse a adoptar una mascota."""

    pet = serializers.IntegerField(min_value=1)
    # Bloque 1: Datos personales
    full_name = serializers.CharField(
        max_length=200,
        error_messages={
            "required": "El nombre completo es obligatorio.",
            "blank": "El nombre completo es obligatorio.",
        },
    )
    age = serializers.IntegerField(
        min_value=MIN_APPLICANT_AGE,
        max_value=MAX_APPLICANT_AGE,
        error_messages={
            "min_value": MIN_AGE_ERROR,
            "max_value": MAX_AGE_ERROR,
        },
    )
    phone = serializers.CharField(
        max_length=30,
        error_messages={
            "required": "El WhatsApp o teléfono es obligatorio.",
            "blank": "El WhatsApp o teléfono es obligatorio.",
        },
    )
    email = serializers.EmailField(
        error_messages={
            "required": "El correo electrónico es obligatorio.",
            "blank": "El correo electrónico es obligatorio.",
            "invalid": "Ingresá un correo electrónico válido.",
        },
    )
    address = serializers.CharField(
        max_length=255,
        error_messages={
            "required": "La dirección es obligatoria.",
            "blank": "La dirección es obligatoria.",
        },
    )
    city = serializers.CharField(
        max_length=100,
        error_messages={
            "required": "La localidad es obligatoria.",
            "blank": "La localidad es obligatoria.",
        },
    )
    # Bloque 2: Hogar y entorno
    housing_type = serializers.CharField(
        max_length=200,
        error_messages={
            "required": "El tipo de vivienda es obligatorio.",
            "blank": "El tipo de vivienda es obligatorio.",
        },
    )
    other_pets = serializers.CharField(
        max_length=255,
        error_messages={
            "required": "Indicá si tenés otros animales actualmente.",
            "blank": "Indicá si tenés otros animales actualmente.",
        },
    )
    # Bloque 3: Compromiso
    accepts_commitment = serializers.BooleanField()

    def validate_accepts_commitment(self, value: bool) -> bool:
        if value is not True:
            raise serializers.ValidationError(COMMITMENT_REQUIRED_ERROR)
        return value


class AdoptionRequestSerializer(serializers.ModelSerializer):
    """Respuesta completa de una solicitud de adopción para solicitante o Staff/Admin.

    Cuando la solicitud está `approved`, incluye `foster_contact` (nombre, rol y
    `contact_phone` de la publicación) y `meeting_point`, sin exponer nunca la dirección
    del hogar de tránsito. En `pending` o `rejected`, `foster_contact` es `null`.
    """

    pet = AdoptionPetSummarySerializer(read_only=True)
    applicant = AdoptionUserSummarySerializer(read_only=True)
    reviewed_by = AdoptionUserSummarySerializer(read_only=True, allow_null=True)
    foster_contact = serializers.SerializerMethodField()

    class Meta:
        model = AdoptionRequest
        fields = (
            "id",
            "pet",
            "applicant",
            "full_name",
            "age",
            "phone",
            "email",
            "address",
            "city",
            "housing_type",
            "other_pets",
            "accepts_commitment",
            "status",
            "rejection_reason",
            "meeting_point",
            "foster_contact",
            "reviewed_by",
            "reviewed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    @extend_schema_field(FosterContactSerializer(allow_null=True))
    def get_foster_contact(self, obj: AdoptionRequest) -> dict | None:
        if obj.status != AdoptionRequest.Status.APPROVED:
            return None
        publisher = obj.pet.published_by
        full_name = f"{publisher.first_name} {publisher.last_name}".strip()
        return {
            "name": full_name,
            "role": RoleSummarySerializer(publisher.role).data,
            "contact_phone": obj.pet.contact_phone,
        }


class PaginatedAdoptionRequestSerializer(serializers.Serializer):
    """Respuesta paginada de solicitudes de adopción (12 resultados por página)."""

    count = serializers.IntegerField(read_only=True)
    next = serializers.URLField(allow_null=True, read_only=True)
    previous = serializers.URLField(allow_null=True, read_only=True)
    results = AdoptionRequestSerializer(many=True, read_only=True)
