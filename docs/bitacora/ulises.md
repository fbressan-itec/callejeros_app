# Bitácora — Ulises Cabrera

Formato de cada entrada: ver [LEEME.md](LEEME.md). Las entradas nuevas van al final.

## 2026-11-17 — Modelo de usuario, roles y comando seed (BK-02a)

- **Tarjeta:** #69 (BK-02a, sub-tarjeta de #5 BK-02)
- **Rama:** feature/bk02-69-modelo-usuario-roles
- **Área:** back, db, test, docs
- **Qué hice:**
  - Dividí la épica #5 (BK-02) en cuatro sub-tarjetas (#69 BK-02a, #70 BK-02b, #71 BK-02c y #72 BK-02d) y las cargué en el tablero.
  - Creé la app `apps.users` con los 5 modelos de cuentas según el diseño de DB-01 en el README (`Role`, `User`, `UserPreferences`, `UserStatusLog` y `UserRoleLog`) y configuré `AUTH_USER_MODEL = "users.User"`.
  - Generé la migración inicial de las tablas y la migración de datos `0002_seed_roles.py` con los 4 roles (`member`, `verified_shelter`, `staff`, `admin`).
  - Implementé `UserManager` para que el registro cree el usuario con rol `member` y sus `UserPreferences` por defecto, y `createsuperuser` le asigne el rol `admin`.
  - Creé el comando idempotente `python manage.py seed` en `apps.core` que carga 1 usuario de prueba por rol usando `SEED_USER_PASSWORD` (agregada a `.env.example`).
  - Escribí las factories (`factory_boy`) y 10 tests con `pytest` cubriendo modelos, migración de roles, autenticación por email sin importar mayúsculas, `createsuperuser`, baja lógica, logs de auditoría y el comando `seed` (incluido el bloqueo cuando `DEBUG=False`).
  - Apliqué las mejoras de la revisión del PR #73: búsqueda insensible a mayúsculas en `UserManager.get_by_natural_key`, uso de `Role.objects.get` para exigir la migración de roles, restricción de `seed` solo a `DEBUG=True` y actualización de los pasos de `migrate`/`seed` en el README.
- **Decisiones tomadas:**
  - `User` hereda de `AbstractBaseUser` y `BaseModel` (sin `PermissionsMixin`) y resuelve `is_staff` / `is_superuser` a partir del rol `admin`, evitando crear tablas extra de grupos y permisos fuera del diagrama de DB-01.
  - El comando `seed` vive en `apps.core` para que las próximas tarjetas de back le sumen sus propios datos semilla sin acoplar módulos, y falla si `DJANGO_DEBUG=False` para evitar correrlo por accidente en producción.
- **Problemas y cómo los resolví:**
  - Al principio mi usuario tenía permiso de escritura en el repositorio pero solo lectura en el Project personal de GitHub; lo coordiné con Franco para que me habilite permiso en el tablero y poder mover las tarjetas a "En curso" y "En revisión".
  - Quien ya había corrido `migrate` antes en `develop` recibía `InconsistentMigrationHistory` al sumar `AUTH_USER_MODEL`; documenté en el README y en el PR borrar `backend/db.sqlite3` una única vez antes de migrar.
- **Pendiente:** que Franco revise y apruebe el PR #73 para continuar con #70 (BK-02b: registro, login y logout con JWT).
- **PR:** #73
- **IA usada:** Antigravity — para dividir la épica, implementar los modelos, migraciones, comando seed y tests siguiendo las reglas del proyecto.

## 2026-11-18 — Registro, login y logout con JWT (BK-02b)

- **Tarjeta:** #70 (BK-02b, sub-tarjeta de #5 BK-02)
- **Rama:** feature/bk02-70-registro-login-logout-jwt
- **Área:** back, test, docs
- **Qué hice:**
  - Instalé `djangorestframework-simplejwt` con `uv` y configuré `JWTAuthentication` y `rest_framework_simplejwt.token_blacklist` en `config/settings.py`.
  - Parametricé en variables de entorno (`.env.example` y `settings.py`) las duraciones de los tokens (`JWT_ACCESS_LIFETIME_MINUTES=60`, `JWT_REFRESH_LIFETIME_DAYS=1`, `JWT_REMEMBER_ME_REFRESH_LIFETIME_DAYS=30`) y el código único de verificación maquetada (`MOCK_VERIFICATION_CODE=8596`).
  - Implementé la capa de servicios (`apps/users/services.py`), serializers (`apps/users/serializers.py`), vistas (`apps/users/views.py`) y rutas bajo `/api/auth/` (`register/`, `login/`, `refresh/` y `logout/`).
  - Validé que la contraseña tenga al menos 6 caracteres devolviendo el mensaje exacto `"La contraseña debe tener al menos 6 caracteres"`, y que el formato de errores coincida con `parseApiError` del cliente del frontend.
  - Escribí 11 tests en `apps/users/tests/test_auth_api.py` cubriendo registro, validación de contraseña corta, email duplicado insensible a mayúsculas, código de verificación maquetado, login con y sin `"Recordarme"` (30 días vs. 1 día), rechazo de usuarios inactivos, refresh e invalidación por logout.
  - Apliqué los ajustes de la revisión del PR #74: centralicé las validaciones de negocio del registro (largo de contraseña, código de verificación y email único) exclusivamente en `apps/users/services.py`, agregué `DEFAULT_PERMISSION_CLASSES = ("rest_framework.permissions.IsAuthenticated",)` en `settings.py`, sumé tests para el rechazo de contraseñas comunes y numéricas (`"123456"` y `"perrito"`) y documenté en el README las validaciones adicionales de contraseña y las tablas de `token_blacklist` de `simplejwt`.
