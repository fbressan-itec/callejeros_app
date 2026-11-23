"""Factories de `factory_boy` para los tests de `apps.pets`."""

from datetime import timedelta
from io import BytesIO

import factory
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image

from apps.pets.models import Favorite, Pet, PetHealth, PetPhoto, PetStatusLog
from apps.users.tests.factories import UserFactory


def make_test_image_file(
    filename: str = "pet.jpg",
    size: tuple[int, int] = (200, 150),
    color: tuple[int, int, int] = (234, 88, 12),
    img_format: str = "JPEG",
) -> SimpleUploadedFile:
    """Genera un archivo de imagen válido en memoria para usar en factories y tests."""
    buffer = BytesIO()
    image = Image.new("RGB", size, color=color)
    image.save(buffer, format=img_format)
    content_type = f"image/{img_format.lower()}"
    return SimpleUploadedFile(filename, buffer.getvalue(), content_type=content_type)


class PetFactory(factory.django.DjangoModelFactory):
    """Genera una mascota de prueba en estado `in_review` por defecto."""

    class Meta:
        model = Pet

    name = factory.Sequence(lambda n: f"Mascota {n}")
    species = Pet.Species.DOG
    sex = Pet.Sex.MALE
    estimated_birth_date = factory.LazyFunction(
        lambda: timezone.localdate() - timedelta(days=365 * 2),
    )
    is_sociable = True
    good_with_children = Pet.Compatibility.NOT_EVALUATED
    good_with_animals = Pet.Compatibility.NOT_EVALUATED
    is_neutered = True
    is_urgent_requested = False
    is_urgent_validated = False
    special_care = ""
    description = "Mascota rescatada en Río Cuarto lista para un hogar."
    notes = "Observaciones de prueba."
    contact_phone = "+54 9 358 4000000"
    status = Pet.Status.IN_REVIEW
    published_by = factory.SubFactory(UserFactory)


class PetHealthFactory(factory.django.DjangoModelFactory):
    """Genera el estado de salud uno a uno de una mascota."""

    class Meta:
        model = PetHealth
        django_get_or_create = ("pet",)

    pet = factory.SubFactory(PetFactory)
    general_status = "Sano y vital"
    vaccines = "Al día"
    deworming = "Desparasitado"
    flea_tick_treatment = "Pipeta al día"
    other = "Sin observaciones"


class PetPhotoFactory(factory.django.DjangoModelFactory):
    """Genera una foto activa de mascota."""

    class Meta:
        model = PetPhoto

    pet = factory.SubFactory(PetFactory)
    position = 0
    image = factory.LazyFunction(lambda: make_test_image_file("factory_pet.jpg"))


class PetStatusLogFactory(factory.django.DjangoModelFactory):
    """Genera una fila de historial de estado de mascota."""

    class Meta:
        model = PetStatusLog

    pet = factory.SubFactory(PetFactory)
    previous_status = ""
    new_status = Pet.Status.IN_REVIEW
    performed_by = factory.LazyAttribute(lambda obj: obj.pet.published_by)
    note = "Alta inicial."


class FavoriteFactory(factory.django.DjangoModelFactory):
    """Genera un favorito activo entre un usuario y una mascota."""

    class Meta:
        model = Favorite

    user = factory.SubFactory(UserFactory)
    pet = factory.SubFactory(PetFactory, status=Pet.Status.PUBLISHED)
