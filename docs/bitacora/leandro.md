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
- **PR:** pendiente de apertura
- **IA usada:** Antigravity — para exponer `badges` en serializers y Swagger, escribir los tests de integración con `pytest` y actualizar `README.md`.
