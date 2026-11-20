"""Permisos de autorización para la gestión de mascotas y fotos."""

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.pets.models import Pet, PetPhoto
from apps.users.models import RoleCode
from apps.users.permissions import FORBIDDEN_ERROR_MESSAGE

STAFF_OR_ADMIN_ROLES = frozenset({RoleCode.STAFF, RoleCode.ADMIN})


def is_staff_or_admin(user) -> bool:
    """Devuelve True si el usuario está activo y tiene rol Staff o Admin."""
    if not user or not user.is_authenticated or not getattr(user, "is_active", False):
        return False
    if getattr(user, "role_id", None) is None:
        return False
    return user.role.code in STAFF_OR_ADMIN_ROLES


def can_manage_pet(user, pet: Pet) -> bool:
    """Devuelve True si el usuario es el autor de la mascota o tiene rol Staff/Admin."""
    if not user or not user.is_authenticated or not getattr(user, "is_active", False):
        return False
    if pet.published_by_id == user.id:
        return True
    return is_staff_or_admin(user)


class IsPetOwnerOrStaffOrAdmin(BasePermission):
    """Permite gestionar una mascota solo a su autor, Staff o Admin."""

    message = FORBIDDEN_ERROR_MESSAGE

    def has_permission(self, request: Request, view: APIView) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "is_active", False))

    def has_object_permission(self, request: Request, view: APIView, obj: object) -> bool:
        if isinstance(obj, Pet):
            return can_manage_pet(request.user, obj)
        if isinstance(obj, PetPhoto):
            return can_manage_pet(request.user, obj.pet)
        return False
