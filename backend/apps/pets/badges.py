"""Servicio de cálculo de insignias y edad legible para fichas de mascotas (BK-04)."""

from datetime import date
from enum import StrEnum
from typing import TypedDict

from django.utils import timezone

from apps.pets.models import Pet


class AgeGroup(StrEnum):
    """Grupos de edad compartidos entre insignias y filtros del catálogo."""

    CACHORRO = "cachorro"
    ADULTO = "adulto"
    SENIOR = "senior"


AGE_GROUP_CHOICES = (
    (AgeGroup.CACHORRO.value, "Cachorro"),
    (AgeGroup.ADULTO.value, "Adulto"),
    (AgeGroup.SENIOR.value, "Senior"),
)

AGE_GROUP_LABELS: dict[str, str] = {
    AgeGroup.CACHORRO.value: "Cachorro",
    AgeGroup.ADULTO.value: "Adulto",
    AgeGroup.SENIOR.value: "Senior",
}

AGE_GROUP_RANGES: dict[str, str] = {
    AgeGroup.CACHORRO.value: "menos de 1 año",
    AgeGroup.ADULTO.value: "de 1 a 7 años",
    AgeGroup.SENIOR.value: "más de 7 años",
}


class BadgeKey(StrEnum):
    """Identificador semántico estable de cada insignia calculada."""

    ADOPTED = "adopted"
    URGENT = "urgent"
    SPECIES = "species"
    SEX = "sex"
    AGE = "age"
    SOCIABILITY = "sociability"
    CHILDREN = "children"
    ANIMALS = "animals"
    NEUTERED = "neutered"
    SPECIAL_CARE = "special_care"


class BadgeTone(StrEnum):
    """Tono visual definido en el sistema de diseño del maquetado."""

    NEUTRAL = "neutral"
    SKY = "sky"
    PINK = "pink"
    ORANGE = "orange"
    GREEN = "green"
    AMBER = "amber"
    GRAY = "gray"
    BLUE = "blue"
    URGENT = "urgent"


class BadgeIcon(StrEnum):
    """Identificador lógico del ícono de cada insignia."""

    ADOPTED = "adopted"
    URGENT = "urgent"
    DOG = "dog"
    CAT = "cat"
    MALE = "male"
    FEMALE = "female"
    AGE_CACHORRO = "age_cachorro"
    AGE_ADULTO = "age_adulto"
    AGE_SENIOR = "age_senior"
    SOCIABLE = "sociable"
    WILD = "wild"
    CHILDREN = "children"
    ANIMALS = "animals"
    NEUTERED = "neutered"
    NOT_NEUTERED = "not_neutered"
    HEALTH = "health"


class PetBadge(TypedDict):
    """Representación serializable de una insignia calculada por el servidor."""

    key: str
    tone: str
    icon: str
    text: str


COEXIST_TONES: dict[str, str] = {
    Pet.Compatibility.YES: BadgeTone.GREEN.value,
    Pet.Compatibility.NO: BadgeTone.AMBER.value,
    Pet.Compatibility.NOT_EVALUATED: BadgeTone.GRAY.value,
}

AGE_GROUP_ICONS: dict[str, str] = {
    AgeGroup.CACHORRO.value: BadgeIcon.AGE_CACHORRO.value,
    AgeGroup.ADULTO.value: BadgeIcon.AGE_ADULTO.value,
    AgeGroup.SENIOR.value: BadgeIcon.AGE_SENIOR.value,
}


def subtract_years(reference_date: date, years: int) -> date:
    """Resta años calendario exactos manejando el 29 de febrero."""
    try:
        return reference_date.replace(year=reference_date.year - years)
    except ValueError:
        return reference_date.replace(year=reference_date.year - years, day=28)


def calculate_age_group(estimated_birth_date: date, *, today: date | None = None) -> str:
    """Calcula el grupo de edad (`cachorro` < 1 año, `adulto` 1-7 años, `senior` > 7)."""
    reference = today or timezone.localdate()
    if estimated_birth_date > subtract_years(reference, 1):
        return AgeGroup.CACHORRO.value
    if estimated_birth_date >= subtract_years(reference, 7):
        return AgeGroup.ADULTO.value
    return AgeGroup.SENIOR.value


def format_pet_age(estimated_birth_date: date, *, today: date | None = None) -> str:
    """Devuelve la edad legible en español a partir de `estimated_birth_date`."""
    reference = today or timezone.localdate()
    if estimated_birth_date >= reference:
        return "menos de 1 mes"

    if estimated_birth_date <= subtract_years(reference, 1):
        years = reference.year - estimated_birth_date.year
        if estimated_birth_date > subtract_years(reference, years):
            years -= 1
        return "1 año" if years == 1 else f"{years} años"

    months = (reference.year - estimated_birth_date.year) * 12 + (
        reference.month - estimated_birth_date.month
    )
    if reference.day < estimated_birth_date.day:
        months -= 1
    if months <= 0:
        return "menos de 1 mes"
    if months == 1:
        return "1 mes"
    return f"{min(months, 11)} meses"


def is_pet_urgent(pet: Pet) -> bool:
    """Devuelve True solo si la urgencia fue pedida, validada por Staff y no está adoptada."""
    return bool(
        pet.is_urgent_requested and pet.is_urgent_validated and pet.status != Pet.Status.ADOPTED
    )


