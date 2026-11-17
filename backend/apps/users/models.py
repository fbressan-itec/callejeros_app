"""Modelos de cuentas y roles según el diseño de DB-01 (README)."""

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models

from apps.core.models import BaseModel, BaseQuerySet


class RoleCode(models.TextChoices):
    """Códigos fijos del catálogo de roles."""

    MEMBER = "member", "Miembro de la comunidad"
    VERIFIED_SHELTER = "verified_shelter", "Refugio verificado"
    STAFF = "staff", "Staff Callejeros"
    ADMIN = "admin", "Admin"


class Role(BaseModel):
    """Catálogo de roles del sistema.

    `code` lo usa el backend para controlar permisos; `name` es el texto visible
    en la insignia del usuario. Los 4 roles se cargan por migración de datos.
    """

    code = models.CharField(
        "código",
        max_length=30,
        unique=True,
        choices=RoleCode.choices,
    )
    name = models.CharField("nombre", max_length=50)

    class Meta:
        verbose_name = "rol"
        verbose_name_plural = "roles"

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class UserManager(BaseUserManager.from_queryset(BaseQuerySet)):
    """Manager de usuarios con login por email, baja lógica y rol por defecto."""

    def get_by_natural_key(self, username: str) -> "User":
        """Busca el usuario por email sin distinguir mayúsculas ni espacios."""
        return self.get(**{f"{self.model.USERNAME_FIELD}__iexact": username.strip()})

    def _get_role(self, code: str) -> Role:
        return Role.objects.get(code=code)

    def create_user(
        self,
        email: str,
        password: str | None = None,
        **extra_fields: object,
    ) -> "User":
        """Crea y guarda un usuario con su rol (por defecto `member`) y preferencias."""
        if not email:
            raise ValueError("El correo electrónico es obligatorio.")

        normalized_email = self.normalize_email(email).strip().lower()
        if "role" not in extra_fields and "role_id" not in extra_fields:
            extra_fields["role"] = self._get_role(RoleCode.MEMBER)

        user = self.model(email=normalized_email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)

        UserPreferences.objects.get_or_create(user=user)
        return user

    def create_superuser(
        self,
        email: str,
        password: str | None = None,
        **extra_fields: object,
    ) -> "User":
        """Crea el primer Admin por consola (`createsuperuser`) con rol `admin`."""
        extra_fields["role"] = self._get_role(RoleCode.ADMIN)
        return self.create_user(email=email, password=password, **extra_fields)


class User(AbstractBaseUser, BaseModel):
    """Usuario de Callejeros Río Cuarto (reemplaza al usuario por defecto de Django)."""

    email = models.EmailField("correo electrónico", unique=True)
    first_name = models.CharField("nombre", max_length=100)
    last_name = models.CharField("apellido", max_length=100, blank=True)
    phone = models.CharField("teléfono", max_length=30, blank=True)
    is_phone_verified = models.BooleanField("teléfono verificado", default=False)
    photo = models.CharField("foto", max_length=255, blank=True)
    birth_date = models.DateField("fecha de nacimiento", null=True, blank=True)
    city = models.CharField("localidad", max_length=100, blank=True)
    neighborhood = models.CharField("barrio", max_length=100, blank=True)
    address = models.CharField("dirección", max_length=255, blank=True)
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="users",
        verbose_name="rol",
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name"]

    class Meta:
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"

    def __str__(self) -> str:
        return self.email

    @property
    def is_staff(self) -> bool:
        """Habilita el acceso al admin de Django solo a usuarios con rol `admin`."""
        return self.role_id is not None and self.role.code == RoleCode.ADMIN

    @property
    def is_superuser(self) -> bool:
        """El rol `admin` equivale a superusuario en Django."""
        return self.is_staff

    def has_perm(self, perm: str, obj: object = None) -> bool:
        return self.is_active and self.is_superuser

    def has_module_perms(self, app_label: str) -> bool:
        return self.is_active and self.is_superuser


class UserPreferences(models.Model):
    """Preferencias de notificación y privacidad (uno a uno con `User`)."""

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="preferences",
        verbose_name="usuario",
    )
    notify_requests_and_posts = models.BooleanField(
        "notificar solicitudes y publicaciones",
        default=True,
    )
    notify_nearby_alerts = models.BooleanField(
        "notificar alertas cercanas",
        default=True,
    )
    notify_sponsored_updates = models.BooleanField(
        "notificar novedades de ahijados",
        default=True,
    )
    notify_news_and_events = models.BooleanField(
        "notificar noticias y eventos",
        default=True,
    )
    notify_extra_channel = models.BooleanField(
        "notificar por canal extra",
        default=False,
    )
    show_phone_in_alerts = models.BooleanField(
        "mostrar teléfono en alertas",
        default=True,
    )
    show_photo_in_comments = models.BooleanField(
        "mostrar foto en comentarios",
        default=True,
    )
    created_at = models.DateTimeField("creado", auto_now_add=True)
    updated_at = models.DateTimeField("modificado", auto_now=True)

    class Meta:
        verbose_name = "preferencias de usuario"
        verbose_name_plural = "preferencias de usuarios"

    def __str__(self) -> str:
        return f"Preferencias de {self.user.email}"


class UserStatusLog(models.Model):
    """Historial de bajas y reactivaciones de cuentas (solo lectura)."""

    class Action(models.TextChoices):
        DEACTIVATED = "deactivated", "Desactivado"
        REACTIVATED = "reactivated", "Reactivado"

    class Reason(models.TextChoices):
        SELF_DELETED = "self_deleted", "Baja propia"
        ADMIN_ACTION = "admin_action", "Acción de administrador"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="status_logs",
        verbose_name="usuario",
    )
    action = models.CharField("acción", max_length=20, choices=Action.choices)
    reason = models.CharField("motivo", max_length=20, choices=Reason.choices)
    performed_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="performed_status_logs",
        verbose_name="realizado por",
    )
    note = models.CharField("nota", max_length=255, blank=True)
    created_at = models.DateTimeField("creado", auto_now_add=True)

    class Meta:
        verbose_name = "historial de estado de usuario"
        verbose_name_plural = "historial de estados de usuarios"

    def __str__(self) -> str:
        return f"{self.user.email}: {self.action} ({self.reason})"


class UserRoleLog(models.Model):
    """Historial de cambios de rol realizados por un Admin (solo lectura)."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="role_logs",
        verbose_name="usuario",
    )
    previous_role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="previous_role_logs",
        verbose_name="rol anterior",
    )
    new_role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="new_role_logs",
        verbose_name="rol nuevo",
    )
    performed_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="performed_role_logs",
        verbose_name="realizado por",
    )
    note = models.CharField("nota", max_length=255, blank=True)
    created_at = models.DateTimeField("creado", auto_now_add=True)

    class Meta:
        verbose_name = "historial de rol de usuario"
        verbose_name_plural = "historial de roles de usuarios"

    def __str__(self) -> str:
        return f"{self.user.email}: {self.previous_role.code} -> {self.new_role.code}"
