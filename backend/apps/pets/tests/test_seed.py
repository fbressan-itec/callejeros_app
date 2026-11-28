"""Tests del comando `python manage.py seed` para los datos de `apps.pets`."""

from io import BytesIO, StringIO
from pathlib import PurePosixPath

import pytest
from django.core.files.base import ContentFile
from django.core.management import call_command
from PIL import Image

from apps.pets.models import Favorite, Pet, PetHealth, PetPhoto, PetStatusLog
from apps.pets.seed import SEED_IMAGES_DIR
from apps.pets.services import add_pet_photo, remove_pet_photo

pytestmark = pytest.mark.django_db


def test_seed_command_populates_pets_idempotently(
    settings: pytest.TempPathFactory,
    tmp_path: pytest.TempPathFactory,
) -> None:
    settings.DEBUG = True
    settings.SEED_USER_PASSWORD = "clave-segura-seed-123"
    settings.MEDIA_ROOT = tmp_path

    first_out = StringIO()
    call_command("seed", stdout=first_out)
    first_output = first_out.getvalue()

    assert (
        "pets: 9 mascotas creadas, 0 actualizadas; 5 favoritos creados, 0 actualizados"
        in first_output
    )
    assert Pet.objects.count() == 9
    assert Favorite.objects.active().count() == 5
    assert Favorite.objects.active().filter(user__email="miembro@callejeros.ar").count() == 3
    assert Pet.objects.filter(status=Pet.Status.PUBLISHED).count() == 6
    assert Pet.objects.filter(status=Pet.Status.ADOPTED).count() == 1
    assert Pet.objects.filter(status=Pet.Status.IN_REVIEW).count() == 1
    assert Pet.objects.filter(status=Pet.Status.REJECTED).count() == 1
    assert PetHealth.objects.count() == 9

    loki = Pet.objects.get(name="Loki")
    assert loki.photos.active().count() == 2
    assert PetPhoto.objects.active().count() == 10

    rocco = Pet.objects.get(name="Rocco")
    assert rocco.is_urgent_requested is True
    assert rocco.is_urgent_validated is True
    assert rocco.special_care != ""

    nala = Pet.objects.get(name="Nala")
    assert nala.status == Pet.Status.IN_REVIEW
    assert nala.is_urgent_requested is True
    assert nala.is_urgent_validated is False

    initial_log_count = PetStatusLog.objects.count()
    assert initial_log_count > 0

    # Si un favorito semilla se da de baja lógica, volver a correr seed lo reactiva sin duplicar
    sample_favorite = Favorite.objects.get(user__email="miembro@callejeros.ar", pet__name="Loki")
    sample_favorite.deactivate()

    # Segunda corrida: no duplica mascotas, fotos, favoritos ni logs de estado
    second_out = StringIO()
    call_command("seed", stdout=second_out)
    second_output = second_out.getvalue()

    assert (
        "pets: 0 mascotas creadas, 9 actualizadas; 0 favoritos creados, 5 actualizados"
        in second_output
    )
    assert Pet.objects.count() == 9
    assert PetHealth.objects.count() == 9
    assert PetPhoto.objects.active().count() == 10
    assert Favorite.objects.count() == 5
    assert Favorite.objects.active().count() == 5
    assert PetStatusLog.objects.count() == initial_log_count


def _run_seed() -> str:
    out = StringIO()
    call_command("seed", stdout=out)
    return out.getvalue()


@pytest.fixture
def seed_settings(settings: pytest.TempPathFactory) -> None:
    settings.DEBUG = True
    settings.SEED_USER_PASSWORD = "clave-segura-seed-123"


def _color_jpeg() -> ContentFile:
    buffer = BytesIO()
    Image.new("RGB", (60, 45), color=(234, 88, 12)).save(buffer, format="JPEG")
    return ContentFile(buffer.getvalue())


def test_seed_uses_real_photos_from_repo(seed_settings: None) -> None:
    _run_seed()

    loki_photos = list(Pet.objects.get(name="Loki").photos.active().order_by("position"))
    assert [PurePosixPath(photo.image.name).stem for photo in loki_photos] == [
        "seed-loki-1",
        "seed-loki-2",
    ]
    for photo in PetPhoto.objects.all():
        source_name = PurePosixPath(photo.image.name).name.removeprefix("seed-")
        with photo.image.open("rb") as stored:
            assert stored.read() == (SEED_IMAGES_DIR / source_name).read_bytes()


