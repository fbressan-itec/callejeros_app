"""Tests de las rutas generales del backend (`config/urls.py`)."""

from importlib import reload

import pytest
from django.test import Client
from django.urls import clear_url_caches

from config import urls as root_urls

PHOTO_BYTES = b"foto-de-prueba"


def _reload_root_urls() -> None:
    """Vuelve a armar las rutas: `config/urls.py` lee `DEBUG` una sola vez, al importarse."""
    reload(root_urls)
    clear_url_caches()


@pytest.fixture
def media_photo(settings, tmp_path):
    """Guarda una foto subida de prueba en una carpeta `media` temporal."""
    settings.MEDIA_ROOT = tmp_path
    photo_path = tmp_path / "pets" / "foto.jpg"
    photo_path.parent.mkdir()
    photo_path.write_bytes(PHOTO_BYTES)
    yield f"{settings.MEDIA_URL}pets/foto.jpg"
    # Deja las rutas como estaban para el resto de los tests (con `DEBUG` apagado).
    settings.DEBUG = False
    _reload_root_urls()


def test_media_files_are_served_in_development(settings, media_photo):
    settings.DEBUG = True
    _reload_root_urls()

    response = Client(HTTP_HOST="localhost").get(media_photo)

    assert response.status_code == 200
    assert b"".join(response.streaming_content) == PHOTO_BYTES


def test_media_files_are_not_served_by_django_in_production(settings, media_photo):
    settings.DEBUG = False
    _reload_root_urls()

    response = Client(HTTP_HOST="localhost").get(media_photo)

    assert response.status_code == 404
