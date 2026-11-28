# Cómo trabajamos

Guía para sumar cambios al proyecto. Cómo levantarlo en tu compu: [docs/desarrollo.md](docs/desarrollo.md).

## Tablero y tarjetas

- Todo el trabajo está en el [tablero Kanban](https://github.com/users/fbressan-itec/projects/1). Cada tarea es una tarjeta con historia de usuario y criterios de aceptación.
- Las tarjetas grandes son **épicas** y se dividen en sub-tarjetas: cada una entrega algo que funciona solo, con sus tests.
- Antes de empezar, la tarjeta tiene que estar asignada a vos y en **En curso**.

## Ramas (GitFlow simplificado)

| Rama | Para qué |
| :--- | :--- |
| `main` | Versiones entregables (v0.1, v0.2…). Es la que se publica en Render y Vercel. Solo recibe `develop` por PR al cerrar un hito, con etiqueta. |
| `develop` | Integración: todo el trabajo entra acá. |
| `feature/<épica>-<n°>-<nombre>` · `bugfix/<épica>-<n°>-<nombre>` | Una por tarjeta, desde `develop` actualizado. Por ejemplo `feature/bk02-68-modelo-usuario`: épica BK-02, tarjeta #68. El trabajo de gestión va en la tarjeta GE-01 (#67). |
| `hotfix/<nombre>` | Errores urgentes en `main`. |

`main` y `develop` están protegidas: no se puede subir directo ni forzar cambios.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/), en español y en imperativo: `tipo(alcance): descripción`. Por ejemplo, `feat(auth): agrega endpoint de login`.

- **Tipos:** `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`, `ci`, `build`, `perf`.
- **Atómicos:** un commit por paso con sentido propio (una dependencia, un modelo, un endpoint, sus tests), no uno por archivo ni uno gigante al final.

## Pull Requests

1. Antes de subir, corré el linter y los tests del back y del front (ver [docs/desarrollo.md](docs/desarrollo.md)).
2. Abrí el PR hacia `develop` con la plantilla completa y `Closes #<n° de tarjeta>`.
3. GitHub Actions corre cuatro controles obligatorios: `commitlint`, `nombre de rama`, `backend (ruff + pytest)` y `frontend (eslint + vitest)`.
4. Franco revisa y aprueba. El merge es siempre con *merge commit*, para que cada commit quede visible en el historial.

## Reglas del código

- **Capas separadas en el back:** vistas y serializers (API) · servicios (reglas de negocio) · modelos (datos). Ver [docs/arquitectura.md](docs/arquitectura.md).
- **Permisos por rol en el back**, en cada endpoint. **Validación en dos capas:** front (`zod` + `react-hook-form`) y back.
- **Baja lógica**, nunca borrado físico de datos de negocio.
- **Toda regla de negocio lleva tests** (pytest en el back, Vitest en el front).
- **Cambios en la base:** siempre con una migración nueva; nunca se edita ni se borra una migración ya mergeada. En el mismo PR se actualiza [docs/base-de-datos.md](docs/base-de-datos.md) (y la vista general del README si cambian las tablas o sus relaciones).
- **API y documentación:** Swagger, el README y `docs/` se actualizan en el mismo PR que cambia lo documentado.
- **Idiomas:** el código en inglés; la interfaz, los commits, las ramas, los PR y la documentación en español rioplatense.
- **Cero secretos en el código:** todo va al `.env`, y cada variable nueva a `.env.example` con un valor falso.
- **Pantallas:** cada una se ve y se comporta como su HTML de referencia del [maquetado](https://github.com/fbressan-itec/callejeros_web).

## Ayuda

- **Discussions:** [preguntas frecuentes, ideas y anuncios del equipo](https://github.com/fbressan-itec/callejeros_app/discussions). Las guías para trabajar en el proyecto:
  - [¿Cómo empiezo a trabajar en una tarjeta?](https://github.com/fbressan-itec/callejeros_app/discussions/132)
  - [¿Cómo levanto el proyecto en mi compu?](https://github.com/fbressan-itec/callejeros_app/discussions/133)
  - [¿Cómo se hacen los merge y qué hago si mi PR tiene conflictos?](https://github.com/fbressan-itec/callejeros_app/discussions/134)
  - [¿Qué tengo en cuenta si mi tarjeta toca la base de datos?](https://github.com/fbressan-itec/callejeros_app/discussions/135)
