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

## 2026-11-22 — Revisión de publicaciones por Staff: validar el caso urgente (BK-06b)

- **Tarjeta:** #104 (BK-06b, sub-tarjeta de la épica #9, BK-06)
- **Rama:** feature/bk06-104-validar-caso-urgente
- **Área:** back, test, docs
- **Qué hice:**
  - Mergeé el PR #106 (BK-06a) y arranqué la segunda sub-tarjeta de BK-06.
  - Agregué el servicio `set_pet_urgency` y el endpoint `POST /api/pets/{id}/urgency/` (solo Staff y Admin) para validar o quitar la validación del "caso urgente" que pide quien publica.
  - Tests del endpoint y del servicio: permisos por rol, casos válidos e inválidos, historial, efecto en la insignia y en el filtro `urgent` del catálogo, y Swagger. Actualicé Swagger y el README.
- **Decisiones tomadas:**
  - Un solo endpoint que recibe `validated` (`true` o `false`), en lugar de dos rutas: es un sí/no y permite también quitar la validación cuando el animal deja de estar en riesgo.
  - Se puede usar en mascotas `in_review` (al revisar) o `published` (si la situación cambia después). No en adoptadas ni rechazadas, ni si quien publicó no pidió urgencia.
  - Cada cambio queda en `PetStatusLog` con el mismo estado antes y después y una nota, sin tocar la base, para tener todo el historial de la revisión en un solo lugar.
  - Pedir el valor que ya tiene responde `200` sin cambios ni registro, para que un doble clic no duplique el historial.
  - El servicio reusa `can_review` del flujo de revisión, así "quién revisa" se define en un solo lugar.
- **Problemas y cómo los resolví:** ninguno.
- **Pendiente:** PR de la #104; después, BK-06c (#105), la cola de revisión del panel.
- **PR:** pendiente
- **IA usada:** Claude Code — para proponer las opciones de diseño, escribir el código y los tests, y redactar la documentación.

## 2026-11-22 — Revisión de publicaciones por Staff: cola de revisión del panel (BK-06c)

