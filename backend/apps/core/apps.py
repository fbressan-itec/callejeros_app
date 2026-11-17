from django.apps import AppConfig


class CoreConfig(AppConfig):
    """Lo común a todas las apps: modelo base y utilidades compartidas."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"
