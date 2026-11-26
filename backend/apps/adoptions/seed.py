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
        "home_ownership": AdoptionRequest.HomeOwnership.OWNED,
        "rental_allows_pets": "",
        "outdoor_space": "Patio de 10 x 8 con tapia de 2 metros y portón con cerradura",
        "household_members": "Vivo con mi pareja; no tenemos hijos",
        "household_agreement": AdoptionRequest.HouseholdAgreement.YES,
        "previous_pets": "Tuve un perro mestizo 13 años; murió de viejo en 2024",
        "hours_alone": AdoptionRequest.HoursAlone.FROM_4_TO_8,
        "living_space": "Adentro de la casa; de día puede salir al patio",
        "vacation_care": "Mis suegros, que viven en el mismo barrio",
        "contingency_plan": "Si nos mudamos, se viene con nosotros; nunca lo daría sin avisar",
        "adoption_reason": "Loki nos enamoró por lo compañero que se ve en las fotos",
        "accepts_commitment": True,
        "status": AdoptionRequest.Status.PENDING,
        "rejection_reason": "",
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
        "home_ownership": AdoptionRequest.HomeOwnership.RENTED,
        "rental_allows_pets": AdoptionRequest.RentalPetsPolicy.YES,
        "outdoor_space": "Patio cerrado con galería techada y red en las ventanas",
        "household_members": "Mi pareja, nuestra hija de 9 años y yo",
        "household_agreement": AdoptionRequest.HouseholdAgreement.YES,
        "previous_pets": "Tenemos una gata hace 4 años y antes tuvimos un perro",
        "hours_alone": AdoptionRequest.HoursAlone.LESS_THAN_4,
        "living_space": "Adentro, con una cucha en el living",
        "vacation_care": "Viajamos con ella o la cuida mi hermana",
        "contingency_plan": "La llevamos con nosotros; si no pudiéramos, avisamos a Callejeros",
        "adoption_reason": "",
        "accepts_commitment": True,
        "status": AdoptionRequest.Status.APPROVED,
        "rejection_reason": "",
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
        "home_ownership": AdoptionRequest.HomeOwnership.OTHER,
        "rental_allows_pets": "",
        "outdoor_space": "Frente abierto, sin cerco",
        "household_members": "Vivo solo",
        "household_agreement": AdoptionRequest.HouseholdAgreement.YES,
        "previous_pets": "Siempre tuve perros de campo",
        "hours_alone": AdoptionRequest.HoursAlone.MORE_THAN_8,
        "living_space": "Afuera, en el patio delantero",
        "vacation_care": "Un vecino le deja comida",
        "contingency_plan": "Se lo daría a algún conocido",
        "adoption_reason": "Quiero un perro guardián",
        "accepts_commitment": True,
        "status": AdoptionRequest.Status.REJECTED,
        "rejection_reason": (
            "Rocco necesita un hogar sin otros animales y con patio cerrado; "
            "te invitamos a conocer otras mascotas compatibles en el catálogo."
        ),
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

        fields = {
            "full_name": item["full_name"],
            "age": item["age"],
            "phone": item["phone"],
            "email": item["email"],
            "address": item["address"],
            "city": item["city"],
            "housing_type": item["housing_type"],
            "home_ownership": item["home_ownership"],
            "rental_allows_pets": item["rental_allows_pets"],
            "outdoor_space": item["outdoor_space"],
            "household_members": item["household_members"],
            "household_agreement": item["household_agreement"],
            "other_pets": item["other_pets"],
            "previous_pets": item["previous_pets"],
            "hours_alone": item["hours_alone"],
            "living_space": item["living_space"],
            "vacation_care": item["vacation_care"],
            "contingency_plan": item["contingency_plan"],
            "adoption_reason": item["adoption_reason"],
            "accepts_commitment": item["accepts_commitment"],
            # La castración se pide solo si la mascota todavía no está castrada.
            "accepts_neutering": None if pet.is_neutered else True,
            "accepts_follow_up": True,
            "accepts_return_notice": True,
            "declares_truthful": True,
            "status": item["status"],
            "rejection_reason": item["rejection_reason"],
            "reviewed_by": staff_user if item["reviewed"] else None,
            "reviewed_at": now if item["reviewed"] else None,
            "is_active": True,
        }

        # Desde la app, el mismo usuario puede volver a postularse a la misma mascota
        # (por ejemplo, después de una desaprobada). La del seed es la más vieja; las
        # demás son de quien usó la app y no se tocan.
        seed_request = (
            AdoptionRequest.objects.filter(pet=pet, applicant=applicant)
            .order_by("created_at", "id")
            .first()
        )
        if seed_request is None:
            AdoptionRequest.objects.create(pet=pet, applicant=applicant, **fields)
            created_count += 1
            continue

        other_pending = (
            AdoptionRequest.objects.active()
            .filter(pet=pet, applicant=applicant, status=AdoptionRequest.Status.PENDING)
            .exclude(pk=seed_request.pk)
            .exists()
        )
        if fields["status"] == AdoptionRequest.Status.PENDING and other_pending:
            # Ya hay otra pendiente creada desde la app: no puede haber dos (restricción
            # de la base), así que la del seed conserva su estado y su revisión.
            for field_name in ("status", "rejection_reason", "reviewed_by", "reviewed_at"):
                fields.pop(field_name)

        for field_name, value in fields.items():
            setattr(seed_request, field_name, value)
        seed_request.save()
        updated_count += 1

    return f"{created_count} solicitudes creadas, {updated_count} actualizadas"
