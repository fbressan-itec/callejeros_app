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

## 2026-11-19 — Botón flotante de Alerta (FAB) y componente Volver (FR-02c)

- **Tarjeta:** #81 (FR-02c, sub-tarjeta de #20 FR-02)
- **Rama:** feature/fr02-81-fab-alerta-boton-volver
- **Área:** front, test, docs
- **Qué hice:**
  - Apliqué las dos mejoras sugeridas en la revisión del PR #83: refactoricé `MobileMenu` con la constante `MENU_GROUPS` recorrida con `.map()` (DRY) y restauré el foco al botón hamburguesa (`#menu-btn`) al cerrar el menú con la tecla `Escape`.
  - Implementé `AlertFab` (`#fab-alerta`) con visibilidad y destino según la ruta (`/` y `/alertas` → `/alertas/reportar` con hint desplegable; `/adopciones` y `/quienes-somos` → `/alertas`), ocultamiento automático mientras el menú hamburguesa está abierto, transición de opacidad en reposo (`opacity-25`) frente a actividad (`scroll` / `touchstart` → `opacity-90` por 2,5 s) y despliegue en celular del texto `"Publicar Alerta Callejero"` durante 3 s (a los 2 s de entrar y cada 30 s) con fondo rojo sólido hasta que la persona lo toca por primera vez (`callejeros_fab_usado`), respetando `prefers-reduced-motion`.
  - Implementé el componente reutilizable `BackButton` (`<` en celular y `< Volver` desde `sm:`, mínimo 44×44 px) y el hook `useNavigationHistoryTracker` en `AppHeader` (que registra en `sessionStorage` la última ruta visitada con `usePathname()`), para volver hacia atrás en el historial si se navegó dentro del sitio sin venir de `/login`, `/registro` ni `/recuperar`, o ir al destino fijo `fallbackHref` si se entró directo.
  - Escribí 6 tests en `AlertFab.test.tsx` y `BackButton.test.tsx` con Vitest y Testing Library (simulando cambios de ruta en `usePathname()`), y comparé el FAB en el navegador contra `contexto-ia/maquetado/index.html` en 375 px y escritorio, en modo claro y oscuro.
- **Decisiones tomadas:**
  - Ubiqué `<AlertFab />` en `RootLayout` entre `{children}` y `<Footer />` sincronizado con `AppHeader` mediante el evento `callejeros:menu-open` para que el orden de tabulación con teclado (`<header>` → `<main>` → `#fab-alerta` → `<footer>`) coincida exactamente con el del maquetado.
  - En lugar de leer `document.referrer` (que Next.js no actualiza al navegar en el cliente con `<Link>`), registré en `sessionStorage` (`callejeros_current_path` y `callejeros_prev_path`) los cambios de `usePathname()` desde `AppHeader` para que `BackButton` conozca siempre la ruta interna anterior.
- **Problemas y cómo los resolví:**
  - En la primera comparación en el navegador detecté que el `useEffect` de inactividad de `AlertFab` dependía del objeto literal `config` creado en cada render y reiniciaba el temporizador de 2,5 s al cambiar `isActive`; lo corregí dependiendo del booleano primitivo `hasFab` y `pathname`.
  - En la revisión del PR #84 Franco señaló que `document.referrer` no cambia durante la navegación cliente con `<Link>`; lo resolví con `useNavigationHistoryTracker` en `AppHeader` guardando la ruta previa en `sessionStorage` y actualizando `BackButton.test.tsx` para simular la navegación entre rutas.
- **Pendiente:** que Franco revise los cambios del PR #84 para dar por completada toda la épica #20 (`[FR-02] Layout común`).
- **PR:** #84
- **IA usada:** Antigravity — para refactorizar `MobileMenu`, implementar `AlertFab` y `BackButton`, sus tests con Vitest y la comparación visual en el navegador.

## 2026-11-19 — Modelos de mascotas, migración inicial, admin y datos semilla (BK-03a)

