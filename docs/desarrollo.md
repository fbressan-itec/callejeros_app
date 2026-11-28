# Desarrollo local

> Volver al [README](../README.md). Las variables de entorno están en la [tabla del README](../README.md#variables-de-entorno).

Hay dos formas: **con Docker** (levanta todo, o el back o el front por separado, sin instalar Python ni Node) o **sin Docker** (cada parte con sus herramientas). Las dos usan el mismo `.env`.

## 1. Preparar (una sola vez)

1. Cloná el repo y entrá a la carpeta:
   ```bash
   git clone https://github.com/fbressan-itec/callejeros_app.git
   cd callejeros_app
   ```
2. Creá tu `.env` a partir del ejemplo (en la raíz del repo):
   ```bash
   cp .env.example .env
   ```
   En PowerShell: `Copy-Item .env.example .env`.
3. Generá una clave secreta y pegala en `DJANGO_SECRET_KEY` de tu `.env`. Con uv (desde `backend/`):
   ```bash
   uv run python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
   ```
   O con Docker (desde la raíz):
   ```bash
   docker compose run --rm backend uv run python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
   ```

## 2a. Con Docker

**Requisito:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) abierto ("Engine running"). Los comandos se corren desde la raíz del repo.

| Qué levantar | Comando | Dirección |
| :--- | :--- | :--- |
| Todo el proyecto | `docker compose up --build --watch` | back en <http://localhost:8000> y front en <http://localhost:3000> |
| Solo el back | `docker compose up --build backend` | <http://localhost:8000> |
| Solo el front | `docker compose up --build --watch frontend` | <http://localhost:3000> |

- **Apagar:** `Ctrl+C` en la misma terminal, o `docker compose down`.
- **Cambios en el código:** se ven al instante, sin volver a armar la imagen. En el front, gracias a `--watch`: Docker copia al contenedor cada archivo que guardás (sin `--watch`, el front no se entera de los cambios). Si agregás una dependencia, volvé a correr el comando con `--build`.
- **Correr un comando dentro de un contenedor:** `docker compose run --rm <servicio> <comando>`, por ejemplo `docker compose run --rm backend uv run pytest` o `docker compose run --rm frontend npm test`.
- **Para programar el front, conviene sin Docker** (`npm run dev`, abajo): en Windows, Next recarga más rápido así. Docker es ideal para levantar todo sin instalar Python ni Node.

Cada parte tiene su propio `Dockerfile` (`backend/Dockerfile` y `frontend/Dockerfile`); el `docker-compose.yml` de la raíz los levanta juntos o por separado.

## 2b. Sin Docker

### Backend

