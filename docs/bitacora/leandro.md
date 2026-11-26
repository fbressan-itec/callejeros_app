# Bitácora — Leandro Odetto

Formato de cada entrada: ver [LEEME.md](LEEME.md). Las entradas nuevas van al final.

## 2026-11-19 — Sesión JWT, pantalla de login, rutas protegidas y redirección de origen (FR-03a)

- **Tarjeta:** #89 (FR-03a, sub-tarjeta de #21 FR-03)
- **Rama:** feature/fr03-89-sesion-login-rutas-protegidas
- **Área:** front, test, docs
- **Qué hice:**
  - Dividí la épica #21 (FR-03) en tres sub-tarjetas (#89 FR-03a, #90 FR-03b y #91 FR-03c) y las cargué en el tablero colgadas de la épica.
  - Actualicé mi entorno local a `npm 11.21.3` e instalé `zod`, `react-hook-form` y `@hookform/resolvers` en `frontend/`.
  - Implementé el módulo de sesión JWT en `src/lib/auth/session.ts` (`saveAuthSession`, `loadAuthSession`, `clearAuthSession`, `loginWithCredentials`, `refreshAccessToken`, `fetchCurrentUser`, `logoutSession` y `getSafeRedirect`), guardando la sesión en `localStorage` cuando `"Recordarme"` está tildado (hasta 30 días) y en `sessionStorage` cuando no está tildado (se pierde al cerrar el navegador y dura máx. 1 día).
  - Creé `AuthProvider` y lo conecté en `RootLayout` y `AppHeader` para que `MobileMenu` refleje automáticamente el usuario autenticado, su insignia de rol y el cierre de sesión.
  - Implementé el componente de rutas protegidas `RequireAuth` y el modal compartido `AuthRequiredModal` (`"Iniciá sesión para continuar"`), preservando la página de origen en `?redirect=` validada con `getSafeRedirect`.
  - Creé la pantalla `/login` (`src/app/login/page.tsx`) fiel a `contexto-ia/maquetado/login.html` adaptada a Tailwind 4, con validación `zod` (mínimo 6 caracteres en contraseña con el mensaje exacto `"La contraseña debe tener al menos 6 caracteres"`), visualización de errores devueltos por el back debajo del campo, ojito para mostrar/ocultar contraseña, casilla `"Recordarme"` y botones chicos y modernos de Google y Facebook maquetados (aclarados en comentario de código).
  - Apliqué los ajustes de la revisión del PR #92: creé el componente compartido accesible `LoadingScreen` (`src/components/ui/LoadingScreen.tsx`) según la guía de `"Estado de carga"` en `02-diseno.md`, hice que `isLoading` en `AuthProvider` arranque en `true` hasta completar la lectura inicial del storage en el cliente para que `RequireAuth` muestre `LoadingScreen` y no redirija a `/login` al recargar con sesión activa, apliqué `bg-orange-700 hover:bg-orange-800` en los botones principales con texto blanco (`"Ingresar"` e `"Iniciar Sesión"` del modal) por contraste WCAG AA, y sumé los 2 tests en `RequireAuth.test.tsx` (16 tests nuevos; 44 tests en total).
- **Decisiones tomadas:**
  - En `AuthProvider`, `isLoading` permanece en `true` hasta que el cliente hidrata la sesión desde `localStorage`/`sessionStorage`, y mientras tanto `RequireAuth` renderiza `<LoadingScreen />` por defecto para no perder la ruta protegida al recargar ni hacer saltar el pie de página.
  - En los botones principales con texto blanco (`"Ingresar"` y `"Iniciar Sesión"` de `AuthRequiredModal`) usé `bg-orange-700 hover:bg-orange-800` según la tabla de colores de `02-diseno.md` para cumplir con el contraste 4.5:1 de WCAG AA.
  - Validé en `getSafeRedirect` que el destino de retorno después de iniciar sesión sea siempre una ruta interna que empiece con `/` (excluyendo `//`, protocolos externos y las propias rutas `/login`, `/registro` y `/recuperar`) para prevenir redirecciones abiertas.
- **Problemas y cómo los resolví:**
  - En la comparación en el navegador contra `login.html` en modo oscuro noté que el botón `BackButton` tenía `dark:bg-slate-800` y se fundía con el fondo `dark:bg-slate-800` de la tarjeta de login; lo ajusté a `dark:bg-slate-700 dark:hover:bg-slate-600` igual que en `login.html`.
  - Al recargar una ruta protegida con sesión activa, `RequireAuth` evaluaba `isAuthenticated === false` antes de leer el storage; lo resolví iniciando `isLoading` en `true` en `AuthProvider` y mostrando `<LoadingScreen />` hasta que termina la lectura inicial del storage.
- **Pendiente:** que Franco revise los ajustes del PR #92 para continuar con #90 (FR-03b: pantalla de registro en 3 pasos con verificación SMS maquetada).
- **PR:** #92
- **IA usada:** Antigravity — para dividir la épica, implementar la gestión de sesión JWT, `LoadingScreen`, rutas protegidas, pantalla de login con validación `zod`, tests con Vitest y comparación visual en el navegador.

## 2026-11-19 — Pantalla de registro en 3 pasos con verificación SMS maquetada (FR-03b)

