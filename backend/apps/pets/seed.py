"""Datos de prueba de mascotas (los ejecuta automáticamente `python manage.py seed`)."""

from datetime import timedelta
from io import BytesIO

from django.core.files.base import ContentFile
from django.core.management.base import CommandError
from django.utils import timezone
from PIL import Image

from apps.pets.models import Pet, PetHealth, PetPhoto, PetStatusLog
from apps.users.models import User


def _build_seed_image_bytes(color: tuple[int, int, int]) -> bytes:
    """Genera un JPEG liviano en memoria para las fotos de prueba del seed."""
    buffer = BytesIO()
    image = Image.new("RGB", (600, 450), color=color)
    image.save(buffer, format="JPEG", quality=80)
    return buffer.getvalue()


SEED_PETS = [
    {
        "name": "Loki",
        "publisher_email": "refugio@callejeros.ar",
        "species": Pet.Species.DOG,
        "sex": Pet.Sex.MALE,
        "age_days": 365 * 2,
        "is_sociable": True,
        "good_with_children": Pet.Compatibility.YES,
        "good_with_animals": Pet.Compatibility.YES,
        "is_neutered": True,
        "is_urgent_requested": False,
        "is_urgent_validated": False,
        "special_care": "",
        "description": (
            "Rescatado en barrio Alberdi. Es juguetón, sociable con otros perros y niños, "
            "muy compañero y con libreta sanitaria al día."
        ),
        "notes": "Le encanta correr en espacios abiertos. Ideal para familias activas.",
        "contact_phone": "+54 9 358 4222222",
        "status": Pet.Status.PUBLISHED,
        "health": {
            "general_status": "Sano y vital",
            "vaccines": "Al Día (Séxtuple y Antirrábica)",
            "deworming": "Desparasitado hace 1 mes",
            "flea_tick_treatment": "Tratado con pipeta",
            "other": "Sin observaciones clínicas",
        },
        "photos": [
            ("seed_loki_1.jpg", (234, 88, 12)),
            ("seed_loki_2.jpg", (194, 65, 12)),
        ],
    },
    {
        "name": "Luna",
        "publisher_email": "miembro@callejeros.ar",
        "species": Pet.Species.CAT,
        "sex": Pet.Sex.FEMALE,
        "age_days": 30 * 8,
        "is_sociable": True,
        "good_with_children": Pet.Compatibility.YES,
        "good_with_animals": Pet.Compatibility.NOT_EVALUATED,
        "is_neutered": True,
        "is_urgent_requested": False,
        "is_urgent_validated": False,
        "special_care": "",
        "description": (
            "Gatita muy dulce y tranquila. Utiliza piedritas sanitarias a la perfección, "
            "ideal para departamento o casa cerrada."
        ),
        "notes": "Muy mimosa, busca contacto humano y se adapta rápido a nuevos ambientes.",
        "contact_phone": "+54 9 358 4111111",
        "status": Pet.Status.PUBLISHED,
        "health": {
            "general_status": "Excelente estado de salud",
            "vaccines": "Triple felina completa",
            "deworming": "Sin parásitos",
            "flea_tick_treatment": "Pipeta al día",
            "other": "Negativa a VIF y ViLEF",
        },
        "photos": [
            ("seed_luna_1.jpg", (16, 185, 129)),
        ],
    },
    {
        "name": "Rocco",
        "publisher_email": "refugio@callejeros.ar",
        "species": Pet.Species.DOG,
        "sex": Pet.Sex.MALE,
        "age_days": 365 * 4,
        "is_sociable": False,
        "good_with_children": Pet.Compatibility.NO,
        "good_with_animals": Pet.Compatibility.NO,
        "is_neutered": True,
        "is_urgent_requested": True,
        "is_urgent_validated": True,
        "special_care": "Dermatitis alérgica controlada y recuperación motriz leve",
        "description": (
            "Perro leal y protector. Su hogar de tránsito vence en pocos días. "
            "Necesita una familia sin otros animales que le brinde paciencia y afecto."
        ),
        "notes": (
            "🚨 CASO URGENTE: El hogar de tránsito actual finaliza este fin de semana. "
            "Requiere adoptante paciente."
        ),
        "contact_phone": "+54 9 358 4222222",
        "status": Pet.Status.PUBLISHED,
        "health": {
            "general_status": "En recuperación motriz leve",
            "vaccines": "Al Día",
            "deworming": "Desparasitado",
            "flea_tick_treatment": "Protegido con collar antiparasitario",
            "other": "Dermatitis alérgica controlada",
        },
        "photos": [
            ("seed_rocco_1.jpg", (225, 29, 72)),
        ],
    },
    {
        "name": "Misa",
        "publisher_email": "miembro@callejeros.ar",
        "species": Pet.Species.CAT,
        "sex": Pet.Sex.FEMALE,
        "age_days": 365 * 1,
        "is_sociable": True,
        "good_with_children": Pet.Compatibility.NOT_EVALUATED,
        "good_with_animals": Pet.Compatibility.YES,
        "is_neutered": False,
        "is_urgent_requested": False,
        "is_urgent_validated": False,
        "special_care": "",
        "description": (
            "Curiosa y ronroneadora. Se entrega con compromiso formal de castración "
            "gratuita por parte de la red de voluntarios."
        ),
        "notes": (
            "No castrada aún por edad y peso previo, incluye voucher para castración sin costo."
        ),
        "contact_phone": "+54 9 358 4111111",
        "status": Pet.Status.PUBLISHED,
        "health": {
            "general_status": "Sana y activa",
            "vaccines": "Esquema de cachorro completo",
            "deworming": "Desparasitada",
            "flea_tick_treatment": "Sin pulgas",
            "other": "Turno de castración asignado para el próximo mes",
        },
        "photos": [
            ("seed_misa_1.jpg", (59, 130, 246)),
        ],
    },
    {
        "name": "Bora",
        "publisher_email": "refugio@callejeros.ar",
        "species": Pet.Species.DOG,
        "sex": Pet.Sex.FEMALE,
        "age_days": 30 * 3,
        "is_sociable": True,
        "good_with_children": Pet.Compatibility.YES,
        "good_with_animals": Pet.Compatibility.YES,
        "is_neutered": False,
        "is_urgent_requested": True,
        "is_urgent_validated": True,
        "special_care": "",
        "description": (
            "Cachorrita mestiza de tamaño mediano encontrada en Banda Norte. "
            "Muy juguetona, desparasitada y con primera vacuna aplicada."
        ),
        "notes": (
            "🚨 CASO URGENTE: Fue hallada sola en una caja. "
            "Necesita hogar definitivo o tránsito de largo plazo."
        ),
        "contact_phone": "+54 9 358 4222222",
        "status": Pet.Status.PUBLISHED,
        "health": {
            "general_status": "Cachorra en crecimiento saludable",
            "vaccines": "Primeras 2 dosis de Séxtuple",
            "deworming": "Desparasitada (requiere refuerzo a los 4 meses)",
            "flea_tick_treatment": "Sin ectoparásitos",
            "other": "Castración obligatoria a los 6 meses",
        },
        "photos": [
            ("seed_bora_1.jpg", (245, 158, 11)),
        ],
    },
    {
        "name": "Thor",
        "publisher_email": "refugio@callejeros.ar",
        "species": Pet.Species.DOG,
        "sex": Pet.Sex.MALE,
        "age_days": 365 * 9,
        "is_sociable": True,
        "good_with_children": Pet.Compatibility.YES,
        "good_with_animals": Pet.Compatibility.NOT_EVALUATED,
        "is_neutered": True,
        "is_urgent_requested": False,
        "is_urgent_validated": False,
        "special_care": "",
        "description": (
            "Un gigante bueno y bonachón. Camina muy bien con correa y adora las siestas al sol. "
            "Apto para convivir con niños."
        ),
        "notes": (
            "Perro muy tranquilo y equilibrado. Ideal para casa con patio o departamento espacioso."
        ),
        "contact_phone": "+54 9 358 4222222",
        "status": Pet.Status.PUBLISHED,
        "health": {
            "general_status": "Excelente estado clínico general",
            "vaccines": "Completo al día",
            "deworming": "Tratamiento trimestral al día",
            "flea_tick_treatment": "Sin pulgas",
            "other": "Control dental anual realizado",
        },
        "photos": [
            ("seed_thor_1.jpg", (100, 116, 139)),
        ],
    },
    {
        "name": "Pancho",
        "publisher_email": "refugio@callejeros.ar",
        "species": Pet.Species.DOG,
        "sex": Pet.Sex.MALE,
        "age_days": 365 * 3,
        "is_sociable": True,
        "good_with_children": Pet.Compatibility.YES,
        "good_with_animals": Pet.Compatibility.YES,
        "is_neutered": True,
        "is_urgent_requested": False,
        "is_urgent_validated": False,
        "special_care": "",
        "description": "Mestizo compañero que ya encontró a su familia definitiva en Río Cuarto.",
        "notes": "Adoptado a través de la red comunitaria.",
        "contact_phone": "+54 9 358 4222222",
        "status": Pet.Status.ADOPTED,
        "health": {
            "general_status": "Sano y con controles al día",
            "vaccines": "Completas",
            "deworming": "Al día",
            "flea_tick_treatment": "Pipeta aplicada",
            "other": "",
        },
        "photos": [
            ("seed_pancho_1.jpg", (16, 185, 129)),
        ],
    },
    {
        "name": "Nala",
        "publisher_email": "miembro@callejeros.ar",
        "species": Pet.Species.CAT,
        "sex": Pet.Sex.FEMALE,
        "age_days": 30 * 6,
        "is_sociable": True,
        "good_with_children": Pet.Compatibility.YES,
        "good_with_animals": Pet.Compatibility.YES,
        "is_neutered": False,
        "is_urgent_requested": True,
        "is_urgent_validated": False,
        "special_care": "",
        "description": (
            "Gatita rescatada en barrio Bimaco, pendiente de revisión por un voluntario."
        ),
        "notes": "Hogar de tránsito provisorio por pocos días.",
        "contact_phone": "+54 9 358 4111111",
        "status": Pet.Status.IN_REVIEW,
        "health": {
            "general_status": "Bajo evaluación veterinaria",
            "vaccines": "Primera dosis aplicada",
            "deworming": "Desparasitada",
            "flea_tick_treatment": "Pipeta aplicada",
            "other": "",
        },
        "photos": [
            ("seed_nala_1.jpg", (139, 92, 246)),
        ],
    },
    {
        "name": "Toby",
        "publisher_email": "miembro@callejeros.ar",
        "species": Pet.Species.DOG,
        "sex": Pet.Sex.MALE,
        "age_days": 365 * 5,
        "is_sociable": True,
        "good_with_children": Pet.Compatibility.NOT_EVALUATED,
        "good_with_animals": Pet.Compatibility.NOT_EVALUATED,
        "is_neutered": True,
        "is_urgent_requested": False,
        "is_urgent_validated": False,
        "special_care": "",
        "description": "Publicación con foto borrosa que requiere corrección antes de publicarse.",
        "notes": "",
        "contact_phone": "+54 9 358 4111111",
        "status": Pet.Status.REJECTED,
        "status_note": (
            "La foto subida no permite identificar al animal; por favor subí una foto clara."
        ),
        "health": {
            "general_status": "Sano",
            "vaccines": "Al día",
            "deworming": "Al día",
            "flea_tick_treatment": "Al día",
            "other": "",
        },
        "photos": [
            ("seed_toby_1.jpg", (148, 163, 184)),
        ],
    },
]


