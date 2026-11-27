"""Comando `python manage.py seed`: carga datos de prueba sin duplicar.

Cada app guarda sus datos de prueba en su propio `seed.py`, con una función
`run() -> str` que los crea o actualiza sin duplicar y devuelve un resumen.
Este comando busca ese módulo en cada app de `apps.` instalada y lo ejecuta en
el orden de `INSTALLED_APPS` (igual que Django descubre los `admin.py`), así
`core` no importa a las apps de negocio y cada tarjeta toca solo su `seed.py`.
"""

from importlib import import_module
from types import ModuleType

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.module_loading import module_has_submodule

SEED_MODULE_NAME = "seed"


def get_seed_modules() -> list[tuple[str, ModuleType]]:
    """Devuelve `(app_label, módulo)` de cada app propia que tiene `seed.py`."""
    seed_modules = []
    for app_config in apps.get_app_configs():
        if not app_config.name.startswith("apps."):
            continue
        if module_has_submodule(app_config.module, SEED_MODULE_NAME):
            module = import_module(f"{app_config.name}.{SEED_MODULE_NAME}")
            seed_modules.append((app_config.label, module))
    return seed_modules


class Command(BaseCommand):
    help = "Carga datos de prueba para desarrollo (idempotente: se puede correr varias veces)."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--allow-production",
            action="store_true",
            help=(
                "Permite correrlo con DJANGO_DEBUG=False. Solo para la demo publicada, "
                "que necesita los usuarios de prueba para revisar cada rol."
            ),
        )

    @transaction.atomic
    def handle(self, *args: object, **options: object) -> None:
        if not settings.DEBUG and not options["allow_production"]:
            raise CommandError(
                "El comando `seed` solo puede ejecutarse en desarrollo (DJANGO_DEBUG=True). "
                "Para la demo publicada, usá --allow-production."
            )

        for app_label, module in get_seed_modules():
            summary = module.run()
            self.stdout.write(f"{app_label}: {summary}.")

        self.stdout.write(self.style.SUCCESS("Seed completado."))