- **Tarjeta:** #90 (FR-03b, sub-tarjeta de #21 FR-03)
- **Rama:** feature/fr03-90-registro-verificacion-sms
- **Área:** front, test, docs
- **Qué hice:**
  - Agregué `min-h-[60vh]` a la variante `page` de `LoadingScreen` (sugerencia de la revisión del PR #92 para evitar que el pie de página suba en celular mientras carga).
  - Sumé `splitFullName` y `registerAccount` en `src/lib/auth/session.ts` para enviar `POST /api/auth/register/` (`email`, `password`, `first_name`, `last_name`, `phone` y `verification_code`) e iniciar sesión automáticamente al crear la cuenta.
  - Implementé la pantalla `/registro` (`src/app/registro/page.tsx`) en 3 pasos (+ pantalla de confirmación `"¡Teléfono Verificado!"`) fiel a `contexto-ia/maquetado/registro.html` adaptada a Tailwind 4:
    - Paso 1: nombre completo, correo electrónico, contraseña con botón mostrar/ocultar, casilla de términos, validación con `zod` (mínimo 6 caracteres con `"La contraseña debe tener al menos 6 caracteres"`), visualización debajo del campo de contraseña de los errores devueltos por el back (`"La contraseña tiene un valor demasiado común."` y `"La contraseña está formada completamente por dígitos."`), botones chicos y modernos de Google y Facebook maquetados (aclarados en comentario de código) y enlace a `/login`.
    - Paso 2: número de teléfono con opción `"Verificar"` (avanza al Paso 3) y `"Más tarde"` (registra la cuenta directamente sin verificar el teléfono).
    - Paso 3 (A6 maquetado): teléfono enmascarado, 4 casilleros OTP numéricos (con avance automático, retroceso con `Backspace` y pegado de 4 dígitos), mensaje en rojo con asterisco debajo del campo del código (`* Verificación por SMS maquetada: usá el código 8596.`), temporizador `(04:30)` y `"Reenviar código"`.
  - Apliqué el ajuste de la revisión del PR #93: pasé `MOCK_VERIFICATION_CODE` desde `next.config.ts` (`env: { NEXT_PUBLIC_MOCK_VERIFICATION_CODE: process.env.MOCK_VERIFICATION_CODE }`) y quité la variable duplicada de `.env.example`, `README.md` y el respaldo harcodeado en `session.ts`, para que `MOCK_VERIFICATION_CODE` en `.env` sea la única fuente de configuración tanto para el back como para el front.
  - Escribí 6 tests nuevos con Vitest y Testing Library en `registro/page.test.tsx` y `session.test.ts` (50 tests en total pasando), y comparé `/registro` en el navegador contra `registro.html` en 375 px y escritorio, en modo claro y oscuro.
- **Decisiones tomadas:**
  - Expuse `MOCK_VERIFICATION_CODE` del `.env` de la raíz al navegador desde `next.config.ts` sin duplicar la variable ni dejar un respaldo fijo en `session.ts`, garantizando que si cambia en `.env` se actualice a la vez lo que muestra la pantalla y lo que valida el backend.
  - Si el backend devuelve errores de validación sobre los campos del Paso 1 (`email`, `password` o `first_name`) al intentar finalizar en el Paso 2 o 3, el formulario vuelve automáticamente al Paso 1 y muestra los mensajes del servidor debajo del campo correspondiente.
  - Reemplacé los `placeholder` poco serios del maquetado (`"Alt Efe Cuatro"`, `"alt_f4@mail.com"`) por `"Juan Pérez"` y `"tu@correo.com"` y agregué los atributos `autoComplete` (`name`, `email`, `new-password`, `tel`, `one-time-code`) según `06-de-maqueta-a-produccion.md`.
- **Problemas y cómo los resolví:**
  - ESLint advirtió sobre el arreglo de refs de los 4 casilleros OTP en el `useEffect` de foco inicial; lo resolví guardando los 4 elementos en un único `useRef<Array<HTMLInputElement | null>>`.
- **Pendiente:** que Franco revise el ajuste del PR #93 para continuar con #91 (FR-03c: pantalla de recuperar contraseña en 3 pasos maquetada).
- **PR:** #93
- **IA usada:** Antigravity — para implementar el servicio de registro, la pantalla `/registro` en 3 pasos con validación `zod`, sus tests con Vitest y la comparación visual en el navegador.

## 2026-11-20 — Pantalla de recuperar contraseña en 3 pasos maquetada (FR-03c)

- **Tarjeta:** #91 (FR-03c, sub-tarjeta de #21 FR-03)
- **Rama:** feature/fr03-91-recuperar-contrasena
- **Área:** front, test, docs
- **Qué hice:**
  - Implementé la pantalla `/recuperar` (`src/app/recuperar/page.tsx`) en 3 pasos (+ pantalla de confirmación `"¡Contraseña actualizada!"`) fiel a `contexto-ia/maquetado/recuperar.html` y `js/auth.js`, adaptada a Tailwind 4:
    - Paso 1: selección en tarjetas entre **Email** (`"Te enviamos un código a tu correo"`) y **Teléfono** (`"Te enviamos un código por SMS"`), campo de contacto dinámico con validación `zod` y botón `"Siguiente"`.
    - Paso 2 (A5 maquetado): contacto enmascarado (`maskRecoverContact`), 4 casilleros OTP numéricos (con avance automático, retroceso con `Backspace` y pegado de 4 dígitos), mensaje en rojo con asterisco debajo del campo del código mostrando `8596` (`getMockVerificationCode()`) y aclarando que esa parte está maquetada, temporizador `(02:30)` y botones `"Verificar"` y `"Reenviar código"`.
    - Paso 3: campos `"Nueva contraseña"` y `"Repetí la contraseña"` con botón mostrar/ocultar (`👁️`), validados con `zod` (mínimo 6 caracteres con el mensaje exacto `"La contraseña debe tener al menos 6 caracteres"` y coincidencia de ambas contraseñas con `"Las contraseñas no coinciden."`).
    - Paso 4 (Éxito): confirmación `"¡Contraseña actualizada!"` con botón `"Iniciar sesión"` hacia `/login`.
  - Escribí 4 tests nuevos con Vitest y Testing Library en `recuperar/page.test.tsx` (54 tests en total pasando), y comparé `/recuperar` en el navegador contra `recuperar.html` en 375 px y escritorio, en modo claro y oscuro.
  - Apliqué el ajuste de la revisión del PR #95: tanto en `/recuperar` como en `/registro` (#90), cuando se ingresa un código OTP incorrecto, ahora se vacían los 4 casilleros y el foco vuelve automáticamente al primero manteniendo visible el mensaje de error, con su test correspondiente en ambas pantallas (55 tests en total pasando).
- **Decisiones tomadas:**
  - Reutilicé `getMockVerificationCode()` en el Paso 2 para que tanto el registro por SMS como la recuperación de contraseña lean el mismo código único (`8596`) expuesto desde `MOCK_VERIFICATION_CODE` en `next.config.ts`, como establece `03-reglas-de-negocio.md`.
- **Problemas y cómo los resolví:**
  - En la primera comparación en el navegador detecté que al pasar de Email a Teléfono y volver a tocar la tarjeta de Email en el Paso 1, el `registerMethod("method")` de `react-hook-form` interfería con el atributo `checked` controlado del radio y no restauraba el campo a `"Correo electrónico"`; lo corregí sincronizando el radio con `checked={selectedMethod === ...}` y `setMethodValue("method", nextMethod)` en `handleMethodChange`, y sumé el caso bidireccional al test de Vitest.
- **Pendiente:** que Franco revise el ajuste del PR #95 y cierre la épica #21 (`[FR-03] Login, registro y recuperar contraseña`).
- **PR:** #95
- **IA usada:** Antigravity — para implementar la pantalla `/recuperar` en 3 pasos con validación `zod`, sus tests con Vitest y la comparación visual en el navegador.

## 2026-11-20 — Servicio de cálculo de insignias, edad legible y tests unitarios (BK-04a)

- **Tarjeta:** #100 (BK-04a, sub-tarjeta de #7 BK-04)
- **Rama:** feature/bk04-100-servicio-insignias
- **Área:** back, test, docs
- **Qué hice:**
  - Dividí la épica #7 (BK-04) en dos sub-tarjetas (#100 BK-04a y #101 BK-04b), las colgué como sub-issues de #7 en el tablero y las asigné a mi usuario.
  - Implementé `backend/apps/pets/badges.py` con los enums `AgeGroup`, `BadgeKey`, `BadgeTone`, `BadgeIcon`, el tipo `PetBadge`, el formateo de edad legible `format_pet_age` y el servicio `get_pet_badges`, respetando exactamente el orden, tonos y textos de `03-reglas-de-negocio.md` y `contexto-ia/maquetado/js/mascota.js`.
  - Reexporté los símbolos de edad e insignias desde `backend/apps/pets/services.py` para centralizar la lógica de negocio sin duplicar código ni romper importaciones existentes de `filters.py`, `serializers.py` y `views.py`.
  - Escribí 36 casos de prueba unitarios en `backend/apps/pets/tests/test_badges.py` cubriendo cada insignia, todas sus variantes, el orden exacto, la prioridad de `"¡Ya encontró hogar! 🧡"` sobre `"Caso urgente"`, el requerimiento de validación de urgencia, la concordancia de género en castración, los cuidados especiales y los bordes de edad (incluido el 29 de febrero).
  - Apliqué los ajustes de la revisión del PR #102: pasé el corte de `senior` a 8 años cumplidos en `calculate_age_group` y en `PetCatalogFilter.filter_age_group` (con tests en `7 años y 364 días` → `adulto` y `8 años` → `senior`, 38 casos en `test_badges.py`), igualé las mayúsculas del texto de edad al maquetado (`"1 Año"`, `"2 Años"`, `"1 Mes"`, `"8 Meses"`, `"Menos de 1 Mes"`), quité los reexports de `services.py` para importar directo desde `apps.pets.badges`, corregí la dependencia de `#101` a `#100` y agregué etiquetas e hito (`v0.2`) al PR #102.
- **Decisiones tomadas:**
  - Separé la lógica de cálculo de insignias en `apps/pets/badges.py` y actualicé `filters.py`, `serializers.py` y `views.py` para importarla directo desde allí sin reexports intermedios en `services.py`, devolviendo cada insignia con la estructura `{key, tone, icon, text}` desacoplada del HTML/SVG del frontend.
  - Unifiqué el corte de `senior` en 8 años cumplidos (`subtract_years(today, 8)`) entre `calculate_age_group`, `format_pet_age` y el filtro del catálogo para que una mascota de 7 años y algunos meses siga siendo `Adulto`.
- **Problemas y cómo los resolví:**
  - En la revisión del PR #102 Franco detectó que cortar `senior` por días al superar los 7 años exactos producía `"Senior (más de 7 años): 7 años"` para mascotas de 7 años y meses; lo resolví alineando el corte de `senior` a 8 años cumplidos en servicio y filtro, y cubriendo ambos bordes en los tests.
- **Pendiente:** que Franco revise los ajustes del PR #102 para continuar con #101 (BK-04b: exposición de `badges` en la API, Swagger, README y tests de integración).
- **PR:** #102
- **IA usada:** Antigravity — para dividir la épica, implementar el servicio de cálculo de insignias y edad legible, y escribir los tests unitarios con `pytest`.

## 2026-11-22 — Exposición de insignias calculadas en la API de mascotas, Swagger, README y tests de integración (BK-04b)

- **Tarjeta:** #101 (BK-04b, sub-tarjeta de #7 BK-04)
- **Rama:** feature/bk04-101-api-insignias
- **Área:** back, test, docs
- **Qué hice:**
  - Agregué `PetBadgeSerializer` (`key`, `tone`, `icon`, `text`, todos `read_only=True`) y el campo calculado `badges` en `PetPublicSerializer` (heredado por `PetManageSerializer`), anotado con `@extend_schema_field(PetBadgeSerializer(many=True))` para su tipado completo en Swagger.
  - Actualicé las descripciones de `@extend_schema` en `backend/apps/pets/views.py` (`GET /api/pets/` y `GET /api/pets/{id}/`) y validé el esquema OpenAPI con `manage.py spectacular --validate --fail-on-warn`.
  - Escribí 7 tests de integración en `backend/apps/pets/tests/test_badges_api.py` cubriendo `badges` en catálogo (disponibles, urgentes validados/no validados y `?adopted=true`), ficha, mis publicaciones, alta, edición, adopción, validación de urgencia por Staff, ignorado de `badges` enviados por el cliente y el esquema `/api/schema/`.
  - Documenté el campo calculado `badges` en la sección de endpoints de mascotas de `README.md`.
- **Decisiones tomadas:**
  - Expuse `badges` en `PetPublicSerializer` para que todos los serializers de lectura de mascotas (`PetPublicSerializer` y `PetManageSerializer`) incluyan automáticamente las insignias calculadas sin duplicar código, mientras `PetCreateSerializer` y `PetUpdateSerializer` no declaran el campo para garantizar que nunca se elijan a mano desde el cliente.
- **Problemas y cómo los resolví:**
  - En el test del esquema OpenAPI `drf-spectacular` nombra el esquema de `PATCH` como `PatchedPetUpdate` (por `partial=True`) en lugar de `PetUpdate`; ajusté el nombre en la aserción del test y quedó en verde.
- **Pendiente:** abrir el PR de #101 para revisión de Franco y cerrar la épica #7 (`[BK-04] Insignias calculadas`) una vez mergeado.
- **PR:** #109
- **IA usada:** Antigravity — para exponer `badges` en serializers y Swagger, escribir los tests de integración con `pytest` y actualizar `README.md`.

## 2026-11-22 — Modelo de solicitudes de adopción, endpoints del solicitante, Swagger y datos semilla (BK-07a)

- **Tarjeta:** #110 (BK-07a, sub-tarjeta de #10 BK-07)
- **Rama:** feature/bk07-110-solicitudes-adopcion-solicitante
- **Área:** back, db, test, docs
- **Qué hice:**
  - Dividí la épica #10 (BK-07) en dos sub-tarjetas por funcionalidad (#110 BK-07a y #111 BK-07b), las colgué como sub-issues de #10 en GitHub, me asigné la épica y sus sub-tarjetas, y moví #10 y #110 a "En curso" en el tablero.
  - Creé la app `backend/apps/adoptions/` con el modelo `AdoptionRequest(BaseModel)` fiel al diseño de DB-01 en `README.md` (`CheckConstraint` de `age >= 18` y `accepts_commitment = True`, `UniqueConstraint` condicional de una sola solicitud `pending` activa por solicitante y mascota, índice compuesto `(status, created_at)`), su migración `0001_initial.py` y su registro en Django Admin con `SoftDeleteAdminMixin` (campos de revisión en solo lectura).
  - Implementé los permisos (`IsApplicantOrStaffOrAdmin`), los servicios de negocio (`create_adoption_request`, `get_my_adoption_requests_queryset`, `get_active_adoption_request_or_404`), los serializers y los endpoints `POST /api/adoption-requests/`, `GET /api/adoption-requests/mine/` y `GET /api/adoption-requests/{request_id}/` con documentación `@extend_schema` validada sin warnings (`spectacular --validate --fail-on-warn`).
  - Agregué `backend/apps/adoptions/seed.py` idempotente con 3 solicitudes de ejemplo (una en cada estado: `pending`, `approved` con `meeting_point` y `rejected` con `rejection_reason`), autodescubierto por `python manage.py seed`.
  - Escribí 45 tests nuevos con `pytest` en `apps/adoptions/tests/` (`test_models.py`, `test_admin.py`, `test_services.py`, `test_api.py` y `test_seed.py`) y documenté los endpoints en `README.md`.
  - Apliqué los ajustes de la revisión del PR #112: bloqueé en `create_adoption_request` que alguien se postule a una mascota que publicó él mismo (devolviendo error en `pet`), e igualé `GET /api/adoption-requests/{request_id}/` al criterio de las fichas de mascotas devolviendo `404` cuando un tercero autenticado consulta una solicitud ajena (mediante `get_visible_adoption_request_or_404`), sumando los tests correspondientes (48 tests en `apps/adoptions/tests/`).
- **Decisiones tomadas:**
  - Creé la app separada `apps.adoptions` (registrada en `LOCAL_APPS` después de `apps.pets`) para mantener el dominio de solicitudes desacoplado de `apps.pets` y aprovechar el autodescubrimiento de `seed.py` en orden de dependencias.
  - Expuse `foster_contact` (nombre, rol y `contact_phone` de la publicación) únicamente cuando `status == "approved"`, ocultándolo (`null`) en `pending` y `rejected` y garantizando que nunca se incluya la dirección del hogar de tránsito.
  - Sumé `PetStatusEnum` y `AdoptionRequestStatusEnum` en `SPECTACULAR_SETTINGS["ENUM_NAME_OVERRIDES"]` para evitar colisiones de nombres de enum `status` en OpenAPI.
- **Problemas y cómo los resolví:**
  - Al validar OpenAPI con `manage.py spectacular --validate --fail-on-warn`, `drf-spectacular` detectó una colisión entre los enums `status` de `Pet` y `AdoptionRequest`; la resolví registrando ambos en `ENUM_NAME_OVERRIDES` de `settings.py` y el esquema quedó con 0 warnings.
- **Pendiente:** que Franco revise los ajustes del PR #112 para continuar con #111 (BK-07b: cola de revisión de Staff, aprobar y rechazar solicitudes).
- **PR:** #112
- **IA usada:** Antigravity — para dividir la épica, crear la app `adoptions`, implementar el modelo `AdoptionRequest`, los servicios, serializers, endpoints, Swagger, `seed.py`, los tests con `pytest` y actualizar `README.md`.

## 2026-11-22 — Revisión de solicitudes de adopción en el panel de Staff (cola, aprobar y rechazar) (BK-07b)

- **Tarjeta:** #111 (BK-07b, sub-tarjeta de #10 BK-07)
- **Rama:** feature/bk07-111-revision-solicitudes-staff
- **Área:** back, test, docs
- **Qué hice:**
  - Eliminé `IsApplicantOrStaffOrAdmin` sin uso en `backend/apps/adoptions/permissions.py` según la observación de Franco al aprobar el PR #112.
  - Implementé en `backend/apps/adoptions/services.py` la cola `get_adoption_review_queue_queryset` (solicitudes activas en `pending`, de más vieja a más nueva aprovechando el índice `(status, created_at)`) y el flujo `AdoptionRequestReviewWorkflow` (`approve_adoption_request` y `reject_adoption_request`) siguiendo las convenciones de `apps/core/review.py`: control de rol `Staff`/`Admin` en el servicio, transacción atómica con `select_for_update()`, validación de estado `pending` y vigencia, `meeting_point` obligatorio (≤ 255) al aprobar, `rejection_reason` obligatorio (≤ 400) al desaprobar, registro de `reviewed_by` y `reviewed_at`, y ganchos `on_approved` / `on_rejected` preparados para notificaciones en BK-08 (#11).
  - Agregué `AdoptionRequestApproveSerializer` y `AdoptionRequestRejectSerializer` en `serializers.py` y los endpoints `GET /api/adoption-requests/review-queue/`, `POST /api/adoption-requests/{request_id}/approve/` y `POST /api/adoption-requests/{request_id}/reject/` (`IsAuthenticated`, `IsStaffOrAdmin`) con `@extend_schema` validado sin warnings (`spectacular --validate --fail-on-warn`).
  - Escribí 22 tests nuevos en `apps/adoptions/tests/test_review_services.py` y `test_review_api.py` cubriendo permisos por rol, orden y paginación de la cola, validaciones, transiciones de estado, ganchos de notificación, privacidad del hogar de tránsito y esquema OpenAPI, y actualicé `README.md`.
- **Decisiones tomadas:**
  - Implementé `AdoptionRequestReviewWorkflow` con la misma estructura de `apps/core/review.py` (verificación de rol en servicio, `select_for_update()` y ganchos `on_approved`/`on_rejected`) en lugar de forzar `ReviewWorkflow` de publicaciones porque las solicitudes usan campos propios (`meeting_point`, `rejection_reason`, `reviewed_by`, `reviewed_at`) y estados `pending` → `approved` / `rejected` sin tabla `*StatusLog`.
- **Problemas y cómo los resolví:**
  - Sin bloqueos; la suite completa del backend pasó en verde tras validar `ruff` y `drf-spectacular`.
- **Pendiente:** abrir el PR de #111 para revisión de Franco y cerrar la épica #10 (`[BK-07] Solicitudes de adopción`) una vez mergeado.
- **PR:** #113
- **IA usada:** Antigravity — para limpiar `permissions.py`, implementar los servicios y endpoints de revisión de Staff, documentar Swagger y `README.md`, y escribir los tests con `pytest`.

## 2026-11-23 — Validación de disponibilidad de la mascota al aprobar una solicitud de adopción (cierre BK-07)

- **Tarjeta:** #10 (BK-07, ajuste pedido por Franco al aprobar el PR #113)
- **Rama:** bugfix/bk07-10-validar-mascota-al-aprobar
- **Área:** back, test, docs
- **Qué hice:**
  - En `AdoptionRequestReviewWorkflow` (`backend/apps/adoptions/services.py`), agregué dentro de la transacción atómica (`select_for_update().select_related("pet")`) la validación de que la mascota siga activa y en estado `published` al aprobar una solicitud (`ValidationError` en `pet` con `"Esta mascota ya no está disponible para adopción."`).
  - Mantuve habilitado el rechazo (`reject`) incluso si la mascota ya fue adoptada o dada de baja para que las solicitudes pendientes no queden colgadas en la cola de Staff.
  - Sumé tests en `test_review_services.py` y `test_review_api.py` cubriendo aprobar (`400`) y rechazar (`200`) sobre mascotas adoptadas, no publicadas o inactivas, y actualicé Swagger (`views.py`) y `README.md`.
- **Decisiones tomadas:**
  - Controlé la disponibilidad de la mascota con un flag `require_available_pet` dentro de `_apply_review` (`True` en `approve`, `False` en `reject`) sobre la fila bloqueada junto con `select_related("pet")`, evitando duplicar la transacción.
- **Problemas y cómo los resolví:**
  - Sin bloqueos; todas las validaciones (`ruff`, `spectacular --validate --fail-on-warn` y `pytest`) pasaron en verde.
- **Pendiente:** abrir el PR hacia `develop` con `Closes #10` para revisión de Franco y cerrar la épica `[BK-07] Solicitudes de adopción`.
- **PR:** #114
- **IA usada:** Antigravity — para agregar la validación de disponibilidad de la mascota al aprobar, los tests con `pytest` y actualizar Swagger, `README.md` y la bitácora.

## 2026-11-23 — Ruta /mascotas/[id], barra superior, carrusel de fotos y estados de carga/error (FR-07a)

- **Tarjeta:** #118 (FR-07a, sub-tarjeta de #25 FR-07)
- **Rama:** feature/fr07-118-ruta-carrusel-ficha
- **Área:** front, test, docs
- **Qué hice:**
  - Dividí la épica #25 (FR-07) en dos sub-tarjetas funcionales (#118 FR-07a y #119 FR-07b), las colgué como sub-issues de #25 en GitHub, me asigné #25, #118 y #119 y moví #25 y #118 a "En curso" en el tablero.
  - Creé los tipos (`src/lib/pets/types.ts`) y el cliente de lectura (`src/lib/pets/api.ts`) consumiendo `GET /api/pets/{id}/` a través de `src/lib/api/client.ts`, con validación de ID (`parsePetId`), normalización de URLs de fotos (`resolvePetImageUrl`), edad legible alineada a `backend/apps/pets/badges.py` (`formatPetAge`) y manejo de sesión Bearer con renovación/fallback público ante `401`.
  - Implementé la ruta dinámica `/mascotas/[id]` (`src/app/mascotas/[id]/page.tsx`) y `PetDetailView` con barra superior fija (`BackButton` en modo `iconOnly` hacia `/adopciones` + nombre truncado), título dinámico del documento, `LoadingScreen` mientras espera, vista `"No encontramos esta mascota"` en `404`/ID inválido y aviso de error con reintento usando `ApiError`.
  - Envolví `AppHeader` y `AlertFab` en `<Suspense>` dentro de `src/app/layout.tsx` para cumplir con `cacheComponents: true` de Next 16 al incorporar la primera ruta dinámica del proyecto.
  - Implementé `PetPhotoCarousel` fiel a `contexto-ia/maquetado/mascota.html` adaptado a Tailwind 4 (`scroll-snap`, `@utility no-scrollbar`, contador `1 / N`, flechas desde `sm:`, puntitos táctiles de 44×44 px, degradado inferior fijo `bg-linear-to-t` con `line-clamp-2` y botón `"Ver más"` solo cuando el texto se corta).
  - Escribí 18 tests nuevos con Vitest y Testing Library (`api.test.ts`, `PetPhotoCarousel.test.tsx` y `PetDetailView.test.tsx`, 73 tests en total pasando) y realicé la comparación visual en navegador contra `mascota.html` en 375 px y 1280 px, modo claro y oscuro.
- **Decisiones tomadas:**
  - En `PetDetailView` derivé el estado de carga a partir de una clave `petId:reloadCount` para evitar `setState` sincrónico dentro de `useEffect` (regla `react-hooks/set-state-in-effect` de React 19).
  - Usé `next/image` con `fill` y `unoptimized` en el carrusel para cumplir `@next/next/no-img-element` sin bloquear imágenes servidas desde `localhost:8000` o almacenamiento externo.
  - Dejé sin renderizar el botón de favorito (`♡`) hasta que se integre `BK-05 (#8)`, evitando heredar `LocalStorage` del maquetado.
- **Problemas y cómo los resolví:**
  - Al correr `npm run build`, Next 16 (`cacheComponents: true`) rechazó `usePathname()` fuera de `<Suspense>` en `AppHeader` y `AlertFab` al prerenderizar la primera ruta dinámica; lo resolví envolviendo ambos en `<Suspense>` en `layout.tsx` según `use-pathname.md`.
  - En la comparación visual en navegador la scrollbar horizontal del carrusel seguía visible porque `.no-scrollbar` estaba fuera de `@utility` en Tailwind 4; la pasé a `@utility no-scrollbar` en `globals.css` y verifiqué en el navegador que desapareció por completo.
- **Pendiente:** abrir el PR de #118 hacia `develop` para revisión de Franco y continuar con #119 (FR-07b: insignias calculadas, padrinos, desplegables, acciones y estado adoptada).
- **PR:** #121
- **IA usada:** Antigravity — para dividir la épica, implementar el cliente de mascotas, la ruta `/mascotas/[id]`, el carrusel, los tests con Vitest y la comparación visual en navegador.

## 2026-11-23 — Insignias calculadas, padrinos, desplegables de información, acciones y estado adoptada (FR-07b)

- **Tarjeta:** #119 (FR-07b, sub-tarjeta de #25 FR-07)
- **Rama:** feature/fr07-119-insignias-desplegables-acciones
- **Área:** front, test, docs
- **Qué hice:**
  - Apliqué las sugerencias de Franco del PR #121: extraje `requestWithAuth` en `src/lib/auth/session.ts` para centralizar el envío del token Bearer, la renovación ante `401` y el fallback público (reutilizado en `fetchCurrentUser` y `fetchPetById`), y eliminé `formatPetAge` de `src/lib/pets/api.ts` junto con sus tests para que la regla de edad viva únicamente en el backend.
  - Implementé `PetBadges` (`src/components/pets/PetBadges.tsx`) fiel a `mascota.html` y `js/mascota.js`, renderizando las `badges` calculadas por el servidor (`BK-04`) con los SVG de línea 24×24, los tonos en modo claro/oscuro, botones circulares de 48 px y la leyenda accesible (`aria-live="polite"`) ante click, hover y foco con teclado.
  - Implementé `PetInfoAccordions` (`src/components/pets/PetInfoAccordions.tsx`) con el bloque de padrinos y los 3 desplegables `<details>` cerrados por defecto (`Descripción`, `Estado de salud` y `Notas`), filas de convivencia (`✓ Sí`, `✗ No`, `? Sin evaluar`) y extracción de la edad desde la insignia `age` calculada por el servidor.
  - Implementé `PetActions` (`src/components/pets/PetActions.tsx`) con banner `"¡Ya encontró hogar! 🧡"` (sin postulación) cuando `status === "adopted"`, botón `"¡Adoptame!"` con `AuthRequiredModal` sin sesión (`?redirect=/mascotas/[id]`) y gancho preparado para `FR-09`, enlace `"Donaciones y Apadrinamiento"` y `"📤 Compartir a <nombre>"` (Web Share API con fallback a WhatsApp).
  - Integré todos los bloques en `PetDetailView` conectando `"Ver más"` del carrusel para abrir y scrollear a `Descripción`.
  - Escribí tests nuevos con Vitest y Testing Library (`session.test.ts`, `PetBadges.test.tsx` y `PetDetailView.test.tsx`) y completé la comparación visual en navegador en 375 px y 1280 px, modo claro y oscuro, verificando también la carga HTTP 200 de las fotos semilla de Loki tras el PR #122, el caso urgente de Rocco (`/mascotas/3`) y el estado adoptado de Pancho (`/mascotas/7`).
  - Apliqué los ajustes de la revisión del PR #128: resolví el merge con `develop` (conservando `fetchPets` de FR-05 y el `waitFor` del título en `PetDetailView.test.tsx`), expuse `age_label` calculado en `PetPublicSerializer` y `PetManageSerializer` (con Swagger, `README.md` y tests en `test_badges_api.py`), migré `PetInfoAccordions` y `formatPetSummaryLine` a `age_label` eliminando por completo `formatPetAge` del front, quité los textos de relleno `DEFAULT_HEALTH` y `DEFAULT_NOTES` para mostrar solo filas reales (o `"Sin información cargada. Consultá con el rescatista."`), corregí `"No castrada"` para hembras y sumé los tests correspondientes.
- **Decisiones tomadas:**
  - Centralicé la lógica de renovación de JWT en `requestWithAuth` en `session.ts` con `allowPublicFallback` para que tanto endpoints privados como públicos con vista enriquecida compartan un único flujo sin duplicar código.
  - Expuse `age_label` desde el back usando `format_pet_age` ya existente en `apps/pets/badges.py` (sin tocar modelos ni migraciones) para que ni la ficha ni el inicio dupliquen reglas de edad ni parseen textos de insignias.
  - Dejé el enlace `"Donaciones y Apadrinamiento"` apuntando a `/donaciones#apadrinar` (documentado en el PR #128) hasta que se implemente la pantalla `/apadrinar` en `FR-14`.
- **Problemas y cómo los resolví:**
  - En `PetDetailView.test.tsx`, la aserción de `document.title` corría un tick antes del efecto tras montar el árbol completo con los nuevos bloques; la moví dentro de `waitFor` y quedó estable y en verde.
  - Al mergear `develop` (con FR-05), `formatPetSummaryLine` dependía de `formatPetAge`; al agregar `age_label` en el back y pasarlo a `format.ts` y `testing.ts`, quedó eliminada toda lógica de cálculo de edad del front manteniendo el inicio y la ficha en verde.
- **Pendiente:** que Franco revise los ajustes del PR #128 y cierre la épica #25 (`[FR-07] Ficha de mascota`) una vez mergeado.
- **PR:** #128
- **IA usada:** Antigravity — para refactorizar `requestWithAuth`, implementar `PetBadges`, `PetInfoAccordions` y `PetActions`, escribir los tests con Vitest y realizar la comparación visual en navegador.

## 2026-11-25 — Publicar mascota en adopción con validaciones, fotos y confirmación en revisión (FR-08a)

- **Tarjeta:** #154 (FR-08a, sub-tarjeta de #26 FR-08)
- **Rama:** feature/fr08-154-publicar-mascota
- **Área:** front, test, docs
- **Qué hice:**
  - Dividí la épica #26 (FR-08) en tres sub-tarjetas por funcionalidad (#154 FR-08a, #155 FR-08b y #156 FR-08c), las colgué como sub-issues de #26 en GitHub, me asigné la épica y las sub-tarjetas, y moví #26 y #154 a "En curso" en el tablero.
  - Extendí `frontend/src/lib/api/client.ts` para soportar `FormData` (`multipart/form-data` sin fijar `Content-Type` manual) con su test en `client.test.ts`, y agregué `createPet` en `frontend/src/lib/pets/api.ts` reutilizando `requestWithAuth` sobre `POST /api/pets/` (con tests en `api.test.ts`).
  - Creé `frontend/src/lib/pets/form.ts` con el esquema `zod` (`petFormSchema`), los valores iniciales (castración y sociabilidad sin opción marcada, convivencia en `"Sin evaluar"`), cálculo de `estimated_birth_date`, validación de imágenes (JPG/PNG/WEBP ≤ 5 MB) y armado de `FormData` (`buildCreatePetFormData`), cubierto con 11 tests unitarios en `form.test.ts`.
  - Implementé el componente reutilizable `PetForm` (`src/components/pets/PetForm.tsx`), `PublishPetView` y la ruta protegida `/adopciones/publicar` (`RequireAuth` con `LoadingScreen`), fiel a `contexto-ia/maquetado/adopciones.html` adaptado a Tailwind 4, WCAG AA y modo claro/oscuro: sin vista previa de insignias, contadores en cuidados especiales (`0 / 150`) y descripción (`0 / 400`), carga de una o más fotos con vista previa y botón para quitar cada una, botón deshabilitado en gerundio (`"Publicando..."`), errores por campo del back y confirmación `"¡Publicación enviada!"` (o `"¡Publicación publicada!"` para Admin).
  - Conecté el enlace `"Publicar"` en `MobileMenu.tsx` y el botón `+ Publicar` en `AdoptionCatalog.tsx` hacia `/adopciones/publicar`.
  - Escribí 7 tests de integración en `PublishPetView.test.tsx` (35 archivos y 218 tests pasando, `lint`, `format:check`, `typecheck` y `build` en verde) y realicé la comparación visual en navegador contra `adopciones.html` en 375 px y escritorio, modo claro y oscuro.
  - Apliqué los ajustes de la revisión del PR #157: actualicé el texto de ayuda del teléfono en `PetForm.tsx` al texto exacto de `03-reglas-de-negocio.md` (con su aserción en `PublishPetView.test.tsx`), cambié el título de éxito para Admin a `"¡Mascota publicada!"` y documenté en la descripción del PR los botones de la pantalla de éxito.
- **Decisiones tomadas:**
  - Implementé la publicación en la ruta dedicada `/adopciones/publicar` en lugar de un modal dentro de `AdoptionCatalog.tsx` para evitar conflictos con `FR-06b/c` (en curso por Ulises) y dejar `PetForm` listo para reutilizar en edición (`FR-08c`).
  - Prellenado automático del teléfono de contacto con el del perfil autenticado (`user.phone`) cuando existe, manteniendo el campo editable y obligatorio.
- **Problemas y cómo los resolví:**
  - En la comparación visual en navegador detecté dos detalles: (1) al desenfocar un radio sin marcar, `react-hook-form` entregaba `null` y `z.enum` mostraba un error técnico crudo; lo resolví usando `z.custom<TriBooleanOption>` en `form.ts`; (2) al enviar todo vacío, la foto obligatoria no mostraba su error hasta que el resto de los campos pasaban `zod`; lo resolví agregando `onInvalidSubmit` en `PetForm.tsx`. Ambos casos quedaron cubiertos con tests.
- **Pendiente:** que Franco revise los ajustes del PR #157 para continuar con #155 (FR-08b: Mis publicaciones, marcar adoptada y dar de baja).
- **PR:** #157
- **IA usada:** Antigravity — para dividir la épica, extender el cliente API con `FormData`, implementar `PetForm` y `/adopciones/publicar` con validación `zod`, escribir los tests con Vitest y realizar la comparación visual en navegador.

## 2026-11-25 — Mis publicaciones: listado propio, marcar adoptada y dar de baja (FR-08b)

- **Tarjeta:** #155 (FR-08b, sub-tarjeta de #26 FR-08)
- **Rama:** feature/fr08-155-mis-publicaciones
- **Área:** front, test, docs
- **Qué hice:**
  - Agregué `fetchMyPets` (`GET /api/pets/mine/` con filtro opcional por estado y paginación), `adoptPet` (`POST /api/pets/{id}/adopt/`) y `deactivatePet` (`DELETE /api/pets/{id}/`) en `frontend/src/lib/pets/api.ts` reutilizando `requestWithAuth`, con 3 tests unitarios en `api.test.ts`.
  - Implementé `MyPetCard` (`src/components/pets/MyPetCard.tsx`) reutilizando `getPetCoverPhotoUrl`, `formatPetSummaryLine` (`age_label`) y `PetSociabilityTag`, con insignias por estado (`En revisión`, `Publicada`, `¡Ya encontró hogar! 🧡`, `Rechazada`), enlace `"Ver ficha"`, botón `"Marcar adoptada"` solo en `published`, `"Dar de baja"` y aviso de estado final con `"Cargar nueva"` en `rejected`.
  - Implementé `MyPetActionModals` (`AdoptPetModal` con nota opcional ≤ 255 y `DeactivatePetModal`) con accesibilidad de diálogo (`role="dialog"`, `aria-modal`, cierre con `Escape`, foco inicial al abrir y retorno de foco al cerrar), botones deshabilitados en gerundio (`"Guardando..."` / `"Dando de baja..."`) y manejo de errores con `getActionErrorMessage`.
  - Implementé `MyPetsView` y la ruta protegida `/mis-publicaciones` (`RequireAuth`, `LoadingScreen`, pestañas por estado, paginación de a 12, manejo de error con reintento y estado vacío con CTA a `/adopciones/publicar`), y sumé el enlace `"🐾 Mis publicaciones"` en `MobileMenu.tsx` visible solo con sesión.
  - Escribí 6 tests en `MyPetsView.test.tsx` y 1 test nuevo en `MobileMenu.test.tsx` (36 archivos y 228 tests pasando, `format`, `lint`, `typecheck` y `build` en verde), y verifiqué la pantalla en navegador en 375 px y escritorio, modo claro y oscuro.
  - Apliqué los ajustes de la revisión del PR #158: moví `StaffDialog` al componente compartido `frontend/src/components/ui/ActionDialog.tsx` (`kickerTone` y `autoFocusClose`) reutilizado en `MyPetActionModals` y los 3 modales del panel de Staff, fijé el banner de feedback abajo en `MyPetsView.tsx` para que siempre se vea en 375 px, ajusté la concordancia de género según `pet.sex` y la frase neutra al dar de baja, y cambié `"pendiente de validación de Staff"` por `"pendiente de validación de un voluntario"` con sus tests.
- **Decisiones tomadas:**
  - Como "Mis publicaciones" no existe en el maquetado (`05-pantallas-y-recorridos.md`, "Pantallas que faltan"), la diseñé siguiendo el sistema de diseño de `02-diseno.md` y reutilizando las piezas compartidas (`PetSociabilityTag`, `formatPetSummaryLine`, `getPetCoverPhotoUrl`, `LoadingScreen`, `BackButton`, `RequireAuth`).
  - Dejé el botón `"Editar"` para `FR-08c (#156)` para no introducir enlaces a una ruta aún inexistente en `develop`.
- **Problemas y cómo los resolví:**
  - En la verificación visual en navegador detecté que al abrir los modales el foco quedaba en el botón disparador; agregué `closeButtonRef.current?.focus()` al montar `ActionDialog` para que el foco entre al diálogo al abrirlo y vuelva al disparador al cerrarlo.
- **Pendiente:** que Franco revise los ajustes del PR #158 para continuar con #156 (FR-08c: editar publicación y gestionar fotos del carrusel).
- **PR:** #158
- **IA usada:** Antigravity — para implementar los métodos de API, la pantalla `/mis-publicaciones` con filtros y modales de confirmación, los tests con Vitest y la verificación visual en navegador.