- **Tarjeta:** #105 (BK-06c, sub-tarjeta de la épica #9, BK-06)
- **Rama:** feature/bk06-105-cola-revision-panel
- **Área:** back, test, docs
- **Qué hice:**
  - Mergeé el PR #107 (BK-06b) y arranqué la última sub-tarjeta de BK-06.
  - Agregué el servicio `get_review_queue_queryset` y el endpoint `GET /api/pets/review-queue/` (solo Staff y Admin): la lista paginada de las mascotas que esperan revisión, que va a usar la pantalla del panel de Staff (FR-10, #28).
  - Tests del endpoint y del servicio: contenido, orden, datos de la ficha de gestión, paginación, cola vacía, que una aprobada sale de la cola, permisos por rol y Swagger. Actualicé Swagger y el README.
- **Decisiones tomadas:**
  - Ruta `/api/pets/review-queue/`, junto a los demás endpoints de mascotas (como `/mine/`), en lugar de una sección `/api/staff/` aparte o de reusar el catálogo público (que podría exponer `contact_phone`).
  - Orden: primero las que pidieron caso urgente y, dentro de cada grupo, la más vieja primero, como una fila de atención.
  - Sin filtros por ahora (con pocas pendientes por día alcanza con el orden); quedó comentado en el código cómo sumarlos si FR-10 los necesita.
  - Cada mascota se devuelve con `PetManageSerializer`, la misma ficha de gestión que devuelven `/approve/`, `/reject/` y `/urgency/`, para no repetir código y que el front reciba siempre la misma forma.
- **Problemas y cómo los resolví:** para probar el orden por antigüedad, `created_at` se completa solo al crear (`auto_now_add`); en los tests lo ajusté después de crear cada mascota.
- **Pendiente:** PR de la #105 y, al mergearlo, cerrar la épica BK-06 (#9).
- **PR:** pendiente
- **IA usada:** Claude Code — para proponer las opciones de diseño, escribir el código y los tests, y redactar la documentación.

## 2026-11-23 — Fotos de las mascotas visibles en desarrollo (BF-01)

- **Tarjeta:** #77 (BF-01, bugfix y correcciones chicas)
- **Rama:** bugfix/bf01-77-servir-media-en-desarrollo
- **Área:** back, test, docs
- **Qué hice:**
  - Revisé los PR #113 y #114 (BK-07b y su corrección), #117 y #120 (BK-05a y BK-05b) y #121 (FR-07a).
  - Al revisar el #121 apareció que, levantando el proyecto, ninguna foto se veía: `/media/...` respondía 404 porque `config/urls.py` no tenía la ruta para servir las fotos subidas.
  - Agregué esa ruta en `backend/config/urls.py`, activa solo con `DEBUG`, y dos tests: en desarrollo la foto responde 200 y, con `DEBUG` apagado, Django no la sirve.
  - Probé con el back levantado: las fotos de Loki y las del catálogo responden 200 y se ven en el navegador.
- **Decisiones tomadas:**
  - Servir las fotos desde Django solo en desarrollo, como recomienda Django: en producción las tiene que servir el servidor web.
  - Mantener las reglas de BK-07: se pueden aprobar varias solicitudes para la misma mascota (aprobar habilita a conocerla, no la entrega) y Staff puede aprobar su propia solicitud (queda registrado quién la aprobó).
- **Problemas y cómo los resolví:** `config/urls.py` lee `DEBUG` una sola vez, al importarse; en los tests recargo el módulo después de cambiar `DEBUG`.
- **Pendiente:** PR de este arreglo con `Refs #77`; aprobar el #120 cuando Ulises suba la corrección del filtro `?favorites=false`.
- **PR:** pendiente
- **IA usada:** Claude Code — para revisar y probar los PR de Ulises y Leandro, y escribir el arreglo, sus tests y esta entrada.

## 2026-11-23 — Inicio: portada con carrusel institucional y secciones fijas (FR-05a)

- **Tarjeta:** #123 (FR-05a, sub-tarjeta de la épica #23, FR-05)
- **Rama:** feature/fr05-123-portada-inicio
- **Área:** front, test
- **Qué hice:**
  - Tomé la épica FR-05 (Inicio), revisé el maquetado, lo que ya había en develop y el endpoint `GET /api/pets/`, y la dividí en dos sub-tarjetas: FR-05a (#123, portada fija) y FR-05b (#124, mascotas y contador desde la API).
  - Reemplacé el inicio provisorio por la portada de `index.html`: carrusel institucional de 3 slides (se desliza con el dedo, puntitos de 44px, flechas desde tablet, autoavance cada 6 s que se pausa con el mouse o el foco y no corre con movimiento reducido), "Sobre Nosotros" y "¿Cómo podés colaborar hoy?".
  - Bajé las 4 fotos de Unsplash del maquetado a `frontend/public/images/inicio/`, con un comentario en el código que dice que son de prueba y qué muestra cada una.
  - Tests con Vitest del carrusel (flechas, puntitos, deslizar, autoavance, pausa y movimiento reducido) y de la portada (textos y enlaces).
  - Comparé con el maquetado en 375px y escritorio, claro y oscuro, midiendo altos y colores en las dos páginas.
- **Decisiones tomadas:**
  - El "carrusel de mascotas" de la tarjeta era un error: el carrusel del inicio es el institucional del maquetado, y las mascotas van en "Adoptá un Callejero" (FR-05b). Se corrige en #23 y en `contexto-ia/` en FR-05b.
  - "+150 Mascotas adoptadas" queda como dato institucional fijo, a modo de publicidad; en FR-05b se suma un recuadro "Mascotas en adopción" con el número real.
  - En escritorio, FR-05b va a mostrar 3 mascotas más la tarjeta "Explorar Catálogo" (4 columnas); en el celular y en tablet, 2.
  - Botones naranjas y verdes un tono más oscuros que el maquetado (`orange-700`, `emerald-700`) por contraste, como pide `02-diseno.md`.
- **Problemas y cómo los resolví:** Tailwind 4 aplica `leading-relaxed` / `leading-tight` aunque haya `sm:text-*` después (en Tailwind 3 ganaba el tamaño del breakpoint): el título del carrusel quedaba 24px más alto en escritorio. Lo igualé con clases de alto de línea explícitas por breakpoint.
- **Pendiente:** FR-05b (#124): mascotas desde la API, contador, estados de carga, error y vacío, funciones reutilizables y corrección del criterio en #23 y `contexto-ia/`.
- **PR:** pendiente
- **IA usada:** Claude Code — para revisar el maquetado y el back, proponer la división, escribir el código y los tests, y comparar con el maquetado en el navegador.

## 2026-11-23 — Inicio: últimas mascotas y contador desde la API (FR-05b)

- **Tarjeta:** #124 (FR-05b, sub-tarjeta de la épica #23, FR-05)
- **Rama:** feature/fr05-124-mascotas-inicio
- **Área:** front, test, docs
- **Qué hice:**
  - Mergeé el PR #125 (FR-05a) y arranqué la segunda sub-tarjeta.
  - Sección "Adoptá un Callejero" con las 3 mascotas publicadas más nuevas de `GET /api/pets/`: 2 en el celular y en tablet, 3 más "Explorar Catálogo" en escritorio. Con `LoadingScreen` mientras carga, el mensaje del cliente de la API si falla y "Todavía no hay mascotas publicadas. ¡Volvé pronto!" si no hay.
  - Recuadro "Mascotas en adopción" en "Sobre Nosotros" con el total real de publicadas, tomado del mismo pedido (`count`); muestra una raya mientras carga o si falla.
  - Piezas reutilizables para el catálogo (FR-06): `fetchPets`, `PaginatedResponse`, las funciones de `lib/pets/format.ts`, `PetSociabilityTag` y `buildPet` para tests. Quedaron anotadas en la tarjeta #24 y en `contexto-ia/producto/02-diseno.md`.
  - Corregí el criterio "carrusel de mascotas" en #23 y en `05-pantallas-y-recorridos.md`: el carrusel del inicio es el institucional.
  - Tests con Vitest del pedido, las funciones de formato, la tarjeta, la sección y la página (carga, contenido, error, vacío y contador). Comparé con el maquetado en 375px y escritorio, con datos reales del `seed` y con el back apagado.
- **Decisiones tomadas:**
  - Un solo pedido para las mascotas y el contador (sin cambios en el back): la API devuelve 12 y el inicio muestra las 3 primeras.
  - Tarjeta propia del inicio (`PetPreviewCard`), distinta de la del catálogo, pero con las funciones y la etiqueta compartidas.
  - Etiqueta "Salvaje" en ámbar con texto oscuro y "Sociable" en `emerald-700`, por contraste (el maquetado usaba rojo y `emerald-600`).
  - "Sin castrar" cuando no está castrada, igual que la insignia del servidor.
- **Problemas y cómo los resolví:** para ver el error en el navegador apagué el back un momento; para el vacío y la carga alcanzó con los tests.
- **Pendiente:** PR de la #124 y, al mergearlo, cerrar la épica #23.
- **PR:** pendiente
- **IA usada:** Claude Code — para escribir el código y los tests, comparar con el maquetado y actualizar las tarjetas y la documentación.

## 2026-11-23 — Test frágil del título de la ficha (BF-01)

- **Tarjeta:** #77 (BF-01, bugfix y correcciones chicas)
- **Rama:** bugfix/bf01-77-test-titulo-ficha
- **Área:** test
- **Qué hice:**
  - En el CI del PR #126 (FR-05b) falló un test de la ficha de mascota (`PetDetailView.test.tsx`, de FR-07a) que no tenía relación con el cambio: esperaba el título de la pestaña "Loki — Adoptá un Callejero — Callejeros Río Cuarto" y encontraba todavía "Ficha de Mascota — Callejeros Río Cuarto".
  - Volví a correr el control (salió en verde) y corregí el test: ahora también espera con `waitFor` a que cambie el título.
- **Decisiones tomadas:** arreglarlo en BF-01 y no en el PR del inicio, porque es de otra tarjeta y de otro integrante. Solo cambia el test, no el componente.
- **Problemas y cómo los resolví:** el título lo cambia un efecto que corre después de dibujar el nombre; en una máquina lenta, el test lo revisaba antes. En local no fallaba nunca.
- **Pendiente:** que Leandro actualice develop para tener el test corregido.
- **PR:** pendiente
- **IA usada:** Claude Code — para encontrar la causa del fallo en el CI, corregir el test y escribir esta entrada.

## 2026-11-24 — Cuestionario de adopción ampliado en el back (FR-09a)

- **Tarjeta:** #141 (FR-09a, sub-tarjeta de la épica #27, FR-09)
- **Rama:** feature/fr09-141-cuestionario-ampliado-back
- **Área:** back, db, test, docs
- **Qué hice:**
  - Definí el cuestionario de adopción con la IA. Primero lo comparé con el maquetado y con lo que ya hacía el back (BK-07). Después investigamos formularios de refugios y protectoras y guías de ASPCA y Best Friends, y armamos uno más completo.
  - Dividí la épica #27 en tres sub-tarjetas: back (#141), página de respuesta (#142) y cuestionario en la ficha (#143). Cambié el criterio de #27 y dejé comentarios en #29, #11 y #26 sobre las notificaciones y el teléfono al publicar.
  - Actualicé en local `contexto-ia/` (01, 03, 04, 05, 05b, 06 y `decisiones.md`) y anoté dos ideas en la ToDo List: "Obtener cuenta refugio" y punto de encuentro fijado por quien publica.
  - Cuestionario de 4 bloques en `AdoptionRequest`, con migración nueva, reglas en la base, validaciones en el servicio (alquiler, castración según la mascota y casillas de compromiso), serializer, Swagger, seed y tests.
  - Saqué el punto de encuentro: aprobar ya no pide datos (migración que borra `meeting_point`).
  - Campo `shelter_public_address` en `User` (migración nueva). El adoptante aprobado lo ve solo si quien publicó es Refugio verificado y lo cargó.
  - README: endpoints de adopción y diagrama entidad-relación.
- **Decisiones tomadas:**
  - El cuestionario del maquetado era una muestra: el nuevo pregunta por la vivienda (propia o alquilada), las protecciones, quiénes viven, la experiencia, las horas solo, dónde vive, quién lo cuida en viajes y qué haría si no puede seguir, más compromisos de castración, seguimiento, avisar antes de darlo y veracidad. Se dejaron afuera las preguntas invasivas (ingresos, estado civil, DNI y similares).
  - Sin punto de encuentro: los voluntarios no tienen tiempo de organizarlo. El adoptante recibe el teléfono de la publicación y coordinan entre ellos, con un aviso de encontrarse en un lugar público.
  - La dirección del refugio es un campo aparte y no la de la cuenta, porque muchos refugios funcionan en una casa particular.
  - Las solicitudes viejas (solo datos de prueba) quedan con textos vacíos y casillas en verdadero al migrar.
- **Problemas y cómo los resolví:**
  - `makemigrations` pedía valores por defecto para los campos nuevos, así que escribí la migración del cuestionario a mano y comprobé con `makemigrations --check` que coincide con el modelo.
  - No hay admin de Django para usuarios: por ahora la dirección del refugio se carga desde el seed.
  - La suite del back tarda unos 12 minutos: la corrí en segundo plano.
- **Pendiente:** PR de la #141; después, FR-09b (#142) y FR-09c (#143).
- **PR:** pendiente
- **IA usada:** Claude Code — para comparar el maquetado con el back, investigar cuestionarios de adopción, proponer las decisiones y la división, escribir el código, las migraciones y los tests, y actualizar la documentación.
