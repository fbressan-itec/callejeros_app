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
  - Creé `apps/users/permissions.py` con la clase base `HasRole` (mensaje en español `"No tenés permiso para hacer esto."`, consistente con el cliente del frontend) y los permisos reutilizables por rol (`IsVerifiedShelter`, `IsStaff`, `IsAdmin`, `IsStaffOrAdmin` para moderación/panel de Staff e `IsShelterStaffOrAdmin` para tienda y noticias).
  - Agregué el endpoint `GET /api/auth/me/` (`MeView` protegido con `IsAuthenticated`) bajo `/api/auth/me/` para que el frontend consulte la sesión actual y el rol del usuario autenticado.
  - Escribí 34 tests parametrizados en `apps/users/tests/test_permissions.py` cubriendo la matriz completa de los 4 roles contra todas las clases de permiso (incluida la composición con `|`), el rechazo de usuarios no autenticados (`401`) o dados de baja (`403`) y el comportamiento de `GET /api/auth/me/`.
  - Apliqué el ajuste de revisión del PR #75: eliminé `IsMember` (y sus casos de prueba) para evitar que algún endpoint deje afuera por error a Refugios, Staff o Admin cuando lo que corresponde es `IsAuthenticated`.
- **Decisiones tomadas:**
  - Definí tanto las clases de rol especial individual como las combinaciones de negocio frecuentes (`IsStaffOrAdmin` e `IsShelterStaffOrAdmin`) heredando de `HasRole`, dejando `IsAuthenticated` para cualquier usuario con sesión activa.
- **Problemas y cómo los resolví:**
  - Al combinar dos permisos con el operador `|` de DRF (`OperandHolder`), DRF no propaga el atributo `message` de las subclases y usa su mensaje por defecto en español; en los tests contemplé ese comportamiento de `OperandHolder` mientras que las subclases de `HasRole` verifican el mensaje exacto `"No tenés permiso para hacer esto."`.
- **Pendiente:** que Franco apruebe y mergee el PR #75 para cerrar la épica con #72 (BK-02d: documentación de la API con Swagger / `drf-spectacular`).
- **PR:** #75
- **IA usada:** Antigravity — para implementar las clases de permisos de DRF, el endpoint `/api/auth/me/` y su batería de tests.

## 2026-11-18 — Documentación de la API con Swagger / drf-spectacular (BK-02d)

- **Tarjeta:** #72 (BK-02d, sub-tarjeta de #5 BK-02)
- **Rama:** feature/bk02-72-documentacion-api-swagger
- **Área:** back, test, docs
- **Qué hice:**
  - Instalé `drf-spectacular` con `uv`, configuré `DEFAULT_SCHEMA_CLASS` y `SPECTACULAR_SETTINGS` en `config/settings.py` y publiqué `/api/schema/` y `/api/docs/` en `config/urls.py`.
  - Creé `AuthTokenResponseSerializer` y decoré con `@extend_schema` los 5 endpoints de `/api/auth/` (`register/`, `login/`, `refresh/`, `logout/` y `me/`) con resúmenes, descripciones de permisos, códigos de respuesta y ejemplos de payloads, verificando que `manage.py spectacular --validate --fail-on-warn` genere el esquema OpenAPI 3 con cero warnings.
  - Escribí `apps/users/tests/test_swagger.py` probando la disponibilidad pública de `/api/schema/` y `/api/docs/` y la presencia de los 5 endpoints de autenticación en el esquema.
  - Actualicé el `README.md` con los enlaces a Swagger UI y al esquema OpenAPI, la tabla de endpoints de `/api/auth/` y la tabla completa de variables de entorno incorporadas en `BK-02`.
  - Apliqué el ajuste de revisión del PR #76: cambié el email del ejemplo de login en Swagger a `miembro@callejeros.ar` para que coincida con el usuario creado por `python manage.py seed`.
- **Decisiones tomadas:**
  - Configuré `SERVE_PERMISSIONS = ["rest_framework.permissions.AllowAny"]` y `SERVE_AUTHENTICATION = []` en `SPECTACULAR_SETTINGS` para que tanto `/api/schema/` como `/api/docs/` se puedan abrir desde el navegador sin exigir token previo, manteniendo `IsAuthenticated` como permiso por defecto para el resto de la API.
- **Problemas y cómo los resolví:**
  - Sin inconvenientes; `drf-spectacular` reconoció automáticamente la autenticación Bearer de `JWTAuthentication` y validó el esquema completo sin advertencias.
- **Pendiente:** que Franco revise y apruebe el PR #76 para dar por completada toda la épica #5 (`[BK-02] Usuarios, roles y autenticación JWT`).
- **PR:** #76
- **IA usada:** Antigravity — para configurar `drf-spectacular`, documentar los endpoints con `@extend_schema`, actualizar el README y escribir los tests de Swagger.

## 2026-11-19 — Barra superior, modo oscuro con next-themes y pie de página (FR-02a)

