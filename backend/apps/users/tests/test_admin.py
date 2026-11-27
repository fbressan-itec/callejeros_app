"""Tests del panel de administración de Django para `apps.users` (BK-15a)."""

import pytest
from django.contrib import admin, messages
from django.contrib.admin.sites import AdminSite
from django.contrib.messages.storage.fallback import FallbackStorage
from django.contrib.sessions.middleware import SessionMiddleware
from django.test import Client, RequestFactory
from django.urls import reverse
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from apps.users.admin import (
    RoleAdmin,
    UserAdmin,
    UserAdminPasswordChangeForm,
    UserRoleLogAdmin,
    UserRoleLogInline,
    UserStatusLogAdmin,
    UserStatusLogInline,
)
from apps.users.models import (
    Role,
    RoleCode,
    User,
    UserPreferences,
    UserRoleLog,
    UserStatusLog,
)
from apps.users.services import (
    CANNOT_DEACTIVATE_SELF_ERROR,
    CANNOT_DEMOTE_SELF_ERROR,
    PASSWORD_MIN_LENGTH_ERROR,
    issue_tokens_for_user,
)
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _build_admin_request(admin_user: User | None = None):
    request = RequestFactory().get("/admin/")
    request.user = admin_user or UserFactory(role__code=RoleCode.ADMIN)
    SessionMiddleware(lambda req: None).process_request(request)
    request.session.save()
    request._messages = FallbackStorage(request)
    return request


def _logged_admin_client(admin_user: User | None = None) -> tuple[Client, User]:
    user = admin_user or UserFactory(role__code=RoleCode.ADMIN, password="AdminPassword99!")
    client = Client()
    client.force_login(user)
    return client, user


def test_models_registered_and_physical_delete_disabled() -> None:
    assert admin.site.is_registered(User)
    assert admin.site.is_registered(Role)
    assert admin.site.is_registered(UserRoleLog)
    assert admin.site.is_registered(UserStatusLog)

    request = _build_admin_request()
    member = UserFactory(role__code=RoleCode.MEMBER)
    user_admin = UserAdmin(User, AdminSite())

    assert user_admin.has_delete_permission(request, member) is False
    assert "delete_selected" not in user_admin.get_actions(request)
    assert user_admin.search_fields == ("email", "first_name", "last_name")
    assert "role" in user_admin.list_filter
    assert "is_active" in user_admin.list_filter
    assert set(user_admin.readonly_fields) == {"last_login", "created_at", "updated_at"}

    assert user_admin.get_inlines(request, None) == ()
    assert user_admin.get_inlines(request, member) == (UserRoleLogInline, UserStatusLogInline)


def test_role_and_audit_log_admins_are_strictly_read_only() -> None:
    request = _build_admin_request()
    site = AdminSite()

    for model, admin_cls in (
        (Role, RoleAdmin),
        (UserRoleLog, UserRoleLogAdmin),
        (UserStatusLog, UserStatusLogAdmin),
    ):
        model_admin = admin_cls(model, site)
        assert model_admin.has_add_permission(request) is False
        assert model_admin.has_change_permission(request) is False
        assert model_admin.has_delete_permission(request) is False
        assert "delete_selected" not in model_admin.get_actions(request)

    for inline_cls in (UserRoleLogInline, UserStatusLogInline):
        inline = inline_cls(User, site)
        assert inline.has_add_permission(request) is False
        assert inline.has_change_permission(request) is False
        assert inline.has_delete_permission(request) is False


def test_non_admin_roles_cannot_access_django_admin() -> None:
    for role_code in (RoleCode.MEMBER, RoleCode.VERIFIED_SHELTER, RoleCode.STAFF):
        user = UserFactory(role__code=role_code)
        client = Client()
        client.force_login(user)

        response = client.get(reverse("admin:users_user_changelist"))
        assert response.status_code == 302
        assert "/admin/login/" in response.url


