"""Tests de integración de la API solo Admin de usuarios y roles (BK-15b)."""

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from apps.users.models import RoleCode, User, UserRoleLog, UserStatusLog
from apps.users.services import (
    CANNOT_DEACTIVATE_SELF_ERROR,
    CANNOT_DEMOTE_SELF_ERROR,
    MAX_ADMIN_NOTE_LENGTH,
    issue_tokens_for_user,
)
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _auth_client(user: User) -> APIClient:
    client = APIClient()
    tokens = issue_tokens_for_user(user, remember_me=False)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return client


def _all_admin_endpoints(target_id: int) -> list[tuple[str, str, dict]]:
    return [
        ("get", "/api/admin/roles/", {}),
        ("get", "/api/admin/users/", {}),
        ("get", f"/api/admin/users/{target_id}/", {}),
        ("post", f"/api/admin/users/{target_id}/role/", {"role_code": RoleCode.STAFF}),
        ("post", f"/api/admin/users/{target_id}/deactivate/", {}),
        ("post", f"/api/admin/users/{target_id}/reactivate/", {}),
    ]


def test_admin_endpoints_require_authentication() -> None:
    target = UserFactory(role__code=RoleCode.MEMBER)
    client = APIClient()

    for method, url, payload in _all_admin_endpoints(target.pk):
        response = getattr(client, method)(url, payload, format="json")
        assert response.status_code == 401, f"{method.upper()} {url} debería devolver 401"


@pytest.mark.parametrize(
    "role_code",
    [RoleCode.MEMBER, RoleCode.VERIFIED_SHELTER, RoleCode.STAFF],
)
def test_admin_endpoints_forbid_non_admin_roles(role_code: str) -> None:
    actor = UserFactory(role__code=role_code)
    target = UserFactory(role__code=RoleCode.MEMBER)
    client = _auth_client(actor)

    for method, url, payload in _all_admin_endpoints(target.pk):
        response = getattr(client, method)(url, payload, format="json")
        assert response.status_code == 403, f"{role_code} en {method.upper()} {url}"


def test_admin_endpoints_reject_inactive_admin_token() -> None:
    admin_user = UserFactory(role__code=RoleCode.ADMIN)
    target = UserFactory(role__code=RoleCode.MEMBER)
    client = _auth_client(admin_user)

    admin_user.deactivate()

    for method, url, payload in _all_admin_endpoints(target.pk):
        response = getattr(client, method)(url, payload, format="json")
        assert response.status_code == 401


def test_admin_roles_list_returns_all_four_roles() -> None:
    admin_user = UserFactory(role__code=RoleCode.ADMIN)
    client = _auth_client(admin_user)

    response = client.get("/api/admin/roles/")
    assert response.status_code == 200
    assert response.data == [
        {"code": RoleCode.MEMBER, "name": "Miembro de la comunidad"},
        {"code": RoleCode.VERIFIED_SHELTER, "name": "Refugio verificado"},
        {"code": RoleCode.STAFF, "name": "Staff Callejeros"},
        {"code": RoleCode.ADMIN, "name": "Admin"},
    ]


def test_admin_users_list_paginates_filters_searches_and_hides_private_fields() -> None:
    admin_user = UserFactory(
        email="admin.panel@callejeros.ar",
        first_name="Admin",
        last_name="Principal",
        role__code=RoleCode.ADMIN,
        address="Dirección Privada Secreta 123",
    )
    shelter = UserFactory(
        email="patitas@callejeros.ar",
        first_name="Refugio",
        last_name="Patitas",
        role__code=RoleCode.VERIFIED_SHELTER,
        address="Domicilio Interno 456",
        shelter_public_address="Sobremonte 1250, Río Cuarto",
        is_active=True,
    )
    inactive_staff = UserFactory(
        email="valentina.baja@callejeros.ar",
        first_name="Valentina",
        last_name="López",
        role__code=RoleCode.STAFF,
        address="Casa Privada 789",
        is_active=False,
    )
    for idx in range(12):
        UserFactory(
            email=f"vecino{idx}@callejeros.ar",
            first_name=f"Vecino{idx}",
            last_name="RíoCuarto",
            role__code=RoleCode.MEMBER,
        )

    client = _auth_client(admin_user)

    # Paginación de a 12 resultados.
    page1 = client.get("/api/admin/users/")
    assert page1.status_code == 200
    assert page1.data["count"] == 15
    assert len(page1.data["results"]) == 12
    assert page1.data["next"] is not None
    assert page1.data["previous"] is None

    for item in page1.data["results"]:
        assert "address" not in item
        assert "password" not in item

    page2 = client.get("/api/admin/users/?page=2")
    assert page2.status_code == 200
    assert len(page2.data["results"]) == 3
    assert page2.data["next"] is None
    assert page2.data["previous"] is not None

    # Filtro por rol.
    by_role = client.get(f"/api/admin/users/?role={RoleCode.VERIFIED_SHELTER}")
    assert by_role.status_code == 200
    assert [u["id"] for u in by_role.data["results"]] == [shelter.pk]
    assert by_role.data["results"][0]["shelter_public_address"] == "Sobremonte 1250, Río Cuarto"

    # Filtro por estado activo/inactivo.
    inactive_resp = client.get("/api/admin/users/?is_active=false")
    assert inactive_resp.status_code == 200
    assert [u["id"] for u in inactive_resp.data["results"]] == [inactive_staff.pk]

    # Búsqueda por nombre + apellido y por correo.
    search_name = client.get("/api/admin/users/?search=Valentina%20López")
    assert search_name.status_code == 200
    assert [u["id"] for u in search_name.data["results"]] == [inactive_staff.pk]

    search_email = client.get("/api/admin/users/?search=patitas@callejeros")
    assert search_email.status_code == 200
    assert [u["id"] for u in search_email.data["results"]] == [shelter.pk]

    # Filtros inválidos devuelven 400.
    assert client.get("/api/admin/users/?role=inexistente").status_code == 400
    assert client.get("/api/admin/users/?is_active=talvez").status_code == 400


