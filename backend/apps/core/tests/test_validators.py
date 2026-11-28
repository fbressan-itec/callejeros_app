"""Tests unitarios del validador reutilizable de imágenes (`apps.core.validators`)."""

from io import BytesIO

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.core.validators import (
    IMAGE_TOO_LARGE_ERROR,
    INVALID_IMAGE_FORMAT_ERROR,
    MAX_IMAGE_SIZE_BYTES,
    validate_image_file,
)
from apps.pets.models import PetPhoto
from apps.pets.tests.factories import PetFactory


def _make_image_upload(
    *,
    image_format: str = "JPEG",
    filename: str = "foto.jpg",
    content_type: str = "image/jpeg",
    size: tuple[int, int] = (20, 20),
) -> SimpleUploadedFile:
    buffer = BytesIO()
    mode = "RGB" if image_format == "JPEG" else "RGBA"
    image = Image.new(mode, size, color=(234, 88, 12))
    image.save(buffer, format=image_format)
    return SimpleUploadedFile(filename, buffer.getvalue(), content_type=content_type)


@pytest.mark.parametrize(
    ("image_format", "filename", "content_type"),
    [
        ("JPEG", "foto.jpg", "image/jpeg"),
        ("PNG", "foto.png", "image/png"),
        ("WEBP", "foto.webp", "image/webp"),
    ],
)
def test_validate_image_file_accepts_valid_formats(
    image_format: str,
    filename: str,
    content_type: str,
) -> None:
    uploaded = _make_image_upload(
        image_format=image_format,
        filename=filename,
        content_type=content_type,
    )

    validate_image_file(uploaded)

    # El puntero vuelve al inicio para que Django pueda guardar el archivo sin truncarlo.
    assert uploaded.tell() == 0
    assert len(uploaded.read()) > 0


def test_validate_image_file_rejects_unsupported_image_format() -> None:
    gif_file = _make_image_upload(
        image_format="GIF",
        filename="animada.gif",
        content_type="image/gif",
    )

    with pytest.raises(ValidationError) as exc_info:
        validate_image_file(gif_file)

    assert INVALID_IMAGE_FORMAT_ERROR in exc_info.value.messages


def test_validate_image_file_rejects_spoofed_text_file() -> None:
    fake_jpg = SimpleUploadedFile(
        "falso.jpg",
        b"esto no es una imagen real",
        content_type="image/jpeg",
    )

    with pytest.raises(ValidationError) as exc_info:
        validate_image_file(fake_jpg)

    assert INVALID_IMAGE_FORMAT_ERROR in exc_info.value.messages


def test_validate_image_file_rejects_file_larger_than_5mb() -> None:
    oversized = SimpleUploadedFile(
        "pesada.jpg",
        b"\xff\xd8\xff" + (b"\x00" * MAX_IMAGE_SIZE_BYTES),
        content_type="image/jpeg",
    )

    with pytest.raises(ValidationError) as exc_info:
        validate_image_file(oversized)

    assert IMAGE_TOO_LARGE_ERROR in exc_info.value.messages


@pytest.mark.django_db
def test_pet_photo_model_full_clean_enforces_image_validator() -> None:
    pet = PetFactory()
    oversized = SimpleUploadedFile(
        "pesada.jpg",
        b"\xff\xd8\xff" + (b"\x00" * MAX_IMAGE_SIZE_BYTES),
        content_type="image/jpeg",
    )
    photo = PetPhoto(pet=pet, image=oversized, position=0)

    with pytest.raises(ValidationError) as exc_info:
        photo.full_clean()

    assert "image" in exc_info.value.message_dict
    assert IMAGE_TOO_LARGE_ERROR in exc_info.value.message_dict["image"]
