"""Datos de prueba de cuentas: un usuario por rol (los ejecuta `python manage.py seed`)."""

from django.conf import settings
from django.core.management.base import CommandError

from apps.users.models import Role, RoleCode, User, UserPreferences

SEED_USERS = [
    {
        "email": "miembro@callejeros.ar",
        "first_name": "Tomás",
        "last_name": "Gómez",
        "phone": "+54 9 358 4111111",
        "city": "Río Cuarto",
        "neighborhood": "Alberdi",
        "role_code": RoleCode.MEMBER,
    },
    {
        "email": "refugio@callejeros.ar",
        "first_name": "Refugio Patitas",
        "last_name": "Río Cuarto",
        "phone": "+54 9 358 4222222",
        "city": "Río Cuarto",
        "neighborhood": "Centro",
        "role_code": RoleCode.VERIFIED_SHELTER,
    },
    {
        "email": "staff@callejeros.ar",
        "first_name": "Valentina",
        "last_name": "López",
        "phone": "+54 9 358 4333333",
        "city": "Río Cuarto",
        "neighborhood": "Banda Norte",
        "role_code": RoleCode.STAFF,
    },
    {
        "email": "admin@callejeros.ar",
        "first_name": "Admin",
        "last_name": "Callejeros",
        "phone": "+54 9 358 4444444",
        "city": "Río Cuarto",
        "neighborhood": "Centro",
        "role_code": RoleCode.ADMIN,
    },
]


def run() -> str:
    """Crea o actualiza los usuarios de prueba sin duplicarlos y devuelve un resumen."""
    password = getattr(settings, "SEED_USER_PASSWORD", "")
    if not password or len(password) < 6:
        raise CommandError(
            "Definí SEED_USER_PASSWORD en tu archivo .env (mínimo 6 caracteres) "
            "antes de correr `python manage.py seed`."
        )

    created_count = 0
    updated_count = 0

    for item in SEED_USERS:
        user, created = User.objects.update_or_create(
            email=item["email"],
            defaults={
                "first_name": item["first_name"],
                "last_name": item["last_name"],
                "phone": item["phone"],
                "is_phone_verified": True,
                "city": item["city"],
                "neighborhood": item["neighborhood"],
                "role": Role.objects.get(code=item["role_code"]),
                "is_active": True,
            },
        )
        user.set_password(password)
        user.save(update_fields=["password", "updated_at"])
        UserPreferences.objects.get_or_create(user=user)

        if created:
            created_count += 1
        else:
            updated_count += 1

    return f"{created_count} usuarios creados, {updated_count} actualizados"
