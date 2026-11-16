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
