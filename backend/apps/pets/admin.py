"""Configuración del panel de administración de Django para `apps.pets`."""

from django.contrib import admin

from apps.pets.models import Pet, PetHealth, PetPhoto, PetStatusLog


class PetHealthInline(admin.StackedInline):
    model = PetHealth
    can_delete = False
    extra = 0


class PetPhotoInline(admin.TabularInline):
    model = PetPhoto
    extra = 0
    fields = ("position", "image", "is_active", "created_at")
    readonly_fields = ("created_at",)


class PetStatusLogInline(admin.TabularInline):
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
class PetAdmin(admin.ModelAdmin):
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
    readonly_fields = ("created_at", "updated_at")
    inlines = (PetHealthInline, PetPhotoInline, PetStatusLogInline)


@admin.register(PetHealth)
class PetHealthAdmin(admin.ModelAdmin):
    list_display = ("pet", "general_status", "vaccines", "updated_at")
    search_fields = ("pet__name", "general_status")
    readonly_fields = ("created_at", "updated_at")


@admin.register(PetPhoto)
class PetPhotoAdmin(admin.ModelAdmin):
    list_display = ("pet", "position", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("pet__name",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(PetStatusLog)
class PetStatusLogAdmin(admin.ModelAdmin):
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