def test_seed_replaces_legacy_color_photos_in_same_rows(seed_settings: None) -> None:
    _run_seed()
    # Simula una base cargada antes de DB-02a: fotos de color llamadas `seed_<mascota>_<n>.jpg`.
    for photo in PetPhoto.objects.all():
        legacy_name = PurePosixPath(photo.image.name).stem.removeprefix("seed-").replace("-", "_")
        photo.image.save(f"seed_{legacy_name}.jpg", _color_jpeg(), save=True)
    ids_before = set(PetPhoto.objects.values_list("id", flat=True))

    _run_seed()

    assert set(PetPhoto.objects.values_list("id", flat=True)) == ids_before
    assert PetPhoto.objects.active().count() == 10
    for photo in PetPhoto.objects.all():
        assert PurePosixPath(photo.image.name).name.startswith("seed-")

    # Una tercera corrida no vuelve a cambiar nada.
    names = dict(PetPhoto.objects.values_list("id", "image"))
    _run_seed()
    assert dict(PetPhoto.objects.values_list("id", "image")) == names


def test_seed_keeps_photos_changed_from_the_app(seed_settings: None) -> None:
    _run_seed()
    loki = Pet.objects.get(name="Loki")
    publisher = loki.published_by
    main_photo = loki.photos.active().get(position=0)

    # El usuario sube una foto y quita la principal del seed (la segunda pasa a la posición 0).
    user_photo = add_pet_photo(pet=loki, actor=publisher, image=_color_jpeg_named("mia.jpg"))
    remove_pet_photo(pet=loki, photo=main_photo, actor=publisher)

    _run_seed()

    loki.refresh_from_db()
    main_photo.refresh_from_db()
    assert main_photo.is_active is False
    active = list(loki.photos.active().order_by("position"))
    assert [photo.position for photo in active] == [0, 1]
    assert PurePosixPath(active[0].image.name).stem == "seed-loki-2"
    assert active[1].id == user_photo.id
    assert PetPhoto.objects.filter(pet=loki).count() == 3


def _color_jpeg_named(name: str) -> ContentFile:
    image = _color_jpeg()
    image.name = name
    return image


@pytest.fixture
def cloudinary_uploads(settings, monkeypatch) -> list[str]:
    """Guarda las fotos con el almacenamiento de Cloudinary, sin subir nada de verdad.

    Cloudinary guarda cada foto sin extensión y con un sufijo al azar
    (`media/pets/seed-loki-1_x7k2pq`): el seed tiene que reconocerlas igual.
    """
    import cloudinary.uploader

    monkeypatch.setenv("CLOUDINARY_URL", "cloudinary://123:clave-falsa@nube-de-prueba")
    uploads: list[str] = []

    def fake_upload(content, folder: str = "", **options) -> dict:
        stem = PurePosixPath(content.name).stem
        uploads.append(stem)
        return {"public_id": f"{folder}/{stem}_x7k2pq"}

    monkeypatch.setattr(cloudinary.uploader, "upload", fake_upload)
    settings.STORAGES = {
        **settings.STORAGES,
        "default": {"BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage"},
    }
    return uploads


def test_seed_does_not_upload_photos_again_to_cloudinary(
    seed_settings: None, cloudinary_uploads: list[str]
) -> None:
    """En Render el seed corre en cada arranque: no tiene que volver a subir las fotos."""
    _run_seed()
    first_uploads = len(cloudinary_uploads)

    _run_seed()

    assert first_uploads == PetPhoto.objects.count() == 10
    assert len(cloudinary_uploads) == first_uploads
    loki_names = [photo.image.name for photo in Pet.objects.get(name="Loki").photos.active()]
    assert sorted(loki_names) == [
        "media/pets/photos/seed-loki-1_x7k2pq",
        "media/pets/photos/seed-loki-2_x7k2pq",
    ]
