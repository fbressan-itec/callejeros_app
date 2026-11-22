# Bitácora — Franco Nicolás Bressan Nadal

Formato de cada entrada: ver [LEEME.md](LEEME.md). Las entradas nuevas van al final.

## 2026-11-16 — Planificación del proyecto

- **Tarjeta:** — (antes de crear el tablero)
- **Rama:** — (todavía no hay repositorio)
- **Área:** docs
- **Qué hice:**
  - Analicé la consigna de la Práctica Profesionalizante y la nota del profesor.
  - Definí el alcance a partir del maquetado de Callejeros: qué se implementa, qué queda maquetado y qué no va.
  - Elegí el stack: Django + DRF + uv, Next + TypeScript + Tailwind, SQLite, Docker, pytest y Vitest.
  - Definí el flujo de trabajo (GitFlow simplificado, Conventional Commits, PR con revisión cruzada, GitHub Projects y GitHub Actions) y el orden de trabajo por funcionalidad.
  - Armé el contexto compartido para las IAs del grupo y la estructura inicial del repositorio.
- **Decisiones tomadas:** un solo repositorio; soy responsable de la base de datos y revisor de sus cambios; la bitácora se sube al repo.
- **Problemas y cómo los resolví:** —
- **Pendiente:** crear el repositorio, el tablero y las protecciones de ramas; arrancar BK-01 y DB-01.
- **PR:** —
- **IA usada:** Claude Code — para analizar la consigna, proponer alcance y stack, y redactar el contexto.

## 2026-11-16 — Configuración inicial del repositorio

- **Tarjeta:** #1 (parte de BK-01)
- **Rama:** feature/1-configuracion-repo
- **Área:** devops, docs
- **Qué hice:**
  - Creé el repositorio público `callejeros_app` con `main` y `develop`.
  - Configuré GitHub: solo *merge commit*, `develop` por defecto, protección de secretos y un ruleset que protege `main` y `develop` (sin push directo, PR con aprobación del dueño del código).
  - Armé el tablero Kanban con sus columnas, etiquetas de área y módulo, e hitos v0.1 a v1.0.
  - Agregué `CODEOWNERS`, las plantillas de PR y de tarjeta, el control de commits con `commitlint` en GitHub Actions, el README inicial y `.env.example`.
- **Decisiones tomadas:** soy el administrador del repo y mi aprobación es obligatoria en los PR de los demás; las ramas no se borran al mergear.
- **Problemas y cómo los resolví:** sin organización de GitHub no se puede restringir quién mergea; lo resolví exigiendo la aprobación del dueño del código con `CODEOWNERS`.
- **Pendiente:** invitar a Ulises y Leandro; cargar las tarjetas del orden de trabajo; sumar el control de commits como requisito del ruleset.
- **PR:** —
- **IA usada:** Claude Code — para configurar GitHub por consola y redactar los archivos.

## 2026-11-16 — Diseño del modelo de datos (DB-01)

- **Tarjeta:** #3 (DB-01), dividida en #43 (DB-01a), #44 (DB-01b) y #45 (DB-01c)
- **Rama:** feature/43-modelo-datos-cuentas, feature/44-modelo-datos-adopcion, feature/45-modelo-datos-comunidad
- **Área:** db, docs
- **Qué hice:**
  - Dividí la épica en tres sub-tarjetas (cuentas; adopción y colaborar; comunidad, índices y vista general) y las cargué como sub-issues de la #3.
  - Diseñé el modelo completo en el README con diagramas Mermaid `erDiagram`: convenciones comunes (`BaseModel` con `created_at`, `updated_at` e `is_active`), 18 tablas, restricciones de la base, índices de búsqueda y filtros, y una vista general con todas las relaciones.
  - Sumé como criterio en #5 (BK-02) y #21 (FR-03) el mínimo de 6 caracteres de la contraseña con su mensaje de error, y en #19 (FR-01) el Dockerfile del front.
  - Practiqué trabajar con dos PR abiertos a la vez: abrí DB-01c antes del merge de DB-01b y resolví el conflicto del README con `git merge develop`.
