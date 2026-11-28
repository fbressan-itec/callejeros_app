# Publicación en línea (deploy)

> Volver al [README](../README.md).

## Direcciones

| Parte | Dirección | Servicio |
| :--- | :--- | :--- |
| Front | <https://callejeros-app.vercel.app> | Vercel |
| API | <https://callejeros-api.onrender.com/api/> | Render |
| Swagger | <https://callejeros-api.onrender.com/api/docs/> | Render |
| Admin de Django | <https://callejeros-api.onrender.com/admin/> | Render |

- **Se publica la rama `main`:** cada versión que entra a `main` (ver [Versiones](../README.md#versiones)) se publica sola en Render y en Vercel. Los PR hacia `develop` arman una vista previa del front en Vercel.
- **Cuentas de prueba:** las mismas de las [cuentas de prueba](desarrollo.md#cuentas-de-prueba) (miembro@, refugio@, staff@ y admin@callejeros.ar). Su contraseña es la `SEED_USER_PASSWORD` cargada en Render, distinta de la de `.env.example`: se pasa en privado, no va en el repo.
- **Primera visita lenta:** el back gratis se apaga tras 15 minutos sin uso; la primera visita después tarda alrededor de un minuto en responder.

## Deploy del back (Render)

El back se publica en [Render](https://render.com) con la imagen de producción `backend/Dockerfile.prod`, distinta de la de desarrollo:

- **gunicorn** en lugar de `runserver`, sin las herramientas de test.
- **WhiteNoise** sirve los estilos del admin y de Swagger; `collectstatic` se corre al armar la imagen.
- **`backend/start.sh`**, al arrancar, aplica las migraciones, corre el `seed` si `DJANGO_SEED_ON_START=True` (con `--allow-production`, para tener los usuarios de prueba en la demo) y levanta gunicorn en el puerto que indica Render (`$PORT`).
- **PostgreSQL** de Render, por `DATABASE_URL`. En local sigue SQLite: si la variable no está, no cambia nada.
- **Cloudinary** guarda las fotos subidas (y las del `seed`), por `CLOUDINARY_URL`, con `django-cloudinary-storage`. La API devuelve la dirección de Cloudinary de cada foto y el front la muestra sin cambios. El `seed` reconoce las fotos que ya subió: al arrancar de nuevo no las vuelve a subir. En local, sin la variable, siguen en `backend/media/`.

Configuración del servicio en Render (*New → Web Service*, desde este repo):

| Campo | Valor |
| :--- | :--- |
| Language | Docker |
| Branch | `main` |
| Region | La misma que la base (Virginia) |
| Root Directory | `backend` |
| Dockerfile Path | `backend/Dockerfile.prod` |
| Instance Type | Free |

Variables del servicio: `DJANGO_SECRET_KEY` (una nueva, larga y aleatoria), `DJANGO_DEBUG=False`, `DJANGO_SECURE_HTTPS=True`, `DATABASE_URL` (la *Internal Database URL* de la base de Render), `CORS_ALLOWED_ORIGINS` (la dirección del front en Vercel), `SEED_USER_PASSWORD`, `DJANGO_SEED_ON_START=True` y `CLOUDINARY_URL`. `DJANGO_ALLOWED_HOSTS` puede quedar vacía: Render agrega su dirección sola.

La base es un *Postgres* de Render (*New → Postgres*, plan Free) en la misma región que el servicio.

> **Limitaciones del plan gratis:** el back se apaga tras 15 minutos sin uso y la primera visita después tarda alrededor de un minuto. Render borra los archivos del servidor en cada reinicio: por eso la base es PostgreSQL (aparte) y las fotos van a Cloudinary. La base gratis de Render vence a los 30 días.

Para probar la imagen de producción en tu compu (desde `backend/`, con Docker Desktop abierto):

```bash
docker build -f Dockerfile.prod -t callejeros-back-prod .
docker run --rm -p 8000:8000 --env-file ../.env -e DJANGO_DEBUG=False callejeros-back-prod
```

## Deploy del front (Vercel)

El front se publica en [Vercel](https://vercel.com), conectado a este repo:

| Campo | Valor |
| :--- | :--- |
| Root Directory | `frontend` |
| Framework Preset | Next.js |
| Production Branch | `main` |

Variables del proyecto (tipo *Config*, entorno *Production*; no son secretas):

| Variable | Valor |
| :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://callejeros-api.onrender.com/api` |
| `MOCK_VERIFICATION_CODE` | `8596` (el código maquetado del registro y del recupero) |

`NEXT_PUBLIC_API_URL` queda fija al armar el front: si cambia, hay que volver a desplegar (*Deployments → ⋯ → Redeploy*). En Render, `CORS_ALLOWED_ORIGINS` tiene que tener la dirección del front (`https://callejeros-app.vercel.app`, sin barra al final).
