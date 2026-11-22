"""Permisos de autorización para las solicitudes de adopción."""

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.adoptions.models import AdoptionRequest
from apps.users.models import RoleCode
from apps.users.permissions import FORBIDDEN_ERROR_MESSAGE, user_has_role

STAFF_OR_ADMIN_ROLES = frozenset({RoleCode.STAFF, RoleCode.ADMIN})


def can_view_adoption_request(user, adoption_request: AdoptionRequest) -> bool:
    """Devuelve True si el usuario es el solicitante o tiene rol Staff/Admin."""
    if not user or not user.is_authenticated or not getattr(user, "is_active", False):
        return False
    if adoption_request.applicant_id == user.id:
        return True
    return user_has_role(user, STAFF_OR_ADMIN_ROLES)


class IsApplicantOrStaffOrAdmin(BasePermission):
    """Permite consultar una solicitud solo a su solicitante, Staff o Admin."""

    message = FORBIDDEN_ERROR_MESSAGE

    def has_permission(self, request: Request, view: APIView) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "is_active", False))

    def has_object_permission(self, request: Request, view: APIView, obj: object) -> bool:
        if isinstance(obj, AdoptionRequest):
            return can_view_adoption_request(request.user, obj)
        return False
