"""Configuración del panel de administración de Django para `apps.pets`."""

from django.contrib import admin
from django.http import HttpRequest

from apps.core.admin import ReadOnlyAdminMixin, SoftDeleteAdminMixin
from apps.pets.models import Pet, PetHealth, PetPhoto, PetStatusLog


class PetHealthInline(admin.StackedInline):
    model = PetHealth
    can_delete = False
    extra = 0

    def has_delete_permission(self, request: HttpRequest, obj: object = None) -> bool:
        return False


class PetPhotoInline(admin.TabularInline):
    model = PetPhoto
    can_delete = False
    extra = 0
    fields = ("position", "image", "is_active", "created_at")
    readonly_fields = ("created_at",)

    def has_delete_permission(self, request: HttpRequest, obj: object = None) -> bool:
        return False


class PetStatusLogInline(ReadOnlyAdminMixin, admin.TabularInline):
    model = PetStatusLog
    extra = 0
    can_delete = False
    readonly_fields = (
        "previous_status",
        "new_status",
        "performed_by",
        "note",
        "created_at",
    )


@admin.register(Pet)
class PetAdmin(SoftDeleteAdminMixin, admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "species",
        "sex",
        "status",
        "is_urgent_requested",
        "is_urgent_validated",
        "published_by",
        "is_active",
        "created_at",
    )
    list_filter = (
        "status",
        "species",
        "sex",
        "is_sociable",
        "is_neutered",
        "is_urgent_requested",
        "is_urgent_validated",
        "is_active",
    )
    search_fields = ("name", "description", "published_by__email")
    # `status` e `is_urgent_validated` cambian solo por servicios (BK-06) para dejar historial.
    readonly_fields = ("status", "is_urgent_validated", "created_at", "updated_at")
    inlines = (PetHealthInline, PetPhotoInline, PetStatusLogInline)


@admin.register(PetHealth)
class PetHealthAdmin(admin.ModelAdmin):
    list_display = ("pet", "general_status", "vaccines", "updated_at")
    search_fields = ("pet__name", "general_status")
    readonly_fields = ("created_at", "updated_at")

    def has_delete_permission(self, request: HttpRequest, obj: object = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest) -> dict:
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(PetPhoto)
class PetPhotoAdmin(SoftDeleteAdminMixin, admin.ModelAdmin):
    list_display = ("pet", "position", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("pet__name",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(PetStatusLog)
class PetStatusLogAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = (
        "pet",
        "previous_status",
        "new_status",
        "performed_by",
        "created_at",
    )
    list_filter = ("new_status",)
    search_fields = ("pet__name", "performed_by__email", "note")
    readonly_fields = (
        "pet",
        "previous_status",
        "new_status",
        "performed_by",
        "note",
        "created_at",
    )