- **Decisiones tomadas:**
  - Baja lógica con `is_active` (lo que conozco; además coincide con el campo del usuario de Django).
  - Tablas de catálogo e historial donde suman: `Role`, `UserStatusLog` (baja por el usuario o por un Admin, y quién), `UserRoleLog`, `PetStatusLog` y `ProductStatusLog`. Quién hizo algo se guarda como clave foránea, no como nombre.
  - Salud de la mascota en una tabla aparte (`PetHealth`, uno a uno); comentarios de alertas y noticias en una sola tabla con un `CHECK`.
  - Favoritos en la base y no en el navegador (sincroniza entre dispositivos; lo pide el alcance).
  - El contacto de una solicitud aprobada sale de quien publicó la mascota, y Staff escribe el punto de encuentro (`meeting_point`).
  - Contraseña de mínimo 6 caracteres.
  - Diagramas en Mermaid dentro del README (se actualizan con texto y se ven en el PR).
- **Problemas y cómo los resolví:** el conflicto entre DB-01b y DB-01c mostró cinco bloques entrecruzados porque los diagramas se parecen; lo resolví dejando los dos bloques completos y verificando con el conteo de líneas que no se perdiera nada.
- **Pendiente:** — (los modelos se programan en cada tarjeta de back siguiendo este diseño)
- **PR:** #46, #47, #48
- **IA usada:** Claude Code — para proponer el diseño, explicar cada decisión y resolver el conflicto conmigo.

## 2026-11-17 — Proyecto base del backend (BK-01)

- **Tarjeta:** #4 (BK-01), dividida en #49 (BK-01a), #50 (BK-01b) y #51 (BK-01c)
- **Rama:** feature/49-proyecto-django, feature/50-calidad-ruff-pytest-ci, feature/51-docker-backend
- **Área:** back, test, devops, docs
- **Qué hice:**
  - Creé el proyecto Django 5.2 + DRF en `backend/` con uv y Python 3.13, con la configuración por `.env` (`django-environ`), CORS limitado al front, idioma `es-ar` y hora de Córdoba.
  - Agregué la app `core` con el `BaseModel` del diseño, incluido `deactivate()` para escribir la baja lógica una sola vez.
  - Configuré ruff y pytest, escribí 4 tests de `BaseModel` y un workflow de GitHub Actions que corre linter y tests en cada PR. Lo sumé como control obligatorio en la protección de `main` y `develop`.
  - Agregué `backend/Dockerfile`, `.dockerignore` y `docker-compose.yml`, y documenté en el README cómo levantar todo o cada parte, con y sin Docker.
- **Decisiones tomadas:**
  - Sin `requirements.txt`: `pyproject.toml` + `uv.lock` son la única lista de dependencias (se puede exportar si hace falta).
  - Cada tarjeta instala las librerías que usa (JWT, Swagger, filtros e imágenes llegan con BK-02 en adelante).
  - Un Dockerfile por parte y un `docker-compose.yml` en la raíz, porque el front y el back se hostean por separado.
  - El control del CI corre en todos los PR (no solo en los del back) para poder ser obligatorio.
  - No correr `migrate` hasta BK-02, porque el usuario propio tiene que existir antes de la primera migración.
- **Problemas y cómo los resolví:**
  - uv no pudo crear un acceso directo de Python en Windows; lo borré y uv usa la carpeta real de Python 3.13.
  - El CI falló porque `setup-uv@v10` no existe como etiqueta corta; lo arreglé fijando `v10.3.3` en un commit `fix(ci)`.
  - Docker Desktop estaba instalado pero apagado; lo abrí y probé la imagen, el compose y los tests dentro del contenedor.
- **Pendiente:** BK-02 (usuarios, roles y JWT) queda habilitada. El front de Docker y del README se completa en FR-01.
- **PR:** #52, #53, #54
- **IA usada:** Claude Code — para armar el proyecto paso a paso, explicar cada herramienta y probarlo.

## 2026-11-17 — Proyecto base del frontend (FR-01)

