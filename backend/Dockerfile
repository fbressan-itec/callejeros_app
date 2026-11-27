# Imagen de desarrollo del back (Django + DRF).
# Para producción (Render) está `Dockerfile.prod`: sin runserver ni herramientas de test.
FROM python:3.13-slim

# uv con versión fija (misma herramienta que en las compus y en el CI)
COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /usr/local/bin/uv

WORKDIR /app

# El entorno va fuera de /app: en desarrollo, /app se reemplaza por la carpeta
# backend/ de la compu, y el .venv de Windows no sirve dentro de Linux.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_LINK_MODE=copy \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Primero las dependencias (capa que Docker reusa si solo cambia el código)...
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --locked --no-install-project

# ...después el código.
COPY . .

EXPOSE 8000

# 0.0.0.0 para aceptar conexiones de afuera del contenedor.
CMD ["uv", "run", "python", "manage.py", "runserver", "0.0.0.0:8000"]