def test_admin_user_detail_returns_active_or_inactive_user_without_address() -> None:
    admin_user = UserFactory(role__code=RoleCode.ADMIN)
    inactive_member = UserFactory(
        role__code=RoleCode.MEMBER,
        address="Dirección Privada 999",
        is_active=False,
    )
    client = _auth_client(admin_user)

    resp = client.get(f"/api/admin/users/{inactive_member.pk}/")
    assert resp.status_code == 200
    assert resp.data["id"] == inactive_member.pk
    assert resp.data["is_active"] is False
    assert resp.data["role"]["code"] == RoleCode.MEMBER
    assert "address" not in resp.data
    assert "password" not in resp.data

    assert client.get("/api/admin/users/999999/").status_code == 404


def test_admin_change_role_endpoint_audits_enforces_protections_and_is_idempotent() -> None:
    admin_1 = UserFactory(role__code=RoleCode.ADMIN)
    admin_2 = UserFactory(role__code=RoleCode.ADMIN)
    member = UserFactory(role__code=RoleCode.MEMBER, address="Privada 10")
    client = _auth_client(admin_1)

    # Cambio de rol exitoso.
    resp = client.post(
        f"/api/admin/users/{member.pk}/role/",
        {"role_code": RoleCode.VERIFIED_SHELTER, "note": "Verificado por coordinación"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["role"]["code"] == RoleCode.VERIFIED_SHELTER
    assert "address" not in resp.data
    assert "password" not in resp.data
    assert UserRoleLog.objects.filter(
        user=member,
        previous_role__code=RoleCode.MEMBER,
        new_role__code=RoleCode.VERIFIED_SHELTER,
        performed_by=admin_1,
        note="Verificado por coordinación",
    ).exists()

    # Repetir el mismo rol responde 200 sin duplicar historial.
    same_resp = client.post(
        f"/api/admin/users/{member.pk}/role/",
        {"role_code": RoleCode.VERIFIED_SHELTER},
        format="json",
    )
    assert same_resp.status_code == 200
    assert UserRoleLog.objects.filter(user=member).count() == 1

    # Admin sí puede cambiarle el rol a otro Admin cuando queda al menos uno activo.
    demote_other = client.post(
        f"/api/admin/users/{admin_2.pk}/role/",
        {"role_code": RoleCode.STAFF},
        format="json",
    )
    assert demote_other.status_code == 200
    assert demote_other.data["role"]["code"] == RoleCode.STAFF

    # Admin no puede quitarse su propio rol.
    self_demote = client.post(
        f"/api/admin/users/{admin_1.pk}/role/",
        {"role_code": RoleCode.STAFF},
        format="json",
    )
    assert self_demote.status_code == 400
    assert CANNOT_DEMOTE_SELF_ERROR in str(self_demote.data["role"])

    # Rol inválido, nota demasiado larga y usuario inexistente.
    assert (
        client.post(
            f"/api/admin/users/{member.pk}/role/",
            {"role_code": "invalido"},
            format="json",
        ).status_code
        == 400
    )
    assert (
        client.post(
            f"/api/admin/users/{member.pk}/role/",
            {"role_code": RoleCode.STAFF, "note": "x" * (MAX_ADMIN_NOTE_LENGTH + 1)},
            format="json",
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/admin/users/999999/role/",
            {"role_code": RoleCode.STAFF},
            format="json",
        ).status_code
        == 404
    )


def test_admin_deactivate_and_reactivate_endpoints_manage_sessions_logs_and_protections() -> None:
    admin_1 = UserFactory(role__code=RoleCode.ADMIN)
    admin_2 = UserFactory(role__code=RoleCode.ADMIN)
    member = UserFactory(role__code=RoleCode.MEMBER, address="Privada 20")
    member_tokens = issue_tokens_for_user(member, remember_me=True)
    client = _auth_client(admin_1)

    # Desactivar miembro: baja lógica, log y blacklist de refresh token.
    deact_resp = client.post(
        f"/api/admin/users/{member.pk}/deactivate/",
        {"note": "Cuenta suspendida"},
        format="json",
    )
    assert deact_resp.status_code == 200
    assert deact_resp.data["is_active"] is False
    assert "address" not in deact_resp.data
    assert "password" not in deact_resp.data
    assert BlacklistedToken.objects.filter(token__user=member).count() == 1
    assert (
        APIClient().post("/api/auth/refresh/", {"refresh": member_tokens["refresh"]}).status_code
        == 401
    )
    assert UserStatusLog.objects.filter(
        user=member,
        action=UserStatusLog.Action.DEACTIVATED,
        reason=UserStatusLog.Reason.ADMIN_ACTION,
        performed_by=admin_1,
        note="Cuenta suspendida",
    ).exists()

    # Desactivar de nuevo es idempotente y no duplica log.
    assert (
        client.post(f"/api/admin/users/{member.pk}/deactivate/", {}, format="json").status_code
        == 200
    )
    assert UserStatusLog.objects.filter(user=member).count() == 1

    # Reactivar miembro.
    react_resp = client.post(
        f"/api/admin/users/{member.pk}/reactivate/",
        {"note": "Rehabilitado"},
        format="json",
    )
    assert react_resp.status_code == 200
    assert react_resp.data["is_active"] is True
    assert UserStatusLog.objects.filter(
        user=member,
        action=UserStatusLog.Action.REACTIVATED,
        reason=UserStatusLog.Reason.ADMIN_ACTION,
        performed_by=admin_1,
        note="Rehabilitado",
    ).exists()

    # Reactivar de nuevo no duplica log.
    assert (
        client.post(f"/api/admin/users/{member.pk}/reactivate/", {}, format="json").status_code
        == 200
    )
    assert UserStatusLog.objects.filter(user=member).count() == 2

    # Admin puede desactivar a otro Admin activo, pero nunca a sí mismo.
    assert (
        client.post(f"/api/admin/users/{admin_2.pk}/deactivate/", {}, format="json").status_code
        == 200
    )
    admin_2.refresh_from_db()
    assert admin_2.is_active is False

    self_deact = client.post(f"/api/admin/users/{admin_1.pk}/deactivate/", {}, format="json")
    assert self_deact.status_code == 400
    assert CANNOT_DEACTIVATE_SELF_ERROR in str(self_deact.data["is_active"])

    # Nota demasiado larga y usuario inexistente.
    assert (
        client.post(
            f"/api/admin/users/{member.pk}/deactivate/",
            {"note": "y" * (MAX_ADMIN_NOTE_LENGTH + 1)},
            format="json",
        ).status_code
        == 400
    )
    assert client.post("/api/admin/users/999999/deactivate/", {}, format="json").status_code == 404
    assert client.post("/api/admin/users/999999/reactivate/", {}, format="json").status_code == 404


def test_openapi_schema_documents_admin_user_endpoints_without_private_fields() -> None:
    response = APIClient().get("/api/schema/", HTTP_ACCEPT="application/json")
    assert response.status_code == 200

    schema = response.json()
    paths = schema["paths"]
    for path in (
        "/api/admin/roles/",
        "/api/admin/users/",
        "/api/admin/users/{user_id}/",
        "/api/admin/users/{user_id}/role/",
        "/api/admin/users/{user_id}/deactivate/",
        "/api/admin/users/{user_id}/reactivate/",
    ):
        assert path in paths, f"Falta {path} en el esquema OpenAPI"

    admin_user_props = schema["components"]["schemas"]["AdminUser"]["properties"]
    assert "address" not in admin_user_props
    assert "password" not in admin_user_props
    assert "role" in admin_user_props
    assert "is_active" in admin_user_props