- **Tarjeta:** #19 (FR-01), dividida en #56 (FR-01a), #57 (FR-01b), #58 (FR-01c) y #59 (FR-01d)
- **Rama:** feature/56-proyecto-next, feature/57-calidad-front, feature/58-cliente-api, feature/59-plantilla-pr-comparacion, feature/59-docker-front
- **Área:** front, test, devops, docs
- **Qué hice:**
  - Creé el proyecto Next 16 con React 19, TypeScript estricto y Tailwind 4 en `frontend/`, con el tema del maquetado (colores, sombras, modo oscuro por clase) y las fuentes Inter y Poppins con `next/font`.
  - Configuré ESLint, Prettier (con orden automático de clases de Tailwind), Vitest y Testing Library, y un workflow de GitHub Actions para el front, que sumé como tercer control obligatorio en la protección de `main` y `develop`.
  - Armé el cliente de la API: una sola forma de llamar al back, con errores en un formato único (aviso general y errores por campo) y 11 tests. El front lee el mismo `.env` de la raíz que el back.
  - Agregué el Dockerfile del front y su servicio en el `docker-compose.yml`: back y front se levantan juntos o por separado.
  - Sumé a la plantilla de PR la sección "Comparación con el maquetado".
  - Actualicé el contexto de las IAs: Tailwind 4 con tabla de equivalencias, comparación obligatoria con el maquetado, aviso de Next 16 y la versión 2026-11-17.
