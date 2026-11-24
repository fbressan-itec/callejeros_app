"""Serializers de solicitudes de adopción (BK-07)."""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.adoptions.models import MAX_ADOPTION_REASON_LENGTH, MIN_APPLICANT_AGE, AdoptionRequest
from apps.adoptions.services import (
    INVALID_CHOICE_ERROR,
    MAX_AGE_ERROR,
    MAX_APPLICANT_AGE,
    MAX_REJECTION_REASON_LENGTH,
    MIN_AGE_ERROR,
    REJECTION_REASON_REQUIRED_ERROR,
    REJECTION_REASON_TOO_LONG_ERROR,
    REQUIRED_CHECKBOX_FIELDS,
    REQUIRED_CHOICE_FIELDS,
    REQUIRED_TEXT_FIELDS,
    get_public_shelter_address,
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
    """Contacto de quien publicó, visible solo en solicitudes aprobadas.

    Nunca incluye la dirección privada de la cuenta. `shelter_public_address` tiene valor
    solo si quien publicó es Refugio verificado y cargó su dirección pública.
    """

    name = serializers.CharField(read_only=True)
    role = RoleSummarySerializer(read_only=True)
    contact_phone = serializers.CharField(read_only=True)
    shelter_public_address = serializers.CharField(read_only=True, allow_null=True)


_TEXT_FIELD_RULES = {
    name: (message, max_length) for name, message, max_length in REQUIRED_TEXT_FIELDS
}
_CHOICE_FIELD_RULES = {
    name: (message, choices) for name, message, choices in REQUIRED_CHOICE_FIELDS
}
_CHECKBOX_FIELD_RULES = dict(REQUIRED_CHECKBOX_FIELDS)


def _required_text(field_name: str) -> serializers.CharField:
    """Texto obligatorio con el mensaje y el largo máximo que define el servicio."""
    message, max_length = _TEXT_FIELD_RULES[field_name]
    return serializers.CharField(
        max_length=max_length,
        error_messages={"required": message, "blank": message},
    )


def _required_choice(field_name: str) -> serializers.ChoiceField:
    """Opción obligatoria con el mensaje y los valores que define el servicio."""
    message, choices = _CHOICE_FIELD_RULES[field_name]
    return serializers.ChoiceField(
        choices=choices.choices,
        error_messages={
            "required": message,
            "blank": message,
            "invalid_choice": INVALID_CHOICE_ERROR,
        },
    )


def _required_checkbox(field_name: str) -> serializers.BooleanField:
    """Casilla de compromiso: si falta, responde con el mismo mensaje que si no se marca."""
    message = _CHECKBOX_FIELD_RULES[field_name]
    return serializers.BooleanField(error_messages={"required": message})


class AdoptionRequestCreateSerializer(serializers.Serializer):
    """Valida el tipo de dato del cuestionario de 4 bloques para postularse a adoptar.

    Las reglas de negocio (casillas marcadas, alquiler, castración según la mascota) las
    aplica `apps.adoptions.services.create_adoption_request`.
    """

    pet = serializers.IntegerField(min_value=1)
    # Bloque 1: Datos personales
    full_name = _required_text("full_name")
    age = serializers.IntegerField(
        min_value=MIN_APPLICANT_AGE,
        max_value=MAX_APPLICANT_AGE,
        error_messages={
            "min_value": MIN_AGE_ERROR,
            "max_value": MAX_AGE_ERROR,
        },
    )
    phone = _required_text("phone")
    email = serializers.EmailField(
        error_messages={
            "required": "El correo electrónico es obligatorio.",
            "blank": "El correo electrónico es obligatorio.",
            "invalid": "Ingresá un correo electrónico válido.",
        },
    )
    address = _required_text("address")
    city = _required_text("city")
    # Bloque 2: Hogar y entorno
    housing_type = _required_text("housing_type")
    home_ownership = _required_choice("home_ownership")
    rental_allows_pets = serializers.ChoiceField(
        choices=AdoptionRequest.RentalPetsPolicy.choices,
        required=False,
        allow_blank=True,
        help_text="Obligatorio solo si `home_ownership` es `rented`; si no, se ignora.",
        error_messages={"invalid_choice": INVALID_CHOICE_ERROR},
    )
    outdoor_space = _required_text("outdoor_space")
    household_members = _required_text("household_members")
    household_agreement = _required_choice("household_agreement")
    other_pets = _required_text("other_pets")
    # Bloque 3: Experiencia y rutina
    previous_pets = _required_text("previous_pets")
    hours_alone = _required_choice("hours_alone")
    living_space = _required_text("living_space")
    vacation_care = _required_text("vacation_care")
    contingency_plan = _required_text("contingency_plan")
    adoption_reason = serializers.CharField(
        max_length=MAX_ADOPTION_REASON_LENGTH,
        required=False,
        allow_blank=True,
    )
    # Bloque 4: Compromiso
    accepts_commitment = _required_checkbox("accepts_commitment")
    accepts_neutering = serializers.BooleanField(
        required=False,
        allow_null=True,
        help_text=(
            "Obligatorio (`true`) solo si la mascota no está castrada; si ya lo está, se ignora."
        ),
    )
    accepts_follow_up = _required_checkbox("accepts_follow_up")
    accepts_return_notice = _required_checkbox("accepts_return_notice")
    declares_truthful = _required_checkbox("declares_truthful")

    def validate(self, attrs: dict) -> dict:
        errors = {
            field_name: [message]
            for field_name, message in _CHECKBOX_FIELD_RULES.items()
            if attrs.get(field_name) is not True
        }
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class AdoptionRequestSerializer(serializers.ModelSerializer):
    """Respuesta completa de una solicitud de adopción para solicitante o Staff/Admin.

    Cuando la solicitud está `approved`, incluye `foster_contact` (nombre, rol y
    `contact_phone` de la publicación, más la dirección pública si es un refugio
    verificado) para que coordinen el encuentro entre ellos, sin exponer nunca la dirección
    de la cuenta. En `pending` o `rejected`, `foster_contact`
    es `null`.
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
            "home_ownership",
            "rental_allows_pets",
            "outdoor_space",
            "household_members",
            "household_agreement",
            "other_pets",
            "previous_pets",
            "hours_alone",
            "living_space",
            "vacation_care",
            "contingency_plan",
            "adoption_reason",
            "accepts_commitment",
            "accepts_neutering",
            "accepts_follow_up",
            "accepts_return_notice",
            "declares_truthful",
            "status",
            "rejection_reason",
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
            "shelter_public_address": get_public_shelter_address(publisher),
        }


class PaginatedAdoptionRequestSerializer(serializers.Serializer):
    """Respuesta paginada de solicitudes de adopción (12 resultados por página)."""

    count = serializers.IntegerField(read_only=True)
    next = serializers.URLField(allow_null=True, read_only=True)
    previous = serializers.URLField(allow_null=True, read_only=True)
    results = AdoptionRequestSerializer(many=True, read_only=True)


class AdoptionRequestRejectSerializer(serializers.Serializer):
    """Entrada para desaprobar una solicitud pendiente indicando el motivo."""

    rejection_reason = serializers.CharField(
        max_length=MAX_REJECTION_REASON_LENGTH,
        error_messages={
            "required": REJECTION_REASON_REQUIRED_ERROR,
            "blank": REJECTION_REASON_REQUIRED_ERROR,
            "max_length": REJECTION_REASON_TOO_LONG_ERROR,
        },
    )