def _build_coexistence_badge(
    *,
    key: BadgeKey,
    icon: BadgeIcon,
    value: str,
    who: str,
    yes_text: str,
    no_text: str,
) -> PetBadge:
    """Construye las insignias de convivencia con niños u otros animales."""
    compatibility = value or Pet.Compatibility.NOT_EVALUATED
    tone = COEXIST_TONES.get(compatibility, BadgeTone.GRAY.value)

    if compatibility == Pet.Compatibility.YES:
        text = yes_text
    elif compatibility == Pet.Compatibility.NO:
        text = no_text
    else:
        text = f"Con {who}: sin evaluar todavía. Consultá con el rescatista."

    return {
        "key": key.value,
        "tone": tone,
        "icon": icon.value,
        "text": text,
    }


def get_pet_badges(pet: Pet, *, today: date | None = None) -> list[PetBadge]:
    """Calcula la lista ordenada de insignias de una mascota según sus datos reales.

    Respeta el orden, tonos y textos definidos en `03-reglas-de-negocio.md` y
    `contexto-ia/maquetado/js/mascota.js`. Nadie elige insignias a mano.
    """
    is_cat = pet.species == Pet.Species.CAT
    is_female = pet.sex == Pet.Sex.FEMALE
    age_group = calculate_age_group(pet.estimated_birth_date, today=today)
    age_label = format_pet_age(pet.estimated_birth_date, today=today)

    badges: list[PetBadge] = []

    if pet.status == Pet.Status.ADOPTED:
        badges.append(
            {
                "key": BadgeKey.ADOPTED.value,
                "tone": BadgeTone.ORANGE.value,
                "icon": BadgeIcon.ADOPTED.value,
                "text": "¡Ya encontró hogar! 🧡",
            }
        )
    elif is_pet_urgent(pet):
        badges.append(
            {
                "key": BadgeKey.URGENT.value,
                "tone": BadgeTone.URGENT.value,
                "icon": BadgeIcon.URGENT.value,
                "text": "Caso urgente: su tránsito vence pronto o necesita atención prioritaria.",
            }
        )

    badges.extend(
        [
            {
                "key": BadgeKey.SPECIES.value,
                "tone": BadgeTone.NEUTRAL.value,
                "icon": BadgeIcon.CAT.value if is_cat else BadgeIcon.DOG.value,
                "text": "Gato" if is_cat else "Perro",
            },
            {
                "key": BadgeKey.SEX.value,
                "tone": BadgeTone.PINK.value if is_female else BadgeTone.SKY.value,
                "icon": BadgeIcon.FEMALE.value if is_female else BadgeIcon.MALE.value,
                "text": "Hembra" if is_female else "Macho",
            },
            {
                "key": BadgeKey.AGE.value,
                "tone": BadgeTone.ORANGE.value,
                "icon": AGE_GROUP_ICONS[age_group],
                "text": (
                    f"{AGE_GROUP_LABELS[age_group]} ({AGE_GROUP_RANGES[age_group]}): {age_label}"
                ),
            },
            (
                {
                    "key": BadgeKey.SOCIABILITY.value,
                    "tone": BadgeTone.GREEN.value,
                    "icon": BadgeIcon.SOCIABLE.value,
                    "text": "Sociable: se lleva bien con las personas.",
                }
                if pet.is_sociable
                else {
                    "key": BadgeKey.SOCIABILITY.value,
                    "tone": BadgeTone.AMBER.value,
                    "icon": BadgeIcon.WILD.value,
                    "text": (
                        "Salvaje: necesita un acercamiento cuidadoso y paciencia. "
                        "Consultá con el rescatista."
                    ),
                }
            ),
            _build_coexistence_badge(
                key=BadgeKey.CHILDREN,
                icon=BadgeIcon.CHILDREN,
                value=pet.good_with_children,
                who="niños",
                yes_text="Sociable con niños.",
                no_text="No es sociable con niños: mejor un hogar sin chicos.",
            ),
            _build_coexistence_badge(
                key=BadgeKey.ANIMALS,
                icon=BadgeIcon.ANIMALS,
                value=pet.good_with_animals,
                who="otros animales",
                yes_text="Sociable con otros animales.",
                no_text="No es sociable con otros animales: mejor un hogar donde sea el único.",
            ),
            (
                {
                    "key": BadgeKey.NEUTERED.value,
                    "tone": BadgeTone.GREEN.value,
                    "icon": BadgeIcon.NEUTERED.value,
                    "text": "Castrada" if is_female else "Castrado",
                }
                if pet.is_neutered
                else {
                    "key": BadgeKey.NEUTERED.value,
                    "tone": BadgeTone.AMBER.value,
                    "icon": BadgeIcon.NOT_NEUTERED.value,
                    "text": "Sin castrar: se entrega con compromiso de castración.",
                }
            ),
        ]
    )

    special_care = pet.special_care.strip()
    if special_care:
        badges.append(
            {
                "key": BadgeKey.SPECIAL_CARE.value,
                "tone": BadgeTone.BLUE.value,
                "icon": BadgeIcon.HEALTH.value,
                "text": f"Necesita cuidados de salud: {special_care}",
            }
        )

    return badges