def test_user_admin_bulk_actions_use_services_and_enforce_protections() -> None:
    admin_user = UserFactory(role__code=RoleCode.ADMIN)
    member = UserFactory(role__code=RoleCode.MEMBER)
    issue_tokens_for_user(member, remember_me=True)

    request = _build_admin_request(admin_user)
    user_admin = UserAdmin(User, AdminSite())

    # Al intentar desactivar al miembro y al propio Admin juntos, desactiva solo al miembro.
    queryset = User.objects.filter(pk__in=[admin_user.pk, member.pk])
    user_admin.deactivate_selected(request, queryset)

    admin_user.refresh_from_db()
    member.refresh_from_db()
    assert admin_user.is_active is True
    assert member.is_active is False
    assert BlacklistedToken.objects.filter(token__user=member).count() == 1
    assert UserStatusLog.objects.filter(
        user=member,
        action=UserStatusLog.Action.DEACTIVATED,
        reason=UserStatusLog.Reason.ADMIN_ACTION,
        performed_by=admin_user,
    ).exists()

    stored = list(messages.get_messages(request))
    assert any(m.level == messages.SUCCESS for m in stored)
    assert any(
        m.level == messages.WARNING and CANNOT_DEACTIVATE_SELF_ERROR in m.message for m in stored
    )

    # Reactivar seleccionados vuelve a activar al miembro y registra el log.
    reactivate_request = _build_admin_request(admin_user)
    user_admin.reactivate_selected(reactivate_request, queryset)

    member.refresh_from_db()
    assert member.is_active is True
    assert UserStatusLog.objects.filter(
        user=member,
        action=UserStatusLog.Action.REACTIVATED,
        reason=UserStatusLog.Reason.ADMIN_ACTION,
        performed_by=admin_user,
    ).exists()


def test_user_admin_add_validates_password_rules_and_hashes_password() -> None:
    client, _ = _logged_admin_client()
    member_role = Role.objects.get(code=RoleCode.MEMBER)
    add_url = reverse("admin:users_user_add")

    base_payload = {
        "email": "NuevoRefugio@Callejeros.AR",
        "first_name": "Refugio",
        "last_name": "Esperanza",
        "role": member_role.pk,
        "phone": "+54 9 358 4555555",
        "is_phone_verified": "on",
        "city": "Río Cuarto",
        "neighborhood": "Centro",
        "address": "Calle Privada 123",
        "shelter_public_address": "Av. Pública 456, Río Cuarto",
        "is_active": "on",
    }

    # Contraseña corta (< 6 caracteres).
    short_resp = client.post(add_url, {**base_payload, "password1": "ab12!", "password2": "ab12!"})
    assert short_resp.status_code == 200
    assert PASSWORD_MIN_LENGTH_ERROR in short_resp.content.decode()
    assert not User.objects.filter(email__iexact="nuevorefugio@callejeros.ar").exists()

    # Contraseña solo numérica.
    numeric_resp = client.post(
        add_url, {**base_payload, "password1": "12345678", "password2": "12345678"}
    )
    assert numeric_resp.status_code == 200
    assert not User.objects.filter(email__iexact="nuevorefugio@callejeros.ar").exists()

    # Contraseñas distintas.
    mismatch_resp = client.post(
        add_url,
        {**base_payload, "password1": "ClaveValida99!", "password2": "OtraClave99!"},
    )
    assert mismatch_resp.status_code == 200
    assert "Las contraseñas no coinciden." in mismatch_resp.content.decode()

    # Alta válida: guarda hash, normaliza email y crea UserPreferences.
    ok_resp = client.post(
        add_url,
        {**base_payload, "password1": "ClaveValida99!", "password2": "ClaveValida99!"},
    )
    assert ok_resp.status_code == 302

    created = User.objects.get(email="nuevorefugio@callejeros.ar")
    assert created.check_password("ClaveValida99!") is True
    assert created.password != "ClaveValida99!"
    assert created.is_phone_verified is True
    assert created.shelter_public_address == "Av. Pública 456, Río Cuarto"
    assert UserPreferences.objects.filter(user=created).exists()


