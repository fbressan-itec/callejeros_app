"""Tests de permisos por rol reutilizables y del endpoint `/api/auth/me/` (BK-02c)."""

import pytest
from rest_framework import status
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from apps.users.models import Role, RoleCode
from apps.users.permissions import (
    FORBIDDEN_ERROR_MESSAGE,
    HasRole,
    IsAdmin,
    IsMember,
    IsShelterStaffOrAdmin,
    IsStaff,
    IsStaffOrAdmin,
    IsVerifiedShelter,
)
from apps.users.services import issue_tokens_for_user
from apps.users.tests.factories import UserFactory

ME_URL = "/api/auth/me/"


def _build_protected_view(permission_class: type[BasePermission] | object) -> APIView:
    class DummyProtectedView(APIView):
        permission_classes = (permission_class,)

        def get(self, request: Request) -> Response:
            return Response({"ok": True}, status=status.HTTP_200_OK)

    return DummyProtectedView.as_view()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("permission_cls", "expected_allowed_roles"),
    [
        (IsMember, {RoleCode.MEMBER}),
        (IsVerifiedShelter, {RoleCode.VERIFIED_SHELTER}),
        (IsStaff, {RoleCode.STAFF}),
        (IsAdmin, {RoleCode.ADMIN}),
        (IsStaffOrAdmin, {RoleCode.STAFF, RoleCode.ADMIN}),
        (
            IsShelterStaffOrAdmin,
            {RoleCode.VERIFIED_SHELTER, RoleCode.STAFF, RoleCode.ADMIN},
        ),
        (IsVerifiedShelter | IsStaff, {RoleCode.VERIFIED_SHELTER, RoleCode.STAFF}),
    ],
)
@pytest.mark.parametrize(
    "role_code",
    [
        RoleCode.MEMBER,
        RoleCode.VERIFIED_SHELTER,
        RoleCode.STAFF,
        RoleCode.ADMIN,
    ],
)
def test_role_permissions_matrix_for_all_four_roles(
    permission_cls: type[BasePermission] | object,
    expected_allowed_roles: set[str],
    role_code: str,
) -> None:
    factory = APIRequestFactory()
    role = Role.objects.get(code=role_code)
    user = UserFactory(role=role)
    view = _build_protected_view(permission_cls)

    request = factory.get("/dummy/")
    force_authenticate(request, user=user)
    response = view(request)

    if role_code in expected_allowed_roles:
        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"ok": True}
    else:
        assert response.status_code == status.HTTP_403_FORBIDDEN
        if isinstance(permission_cls, type) and issubclass(permission_cls, HasRole):
            assert str(response.data["detail"]) == FORBIDDEN_ERROR_MESSAGE


@pytest.mark.django_db
@pytest.mark.parametrize(
    "permission_cls",
    [
        IsMember,
        IsVerifiedShelter,
        IsStaff,
        IsAdmin,
        IsStaffOrAdmin,
        IsShelterStaffOrAdmin,
    ],
)
def test_role_permissions_reject_unauthenticated_and_inactive_users(
    permission_cls: type[BasePermission],
) -> None:
    factory = APIRequestFactory()
    view = _build_protected_view(permission_cls)

    anon_request = factory.get("/dummy/")
    anon_response = view(anon_request)
    assert anon_response.status_code == status.HTTP_401_UNAUTHORIZED

    admin_role = Role.objects.get(code=RoleCode.ADMIN)
    inactive_user = UserFactory(role=admin_role)
    inactive_user.deactivate()

    inactive_request = factory.get("/dummy/")
    force_authenticate(inactive_request, user=inactive_user)
    inactive_response = view(inactive_request)
    assert inactive_response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("role_code", "expected_role_name"),
    [
        (RoleCode.MEMBER, "Miembro de la comunidad"),
        (RoleCode.VERIFIED_SHELTER, "Refugio verificado"),
        (RoleCode.STAFF, "Staff Callejeros"),
        (RoleCode.ADMIN, "Admin"),
    ],
)
def test_me_endpoint_returns_authenticated_user_and_role(
    role_code: str,
    expected_role_name: str,
) -> None:
    client = APIClient()
    role = Role.objects.get(code=role_code)
    user = UserFactory(
        email=f"{role_code}@callejeros.ar",
        first_name="Camila",
        role=role,
    )
    tokens = issue_tokens_for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    response = client.get(ME_URL)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == user.id
    assert data["email"] == f"{role_code}@callejeros.ar"
    assert data["first_name"] == "Camila"
    assert data["role"] == {
        "code": role_code,
        "name": expected_role_name,
    }
    assert "password" not in data
    assert "address" not in data


@pytest.mark.django_db
def test_me_endpoint_rejects_unauthenticated_or_inactive_user() -> None:
    client = APIClient()

    anon_response = client.get(ME_URL)
    assert anon_response.status_code == status.HTTP_401_UNAUTHORIZED

    user = UserFactory(email="baja@callejeros.ar")
    tokens = issue_tokens_for_user(user)
    user.deactivate()

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    inactive_response = client.get(ME_URL)
    assert inactive_response.status_code == status.HTTP_401_UNAUTHORIZED
