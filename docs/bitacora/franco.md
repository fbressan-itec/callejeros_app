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