def run() -> str:
    """Crea o actualiza las mascotas de prueba sin duplicarlas y devuelve un resumen."""
    staff_user = User.objects.filter(email="staff@callejeros.ar").first()
    if staff_user is None:
        raise CommandError(
            "No se encontraron los usuarios de prueba. Asegurate de que `apps.users` "
            "esté antes de `apps.pets` en INSTALLED_APPS."
        )

    today = timezone.localdate()
    created_count = 0
    updated_count = 0

    for item in SEED_PETS:
        publisher = User.objects.get(email=item["publisher_email"])
        estimated_birth_date = today - timedelta(days=item["age_days"])

        pet, created = Pet.objects.update_or_create(
            name=item["name"],
            published_by=publisher,
            defaults={
                "species": item["species"],
                "sex": item["sex"],
                "estimated_birth_date": estimated_birth_date,
                "is_sociable": item["is_sociable"],
                "good_with_children": item["good_with_children"],
                "good_with_animals": item["good_with_animals"],
                "is_neutered": item["is_neutered"],
                "is_urgent_requested": item["is_urgent_requested"],
                "is_urgent_validated": item["is_urgent_validated"],
                "special_care": item["special_care"],
                "description": item["description"],
                "notes": item["notes"],
                "contact_phone": item["contact_phone"],
                "status": item["status"],
                "is_active": True,
            },
        )

        PetHealth.objects.update_or_create(
            pet=pet,
            defaults=item["health"],
        )

        for position, (filename, color) in enumerate(item["photos"]):
            photo = PetPhoto.objects.filter(pet=pet, position=position).first()
            if photo is None:
                content = ContentFile(_build_seed_image_bytes(color), name=filename)
                PetPhoto.objects.create(
                    pet=pet,
                    position=position,
                    image=content,
                    is_active=True,
                )
            elif not photo.is_active:
                photo.is_active = True
                photo.save(update_fields=["is_active", "updated_at"])

        if not pet.status_logs.exists():
            PetStatusLog.objects.create(
                pet=pet,
                previous_status="",
                new_status=Pet.Status.IN_REVIEW,
                performed_by=publisher,
                note="Alta inicial de la publicación.",
            )
            if item["status"] != Pet.Status.IN_REVIEW:
                PetStatusLog.objects.create(
                    pet=pet,
                    previous_status=Pet.Status.IN_REVIEW,
                    new_status=item["status"],
                    performed_by=staff_user,
                    note=item.get("status_note", "Revisión inicial de datos semilla."),
                )

        if created:
            created_count += 1
        else:
            updated_count += 1

    return f"{created_count} mascotas creadas, {updated_count} actualizadas"
