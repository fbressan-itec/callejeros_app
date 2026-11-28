#!/bin/sh
# Arranque del back en producción (lo corre la imagen de `Dockerfile.prod`).
# En el plan gratis de Render no hay consola ni paso previo al deploy: las migraciones
# (y, si se pide, el seed) se corren acá, cada vez que arranca el servicio.
set -e

python manage.py migrate --noinput

# El seed se puede correr varias veces sin duplicar ni pisar datos cargados desde la app.
if [ "$DJANGO_SEED_ON_START" = "True" ]; then
    python manage.py seed --allow-production
fi

# 2 procesos: entran en los 512 MB del plan gratis.
exec gunicorn config.wsgi --bind "0.0.0.0:${PORT:-8000}" --workers 2
