"""Tests unitarios del servicio de cálculo de insignias y edad legible (BK-04a)."""

from datetime import date

import pytest

from apps.pets.badges import (
    AgeGroup,
    BadgeIcon,
    BadgeKey,
    BadgeTone,
    calculate_age_group,
    format_pet_age,
    get_pet_badges,
    subtract_years,
)
from apps.pets.models import Pet

REFERENCE_DATE = date(2026, 11, 20)


def _make_pet(**overrides: object) -> Pet:
    """Construye una instancia de `Pet` en memoria con valores base controlados."""
    defaults: dict[str, object] = {
        "name": "Loki",
        "species": Pet.Species.DOG,
        "sex": Pet.Sex.MALE,
        "estimated_birth_date": date(2024, 11, 20),
        "is_sociable": True,
        "good_with_children": Pet.Compatibility.NOT_EVALUATED,
        "good_with_animals": Pet.Compatibility.NOT_EVALUATED,
        "is_neutered": True,
        "is_urgent_requested": False,
        "is_urgent_validated": False,
        "special_care": "",
        "description": "Perro cariñoso rescatado en Río Cuarto.",
        "notes": "",
        "contact_phone": "+54 9 358 4000000",
        "status": Pet.Status.PUBLISHED,
    }
    defaults.update(overrides)
    return Pet(**defaults)


def _badge_by_key(pet: Pet, key: BadgeKey, *, today: date = REFERENCE_DATE) -> dict[str, str]:
    badges = get_pet_badges(pet, today=today)
    matches = [badge for badge in badges if badge["key"] == key.value]
    assert len(matches) == 1
    return matches[0]


def test_default_published_pet_returns_seven_badges_in_exact_order() -> None:
    pet = _make_pet()

    badges = get_pet_badges(pet, today=REFERENCE_DATE)

    assert [badge["key"] for badge in badges] == [
        BadgeKey.SPECIES.value,
        BadgeKey.SEX.value,
        BadgeKey.AGE.value,
        BadgeKey.SOCIABILITY.value,
        BadgeKey.CHILDREN.value,
        BadgeKey.ANIMALS.value,
        BadgeKey.NEUTERED.value,
    ]


def test_urgent_validated_pet_with_special_care_returns_nine_badges_in_exact_order() -> None:
    pet = _make_pet(
        is_urgent_requested=True,
        is_urgent_validated=True,
        special_care="Medicación diaria",
    )

    badges = get_pet_badges(pet, today=REFERENCE_DATE)

    assert [badge["key"] for badge in badges] == [
        BadgeKey.URGENT.value,
        BadgeKey.SPECIES.value,
        BadgeKey.SEX.value,
        BadgeKey.AGE.value,
        BadgeKey.SOCIABILITY.value,
        BadgeKey.CHILDREN.value,
        BadgeKey.ANIMALS.value,
        BadgeKey.NEUTERED.value,
        BadgeKey.SPECIAL_CARE.value,
    ]
    assert badges[0] == {
        "key": BadgeKey.URGENT.value,
        "tone": BadgeTone.URGENT.value,
        "icon": BadgeIcon.URGENT.value,
        "text": "Caso urgente: su tránsito vence pronto o necesita atención prioritaria.",
    }
    assert badges[-1] == {
        "key": BadgeKey.SPECIAL_CARE.value,
        "tone": BadgeTone.BLUE.value,
        "icon": BadgeIcon.HEALTH.value,
        "text": "Necesita cuidados de salud: Medicación diaria",
    }


def test_adopted_badge_replaces_urgent_even_when_urgent_was_validated() -> None:
    pet = _make_pet(
        status=Pet.Status.ADOPTED,
        is_urgent_requested=True,
        is_urgent_validated=True,
    )

    badges = get_pet_badges(pet, today=REFERENCE_DATE)
    keys = [badge["key"] for badge in badges]

    assert keys[0] == BadgeKey.ADOPTED.value
    assert BadgeKey.URGENT.value not in keys
    assert badges[0] == {
        "key": BadgeKey.ADOPTED.value,
        "tone": BadgeTone.ORANGE.value,
        "icon": BadgeIcon.ADOPTED.value,
        "text": "¡Ya encontró hogar! 🧡",
    }


@pytest.mark.parametrize(
    ("is_urgent_requested", "is_urgent_validated"),
    [
        (True, False),
        (False, True),
        (False, False),
    ],
)
def test_urgent_badge_not_shown_without_request_and_validation(
    is_urgent_requested: bool,
    is_urgent_validated: bool,
) -> None:
    pet = _make_pet(
        is_urgent_requested=is_urgent_requested,
        is_urgent_validated=is_urgent_validated,
    )

    keys = [badge["key"] for badge in get_pet_badges(pet, today=REFERENCE_DATE)]

    assert BadgeKey.URGENT.value not in keys


