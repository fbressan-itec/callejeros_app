"""Tests de la carga de imágenes para los datos de prueba (`seed`)."""

from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image

from apps.core.seed_images import load_seed_image
from apps.core.validators import validate_image_file


def _write_jpeg(path: Path) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (40, 30), color=(234, 88, 12)).save(buffer, format="JPEG")
    path.write_bytes(buffer.getvalue())
    return buffer.getvalue()


def test_load_seed_image_returns_file_with_same_bytes_and_name(tmp_path: Path) -> None:
    source = tmp_path / "loki-1.jpg"
    expected = _write_jpeg(source)

    image = load_seed_image(source)

    assert image.name == "loki-1.jpg"
    assert image.read() == expected


def test_load_seed_image_accepts_custom_name(tmp_path: Path) -> None:
    source = tmp_path / "loki-1.jpg"
    _write_jpeg(source)

    image = load_seed_image(source, name="seed-loki-1.jpg")

    assert image.name == "seed-loki-1.jpg"


def test_load_seed_image_passes_image_validation(tmp_path: Path) -> None:
    source = tmp_path / "loki-1.jpg"
    _write_jpeg(source)

    validate_image_file(load_seed_image(source))


def test_load_seed_image_fails_when_file_is_missing(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        load_seed_image(tmp_path / "no-existe.jpg")
