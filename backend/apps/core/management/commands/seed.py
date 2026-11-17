"""Comando `python manage.py seed`: carga datos de prueba sin duplicar."""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

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


class Command(BaseCommand):
    help = "Carga datos de prueba para desarrollo (idempotente: se puede correr varias veces)."

    @transaction.atomic
    def handle(self, *args: object, **options: object) -> None:
        password = getattr(settings, "SEED_USER_PASSWORD", "")
        if not password or len(password) < 6:
            raise CommandError(
                "Definí SEED_USER_PASSWORD en tu archivo .env (mínimo 6 caracteres) "
                "antes de correr `python manage.py seed`."
            )

        created_count = 0
        updated_count = 0

        for item in SEED_USERS:
            role_code = item["role_code"]
            role, _ = Role.objects.get_or_create(
                code=role_code,
                defaults={"name": role_code.label, "is_active": True},
            )

            user, created = User.objects.update_or_create(
                email=item["email"],
                defaults={
                    "first_name": item["first_name"],
                    "last_name": item["last_name"],
                    "phone": item["phone"],
                    "is_phone_verified": True,
                    "city": item["city"],
                    "neighborhood": item["neighborhood"],
                    "role": role,
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

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed completado: {created_count} usuarios creados, {updated_count} actualizados."
            )
        )