def test_user_admin_change_view_uses_services_and_preserves_password_hash() -> None:
    client, admin_user = _logged_admin_client()
    member = UserFactory(role__code=RoleCode.MEMBER, password="ClaveOriginal99!")
    original_hash = member.password
    issue_tokens_for_user(member, remember_me=True)

    shelter_role = Role.objects.get(code=RoleCode.VERIFIED_SHELTER)
    change_url = reverse("admin:users_user_change", args=[member.pk])

    response = client.post(
        change_url,
        {
            "email": member.email,
            "first_name": "Refugio",
            "last_name": "Actualizado",
            "phone": "+54 9 358 4777777",
            "is_phone_verified": "on",
            "city": "Río Cuarto",
            "neighborhood": "Alberdi",
            "address": "Privada 99",
            "shelter_public_address": "Sobremonte 500, Río Cuarto",
            "role": shelter_role.pk,
            # Omitir `is_active` desactiva al usuario.
            "role_logs-TOTAL_FORMS": "0",
            "role_logs-INITIAL_FORMS": "0",
            "status_logs-TOTAL_FORMS": "0",
            "status_logs-INITIAL_FORMS": "0",
        },
    )
    assert response.status_code == 302

    member.refresh_from_db()
    assert member.password == original_hash
    assert member.first_name == "Refugio"
    assert member.shelter_public_address == "Sobremonte 500, Río Cuarto"
    assert member.role.code == RoleCode.VERIFIED_SHELTER
    assert member.is_active is False
    assert BlacklistedToken.objects.filter(token__user=member).count() == 1
    assert UserRoleLog.objects.filter(
        user=member,
        previous_role__code=RoleCode.MEMBER,
        new_role__code=RoleCode.VERIFIED_SHELTER,
        performed_by=admin_user,
    ).exists()
    assert UserStatusLog.objects.filter(
        user=member,
        action=UserStatusLog.Action.DEACTIVATED,
        reason=UserStatusLog.Reason.ADMIN_ACTION,
        performed_by=admin_user,
    ).exists()


def test_user_admin_change_view_blocks_self_demotion_and_self_deactivation() -> None:
    client, admin_user = _logged_admin_client()
    UserFactory(role__code=RoleCode.ADMIN)
    staff_role = Role.objects.get(code=RoleCode.STAFF)
    change_url = reverse("admin:users_user_change", args=[admin_user.pk])

    response = client.post(
        change_url,
        {
            "email": admin_user.email,
            "first_name": admin_user.first_name,
            "last_name": admin_user.last_name,
            "phone": admin_user.phone,
            "city": admin_user.city,
            "neighborhood": admin_user.neighborhood,
            "address": admin_user.address,
            "shelter_public_address": admin_user.shelter_public_address,
            "role": staff_role.pk,
            # Sin `is_active`: intenta auto-desactivarse y auto-degradarse.
            "role_logs-TOTAL_FORMS": "0",
            "role_logs-INITIAL_FORMS": "0",
            "status_logs-TOTAL_FORMS": "0",
            "status_logs-INITIAL_FORMS": "0",
        },
    )
    assert response.status_code == 200
    body = response.content.decode()
    assert CANNOT_DEMOTE_SELF_ERROR in body
    assert CANNOT_DEACTIVATE_SELF_ERROR in body

    admin_user.refresh_from_db()
    assert admin_user.role.code == RoleCode.ADMIN
    assert admin_user.is_active is True


def test_user_admin_password_change_form_hashes_and_validates_password() -> None:
    client, _ = _logged_admin_client()
    member = UserFactory(role__code=RoleCode.MEMBER, password="ClaveVieja99!")
    password_url = reverse("admin:auth_user_password_change", args=[member.pk])

    # Rechaza contraseña corta (< 6).
    short_resp = client.post(password_url, {"password1": "abc1!", "password2": "abc1!"})
    assert short_resp.status_code == 200
    assert PASSWORD_MIN_LENGTH_ERROR in short_resp.content.decode()
    member.refresh_from_db()
    assert member.check_password("ClaveVieja99!") is True

    # Acepta nueva contraseña válida y la guarda con hash.
    ok_resp = client.post(
        password_url,
        {"password1": "NuevaClaveSegura99!", "password2": "NuevaClaveSegura99!"},
    )
    assert ok_resp.status_code == 302
    member.refresh_from_db()
    assert member.check_password("NuevaClaveSegura99!") is True
    assert member.password != "NuevaClaveSegura99!"


