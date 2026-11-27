"""Configuración del panel de administración de Django para `apps.users` (BK-15a)."""

from typing import Any

from django import forms
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import AdminPasswordChangeForm, ReadOnlyPasswordHashField
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import QuerySet
from django.http import HttpRequest
from rest_framework.exceptions import ValidationError as DRFValidationError

from apps.core.admin import NoDeleteAdminMixin, ReadOnlyAdminMixin
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
    DUPLICATE_EMAIL_ERROR,
    LAST_ADMIN_DEACTIVATE_ERROR,
    LAST_ADMIN_ROLE_ERROR,
    change_user_role,
    deactivate_user,
    reactivate_user,
    validate_user_password,
)

PASSWORD_MISMATCH_ERROR = "Las contraseñas no coinciden."


def _extract_error_message(exc: DRFValidationError) -> str:
    """Devuelve el primer mensaje legible de un `ValidationError` de DRF."""
    detail = exc.detail
    if isinstance(detail, dict):
        for messages_list in detail.values():
            if isinstance(messages_list, list) and messages_list:
                return str(messages_list[0])
            return str(messages_list)
    if isinstance(detail, list) and detail:
        return str(detail[0])
    return str(detail)


class UserAdminCreationForm(forms.ModelForm):
    """Formulario de alta de usuarios en Django Admin con contraseña doble y validada."""

    password1 = forms.CharField(
        label="Contraseña",
        strip=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
        help_text=(
            "Mínimo 6 caracteres. No puede ser una contraseña muy común ni estar "
            "formada solo por números."
        ),
    )
    password2 = forms.CharField(
        label="Confirmación de contraseña",
        strip=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
        help_text="Ingresá la misma contraseña nuevamente para verificarla.",
    )

    class Meta:
        model = User
        fields = (
            "email",
            "first_name",
            "last_name",
            "role",
            "phone",
            "is_phone_verified",
            "city",
            "neighborhood",
            "address",
            "shelter_public_address",
            "is_active",
        )

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.fields["role"].queryset = Role.objects.active()
        if not self.is_bound and not self.initial.get("role"):
            default_role = Role.objects.active().filter(code=RoleCode.MEMBER).first()
            if default_role is not None:
                self.initial["role"] = default_role

    def clean_email(self) -> str:
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError(DUPLICATE_EMAIL_ERROR)
        return email

    def clean_password2(self) -> str:
        password1 = self.cleaned_data.get("password1")
        password2 = self.cleaned_data.get("password2")
        if password1 and password2 and password1 != password2:
            raise forms.ValidationError(PASSWORD_MISMATCH_ERROR)
        return password2 or ""

    def _post_clean(self) -> None:
        super()._post_clean()
        password = self.cleaned_data.get("password2")
        if password:
            try:
                validate_user_password(password, user=self.instance)
            except DjangoValidationError as exc:
                self.add_error("password2", exc)

    def save(self, commit: bool = True) -> User:
        user: User = super().save(commit=False)
        user.email = self.cleaned_data["email"].strip().lower()
        user.set_password(self.cleaned_data["password1"])
        if commit:
            user.save()
            UserPreferences.objects.get_or_create(user=user)
        return user


class UserAdminChangeForm(forms.ModelForm):
    """Formulario de edición de usuarios en Django Admin sin exponer la contraseña."""

    password = ReadOnlyPasswordHashField(
        label="Contraseña",
        help_text=(
            "Las contraseñas se guardan cifradas (con hash) y no se pueden ver. "
            'Para cambiarla, usá <a href="../password/">este formulario</a>.'
        ),
    )

    class Meta:
        model = User
        fields = (
            "email",
            "password",
            "first_name",
            "last_name",
            "phone",
            "is_phone_verified",
            "city",
            "neighborhood",
            "address",
            "shelter_public_address",
            "role",
            "is_active",
        )

    def __init__(self, *args: Any, request_user: User | None = None, **kwargs: Any) -> None:
        self.request_user = request_user
        super().__init__(*args, **kwargs)
        self.fields["role"].queryset = Role.objects.active()

    def clean_password(self) -> str | None:
        return self.initial.get("password")

    def clean_email(self) -> str:
        email = self.cleaned_data["email"].strip().lower()
        qs = User.objects.filter(email__iexact=email)
        if self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError(DUPLICATE_EMAIL_ERROR)
        return email

    def clean(self) -> dict[str, Any]:
        cleaned_data = super().clean()
        if not self.instance.pk:
            return cleaned_data

        original = User.objects.select_related("role").get(pk=self.instance.pk)
        new_role: Role | None = cleaned_data.get("role")
        new_is_active: bool | None = cleaned_data.get("is_active")

        other_active_admins = (
            User.objects.filter(is_active=True, role__code=RoleCode.ADMIN)
            .exclude(pk=original.pk)
            .exists()
        )

        if (
            new_role is not None
            and original.role.code == RoleCode.ADMIN
            and new_role.code != RoleCode.ADMIN
        ):
            if self.request_user is not None and self.request_user.pk == original.pk:
                self.add_error("role", CANNOT_DEMOTE_SELF_ERROR)
            elif original.is_active and not other_active_admins:
                self.add_error("role", LAST_ADMIN_ROLE_ERROR)

        if new_is_active is False and original.is_active:
            if self.request_user is not None and self.request_user.pk == original.pk:
                self.add_error("is_active", CANNOT_DEACTIVATE_SELF_ERROR)
            elif original.role.code == RoleCode.ADMIN and not other_active_admins:
                self.add_error("is_active", LAST_ADMIN_DEACTIVATE_ERROR)

        return cleaned_data


