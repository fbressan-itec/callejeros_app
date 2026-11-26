"""Imágenes de los datos de prueba (`seed`), compartidas por todas las apps.

Cada app guarda sus fotos de prueba en su propia carpeta `seed_images/`, dentro
del repo, para que el `seed` funcione sin internet. Esta función las lee y las
deja listas para guardarlas en un `ImageField` (y de ahí, en `MEDIA_ROOT`).
"""

from pathlib import Path

from django.core.files.base import ContentFile


def load_seed_image(path: Path, name: str | None = None) -> ContentFile:
    """Lee una imagen del seed y la devuelve como archivo para un `ImageField`.

    `name` es el nombre con el que se guarda en `media/` (por defecto, el del archivo).
    """
    source = Path(path)
    return ContentFile(source.read_bytes(), name=name or source.name)
