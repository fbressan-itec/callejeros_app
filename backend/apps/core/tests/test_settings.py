"""Tests de la configuración de producción (`config/settings.py`).

Cada test carga una copia nueva de `settings.py` con las variables de entorno que
necesita, sin tocar la configuración que usa el resto de los tests.
"""

import importlib.util
from types import ModuleType

import pytest
from django.conf import settings as django_settings

SETTINGS_FILE = django_settings.BASE_DIR / "config" / "settings.py"


@pytest.fixture
def load_settings(monkeypatch):
    """Carga `settings.py` con las variables de entorno indicadas."""

    def _load(**env_vars: str) -> ModuleType:
        monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", "localhost")
        monkeypatch.delenv("RENDER_EXTERNAL_HOSTNAME", raising=False)
        monkeypatch.delenv("DJANGO_SECURE_HTTPS", raising=False)
        # Vacía y no borrada: si tu `.env` la tiene, `read_env` no la vuelve a cargar.
        monkeypatch.setenv("CLOUDINARY_URL", "")
        for name, value in env_vars.items():
            monkeypatch.setenv(name, value)
        spec = importlib.util.spec_from_file_location("settings_under_test", SETTINGS_FILE)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    return _load


def test_render_hostname_is_added_to_allowed_hosts(load_settings):
    loaded = load_settings(RENDER_EXTERNAL_HOSTNAME="callejeros-api.onrender.com")

    assert loaded.ALLOWED_HOSTS == ["localhost", "callejeros-api.onrender.com"]


def test_allowed_hosts_come_only_from_env_outside_render(load_settings):
    loaded = load_settings()

    assert loaded.ALLOWED_HOSTS == ["localhost"]


def test_secure_https_turns_on_https_protections(load_settings):
    loaded = load_settings(DJANGO_SECURE_HTTPS="True")

    assert loaded.SECURE_PROXY_SSL_HEADER == ("HTTP_X_FORWARDED_PROTO", "https")
    assert loaded.SECURE_SSL_REDIRECT is True
    assert loaded.SESSION_COOKIE_SECURE is True
    assert loaded.CSRF_COOKIE_SECURE is True
    assert loaded.SECURE_HSTS_SECONDS > 0


def test_https_protections_are_off_by_default(load_settings):
    """En local y en el CI se usa http: redirigir a https rompería todo."""
    loaded = load_settings()

    assert not hasattr(loaded, "SECURE_SSL_REDIRECT")
    assert not hasattr(loaded, "SECURE_PROXY_SSL_HEADER")


def test_csrf_trusted_origins_come_from_env(load_settings):
    loaded = load_settings(CSRF_TRUSTED_ORIGINS="https://a.example.com,https://b.example.com")

    assert loaded.CSRF_TRUSTED_ORIGINS == ["https://a.example.com", "https://b.example.com"]


def test_photos_go_to_cloudinary_when_its_url_is_set(load_settings):
    loaded = load_settings(CLOUDINARY_URL="cloudinary://123:clave-falsa@nube-de-prueba")

    assert loaded.STORAGES["default"]["BACKEND"] == (
        "cloudinary_storage.storage.MediaCloudinaryStorage"
    )


def test_photos_stay_on_disk_without_cloudinary_url(load_settings):
    loaded = load_settings()

    assert loaded.STORAGES["default"]["BACKEND"] == "django.core.files.storage.FileSystemStorage"