class UserAdminPasswordChangeForm(AdminPasswordChangeForm):
    """Formulario estándar de cambio de contraseña con las mismas reglas que el registro."""

    def clean_password2(self) -> str:
        password1 = self.cleaned_data.get("password1")
        password2 = self.cleaned_data.get("password2")
        if password1 and password2 and password1 != password2:
            raise forms.ValidationError(PASSWORD_MISMATCH_ERROR)
        if password2:
            validate_user_password(password2, user=self.user)
        return password2 or ""


class UserRoleLogInline(ReadOnlyAdminMixin, admin.TabularInline):
    """Historial de cambios de rol del usuario (solo lectura dentro de su ficha)."""

    model = UserRoleLog
    fk_name = "user"
    extra = 0
    can_delete = False
    fields = ("previous_role", "new_role", "performed_by", "note", "created_at")
    readonly_fields = fields
    ordering = ("-created_at", "-id")


class UserStatusLogInline(ReadOnlyAdminMixin, admin.TabularInline):
    """Historial de bajas y reactivaciones del usuario (solo lectura dentro de su ficha)."""

    model = UserStatusLog
    fk_name = "user"
    extra = 0
    can_delete = False
    fields = ("action", "reason", "performed_by", "note", "created_at")
    readonly_fields = fields
    ordering = ("-created_at", "-id")