@pytest.mark.parametrize(
    ("species", "expected_icon", "expected_text"),
    [
        (Pet.Species.DOG, BadgeIcon.DOG.value, "Perro"),
        (Pet.Species.CAT, BadgeIcon.CAT.value, "Gato"),
    ],
)
def test_species_badge_variants(species: str, expected_icon: str, expected_text: str) -> None:
    badge = _badge_by_key(_make_pet(species=species), BadgeKey.SPECIES)

    assert badge == {
        "key": BadgeKey.SPECIES.value,
        "tone": BadgeTone.NEUTRAL.value,
        "icon": expected_icon,
        "text": expected_text,
    }


@pytest.mark.parametrize(
    ("sex", "expected_tone", "expected_icon", "expected_text"),
    [
        (Pet.Sex.MALE, BadgeTone.SKY.value, BadgeIcon.MALE.value, "Macho"),
        (Pet.Sex.FEMALE, BadgeTone.PINK.value, BadgeIcon.FEMALE.value, "Hembra"),
    ],
)
def test_sex_badge_variants(
    sex: str,
    expected_tone: str,
    expected_icon: str,
    expected_text: str,
) -> None:
    badge = _badge_by_key(_make_pet(sex=sex), BadgeKey.SEX)

    assert badge == {
        "key": BadgeKey.SEX.value,
        "tone": expected_tone,
        "icon": expected_icon,
        "text": expected_text,
    }


@pytest.mark.parametrize(
    ("birth_date", "expected_group", "expected_icon", "expected_text"),
    [
        (
            date(2026, 11, 20),
            AgeGroup.CACHORRO.value,
            BadgeIcon.AGE_CACHORRO.value,
            "Cachorro (menos de 1 año): Menos de 1 Mes",
        ),
        (
            date(2026, 11, 5),
            AgeGroup.CACHORRO.value,
            BadgeIcon.AGE_CACHORRO.value,
            "Cachorro (menos de 1 año): Menos de 1 Mes",
        ),
        (
            date(2026, 10, 20),
            AgeGroup.CACHORRO.value,
            BadgeIcon.AGE_CACHORRO.value,
            "Cachorro (menos de 1 año): 1 Mes",
        ),
        (
            date(2026, 5, 20),
            AgeGroup.CACHORRO.value,
            BadgeIcon.AGE_CACHORRO.value,
            "Cachorro (menos de 1 año): 6 Meses",
        ),
        (
            date(2025, 11, 21),
            AgeGroup.CACHORRO.value,
            BadgeIcon.AGE_CACHORRO.value,
            "Cachorro (menos de 1 año): 11 Meses",
        ),
        (
            date(2025, 11, 20),
            AgeGroup.ADULTO.value,
            BadgeIcon.AGE_ADULTO.value,
            "Adulto (de 1 a 7 años): 1 Año",
        ),
        (
            date(2022, 11, 20),
            AgeGroup.ADULTO.value,
            BadgeIcon.AGE_ADULTO.value,
            "Adulto (de 1 a 7 años): 4 Años",
        ),
        (
            date(2019, 11, 20),
            AgeGroup.ADULTO.value,
            BadgeIcon.AGE_ADULTO.value,
            "Adulto (de 1 a 7 años): 7 Años",
        ),
        (
            date(2019, 6, 1),
            AgeGroup.ADULTO.value,
            BadgeIcon.AGE_ADULTO.value,
            "Adulto (de 1 a 7 años): 7 Años",
        ),
        (
            date(2018, 11, 21),
            AgeGroup.ADULTO.value,
            BadgeIcon.AGE_ADULTO.value,
            "Adulto (de 1 a 7 años): 7 Años",
        ),
        (
            date(2018, 11, 20),
            AgeGroup.SENIOR.value,
            BadgeIcon.AGE_SENIOR.value,
            "Senior (más de 7 años): 8 Años",
        ),
        (
            date(2016, 11, 20),
            AgeGroup.SENIOR.value,
            BadgeIcon.AGE_SENIOR.value,
            "Senior (más de 7 años): 10 Años",
        ),
    ],
)
def test_age_group_and_age_badge_boundaries(
    birth_date: date,
    expected_group: str,
    expected_icon: str,
    expected_text: str,
) -> None:
    assert calculate_age_group(birth_date, today=REFERENCE_DATE) == expected_group

    badge = _badge_by_key(_make_pet(estimated_birth_date=birth_date), BadgeKey.AGE)

    assert badge == {
        "key": BadgeKey.AGE.value,
        "tone": BadgeTone.ORANGE.value,
        "icon": expected_icon,
        "text": expected_text,
    }


def test_leap_year_birth_date_handling() -> None:
    leap_birth = date(2024, 2, 29)

    assert subtract_years(date(2024, 2, 29), 1) == date(2023, 2, 28)
    assert calculate_age_group(leap_birth, today=date(2025, 2, 28)) == AgeGroup.CACHORRO.value
    assert format_pet_age(leap_birth, today=date(2025, 2, 28)) == "11 Meses"
    assert calculate_age_group(leap_birth, today=date(2025, 3, 1)) == AgeGroup.ADULTO.value
    assert format_pet_age(leap_birth, today=date(2025, 3, 1)) == "1 Año"


