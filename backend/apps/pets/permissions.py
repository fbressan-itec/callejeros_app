"""Permisos de autorización para la gestión de mascotas y fotos."""

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.pets.models import Pet, PetPhoto
from apps.users.models import RoleCode
from apps.users.permissions import FORBIDDEN_ERROR_MESSAGE

STAFF_OR_ADMIN_ROLES = frozenset({RoleCode.STAFF, RoleCode.ADMIN})
PUBLIC_PET_STATUSES = frozenset({Pet.Status.PUBLISHED, Pet.Status.ADOPTED})


def is_authenticated_active_user(user) -> bool:
    """Devuelve True si el usuario está autenticado y activo."""
    return bool(
        user and getattr(user, "is_authenticated", False) and getattr(user, "is_active", False)
    )


def is_staff_or_admin(user) -> bool:
    """Devuelve True si el usuario está activo y tiene rol Staff o Admin."""
    if not is_authenticated_active_user(user):
        return False
    if getattr(user, "role_id", None) is None:
        return False
    return user.role.code in STAFF_OR_ADMIN_ROLES


def can_manage_pet(user, pet: Pet) -> bool:
    """Devuelve True si el usuario es el autor de la mascota o tiene rol Staff/Admin."""
    if not is_authenticated_active_user(user):
        return False
    if pet.published_by_id == user.id:
        return True
    return is_staff_or_admin(user)


def can_view_pet(user, pet: Pet) -> bool:
    """Devuelve True si la ficha de la mascota es visible para el usuario dado.

    Las mascotas de un usuario desactivado se ocultan de la ficha pública sin tocar
    sus datos (BK-15c): al reactivar la cuenta vuelven a mostrarse solas.
    """
    if not pet.is_active:
        return False
    if not pet.published_by.is_active:
        return is_staff_or_admin(user)
    if pet.status in PUBLIC_PET_STATUSES:
        return True
    return can_manage_pet(user, pet)


class IsPetOwnerOrStaffOrAdmin(BasePermission):
    """Permite gestionar una mascota solo a su autor, Staff o Admin."""

    message = FORBIDDEN_ERROR_MESSAGE

    def has_permission(self, request: Request, view: APIView) -> bool:
        return is_authenticated_active_user(request.user)

    def has_object_permission(self, request: Request, view: APIView, obj: object) -> bool:
        if isinstance(obj, Pet):
            return can_manage_pet(request.user, obj)
        if isinstance(obj, PetPhoto):
            return can_manage_pet(request.user, obj.pet)
        return False
