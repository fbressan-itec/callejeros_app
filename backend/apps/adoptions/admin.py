"""Configuración del panel de administración de Django para `apps.adoptions`."""

from django.contrib import admin

from apps.adoptions.models import AdoptionRequest
from apps.core.admin import SoftDeleteAdminMixin


@admin.register(AdoptionRequest)
class AdoptionRequestAdmin(SoftDeleteAdminMixin, admin.ModelAdmin):
    list_display = (
        "id",
        "pet",
        "applicant",
        "full_name",
        "age",
        "status",
        "reviewed_by",
        "reviewed_at",
        "is_active",
        "created_at",
    )
    list_filter = (
        "status",
        "is_active",
        "created_at",
    )
    search_fields = (
        "full_name",
        "email",
        "pet__name",
        "applicant__email",
    )
    # `status`, `reviewed_by` y `reviewed_at` cambian solo por servicios de revisión (BK-07b).
    readonly_fields = (
        "status",
        "reviewed_by",
        "reviewed_at",
        "created_at",
        "updated_at",
    )
