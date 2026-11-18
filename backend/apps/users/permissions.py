"""Clases de permisos por rol reutilizables para los endpoints de la API (BK-02c)."""

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.users.models import RoleCode

FORBIDDEN_ERROR_MESSAGE = "No tenés permiso para hacer esto."


class HasRole(BasePermission):
    """Permiso base que verifica que el usuario esté activo y tenga uno de los roles permitidos."""

    allowed_roles: tuple[str, ...] = ()
    message = FORBIDDEN_ERROR_MESSAGE

    def has_permission(self, request: Request, view: APIView) -> bool:
        user = request.user
        if not user or not user.is_authenticated or not getattr(user, "is_active", False):
            return False
        if getattr(user, "role_id", None) is None:
            return False
        return user.role.code in self.allowed_roles


class IsMember(HasRole):
    """Permite el acceso únicamente a usuarios con rol `member`."""

    allowed_roles = (RoleCode.MEMBER,)


class IsVerifiedShelter(HasRole):
    """Permite el acceso únicamente a usuarios con rol `verified_shelter`."""

    allowed_roles = (RoleCode.VERIFIED_SHELTER,)


class IsStaff(HasRole):
    """Permite el acceso únicamente a usuarios con rol `staff`."""

    allowed_roles = (RoleCode.STAFF,)


class IsAdmin(HasRole):
    """Permite el acceso únicamente a usuarios con rol `admin`."""

    allowed_roles = (RoleCode.ADMIN,)


class IsStaffOrAdmin(HasRole):
    """Permite el acceso a `staff` y `admin` (panel de Staff y moderación, alcance A1)."""

    allowed_roles = (RoleCode.STAFF, RoleCode.ADMIN)


class IsShelterStaffOrAdmin(HasRole):
    """Permite el acceso a `verified_shelter`, `staff` y `admin` (tienda E4 y noticias F1)."""

    allowed_roles = (RoleCode.VERIFIED_SHELTER, RoleCode.STAFF, RoleCode.ADMIN)
