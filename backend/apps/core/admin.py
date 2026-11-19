"""Mixins reutilizables del panel de administración de Django (baja lógica y solo lectura)."""

from django.contrib import admin, messages
from django.db import IntegrityError, transaction
from django.db.models import QuerySet
from django.http import HttpRequest


class NoDeleteAdminMixin:
    """Impide el borrado físico desde el panel de administración (ficha, inline y acción masiva)."""

    def has_delete_permission(self, request: HttpRequest, obj: object = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest) -> dict:
        actions = super().get_actions(request)  # type: ignore[misc]
        actions.pop("delete_selected", None)
        return actions


class SoftDeleteAdminMixin(NoDeleteAdminMixin):
    """Impide el borrado físico en el admin y agrega acciones de baja lógica y reactivación."""

    actions = ("deactivate_selected", "reactivate_selected")

    @admin.action(description="Dar de baja seleccionados")
    def deactivate_selected(self, request: HttpRequest, queryset: QuerySet) -> None:
        for obj in queryset:
            obj.deactivate()

    @admin.action(description="Reactivar seleccionados")
    def reactivate_selected(self, request: HttpRequest, queryset: QuerySet) -> None:
        reactivated = 0
        skipped: list[str] = []

        for obj in queryset:
            try:
                with transaction.atomic():
                    obj.is_active = True
                    obj.save(update_fields=["is_active", "updated_at"])
                    reactivated += 1
            except IntegrityError:
                skipped.append(str(obj))

        if reactivated:
            self.message_user(  # type: ignore[attr-defined]
                request,
                f"Se reactivaron {reactivated} registro(s).",
                level=messages.SUCCESS,
            )
        if skipped:
            self.message_user(  # type: ignore[attr-defined]
                request,
                "No se pudieron reactivar por conflicto con otro registro activo: "
                + ", ".join(skipped),
                level=messages.WARNING,
            )


class ReadOnlyAdminMixin(NoDeleteAdminMixin):
    """Bloquea alta, edición y borrado en el admin para historiales de auditoría (`*Log`)."""

    def has_add_permission(self, request: HttpRequest, obj: object = None) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: object = None) -> bool:
        return False