@pytest.mark.parametrize(
    ("is_sociable", "expected_tone", "expected_icon", "expected_text"),
    [
        (
            True,
            BadgeTone.GREEN.value,
            BadgeIcon.SOCIABLE.value,
            "Sociable: se lleva bien con las personas.",
        ),
        (
            False,
            BadgeTone.AMBER.value,
            BadgeIcon.WILD.value,
            (
                "Salvaje: necesita un acercamiento cuidadoso y paciencia. "
                "Consultá con el rescatista."
            ),
        ),
    ],
)
def test_sociability_badge_variants(
    is_sociable: bool,
    expected_tone: str,
    expected_icon: str,
    expected_text: str,
) -> None:
    badge = _badge_by_key(_make_pet(is_sociable=is_sociable), BadgeKey.SOCIABILITY)

    assert badge == {
        "key": BadgeKey.SOCIABILITY.value,
        "tone": expected_tone,
        "icon": expected_icon,
        "text": expected_text,
    }


@pytest.mark.parametrize(
    ("value", "expected_tone", "expected_text"),
    [
        (Pet.Compatibility.YES, BadgeTone.GREEN.value, "Sociable con niños."),
        (
            Pet.Compatibility.NO,
            BadgeTone.AMBER.value,
            "No es sociable con niños: mejor un hogar sin chicos.",
        ),
        (
            Pet.Compatibility.NOT_EVALUATED,
            BadgeTone.GRAY.value,
            "Con niños: sin evaluar todavía. Consultá con el rescatista.",
        ),
    ],
)
def test_children_coexistence_badge_variants(
    value: str,
    expected_tone: str,
    expected_text: str,
) -> None:
    badge = _badge_by_key(_make_pet(good_with_children=value), BadgeKey.CHILDREN)

    assert badge == {
        "key": BadgeKey.CHILDREN.value,
        "tone": expected_tone,
        "icon": BadgeIcon.CHILDREN.value,
        "text": expected_text,
    }


@pytest.mark.parametrize(
    ("value", "expected_tone", "expected_text"),
    [
        (Pet.Compatibility.YES, BadgeTone.GREEN.value, "Sociable con otros animales."),
        (
            Pet.Compatibility.NO,
            BadgeTone.AMBER.value,
            "No es sociable con otros animales: mejor un hogar donde sea el único.",
        ),
        (
            Pet.Compatibility.NOT_EVALUATED,
            BadgeTone.GRAY.value,
            "Con otros animales: sin evaluar todavía. Consultá con el rescatista.",
        ),
    ],
)
def test_animals_coexistence_badge_variants(
    value: str,
    expected_tone: str,
    expected_text: str,
) -> None:
    badge = _badge_by_key(_make_pet(good_with_animals=value), BadgeKey.ANIMALS)

    assert badge == {
        "key": BadgeKey.ANIMALS.value,
        "tone": expected_tone,
        "icon": BadgeIcon.ANIMALS.value,
        "text": expected_text,
    }


@pytest.mark.parametrize(
    ("sex", "is_neutered", "expected_tone", "expected_icon", "expected_text"),
    [
        (Pet.Sex.MALE, True, BadgeTone.GREEN.value, BadgeIcon.NEUTERED.value, "Castrado"),
        (Pet.Sex.FEMALE, True, BadgeTone.GREEN.value, BadgeIcon.NEUTERED.value, "Castrada"),
        (
            Pet.Sex.MALE,
            False,
            BadgeTone.AMBER.value,
            BadgeIcon.NOT_NEUTERED.value,
            "Sin castrar: se entrega con compromiso de castración.",
        ),
        (
            Pet.Sex.FEMALE,
            False,
            BadgeTone.AMBER.value,
            BadgeIcon.NOT_NEUTERED.value,
            "Sin castrar: se entrega con compromiso de castración.",
        ),
    ],
)
def test_neutered_badge_variants(
    sex: str,
    is_neutered: bool,
    expected_tone: str,
    expected_icon: str,
    expected_text: str,
) -> None:
    badge = _badge_by_key(_make_pet(sex=sex, is_neutered=is_neutered), BadgeKey.NEUTERED)

    assert badge == {
        "key": BadgeKey.NEUTERED.value,
        "tone": expected_tone,
        "icon": expected_icon,
        "text": expected_text,
    }


@pytest.mark.parametrize("special_care", ["", "   "])
def test_special_care_badge_omitted_when_empty_or_whitespace(special_care: str) -> None:
    keys = [
        badge["key"]
        for badge in get_pet_badges(_make_pet(special_care=special_care), today=REFERENCE_DATE)
    ]

    assert BadgeKey.SPECIAL_CARE.value not in keys


def test_special_care_badge_trims_whitespace() -> None:
    badge = _badge_by_key(_make_pet(special_care="  Dieta hipoalergénica  "), BadgeKey.SPECIAL_CARE)

    assert badge == {
        "key": BadgeKey.SPECIAL_CARE.value,
        "tone": BadgeTone.BLUE.value,
        "icon": BadgeIcon.HEALTH.value,
        "text": "Necesita cuidados de salud: Dieta hipoalergénica",
    }