- **Tarjeta:** #85 (BK-03a, sub-tarjeta de #6 BK-03)
- **Rama:** feature/bk03-85-modelos-mascotas-seed
- **Área:** back, db, test, docs
- **Qué hice:**
  - Dividí la épica #6 (BK-03) en tres sub-tarjetas (#85 BK-03a, #86 BK-03b y #87 BK-03c) siguiendo el orden acordado con Franco (base de datos primero para revisarla antes de los endpoints).
  - Instalé `Pillow` con `uv` y creé la app `apps.pets` con los 4 modelos del diagrama DB-01 en el README (`Pet`, `PetHealth`, `PetPhoto` y `PetStatusLog`), sus `TextChoices`, los índices de catálogo (`status + species + sex`) y edad (`estimated_birth_date`), y la restricción `UniqueConstraint` de `(pet, position)` sobre fotos activas.
  - Generé la migración `apps/pets/migrations/0001_initial.py` y registré los 4 modelos en `apps/pets/admin.py` con inlines en `PetAdmin`.
  - Creé `apps/pets/seed.py` (descubierto automáticamente por `python manage.py seed`) con las 6 mascotas del maquetado (`Loki` con 2 fotos, `Luna`, `Rocco`, `Misa`, `Bora`, `Thor`) y 3 ejemplos adicionales en estados `adopted`, `in_review` y `rejected`, con sus datos de salud, imágenes JPEG generadas con Pillow y registros de historial sin duplicar al re-ejecutar.
  - Escribí las factories (`factory_boy`) y 9 tests con `pytest` en `apps/pets/tests/test_models.py`, `test_seed.py` y `test_admin.py`.
  - Apliqué las mejoras de la revisión del PR #88: creé `SoftDeleteAdminMixin` y `ReadOnlyAdminMixin` en `apps/core/admin.py` para impedir el borrado físico en el admin y habilitar acciones de baja lógica y reactivación; dejé `PetStatusLog` completamente de solo lectura y bloqueé la edición directa de `status` e `is_urgent_validated` en `PetAdmin`; documenté en el README que la unicidad de `PetPhoto` aplica a fotos activas; y agregué `backend/conftest.py` con un fixture `autouse` que aísla `MEDIA_ROOT` en `tmp_path` para todos los tests.
- **Decisiones tomadas:**
  - Definí `UniqueConstraint(fields=["pet", "position"], condition=Q(is_active=True))` en `PetPhoto` para que la baja lógica de una foto permita cargar un reemplazo en la misma posición (`position=0`) sin violar unicidad.
  - En `apps/pets/seed.py` generé imágenes JPEG livianas en memoria con Pillow y verifiqué `PetPhoto` por `(pet, position)` para garantizar que `manage.py seed` funcione offline sin duplicar archivos en `media/`.
- **Problemas y cómo los resolví:**
  - En `test_models.py`, capturar un `IntegrityError` dentro del bloque transaccional de `pytest-django` requiere envolver la operación esperada en `transaction.atomic()` para no dejar la transacción marcada para rollback antes de seguir con las aserciones; lo resolví con `with pytest.raises(IntegrityError), transaction.atomic():`.
  - `apps/users/tests/test_seed.py` ejecutaba el `seed` completo escribiendo imágenes en `backend/media/`; lo resolví globalmente con el fixture `autouse` `isolated_media_root` en `backend/conftest.py`.
- **Pendiente:** que Franco revise los ajustes del PR #88 para continuar con #86 (BK-03b: publicar, editar, adoptar y dar de baja mascotas con validación de fotos).
- **PR:** #88
- **IA usada:** Antigravity — para dividir la épica, implementar los modelos según DB-01, migración, admin, seed y tests con `pytest`.

## 2026-11-20 — Publicar, editar, adoptar, dar de baja mascotas y validación de fotos (BK-03b)

