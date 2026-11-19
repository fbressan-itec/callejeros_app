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
  - Agregué `min-h-[60vh]` a la variante `page` de `LoadingScreen` (sugerencia de la revisión del PR #92 para evitar que el pie de página suba en celular mientras carga) y documenté `NEXT_PUBLIC_MOCK_VERIFICATION_CODE=8596` en `.env.example` y en la tabla de variables de entorno del `README.md`.
  - Sumé `splitFullName` y `registerAccount` en `src/lib/auth/session.ts` para enviar `POST /api/auth/register/` (`email`, `password`, `first_name`, `last_name`, `phone` y `verification_code`) e iniciar sesión automáticamente al crear la cuenta.
  - Implementé la pantalla `/registro` (`src/app/registro/page.tsx`) en 3 pasos (+ pantalla de confirmación `"¡Teléfono Verificado!"`) fiel a `contexto-ia/maquetado/registro.html` adaptada a Tailwind 4:
    - Paso 1: nombre completo, correo electrónico, contraseña con botón mostrar/ocultar, casilla de términos, validación con `zod` (mínimo 6 caracteres con `"La contraseña debe tener al menos 6 caracteres"`), visualización debajo del campo de contraseña de los errores devueltos por el back (`"La contraseña tiene un valor demasiado común."` y `"La contraseña está formada completamente por dígitos."`), botones chicos y modernos de Google y Facebook maquetados (aclarados en comentario de código) y enlace a `/login`.
    - Paso 2: número de teléfono con opción `"Verificar"` (avanza al Paso 3) y `"Más tarde"` (registra la cuenta directamente sin verificar el teléfono).
    - Paso 3 (A6 maquetado): teléfono enmascarado, 4 casilleros OTP numéricos (con avance automático, retroceso con `Backspace` y pegado de 4 dígitos), mensaje en rojo con asterisco debajo del campo del código (`* Verificación por SMS maquetada: usá el código 8596.`), temporizador `(04:30)` y `"Reenviar código"`.
  - Escribí 6 tests nuevos con Vitest y Testing Library en `registro/page.test.tsx` y `session.test.ts` (50 tests en total pasando), y comparé `/registro` en el navegador contra `registro.html` en 375 px y escritorio, en modo claro y oscuro.
- **Decisiones tomadas:**
  - Si el backend devuelve errores de validación sobre los campos del Paso 1 (`email`, `password` o `first_name`) al intentar finalizar en el Paso 2 o 3, el formulario vuelve automáticamente al Paso 1 y muestra los mensajes del servidor debajo del campo correspondiente.
  - Reemplacé los `placeholder` poco serios del maquetado (`"Alt Efe Cuatro"`, `"alt_f4@mail.com"`) por `"Juan Pérez"` y `"tu@correo.com"` y agregué los atributos `autoComplete` (`name`, `email`, `new-password`, `tel`, `one-time-code`) según `06-de-maqueta-a-produccion.md`.
- **Problemas y cómo los resolví:**
  - ESLint advirtió sobre el arreglo de refs de los 4 casilleros OTP en el `useEffect` de foco inicial; lo resolví guardando los 4 elementos en un único `useRef<Array<HTMLInputElement | null>>`.
- **Pendiente:** abrir el PR de #90 hacia `develop` para revisión de Franco y continuar con #91 (FR-03c: pantalla de recuperar contraseña en 3 pasos maquetada).
- **PR:** pendiente de abrir
- **IA usada:** Antigravity — para implementar el servicio de registro, la pantalla `/registro` en 3 pasos con validación `zod`, sus tests con Vitest y la comparación visual en el navegador.
