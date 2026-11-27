"""Fixtures globales de pytest para el backend."""

from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def isolated_media_root(settings, tmp_path: Path) -> Path:
    """Aísla MEDIA_ROOT en una carpeta temporal para que los tests no escriban en media/.

    También fuerza el guardado en disco: aunque tu `.env` tenga `CLOUDINARY_URL` (para
    probar Cloudinary a mano), los tests nunca suben fotos a Cloudinary.
    """
    media_dir = tmp_path / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    settings.MEDIA_ROOT = media_dir
    settings.STORAGES = {
        **settings.STORAGES,
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    }
    return media_dir