- **Tarjeta:** #86 (BK-03b, sub-tarjeta de #6 BK-03)
- **Rama:** feature/bk03-86-crud-mascotas-fotos
- **Área:** back, db, test, docs
- **Qué hice:**
  - Actualicé la rama `feature/bk03-86-crud-mascotas-fotos` con los últimos cambios de `develop` antes de empezar.
  - Creé el validador reutilizable `validate_image_file` en `apps/core/validators.py` (verifica tamaño ≤ 5 MB y formato real `JPEG`, `PNG` o `WEBP` con Pillow) y lo asocié a `PetPhoto.image` con la migración nueva `apps/pets/migrations/0002_alter_petphoto_image.py`, aplicando la sugerencia de Franco del PR #88.
  - Implementé `apps/pets/permissions.py` (`can_manage_pet` e `IsPetOwnerOrStaffOrAdmin`) y la capa de servicios en `apps/pets/services.py` (`create_pet`, `update_pet`, `deactivate_pet`, `adopt_pet`, `add_pet_photo` y `remove_pet_photo`) con todas las reglas de negocio en transacciones atómicas.
  - Implementé serializers, vistas y rutas bajo `/api/pets/`: `POST /api/pets/` (nace siempre en `in_review` y `is_urgent_validated=False`, exige ≥ 1 foto válida, valida largos de texto y fecha de nacimiento, crea `PetHealth`, `PetPhoto` y `PetStatusLog` inicial, y no expone `contact_phone`), `PATCH /api/pets/{id}/`, `DELETE /api/pets/{id}/` (baja lógica), `POST /api/pets/{id}/adopt/` (solo desde `published`, con registro en `PetStatusLog`), `POST /api/pets/{id}/photos/` y `DELETE /api/pets/{id}/photos/{photo_id}/` (baja lógica impidiendo dejar la mascota sin fotos activas).
  - Escribí 36 tests nuevos con `pytest` en `apps/core/tests/test_validators.py` y `apps/pets/tests/test_api.py` cubriendo validaciones de fotos y textos, flujo completo, protección de campos sensibles, historial `PetStatusLog`, vuelta a revisión y matriz de permisos; verifiqué `ruff format --check .`, `ruff check .`, `spectacular --validate --fail-on-warn` y la suite completa de 111 tests en verde.
  - Apliqué los ajustes de la revisión del PR #98: formateé con `ruff format`, validé explícitamente que `is_sociable` e `is_neutered` vengan informados en `multipart/form-data`, agregué `@extend_schema` a las 5 vistas de `apps/pets/views.py` (con `ENUM_NAME_OVERRIDES` para `PetCompatibilityEnum` en `settings.py` y cero warnings en Swagger), e implementé la regla de que cuando el autor (no Staff/Admin) edita datos o fotos de una mascota `published`, esta vuelve automáticamente a `in_review` dejando registro en `PetStatusLog`.
- **Decisiones tomadas:**
  - Al dar de baja lógica una foto del carrusel (`remove_pet_photo`), compacté las posiciones de las fotos activas restantes (`0..n`) para asegurar que siempre exista una foto principal en `position=0` sin chocar con la restricción de unicidad activa.
  - En `validate_image_file` validé los bytes reales en memoria con `BytesIO` (después de chequear el límite de 5 MB) y restauré el puntero del archivo con `seek(0)` para que Pillow no cierre el archivo subido antes de que Django lo guarde.
- **Problemas y cómo los resolví:**
  - En `POST /api/pets/` con `multipart/form-data`, DRF ignoraba el campo anidado `health` cuando se enviaba como string JSON porque `html.parse_html_dict` espera claves planas; lo resolví sobrescribiendo `get_value` en `PetHealthInputSerializer` para aceptar tanto JSON string en multipart como objetos JSON estándar.
  - En `multipart/form-data`, DRF interpretaba `is_sociable` e `is_neutered` ausentes como `False` (checkbox sin tildar); lo resolví validando explícitamente su presencia en `self.initial_data` dentro de `PetCreateSerializer.validate()`.
- **Pendiente:** que Franco revise y apruebe los ajustes del PR #98 para continuar con #87 (`BK-03c`: catálogo público, filtros, ficha pública y Swagger del catálogo).
- **PR:** #98
- **IA usada:** Antigravity — para implementar el validador de imágenes, servicios, permisos, serializers, vistas y batería de tests siguiendo las reglas del proyecto.

## 2026-11-20 — Catálogo público, filtros, búsqueda, ficha de mascota y Swagger (BK-03c)

