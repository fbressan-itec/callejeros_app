"""Validadores reutilizables para modelos y serializers del backend."""

from io import BytesIO

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError

MAX_IMAGE_SIZE_MB = 5
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024
ALLOWED_IMAGE_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})

IMAGE_TOO_LARGE_ERROR = f"La imagen no puede superar los {MAX_IMAGE_SIZE_MB} MB."
INVALID_IMAGE_FORMAT_ERROR = "El archivo debe ser una imagen válida en formato JPG, PNG o WEBP."


def validate_image_file(file) -> None:
    """Valida que el archivo sea una imagen real JPG, PNG o WEBP de hasta 5 MB."""
    if not file:
        return

    file_size = getattr(file, "size", None)
    if file_size is not None and file_size > MAX_IMAGE_SIZE_BYTES:
        raise ValidationError(IMAGE_TOO_LARGE_ERROR, code="image_too_large")

    was_closed = getattr(file, "closed", False)
    try:
        if was_closed:
            file.open("rb")
        if hasattr(file, "seek"):
            file.seek(0)
        raw_bytes = file.read(MAX_IMAGE_SIZE_BYTES + 1)
    except OSError as exc:
        raise ValidationError(INVALID_IMAGE_FORMAT_ERROR, code="invalid_image") from exc
    finally:
        if hasattr(file, "seek") and not getattr(file, "closed", False):
            file.seek(0)
        if was_closed and not getattr(file, "closed", False):
            file.close()

    if len(raw_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise ValidationError(IMAGE_TOO_LARGE_ERROR, code="image_too_large")

    if not raw_bytes:
        raise ValidationError(INVALID_IMAGE_FORMAT_ERROR, code="invalid_image")

    try:
        with Image.open(BytesIO(raw_bytes)) as img:
            image_format = (img.format or "").upper()
            img.verify()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValidationError(INVALID_IMAGE_FORMAT_ERROR, code="invalid_image") from exc

    if image_format not in ALLOWED_IMAGE_FORMATS:
        raise ValidationError(INVALID_IMAGE_FORMAT_ERROR, code="invalid_image_format")