- **Tarjeta:** #79 (FR-02a, sub-tarjeta de #20 FR-02)
- **Rama:** feature/fr02-79-barra-modo-oscuro-footer
- **Área:** front, test, docs
- **Qué hice:**
  - Dividí la épica #20 (FR-02) en tres sub-tarjetas (#79 FR-02a, #80 FR-02b y #81 FR-02c) y las cargué en el tablero.
  - Instalé `next-themes`, copié el logo oficial `logo_callejeros.jpg` a `frontend/public/images/` y creé `ThemeProvider` configurado con `attribute="class"`, preferencia del sistema por defecto y persistencia en `callejeros_theme`.
  - Implementé `Navbar` con el logo, botón de notificaciones (con soporte para contador de no leídas), botón de modo claro/oscuro y botón de menú hamburguesa, todos con tamaño mínimo de 44×44 px, sus 5 estados interactivos y clases adaptadas a Tailwind 4.
  - Implementé `Footer` institucional de 4 columnas igual a `contexto-ia/maquetado/index.html` y lo integré junto con `ThemeProvider` y `Navbar` en `src/app/layout.tsx`.
  - Escribí los tests unitarios en `Navbar.test.tsx` y `Footer.test.tsx` con Vitest y Testing Library, y comparé en el navegador la barra y el footer contra `index.html` en 375 px y escritorio, en modo claro y oscuro.
- **Decisiones tomadas:**
  - Unifiqué en `Footer` el pie de página institucional completo de 4 columnas de `index.html` para que todas las pantallas del layout compartan contacto, navegación y derechos como indica `02-diseno.md`.
  - Preparé `Navbar` con props tipadas (`isMenuOpen`, `onMenuToggle`, `isNotificationsOpen`, `onNotificationsToggle`, `unreadNotificationsCount`) para conectar el drawer del menú hamburguesa en `FR-02b` (#80) y el panel de notificaciones en `FR-11` (#29) sin reescribir la barra.
- **Problemas y cómo los resolví:**
  - Sin inconvenientes en el código; `suppressHydrationWarning` en `<html>` evita avisos de hidratación al aplicar la clase `.dark` de `next-themes` en el cliente. En la revisión del PR #82 Franco detectó que mi `npm 10.9.8` había quitado 48 campos `"libc"` de `package-lock.json`, por lo que actualicé mi entorno a `npm 11.21.3` para mantener el lockfile uniforme en el equipo.
- **Pendiente:** continuar con #80 (FR-02b: menú hamburguesa desplegable y navegación por sección).
- **PR:** #82
- **IA usada:** Antigravity — para dividir la épica, implementar `ThemeProvider`, `Navbar`, `Footer`, sus tests con Vitest y la comparación visual con el maquetado.

## 2026-11-19 — Menú hamburguesa desplegable y navegación por sección (FR-02b)

- **Tarjeta:** #80 (FR-02b, sub-tarjeta de #20 FR-02)
- **Rama:** feature/fr02-80-menu-hamburguesa-navegacion
- **Área:** front, test, docs
- **Qué hice:**
  - Actualicé mi entorno local a `npm 11.21.3` y regeneré `frontend/package-lock.json` para restaurar los campos `"libc"` señalados en la revisión del PR #82.
  - Implementé `MobileMenu` con el drawer lateral (`#mobile-menu`), backdrop (`#menu-backdrop`), los 4 grupos de navegación del maquetado, resaltado automático de la sección activa según `usePathname()` (`aria-current="page"` y anillo naranja) y el bloque superior de estado de sesión (vista `"No Registrado..."` con enlaces a `/registro` y `/login`, y vista autenticada con insignia de rol `"🛡️ Staff Callejeros"` / `"✓ Refugio verificado"`, acceso a `/mi-cuenta` y botón `"Cerrar Sesión"`, sin el botón `"Alternar Modo Test"`).
  - Creé `AppHeader` para coordinar la apertura y cierre entre `Navbar` y `MobileMenu`, aplicando `inert` cuando el menú está cerrado, bloqueo de scroll en `document.body` y cierre con tecla `Escape`, clic en el backdrop o selección de un enlace.
  - Escribí 5 tests en `MobileMenu.test.tsx` con Vitest y Testing Library cubriendo apertura/cierre, teclado (`Escape`), `inert`, rutas activas (incluida la agrupación de detalle de noticia bajo `/noticias`) y estados con y sin sesión.
  - Comparé el menú en el navegador contra `contexto-ia/maquetado/index.html` en 375 px y escritorio, en modo claro y oscuro.
- **Decisiones tomadas:**
  - Encapsulé el estado de apertura del menú y del panel de notificaciones en `AppHeader` para mantener `RootLayout` como Server Component y preparar la integración del FAB en `FR-02c` (#81).
- **Problemas y cómo los resolví:**
  - Sin inconvenientes.
- **Pendiente:** continuar con #81 (FR-02c: botón flotante de Alerta y componente Volver).
- **PR:** #83
- **IA usada:** Antigravity — para implementar `MobileMenu`, `AppHeader`, sus tests con Vitest y la comparación en el navegador contra el maquetado.