**Requisito:** [uv](https://docs.astral.sh/uv/getting-started/installation/). No hace falta instalar Python: uv descarga la versión del proyecto (3.13) sola. Desde `backend/`:

```bash
uv sync                               # instala las dependencias (crea backend/.venv)
uv run python manage.py migrate       # crea las tablas y carga los 4 roles
uv run python manage.py seed          # carga un usuario de prueba por rol (usa SEED_USER_PASSWORD)
uv run python manage.py runserver     # levanta el back en http://localhost:8000
```

**Datos de prueba (`seed`):** cada app guarda los suyos en su propio `seed.py` (por ejemplo, `apps/users/seed.py`), con una función `run()` que los crea o actualiza sin duplicar y devuelve un resumen. El comando `seed` encuentra el `seed.py` de cada app y los ejecuta en el orden de `INSTALLED_APPS`. Para sumar datos de una app nueva, creá su `seed.py`: no hace falta tocar el comando. Solo corre con `DJANGO_DEBUG=True`.

**Fotos del `seed`:** son fotos reales libres de derechos (Unsplash) guardadas en el repo, en la carpeta `seed_images/` de cada app (hoy, `apps/pets/seed_images/`), así el `seed` anda sin internet. Al correrlo se copian a `backend/media/`. Para usarlas desde otra app (alertas, noticias), creá su carpeta `seed_images/` y cargalas con `load_seed_image()` de `apps/core/seed_images.py`. Las que empiezan con `extra-` son de reserva para pruebas.

**Correr el `seed` de nuevo:** no duplica datos y vuelve a dejar los datos de prueba como estaban (textos, estados, favoritos). No falla ni pisa lo que se hizo desde la app con esos datos: respeta las fotos agregadas o quitadas y las solicitudes de adopción creadas desde la app. Si tu base tenía las fotos viejas de un solo color, el `seed` las cambia por las reales en la misma foto. Si le cambiaste el nombre a una mascota del `seed`, se vuelve a crear la original.

### Cuentas de prueba

`python manage.py seed` carga un usuario por rol. Todos usan la contraseña de `SEED_USER_PASSWORD` de tu `.env` (en el `.env.example`, `cambiame-clave-seed-123`) y tienen el teléfono ya verificado.

| Rol | Email | Nombre | Qué permite probar |
| :--- | :--- | :--- | :--- |
| Miembro | `miembro@callejeros.ar` | Tomás Gómez | Usuario común, sin insignia. Publicó 4 mascotas del `seed`. |
| Refugio verificado | `refugio@callejeros.ar` | Refugio Patitas Río Cuarto | Insignia "✓ Refugio verificado". Publicó 5 mascotas del `seed`. |
| Staff | `staff@callejeros.ar` | Valentina López | Insignia "🛡️ Staff Callejeros". Revisa publicaciones y solicitudes (desde v0.2). |
| Admin | `admin@callejeros.ar` | Admin Callejeros | Lo mismo que Staff, y además entra al panel de Django (<http://localhost:8000/admin/>). |

**Código de verificación:** la verificación por SMS del registro y el código para recuperar la contraseña todavía están maquetados (no se envía ningún SMS ni correo). El código es siempre el de `MOCK_VERIFICATION_CODE` en tu `.env`: por defecto, **`8596`**.

> ⚠️ Son datos de prueba: el `seed` solo corre con `DJANGO_DEBUG=True` y nunca se usa en producción.

### Panel de administración de Django (`/admin/`)

Solo acceden usuarios activos con rol **Admin** (`http://localhost:8000/admin/`). Para el módulo de cuentas (`apps.users`) permite:

- **Usuarios (`User`):** listado con búsqueda por correo, nombre o apellido y filtros por rol, estado activo y verificación de teléfono. Sin borrado físico.
- **Alta y contraseñas:** el alta de cuentas se hace solo desde aquí (con contraseña ingresada dos veces, validada con las mismas reglas que el registro y guardada con hash, creando además `UserPreferences`). El cambio de contraseña de otro usuario usa el formulario estándar de Django; nunca se muestra ni edita en texto plano.
- **Edición, roles y baja lógica:** permite editar datos personales, teléfono y su verificación, correo y la `dirección pública del refugio` (fechas y último ingreso son solo lectura). Cambiar el rol y activar/desactivar (tanto desde la ficha como con las acciones masivas **"Desactivar usuarios seleccionados"** y **"Reactivar usuarios seleccionados"**) pasan por los servicios de `apps/users/services.py`: registran `UserRoleLog` y `UserStatusLog` (motivo `admin_action`), invalidan los tokens de refresco en `token_blacklist` al desactivar e impiden que un Admin se quite su propio rol, se desactive a sí mismo o deje el sistema sin ningún Admin activo.
- **Roles e historiales (`Role`, `UserRoleLog`, `UserStatusLog`):** son estrictamente de solo lectura; el historial de roles y de estados de cada usuario también se ve en su ficha.

### Frontend

**Requisito:** [Node.js](https://nodejs.org/) 22 o más nuevo (trae npm). Desde `frontend/`:

```bash
npm install          # instala las dependencias (crea frontend/node_modules)
npm run dev          # levanta el front en http://localhost:3000
```

Linter, formato, tipos y tests (desde `frontend/`; los mismos controles corren solos en cada PR):

```bash
npm run lint         # linter (ESLint)
npm run format       # formatea el código y ordena las clases de Tailwind (Prettier)
npm run typecheck    # revisa los tipos de TypeScript
npm test             # tests (Vitest); npm run test:watch los repite al guardar
npm run build        # compila como en producción: si falla acá, falla en el deploy
```

Antes de subir cambios, corré `lint`, `format`, `typecheck` y `test`: si fallan en tu compu, también van a fallar en el PR. Los tests van junto al archivo que prueban, con el nombre `*.test.tsx` (por ejemplo, `src/app/page.test.tsx`).

El front usa **Tailwind 4** (el maquetado está en Tailwind 3): el tema está en `frontend/src/app/globals.css`.

**Llamar al back:** el front lee el mismo `.env` de la raíz; la URL de la API sale de `NEXT_PUBLIC_API_URL`. Todas las llamadas pasan por el cliente de `frontend/src/lib/api/client.ts` (nunca `fetch` directo):

```ts
import { ApiError, api } from "@/lib/api/client";

try {
  const pets = await api.get<Pet[]>("pets/");
} catch (error) {
  if (error instanceof ApiError) {
    // error.message → aviso general · error.fieldErrors.email → errores junto al campo
  }
}
```

## Linter y tests del back

Desde `backend/` (los mismos controles corren solos en cada PR):

```bash
uv run ruff check .          # linter
uv run ruff format .         # formatea el código
uv run pytest                # tests
```

Con Docker, desde la raíz: `docker compose run --rm backend uv run pytest` (y lo mismo con `ruff`).

Antes de subir cambios, corré los tres: si `ruff check` o `pytest` fallan en tu compu, también van a fallar en el PR.

> ⚠️ **Si ya habías corrido `migrate` antes de BK-02** y al migrar aparece `InconsistentMigrationHistory` (porque `admin` se había migrado con el usuario por defecto de Django), borrá `backend/db.sqlite3` una única vez (y, si usás Docker, corré `docker compose down -v`) antes de volver a correr `migrate`.