- **Decisiones tomadas:**
  - Tailwind 4 y no 3 como el maquetado; decidido ahora porque migrar después obliga a revisar todas las pantallas y genera conflictos en las ramas de todos. El responsive y el mobile first no cambian.
  - La tabla de equivalencias de clases (3 → 4) vive en `contexto-ia/producto/02-diseno.md`, que es lo que leen las IAs; el README no la repite.
  - Cada pantalla se compara con su HTML del maquetado (375px y escritorio, claro y oscuro, estados) y el PR lista las diferencias. Sin capturas: reviso yo a mano.
  - Desactivé el `AGENTS.md` que genera Next 16 para que las IAs lean un solo archivo de reglas.
  - La API del back va a vivir bajo `/api/` (lo sumé como criterio en #5).
  - En Docker, el front usa `--watch` en lugar de un volumen espejo.
- **Problemas y cómo los resolví:**
  - La tabla de equivalencias tenía errores (nombre de `flex-shrink-0`, color por defecto de `ring`) y la receta de foco usaba `outline-none`; los corregí con la revisión del contexto.
  - Las fuentes con `@theme` normal podían quedar en la fuente genérica sin error; las pasé a `@theme inline`.
  - Vitest 5 pedía los tipos de Node 22 y el proyecto traía los de 20; los actualicé.
  - La verificación de tipos fallaba en el CI porque Next genera tipos dentro de `.next`; el script corre `next typegen` antes.
  - En Windows, Next no veía los cambios dentro de Docker; lo resolví con `docker compose --watch` (los cambios se ven en unos 2 segundos).
- **Pendiente:** pasarles `AGENTS.md` y `contexto-ia/` a Ulises y Leandro. Quedan habilitadas BK-02 (usuarios, roles y JWT) y FR-02 (layout).
- **PR:** #60, #61, #62, #63, #64
- **IA usada:** Claude Code — para armar el front paso a paso, explicar cada decisión, revisar el contexto de las IAs y probar todo en el navegador y en Docker.

## 2026-11-17 — Cierre de sesión: Wiki, capturas y plan de la base

- **Tarjeta:** — (planificación). Cambios de criterios en #5, #6, #8, #10, #11, #12, #13, #14, #15, #16 y #37 (DB-02)
- **Rama:** feature/37-bitacora-cierre-sesion (solo esta entrada)
- **Área:** docs, db
- **Qué hice:**
  - Probé la Wiki de GitHub con una versión de ejemplo: portada, "Cómo trabajamos", "Cronología del proyecto" con capturas de FR-01 y BK-01, barra lateral y pie de página.
  - Armé una carpeta personal de capturas del avance (`docs/capturas/`, ignorada solo en mi compu), nombradas por número de tarjeta como si fueran versiones.
  - Redefiní cómo se puebla la base: cada tarjeta de back suma sus datos de prueba a un comando `seed` y DB-02 pasa a revisarlo y completarlo. Actualicé 11 tarjetas y el plan del grupo.
  - Corregí en las tarjetas BK-03 y BK-07 los nombres de los estados (en inglés, como el diseño de la base).
  - Comparé las 37 tarjetas abiertas con `orden-de-trabajo.md`: coinciden en alcance.
  - Probé el acuerdo de revisión: Ulises aprobó y mergeó un PR mío.
- **Decisiones tomadas:**
  - Solo los 4 roles (`Role`) se cargan con una migración de datos: es la única tabla de catálogo. Los datos de prueba van en el comando `seed`, nunca en migraciones (correrían también en producción y en los tests). El primer Admin se crea con `createsuperuser`, sin contraseñas en el código.
  - Las capturas son personales; la Wiki se trabaja directo en su propio repositorio.
  - No hace falta una regla obligatoria para que las IAs lean la tarjeta: alcanza con que el plan y las tarjetas no se contradigan, y con que cada integrante le pase la tarjeta a su IA al empezar.
  - Acuerdo del equipo: Ulises y Leandro me avisan al terminar, yo reviso, apruebo y mergeo; en una emergencia se aprueban entre ellos.
- **Problemas y cómo los resolví:**
  - La tabla de la portada de la Wiki no mostraba los enlaces (el `|` de los enlaces de la Wiki corta la tabla); los cambié por enlaces comunes.
  - Una captura de 375px salió cortada (el navegador sin ventana no achica a menos de unos 500px); la volví a sacar con el navegador integrado.
- **Pendiente:** pasarles `AGENTS.md` y `contexto-ia/` (versión 2026-11-17) a Ulises y Leandro; que Leandro acepte la invitación; arrancar BK-02 y FR-02.
- **PR:** este
- **IA usada:** Claude Code — para armar la Wiki paso a paso, revisar el plan contra las tarjetas y actualizar las tarjetas en GitHub.

## 2026-11-17 — Cambio de convención de nombres de ramas y tarjeta GE-01

- **Tarjeta:** #67 (GE-01, gestión y documentación del proyecto)
- **Rama:** feature/ge01-67-convencion-ramas
- **Área:** docs, devops
- **Qué hice:**
  - Cambié el formato de las ramas de `feature/<n°>-<descripción>` a `feature/<épica>-<n°>-<descripción>`, para que queden agrupadas por épica al ordenarlas.
  - Creé la tarjeta permanente GE-01 (#67) para el trabajo de gestión que no es de ninguna funcionalidad.
  - Renombré en GitHub las ramas existentes (los commits no cambian; los commits de merge y los PR conservan el nombre viejo):

    | Nombre viejo | Nombre nuevo |
    | :--- | :--- |
    | `feature/43-modelo-datos-cuentas` | `feature/db01-43-modelo-datos-cuentas` |
    | `feature/44-modelo-datos-adopcion` | `feature/db01-44-modelo-datos-adopcion` |
    | `feature/45-modelo-datos-comunidad` | `feature/db01-45-modelo-datos-comunidad` |
    | `feature/49-proyecto-django` | `feature/bk01-49-proyecto-django` |
    | `feature/50-calidad-ruff-pytest-ci` | `feature/bk01-50-calidad-ruff-pytest-ci` |
    | `feature/51-docker-backend` | `feature/bk01-51-docker-backend` |
    | `feature/56-proyecto-next` | `feature/fr01-56-proyecto-next` |
    | `feature/57-calidad-front` | `feature/fr01-57-calidad-front` |
    | `feature/58-cliente-api` | `feature/fr01-58-cliente-api` |
    | `feature/59-docker-front` | `feature/fr01-59-docker-front` |
    | `feature/19-bitacora-fr01` | `feature/fr01-19-bitacora` |
    | `feature/37-bitacora-cierre-sesion` | `feature/ge01-67-bitacora-cierre-sesion` |

    `feature/1-configuracion-repo` quedó igual: es anterior al tablero. Las ramas `feature/4-bitacora-db01-bk01` y `feature/59-plantilla-pr-comparacion` ya no existían en GitHub; sus commits están en `develop`.
  - Actualicé la regla en el README, la plantilla de PR, la guía de la bitácora y el contexto de las IAs (`AGENTS.md`, `01-reglas-de-la-consigna.md`, `flujo-de-trabajo.md`, `orden-de-trabajo.md`, `decisiones.md`; versión 2026-11-17c).
  - Agregué un control automático (`nombre de rama`, en `.github/workflows/branch-name.yml`) que falla si la rama del PR no sigue el formato. Lo probé con 16 nombres válidos e inválidos.
- **Decisiones tomadas:**
  - El código de la épica va primero (`db01`, `bk02`, `fr02`, `ge01`) y después el número de la sub-tarjeta, que es la que cierra el PR.
  - Renombrar ahora y no más adelante: hoy eran 12 ramas y nadie más había empezado.
  - Las entradas viejas de esta bitácora no se editan (regla del grupo): la tabla de arriba es la referencia entre nombres viejos y nuevos.
  - El trabajo de gestión va en GE-01 con `Refs #67` (no `Closes`), y no con un código inventado, para mantener la trazabilidad entre el tablero y los PR que pide la consigna.
- **Problemas y cómo los resolví:** la bitácora de cierre anterior usaba el número de DB-02 sin ser de esa tarjeta; ahora esa rama pertenece a GE-01.
- **Pendiente:** pasarles a Ulises y Leandro `AGENTS.md` y `contexto-ia/` (versión 2026-11-17b) y pedirles que corran `git fetch --prune`.
- **PR:** este
- **IA usada:** Claude Code — para proponer la convención, renombrar las ramas y actualizar las reglas.

## 2026-11-19 — Revisión de PR, estado de carga y arreglo de la carga del `.env` en el front

- **Tarjeta:** #77 (BF-01, bugfix y correcciones chicas)
- **Rama:** bugfix/bf01-77-carga-env-raiz-front
- **Área:** front, devops, docs
- **Qué hice:**
  - Revisé las correcciones del PR #88 (BK-03a, Ulises) y los PR #92 (FR-03a, login y rutas protegidas) y #93 (FR-03b, registro) de Leandro, probando cada uno en una copia aparte del repo.
  - Definí el **estado de carga** (no está en el maquetado): un único componente compartido `LoadingScreen` para toda espera de datos, y botones deshabilitados con el texto en gerundio al enviar. Lo agregué al contexto de las IAs y como criterio en las tarjetas del front que cargan datos (#23 a #36) y en #89.
  - Arreglé `frontend/next.config.ts`: con `npm run dev` fuera de Docker, el front no leía el `.env` de la raíz y faltaban `NEXT_PUBLIC_API_URL` y el código `MOCK_VERIFICATION_CODE`. Ahora `loadEnvConfig` fuerza la lectura (`forceReload`).
- **Decisiones tomadas:**
  - `LoadingScreen` de página completa con `min-h-[60vh]`, para que el pie no suba mientras carga. Los *skeletons* quedan anotados como idea para el final del proyecto.
  - El enmascarado del teléfono del registro (`+54 •••• 456`) se queda así aunque muestre menos dígitos que el maquetado, porque da más privacidad.
- **Problemas y cómo los resolví:**
  - Next lee `frontend/` antes de cargar `next.config.ts` y `@next/env` reusa esa lectura, así que la segunda llamada no hacía nada. Lo reproduje con un script y lo comprobé con `npm run dev`: con el arreglo llegan las variables y el registro muestra el código `8596`.
  - A mi `.env` le faltaba `MOCK_VERIFICATION_CODE` (se agregó al `.env.example` el 2026-11-18); lo agregué y avisé a Ulises y Leandro que revisen el suyo.
- **Pendiente:** que Ulises y Leandro actualicen su `.env` y hagan `git pull` cuando se mergee este PR.
- **PR:** este
- **IA usada:** Claude Code — para revisar y probar los PR, definir el estado de carga y encontrar y arreglar el error de la carga del `.env`.

## 2026-11-20 — Cierre de la versión v0.1: README y capturas

- **Tarjeta:** #67 (GE-01, gestión)
- **Rama:** feature/ge01-67-version-v01
- **Área:** docs
- **Qué hice:**
  - Comprobé que el hito v0.1 está completo (42 tarjetas cerradas, ninguna abierta) y preparé el pase de `develop` a `main`, como pide la consigna al cerrar cada hito.
  - Agregué al README las **cuentas de prueba** del `seed` (una por rol, con lo que permite probar cada una) y el código de verificación maquetado (`MOCK_VERIFICATION_CODE`, `8596` por defecto).
  - Agregué la sección **Versiones** (qué trae cada hito y en qué estado está) y la versión actual arriba de todo.
  - Completé los usuarios de GitHub de Ulises y Leandro en la tabla del equipo.
  - Saqué las capturas de FR-03 (login en celular, claro y oscuro, con errores de validación, registro, recuperar y escritorio) para la Wiki.
- **Decisiones tomadas:**
  - La tabla de cuentas no muestra una contraseña real: remite a `SEED_USER_PASSWORD` del `.env` y da el valor de ejemplo del `.env.example`, que ya es público.
  - BK-03a (modelos de mascotas) ya está en `develop` y entra en la v0.1 como adelanto de v0.2: funciona sola, y el flujo es pasar `develop` entera a `main`.
  - La Wiki se arma después de definir entre todos sus secciones.
- **Problemas y cómo los resolví:** en las capturas del front aparecía el botón de desarrollo de Next; las saqué sobre la versión de producción (`next build` + `next start`).
- **Pendiente:** PR `develop` → `main`, etiqueta `v0.1`, Release, cerrar el hito y armar la Wiki.
- **PR:** este
- **IA usada:** Claude Code — para revisar el hito, redactar el README y sacar las capturas.

## 2026-11-22 — Revisión de publicaciones por Staff: aprobar y rechazar (BK-06a)

- **Tarjeta:** #103 (BK-06a, sub-tarjeta de la épica #9, BK-06)
- **Rama:** feature/bk06-103-aprobar-rechazar-publicaciones
- **Área:** back, test, docs
- **Qué hice:**
  - Dividí la épica BK-06 (#9) en tres sub-tarjetas: aprobar y rechazar (#103), validar el caso urgente (#104) y la cola de revisión del panel (#105). Me asigné la épica y la #103 y las pasé a "En curso".
  - Armé el **flujo de revisión reutilizable** (`ReviewWorkflow` en `apps/core/review.py`): controla el rol, el estado, el motivo y el historial en un solo lugar. Las mascotas lo usan con `PetReviewWorkflow`; los productos (BK-12, #15) lo van a usar con una clase hija de pocas líneas, que dejé de ejemplo en el código.
  - Agregué los endpoints `POST /api/pets/{id}/approve/` y `POST /api/pets/{id}/reject/`, solo para Staff y Admin.
  - El Admin publica mascotas sin revisión y, si marca "urgente", queda validado.
  - Una mascota rechazada ya no se puede editar ni cambiar sus fotos (sí darla de baja).
  - Tests de servicios y de endpoints: permisos por rol, cambios de estado válidos e inválidos, historial, catálogo y Swagger. Actualicé Swagger y el README.
- **Decisiones tomadas:**
  - Una clase base con clases hijas para el flujo, en lugar de funciones sueltas o una tabla de historial genérica: no toca la base, deja configurado cada caso en un lugar y tiene ganchos (`on_approved`, `on_rejected`) para enchufar las notificaciones de BK-08 (#11).
  - Endpoints separados `/approve/` y `/reject/`, igual que `/adopt/`. Si la mascota no está en revisión, devuelve `400`.
  - El motivo es opcional; si Staff rechaza sin escribir nada, se guarda uno genérico ("Tu publicación no fue aprobada porque no cumple con las pautas de Callejeros Río Cuarto."), para no darle explicaciones a los trolls.
  - Siguen revisándose **todas** las publicaciones (no solo las urgentes): protege al catálogo de estafas y de venta de animales.
  - **Solo el Admin publica sin revisión** (Staff, Refugio verificado y Miembro pasan por revisión). Staff puede aprobar su propia publicación; queda en el historial y anotado en el código.
  - Una rechazada es final: para volver a intentar se carga de nuevo. El autor va a recibir el motivo por notificación (BK-08).
  - Las decisiones nuevas quedaron en el contexto de las IAs (`decisiones.md` y `03-reglas-de-negocio.md`) y en los criterios de la #103.
- **Problemas y cómo los resolví:** si dos personas de Staff revisan la misma mascota a la vez, la segunda podía pisar a la primera; el flujo bloquea la fila mientras revisa (`select_for_update`) y la segunda recibe el error.
- **Corrección de una entrada anterior:** en la entrada del 2026-11-20 (cierre de la v0.1) escribí "42 tarjetas cerradas", pero eran **27 tarjetas**; las otras 15 eran PR.
- **Pendiente:** abrir el PR de la #103 y dejar los avisos en la #15 (productos) y la #11 (notificaciones). Después, BK-06b (#104) y BK-06c (#105).
- **PR:** pendiente
- **IA usada:** Claude Code — para proponer la división y las opciones de diseño, escribir el código y los tests, y redactar la documentación.