def test_user_admin_changelist_search_filters_and_change_view_history_inlines() -> None:
    client, admin_user = _logged_admin_client()
    other_admin = UserFactory(
        email="segundo.admin@callejeros.ar",
        first_name="Lucía",
        last_name="Fernández",
        role__code=RoleCode.ADMIN,
        password="ClaveSecretaAdmin99!",
    )
    member = UserFactory(
        email="vecino.activo@callejeros.ar",
        first_name="Martín",
        role__code=RoleCode.MEMBER,
    )

    # Búsqueda por correo/nombre y filtro por rol en la lista.
    list_url = reverse("admin:users_user_changelist")
    admin_role = Role.objects.get(code=RoleCode.ADMIN)
    list_resp = client.get(list_url, {"q": "Lucía", "role__id__exact": admin_role.pk})
    assert list_resp.status_code == 200
    list_html = list_resp.content.decode()
    assert "segundo.admin@callejeros.ar" in list_html
    assert member.email not in list_html

    # Un Admin sí puede cambiarle el rol y desactivar a otro Admin desde su ficha.
    staff_role = Role.objects.get(code=RoleCode.STAFF)
    change_url = reverse("admin:users_user_change", args=[other_admin.pk])
    post_resp = client.post(
        change_url,
        {
            "email": other_admin.email,
            "first_name": other_admin.first_name,
            "last_name": other_admin.last_name,
            "phone": other_admin.phone,
            "city": other_admin.city,
            "neighborhood": other_admin.neighborhood,
            "address": other_admin.address,
            "shelter_public_address": other_admin.shelter_public_address,
            "role": staff_role.pk,
            # Sin `is_active`: lo desactiva.
            "role_logs-TOTAL_FORMS": "0",
            "role_logs-INITIAL_FORMS": "0",
            "status_logs-TOTAL_FORMS": "0",
            "status_logs-INITIAL_FORMS": "0",
        },
    )
    assert post_resp.status_code == 302
    other_admin.refresh_from_db()
    assert other_admin.role.code == RoleCode.STAFF
    assert other_admin.is_active is False

    # La ficha muestra ambos historiales (solo lectura) y nunca expone la contraseña en texto plano.
    detail_resp = client.get(change_url)
    assert detail_resp.status_code == 200
    detail_html = detail_resp.content.decode()
    assert "ClaveSecretaAdmin99!" not in detail_html
    assert admin_user.email in detail_html
    assert "Desactivado" in detail_html
    assert "Acción de administrador" in detail_html
    assert "Staff Callejeros" in detail_html


def test_user_admin_password_change_form_hides_usable_password_option() -> None:
    client, _ = _logged_admin_client()
    member = UserFactory(role__code=RoleCode.MEMBER, password="ClaveActiva99!")
    password_url = reverse("admin:auth_user_password_change", args=[member.pk])

    form = UserAdminPasswordChangeForm(member)
    assert "usable_password" not in form.fields
    assert form.fields["password1"].required is True
    assert form.fields["password2"].required is True

    get_resp = client.get(password_url)
    assert get_resp.status_code == 200
    assert "usable_password" not in get_resp.context["form"].fields
    html = get_resp.content.decode()
    assert 'name="usable_password"' not in html
    assert "id_usable_password" not in html

    # Intentar enviar `usable_password=false` por POST no desactiva la contraseña.
    post_resp = client.post(password_url, {"usable_password": "false"})
    assert post_resp.status_code == 200
    member.refresh_from_db()
    assert member.has_usable_password() is True
    assert member.check_password("ClaveActiva99!") is True


def test_user_admin_save_model_catches_service_validation_error_with_message() -> None:
    admin_user = UserFactory(role__code=RoleCode.ADMIN)
    request = _build_admin_request(admin_user)
    user_admin = UserAdmin(User, AdminSite())

    # Simula un intento que saltea `clean()` (ej. condición de carrera con otro Admin).
    admin_user.role = Role.objects.get(code=RoleCode.STAFF)
    admin_user.is_active = False
    user_admin.save_model(request, admin_user, form=None, change=True)

    admin_user.refresh_from_db()
    assert admin_user.role.code == RoleCode.ADMIN
    assert admin_user.is_active is True

    stored = list(messages.get_messages(request))
    error_messages = [m.message for m in stored if m.level == messages.ERROR]
    assert CANNOT_DEMOTE_SELF_ERROR in error_messages
    assert CANNOT_DEACTIVATE_SELF_ERROR in error_messages
