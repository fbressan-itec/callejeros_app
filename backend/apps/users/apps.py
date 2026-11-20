from django.apps import AppConfig


class UsersConfig(AppConfig):
    """Cuentas de usuario, roles, preferencias e historial de cambios."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.users"
    verbose_name = "Usuarios y roles"