- **Decisiones tomadas:**
  - Creé `StandardRefreshToken` y `RememberMeRefreshToken` heredando de `RefreshToken` para que la duración del refresh token se aplique al instante de emitir el token y quede registrada con la misma fecha de expiración en `OutstandingToken` de la blacklist.
  - Definí `PublicAuthAPIView` con `authentication_classes = ()` y `get_authenticate_header` devolviendo `'Bearer realm="api"'` para que los endpoints públicos de autenticación no fallen si el cliente envía un header `Authorization` vencido y, a la vez, respondan `401 Unauthorized` (en lugar de `403 Forbidden`) ante credenciales inválidas.
- **Problemas y cómo los resolví:**
  - Al probar el login con contraseña incorrecta en una vista con `authentication_classes = ()`, DRF convertía el `AuthenticationFailed` (`401`) en `403 Forbidden` por no tener `WWW-Authenticate`; lo resolví implementando `get_authenticate_header` en la vista base pública `PublicAuthAPIView`.
- **Pendiente:** que Franco apruebe y mergee el PR #74 para continuar con #71 (BK-02c: permisos por rol reutilizables).
- **PR:** #74
- **IA usada:** Antigravity — para estructurar los servicios, serializers, vistas y tests de autenticación JWT siguiendo las reglas del proyecto.

## 2026-11-18 — Permisos por rol reutilizables y endpoint de sesión actual (BK-02c)

- **Tarjeta:** #71 (BK-02c, sub-tarjeta de #5 BK-02)
- **Rama:** feature/bk02-71-permisos-por-rol
- **Área:** back, test, docs
- **Qué hice:**
  - Creé `apps/users/permissions.py` con la clase base `HasRole` (mensaje en español `"No tenés permiso para hacer esto."`, consistente con el cliente del frontend) y los permisos reutilizables por rol individual (`IsMember`, `IsVerifiedShelter`, `IsStaff`, `IsAdmin`) y por combinación de alcance (`IsStaffOrAdmin` para moderación/panel de Staff e `IsShelterStaffOrAdmin` para tienda y noticias).
  - Agregué el endpoint `GET /api/auth/me/` (`MeView` protegido con `IsAuthenticated`) bajo `/api/auth/me/` para que el frontend consulte la sesión actual y el rol del usuario autenticado.
  - Escribí 39 tests parametrizados en `apps/users/tests/test_permissions.py` cubriendo la matriz completa de los 4 roles contra todas las clases de permiso (incluida la composición con `|`), el rechazo de usuarios no autenticados (`401`) o dados de baja (`403`) y el comportamiento de `GET /api/auth/me/`.
- **Decisiones tomadas:**
  - Definí tanto las clases de rol individual como las combinaciones de negocio frecuentes (`IsStaffOrAdmin` e `IsShelterStaffOrAdmin`) heredando de `HasRole`, de modo que los endpoints futuros puedan declarar una sola clase expresiva y conservar el mensaje de error personalizado en español.
- **Problemas y cómo los resolví:**
  - Al combinar dos permisos con el operador `|` de DRF (`OperandHolder`), DRF no propaga el atributo `message` de las subclases y usa su mensaje por defecto en español; en los tests contemplé ese comportamiento de `OperandHolder` mientras que las subclases de `HasRole` verifican el mensaje exacto `"No tenés permiso para hacer esto."`.
- **Pendiente:** que Franco revise y apruebe el PR de BK-02c para cerrar la épica con #72 (BK-02d: documentación de la API con Swagger / `drf-spectacular`).
- **PR:** pendiente de apertura
- **IA usada:** Antigravity — para implementar las clases de permisos de DRF, el endpoint `/api/auth/me/` y su batería de tests.
