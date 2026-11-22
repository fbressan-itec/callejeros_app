"""Datos de prueba de solicitudes de adopción (`python manage.py seed`)."""

from django.core.management.base import CommandError
from django.utils import timezone

from apps.adoptions.models import AdoptionRequest
from apps.pets.models import Pet
from apps.users.models import User

SEED_ADOPTION_REQUESTS = [
    {
        "pet_name": "Loki",
        "applicant_email": "miembro@callejeros.ar",
        "full_name": "Tomás Gómez",
        "age": 28,
        "phone": "+54 9 358 4111111",
        "email": "miembro@callejeros.ar",
        "address": "Belgrano 640",
        "city": "Río Cuarto",
        "housing_type": "Casa con patio cerrado y tapia de 2 metros",
        "other_pets": "No tengo otros animales actualmente",
        "accepts_commitment": True,
        "status": AdoptionRequest.Status.PENDING,
        "rejection_reason": "",
        "meeting_point": "",
        "reviewed": False,
    },
    {
        "pet_name": "Bora",
        "applicant_email": "miembro@callejeros.ar",
        "full_name": "Tomás Gómez",
        "age": 28,
        "phone": "+54 9 358 4111111",
        "email": "miembro@callejeros.ar",
        "address": "Belgrano 640",
        "city": "Río Cuarto",
        "housing_type": "Casa familiar con patio cerrado y galería techada",
        "other_pets": "1 gata castrada y vacunada, sociable con perros",
        "accepts_commitment": True,
        "status": AdoptionRequest.Status.APPROVED,
        "rejection_reason": "",
        "meeting_point": "Centro Vecinal Alberdi (Av. Colombres y Pasteur)",
        "reviewed": True,
    },
    {
        "pet_name": "Rocco",
        "applicant_email": "miembro@callejeros.ar",
        "full_name": "Tomás Gómez",
        "age": 28,
        "phone": "+54 9 358 4111111",
        "email": "miembro@callejeros.ar",
        "address": "Belgrano 640",
        "city": "Río Cuarto",
        "housing_type": "Casa sin cerramiento al frente",
        "other_pets": "2 perros adultos",
        "accepts_commitment": True,
        "status": AdoptionRequest.Status.REJECTED,
        "rejection_reason": (
            "Rocco necesita un hogar sin otros animales y con patio cerrado; "
            "te invitamos a conocer otras mascotas compatibles en el catálogo."
        ),
        "meeting_point": "",
        "reviewed": True,
    },
]


def run() -> str:
    """Crea o actualiza las solicitudes de prueba sin duplicarlas y devuelve un resumen."""
    staff_user = User.objects.filter(email="staff@callejeros.ar").first()
    if staff_user is None:
        raise CommandError(
            "No se encontraron los usuarios de prueba. Asegurate de que `apps.users` "
            "esté antes de `apps.adoptions` en INSTALLED_APPS."
        )

    now = timezone.now()
    created_count = 0
    updated_count = 0

    for item in SEED_ADOPTION_REQUESTS:
        applicant = User.objects.filter(email=item["applicant_email"]).first()
        pet = Pet.objects.filter(name=item["pet_name"]).first()
        if applicant is None or pet is None:
            raise CommandError(
                f"Faltan datos previos para crear la solicitud de '{item['pet_name']}'. "
                "Asegurate de que `apps.users` y `apps.pets` estén antes de `apps.adoptions` "
                "en INSTALLED_APPS."
            )

        _, created = AdoptionRequest.objects.update_or_create(
            pet=pet,
            applicant=applicant,
            defaults={
                "full_name": item["full_name"],
                "age": item["age"],
                "phone": item["phone"],
                "email": item["email"],
                "address": item["address"],
                "city": item["city"],
                "housing_type": item["housing_type"],
                "other_pets": item["other_pets"],
                "accepts_commitment": item["accepts_commitment"],
                "status": item["status"],
                "rejection_reason": item["rejection_reason"],
                "meeting_point": item["meeting_point"],
                "reviewed_by": staff_user if item["reviewed"] else None,
                "reviewed_at": now if item["reviewed"] else None,
                "is_active": True,
            },
        )
        if created:
            created_count += 1
        else:
            updated_count += 1

    return f"{created_count} solicitudes creadas, {updated_count} actualizadas"
