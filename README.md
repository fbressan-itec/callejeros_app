# Callejeros Río Cuarto

Plataforma web comunitaria de **adopción responsable** y **alertas de animales en la calle** para Río Cuarto (Córdoba, Argentina). Conecta a refugios, particulares y vecinos: catálogo de mascotas en adopción, Alerta Callejeros para animales perdidos o en peligro, apadrinamiento, tienda solidaria y noticias.

Proyecto integrador de la **Práctica Profesionalizante II** — Tecnicatura Superior en Desarrollo de Software, ITEC, 2026.

> 🚧 **En desarrollo.** Este README se completa a medida que avanza el proyecto (arquitectura, base de datos, instalación, variables de entorno, tests y API).

## Equipo

| Integrante | GitHub |
| :--- | :--- |
| Franco Nicolás Bressan Nadal | [@fbressan-itec](https://github.com/fbressan-itec) |
| Ulises Cabrera | — |
| Leandro Odetto | — |

## Tecnologías

| Parte | Tecnologías |
| :--- | :--- |
| Backend | Python · Django · Django REST Framework · uv · pytest · ruff |
| Base de datos | ORM de Django · SQLite |
| Frontend | Next.js · TypeScript · Tailwind CSS · Vitest · ESLint |
| DevOps | Docker · GitHub Actions |
| Organización | GitHub Projects (Kanban) |

## Estructura

```
backend/    API REST (Django + DRF)
frontend/   Aplicación web (Next.js)
docs/       Documentación y bitácora del equipo
```

## Flujo de trabajo

- **Tablero Kanban:** [Callejeros — Tablero](https://github.com/users/fbressan-itec/projects/1). Cada tarea es una tarjeta con historia de usuario y criterios de aceptación.
- **Ramas (GitFlow simplificado):**
  - `main`: versiones entregables (v0.1, v0.2…);
  - `develop`: integración;
  - `feature/<n°>-<nombre>` y `bugfix/<n°>-<nombre>`: una por tarjeta, desde `develop`;
  - `hotfix/<nombre>`: errores urgentes en `main`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) (`feat(auth): agrega endpoint de login`). Se revisan automáticamente en cada PR.
- **Pull Requests:** todo entra a `develop` por PR, con revisión de código y *merge commit* (cada commit queda visible en el historial). `main` y `develop` están protegidas: no se puede subir directo.
- **Bitácora:** cada integrante registra su avance en [`docs/bitacora/`](docs/bitacora/LEEME.md).
