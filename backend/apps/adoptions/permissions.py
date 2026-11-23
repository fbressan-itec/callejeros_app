"""Helpers de autorización para las solicitudes de adopción."""

from apps.adoptions.models import AdoptionRequest
from apps.users.models import RoleCode
from apps.users.permissions import user_has_role

STAFF_OR_ADMIN_ROLES = frozenset({RoleCode.STAFF, RoleCode.ADMIN})


def can_view_adoption_request(user, adoption_request: AdoptionRequest) -> bool:
    """Devuelve True si el usuario es el solicitante o tiene rol Staff/Admin."""
    if not user or not user.is_authenticated or not getattr(user, "is_active", False):
        return False
    if adoption_request.applicant_id == user.id:
        return True
    return user_has_role(user, STAFF_OR_ADMIN_ROLES)