- **Tarjeta:** #87 (BK-03c, sub-tarjeta de #6 BK-03)
- **Rama:** feature/bk03-87-catalogo-filtros-ficha
- **Área:** back, test, docs
- **Qué hice:**
  - Instalé `django-filter` con `uv` y lo registré en `THIRD_PARTY_APPS` de `config/settings.py`.
  - Creé `apps/pets/filters.py` con `PetCatalogFilter` soportando `species`, `sex`, `age_group` (`cachorro`, `adulto`, `senior`), `is_sociable`, `good_with_children`, `good_with_animals`, `is_neutered`, `urgent` (solo urgentes validados y no adoptados), `adopted` (sin mezclar disponibles con adoptados) y `search` por nombre.
  - Agregué en `apps/pets/permissions.py` y `apps/pets/services.py` las reglas de visibilidad de ficha (`can_view_pet`, `get_visible_pet_or_404`), los cortes exactos de edad compartidos (`calculate_age_group`, `subtract_years`) y las consultas optimizadas con `select_related` y `Prefetch` de fotos activas (`get_catalog_pets_queryset`, `get_my_pets_queryset`).
  - Implementé `GET /api/pets/` (público), `GET /api/pets/{id}/` (público para `published` y `adopted`, restringido a autor/Staff/Admin para `in_review` y `rejected`, sin exponer `contact_phone`) y `GET /api/pets/mine/` (`IsAuthenticated`), todos documentados con `@extend_schema` en Swagger (`spectacular --validate --fail-on-warn` sin warnings).
  - Escribí 17 tests en `apps/pets/tests/test_catalog_api.py` cubriendo catálogo, todos los filtros y bordes exactos de edad, paginación de a 12 combinada con filtros, privacidad de `contact_phone` e `is_urgent`, visibilidad de ficha, listado propio y esquema OpenAPI (128 tests en total en verde).
  - Actualicé `README.md` con `django-filter` y la tabla completa de endpoints `/api/pets/` (incluyendo paginación `{ count, next, previous, results }`, `is_urgent` público y `contact_phone` solo para autor/Staff/Admin).
  - Apliqué las 3 mejoras de la revisión del PR #99: creé `PetPublicSerializer` con `is_urgent` calculado (`is_pet_urgent`: solicitado, validado y no adoptada) sin exponer `is_urgent_requested`, `is_urgent_validated` ni `contact_phone` al público; expuse `contact_phone` en `PetManageSerializer` únicamente cuando consulta el autor, Staff o Admin (en la ficha y en `mine/`); y agregué `StandardPageNumberPagination` (`page_size = 12`) en `apps/core/pagination.py` aplicada a `GET /api/pets/` y `GET /api/pets/mine/` con su documentación en Swagger y README.
- **Decisiones tomadas:**
  - Usé un único helper `subtract_years` / `calculate_age_group` tanto en el filtro `age_group` como en el campo calculado `age_group` del serializer, garantizando cortes consistentes con el maquetado (`< 1 año` cachorro, `1..7` adulto, `> 7` senior) incluso en años bisiestos.
  - En `GET /api/pets/{id}/`, devolví `404` (y no `403`) a terceros cuando una publicación está en `in_review` o `rejected` para no filtrar la existencia de mascotas aún no aprobadas.
  - Separé `PetPublicSerializer` y `PetManageSerializer` (heredando del primero para mantener DRY) para garantizar que ni el catálogo ni la ficha pública expongan flags internos de urgencia ni el teléfono de contacto.
- **Problemas y cómo los resolví:**
  - Sin inconvenientes; `PetCatalogFilter.qs` aplica `status=published` por defecto cuando no se envía `adopted`, evitando que disponibles y adoptados se mezclen en el catálogo.
- **Pendiente:** que Franco revise y apruebe los ajustes del PR #99 para cerrar la épica #6 (`[BK-03] Mascotas y fotos`).
- **PR:** #99
- **IA usada:** Antigravity — para instalar `django-filter`, implementar los filtros, endpoints de lectura, Swagger, actualización del README y tests con `pytest`.

## 2026-11-23 — Modelo Favorite, migración, admin y datos semilla (BK-05a)

- **Tarjeta:** #115 (BK-05a, sub-tarjeta de #8 BK-05)
- **Rama:** feature/bk05-115-modelo-favoritos-seed
- **Área:** back, db, test, docs
- **Qué hice:**
  - Dividí la épica #8 (BK-05) en dos sub-tarjetas (#115 BK-05a y #116 BK-05b) y las cargué en el tablero colgadas de #8.
  - Agregué el modelo `Favorite` en `apps/pets/models.py` heredando de `BaseModel` (`user`, `pet` con `on_delete=models.PROTECT`, `is_active`, `created_at`, `updated_at`) y la restricción `UniqueConstraint(fields=["user", "pet"], name="unique_user_pet_favorite")` según el diseño de DB-01 en el README.
  - Generé la migración nueva `apps/pets/migrations/0003_favorite.py` y registré `FavoriteAdmin` en `apps/pets/admin.py` usando `SoftDeleteAdminMixin` para bloquear borrados físicos y habilitar acciones de baja lógica y reactivación.
  - Sumé `SEED_FAVORITES` (5 favoritos de prueba para los usuarios semilla) en `apps/pets/seed.py` con `update_or_create` idempotente.
  - Agregué `FavoriteFactory` en `apps/pets/tests/factories.py` y cubrí con `pytest` el modelo, la restricción única `(user, pet)` tanto activo como inactivo, la baja lógica y reactivación, el panel de admin y la idempotencia del `seed`.
