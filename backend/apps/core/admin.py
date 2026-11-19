"""Mixins reutilizables del panel de administración de Django (baja lógica y solo lectura)."""

from django.contrib import admin
from django.db.models import QuerySet
from django.http import HttpRequest


class SoftDeleteAdminMixin:
    """Impide el borrado físico en el admin y agrega acciones de baja lógica y reactivación."""

    actions = ("deactivate_selected", "reactivate_selected")

    def has_delete_permission(self, request: HttpRequest, obj: object = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest) -> dict:
        actions = super().get_actions(request)  # type: ignore[misc]
        actions.pop("delete_selected", None)
        return actions

    @admin.action(description="Dar de baja seleccionados")
    def deactivate_selected(self, request: HttpRequest, queryset: QuerySet) -> None:
        for obj in queryset:
            obj.deactivate()

    @admin.action(description="Reactivar seleccionados")
    def reactivate_selected(self, request: HttpRequest, queryset: QuerySet) -> None:
        for obj in queryset:
            obj.is_active = True
            obj.save(update_fields=["is_active", "updated_at"])


class ReadOnlyAdminMixin:
    """Bloquea alta, edición y borrado en el admin para historiales de auditoría (`*Log`)."""

    def has_add_permission(self, request: HttpRequest, obj: object = None) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: object = None) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj: object = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest) -> dict:
        actions = super().get_actions(request)  # type: ignore[misc]
        actions.pop("delete_selected", None)
        return actions