@admin.register(User)
class UserAdmin(NoDeleteAdminMixin, BaseUserAdmin):
    """Administración de usuarios y roles en Django Admin sin borrado físico."""

    form = UserAdminChangeForm
    add_form = UserAdminCreationForm
    change_password_form = UserAdminPasswordChangeForm

    list_display = (
        "email",
        "first_name",
        "last_name",
        "role",
        "is_phone_verified",
        "is_active",
        "last_login",
        "created_at",
    )
    list_filter = ("role", "is_active", "is_phone_verified")
    search_fields = ("email", "first_name", "last_name")
    ordering = ("email",)
    filter_horizontal = ()
    readonly_fields = ("last_login", "created_at", "updated_at")
    actions = ("deactivate_selected", "reactivate_selected")

    fieldsets = (
        ("Cuenta", {"fields": ("email", "password", "role", "is_active")}),
        (
            "Datos personales",
            {
                "fields": (
                    "first_name",
                    "last_name",
                    "phone",
                    "is_phone_verified",
                    "city",
                    "neighborhood",
                    "address",
                    "shelter_public_address",
                )
            },
        ),
        ("Fechas", {"fields": ("last_login", "created_at", "updated_at")}),
    )

    add_fieldsets = (
        (
            "Nueva cuenta",
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "password1",
                    "password2",
                    "first_name",
                    "last_name",
                    "role",
                    "phone",
                    "is_phone_verified",
                    "city",
                    "neighborhood",
                    "address",
                    "shelter_public_address",
                    "is_active",
                ),
            },
        ),
    )

    def get_inlines(self, request: HttpRequest, obj: User | None = None):
        if obj is None:
            return ()
        return (UserRoleLogInline, UserStatusLogInline)

    def get_form(
        self,
        request: HttpRequest,
        obj: User | None = None,
        change: bool = False,
        **kwargs: Any,
    ):
        form_class = super().get_form(request, obj=obj, change=change, **kwargs)
        if obj is None:
            return form_class

        class BoundUserAdminChangeForm(form_class):  # type: ignore[valid-type, misc]
            def __init__(self, *form_args: Any, **form_kwargs: Any) -> None:
                form_kwargs["request_user"] = request.user
                super().__init__(*form_args, **form_kwargs)

        return BoundUserAdminChangeForm

    @transaction.atomic
    def save_model(
        self,
        request: HttpRequest,
        obj: User,
        form: forms.ModelForm,
        change: bool,
    ) -> None:
        if not change:
            obj.email = obj.email.strip().lower()
            super().save_model(request, obj, form, change)
            UserPreferences.objects.get_or_create(user=obj)
            return

        original = User.objects.select_related("role").get(pk=obj.pk)
        target_role_code = obj.role.code
        target_is_active = obj.is_active

        # Guardamos primero los datos editables preservando rol/estado previos para que sus
        # transiciones pasen siempre por los servicios (auditoría, protecciones y blacklist).
        obj.email = obj.email.strip().lower()
        obj.role = original.role
        obj.is_active = original.is_active
        super().save_model(request, obj, form, change)

        if target_role_code != original.role.code:
            change_user_role(
                target_user=obj,
                new_role_code=target_role_code,
                actor=request.user,
            )

        if target_is_active != original.is_active:
            if target_is_active:
                reactivate_user(target_user=obj, actor=request.user)
            else:
                deactivate_user(target_user=obj, actor=request.user)

        obj.refresh_from_db()

    @admin.action(description="Desactivar usuarios seleccionados")
    def deactivate_selected(self, request: HttpRequest, queryset: QuerySet[User]) -> None:
        deactivated = 0
        already_inactive = 0
        blocked: list[str] = []

        for user in queryset.select_related("role"):
            if not user.is_active:
                already_inactive += 1
                continue
            try:
                deactivate_user(target_user=user, actor=request.user)
                deactivated += 1
            except DRFValidationError as exc:
                blocked.append(f"{user.email}: {_extract_error_message(exc)}")

        if deactivated:
            self.message_user(
                request,
                f"Se desactivaron {deactivated} usuario(s) y se cerraron sus sesiones.",
                level=messages.SUCCESS,
            )
        if already_inactive:
            self.message_user(
                request,
                f"{already_inactive} usuario(s) ya estaban desactivados.",
                level=messages.INFO,
            )
        if blocked:
            self.message_user(
                request,
                "No se pudieron desactivar: " + " · ".join(blocked),
                level=messages.WARNING,
            )

    @admin.action(description="Reactivar usuarios seleccionados")
    def reactivate_selected(self, request: HttpRequest, queryset: QuerySet[User]) -> None:
        reactivated = 0
        already_active = 0

        for user in queryset.select_related("role"):
            if user.is_active:
                already_active += 1
                continue
            reactivate_user(target_user=user, actor=request.user)
            reactivated += 1

        if reactivated:
            self.message_user(
                request,
                f"Se reactivaron {reactivated} usuario(s).",
                level=messages.SUCCESS,
            )
        if already_active:
            self.message_user(
                request,
                f"{already_active} usuario(s) ya estaban activos.",
                level=messages.INFO,
            )


@admin.register(Role)
class RoleAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """Catálogo de roles del sistema (solo lectura: sus códigos son usados por permisos)."""

    list_display = ("code", "name", "is_active", "created_at", "updated_at")
    readonly_fields = ("code", "name", "is_active", "created_at", "updated_at")
    ordering = ("id",)


@admin.register(UserRoleLog)
class UserRoleLogAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """Historial de auditoría de cambios de rol (solo lectura)."""

    list_display = ("user", "previous_role", "new_role", "performed_by", "created_at")
    list_filter = ("previous_role", "new_role")
    search_fields = ("user__email", "performed_by__email", "note")
    readonly_fields = ("user", "previous_role", "new_role", "performed_by", "note", "created_at")
    ordering = ("-created_at", "-id")


@admin.register(UserStatusLog)
class UserStatusLogAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """Historial de auditoría de bajas y reactivaciones de usuarios (solo lectura)."""

    list_display = ("user", "action", "reason", "performed_by", "created_at")
    list_filter = ("action", "reason")
    search_fields = ("user__email", "performed_by__email", "note")
    readonly_fields = ("user", "action", "reason", "performed_by", "note", "created_at")
    ordering = ("-created_at", "-id")