- **Decisiones tomadas:**
  - Mantuve `UniqueConstraint(fields=["user", "pet"])` sin condición parcial (siguiendo exactamente DB-01) y `on_delete=models.PROTECT` (consistente con `AdoptionRequest`): al desmarcar se aplica baja lógica (`is_active=False`) y al volver a marcar se reactiva el mismo registro sin duplicar filas.
- **Problemas y cómo los resolví:**
  - Sin inconvenientes; la salida del resumen de `apps/pets/seed.py` conservó el prefijo de mascotas y sumó el conteo de favoritos manteniendo compatibilidad con las pruebas existentes.
- **Pendiente:** abrir el PR hacia `develop` para que Franco revise la migración y el modelo, y continuar con #116 (`BK-05b`: endpoints de favoritos, filtro `?favorites=true`, campo `is_favorite`, Swagger y tests).
- **PR:** pendiente de apertura
- **IA usada:** Antigravity — para dividir la épica en GitHub, implementar el modelo `Favorite`, la migración, el admin, los datos semilla y los tests con `pytest`.

## 2026-11-23 — Endpoints de favoritos, filtro en catálogo, is_favorite y Swagger (BK-05b)

- **Tarjeta:** #116 (BK-05b, sub-tarjeta de #8 BK-05)
- **Rama:** feature/bk05-116-endpoints-favoritos-catalogo
- **Área:** back, test, docs
- **Qué hice:**
  - Actualicé `develop` tras el merge del PR #117 (`BK-05a`) y creé la rama `feature/bk05-116-endpoints-favoritos-catalogo`.
  - Implementé los servicios de favoritos en `apps/pets/services.py` (`add_favorite`, `remove_favorite`, `get_favorite_pets_queryset`) y la anotación `_annotate_is_favorite` con `Exists(...)` para evitar consultas N+1 en catálogo, ficha y listado propio.
  - Sumé el filtro `?favorites=true` / `false` en `PetCatalogFilter` (`apps/pets/filters.py`) y el campo calculado `is_favorite` en `PetPublicSerializer` (heredado por `PetManageSerializer`), junto con `FavoriteStatusSerializer`.
  - Expuse los endpoints `GET /api/pets/favorites/`, `POST /api/pets/{id}/favorite/` y `DELETE /api/pets/{id}/favorite/` en `apps/pets/views.py` y `apps/pets/urls.py`, todos protegidos con `IsAuthenticated` y documentados con `@extend_schema` en Swagger (`spectacular --validate --fail-on-warn` sin warnings).
  - Escribí 10 tests en `apps/pets/tests/test_favorites_api.py` cubriendo permisos, idempotencia, baja lógica y reactivación, rechazo de mascotas no visibles, paginación, filtro `?favorites=true`, campo `is_favorite` y esquema OpenAPI.
  - Actualicé la tabla de endpoints `/api/pets/` en `README.md`.
  - Apliqué los ajustes de la revisión del PR #120: simplifiqué `filter_favorites` en `apps/pets/filters.py` a `queryset.filter(is_favorite=value)` para evitar que `?favorites=false` oculte mascotas por favoritos activos de otros usuarios (sumando el test correspondiente), centralicé `is_authenticated_active_user` y reutilicé `PUBLIC_PET_STATUSES` desde `apps/pets/permissions.py`, anoté `is_favorite` en `get_review_queue_queryset` para evitar N+1 en la cola de Staff y agregué etiquetas e hito al PR #120.
- **Decisiones tomadas:**
  - Usé `POST /api/pets/{id}/favorite/` (idempotente: `201` al crear, `200` al reactivar o si ya estaba activo) y `DELETE /api/pets/{id}/favorite/` (baja lógica idempotente, `204`) en lugar de un toggle único para mantener semántica REST predecible ante reintentos o doble clic.
  - Anoté `is_favorite` mediante `Exists(...)` en el queryset de lectura con fallback seguro en el serializer, garantizando cero consultas N+1 en el catálogo paginado y en la ficha.
- **Problemas y cómo los resolví:**
  - Sin inconvenientes; los tests de favoritos, el esquema OpenAPI y `ruff` pasaron en verde.
- **Pendiente:** que Franco apruebe y mergee los ajustes del PR #120 para cerrar la épica #8 (`[BK-05] Favoritos`) y destrabar `FR-06` (#24 Catálogo).
- **PR:** #120
- **IA usada:** Antigravity — para implementar servicios, filtro de catálogo, endpoints, Swagger, documentación en README y tests en `pytest`.
