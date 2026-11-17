"""Migración de datos: carga los 4 roles del catálogo de la tabla Role."""

from django.db import migrations

INITIAL_ROLES = [
    ("member", "Miembro de la comunidad"),
    ("verified_shelter", "Refugio verificado"),
    ("staff", "Staff Callejeros"),
    ("admin", "Admin"),
]


def seed_roles(apps, schema_editor):
    role_model = apps.get_model("users", "Role")
    for code, name in INITIAL_ROLES:
        role_model.objects.get_or_create(
            code=code,
            defaults={"name": name, "is_active": True},
        )


def unseed_roles(apps, schema_editor):
    role_model = apps.get_model("users", "Role")
    codes = [code for code, _ in INITIAL_ROLES]
    role_model.objects.filter(code__in=codes, users__isnull=True).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_roles, unseed_roles),
    ]
