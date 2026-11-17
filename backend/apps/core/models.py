from django.db import models


class BaseQuerySet(models.QuerySet):
    """Consultas comunes a todas las tablas de negocio."""

    def active(self):
        """Solo las filas vigentes (no dadas de baja)."""
        return self.filter(is_active=True)


class BaseModel(models.Model):
    """Modelo base de las tablas de negocio.

    Suma las fechas de auditoría y la baja lógica. Es abstracto: no crea una
    tabla propia, solo le pasa sus campos a los modelos que lo heredan.
    """

    created_at = models.DateTimeField("creado", auto_now_add=True)
    updated_at = models.DateTimeField("modificado", auto_now=True)
    is_active = models.BooleanField("activo", default=True)

    objects = BaseQuerySet.as_manager()

    class Meta:
        abstract = True

    def deactivate(self):
        """Baja lógica: marca la fila como inactiva en lugar de borrarla."""
        self.is_active = False
        self.save(update_fields=["is_active", "updated_at"])
