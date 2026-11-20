"""Tests de integración de los endpoints CRUD de mascotas, adopción y fotos (BK-03b)."""

import json
from datetime import timedelta
from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from apps.core.validators import (
    IMAGE_TOO_LARGE_ERROR,
    INVALID_IMAGE_FORMAT_ERROR,
    MAX_IMAGE_SIZE_BYTES,
)
from apps.pets.models import Pet, PetPhoto, PetStatusLog
from apps.pets.serializers import IS_NEUTERED_REQUIRED_ERROR, IS_SOCIABLE_REQUIRED_ERROR
from apps.pets.services import (
    ADOPT_ONLY_PUBLISHED_ERROR,
    DESCRIPTION_TOO_LONG_ERROR,
    FUTURE_BIRTH_DATE_ERROR,
    LAST_PHOTO_ERROR,
    MIN_PHOTOS_ERROR,
    SPECIAL_CARE_TOO_LONG_ERROR,
)
from apps.pets.tests.factories import PetFactory, PetHealthFactory, PetPhotoFactory
from apps.users.models import RoleCode
from apps.users.permissions import FORBIDDEN_ERROR_MESSAGE
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

PETS_URL = "/api/pets/"


def _make_image(
    *,
    filename: str = "pet.jpg",
    image_format: str = "JPEG",
    content_type: str = "image/jpeg",
    color: tuple[int, int, int] = (234, 88, 12),
) -> SimpleUploadedFile:
    buffer = BytesIO()
    mode = "RGB" if image_format == "JPEG" else "RGBA"
    image = Image.new(mode, (32, 32), color=color)
    image.save(buffer, format=image_format)
    return SimpleUploadedFile(filename, buffer.getvalue(), content_type=content_type)


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _valid_pet_payload(**overrides) -> dict:
    payload = {
        "name": "Milo",
        "species": Pet.Species.DOG,
        "sex": Pet.Sex.MALE,
        "estimated_birth_date": (timezone.localdate() - timedelta(days=365)).isoformat(),
        "is_sociable": "true",
        "good_with_children": Pet.Compatibility.YES,
        "good_with_animals": Pet.Compatibility.NOT_EVALUATED,
        "is_neutered": "true",
        "is_urgent_requested": "true",
        "special_care": "Dieta hipoalergénica",
        "description": "Muy compañero, rescatado en barrio Banda Norte.",
        "notes": "Camina perfecto con correa.",
        "contact_phone": "+54 9 358 4123456",
        "health": json.dumps(
            {
                "general_status": "Sano",
                "vaccines": "Séxtuple al día",
                "deworming": "Desparasitado",
            }
        ),
        "photos": [
            _make_image(filename="milo_1.jpg"),
            _make_image(filename="milo_2.png", image_format="PNG", content_type="image/png"),
        ],
    }
    payload.update(overrides)
    return payload


# ---------------------------------------------------------------------------
# POST /api/pets/
# ---------------------------------------------------------------------------


def test_create_pet_requires_authentication() -> None:
    client = APIClient()
    response = client.post(PETS_URL, _valid_pet_payload(), format="multipart")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_create_pet_creates_in_review_with_health_photos_and_initial_log() -> None:
    member = UserFactory(role__code=RoleCode.MEMBER)
    client = _auth_client(member)

    # Intenta forzar status y validación urgente: el servidor debe ignorarlos.
    payload = _valid_pet_payload(
        status=Pet.Status.PUBLISHED,
        is_urgent_validated="true",
    )
    response = client.post(PETS_URL, payload, format="multipart")

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["name"] == "Milo"
    assert body["status"] == Pet.Status.IN_REVIEW
    assert body["is_urgent_requested"] is True
    assert body["is_urgent_validated"] is False
    assert body["published_by"]["id"] == member.id
    assert body["health"]["general_status"] == "Sano"
    assert body["health"]["vaccines"] == "Séxtuple al día"
    assert [photo["position"] for photo in body["photos"]] == [0, 1]
    assert "contact_phone" not in body

    pet = Pet.objects.get(pk=body["id"])
    assert pet.contact_phone == "+54 9 358 4123456"
    assert pet.photos.active().count() == 2

    logs = list(pet.status_logs.all())
    assert len(logs) == 1
    assert logs[0].previous_status == ""
    assert logs[0].new_status == Pet.Status.IN_REVIEW
    assert logs[0].performed_by_id == member.id


def test_create_pet_requires_at_least_one_photo() -> None:
    member = UserFactory(role__code=RoleCode.MEMBER)
    client = _auth_client(member)
    payload = _valid_pet_payload()
    payload.pop("photos")

    response = client.post(PETS_URL, payload, format="multipart")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert MIN_PHOTOS_ERROR in response.json()["photos"]


@pytest.mark.parametrize(
    ("missing_field", "expected_error"),
    [
        ("is_sociable", IS_SOCIABLE_REQUIRED_ERROR),
        ("is_neutered", IS_NEUTERED_REQUIRED_ERROR),
    ],
)
def test_create_pet_requires_explicit_booleans_in_multipart(
    missing_field: str,
    expected_error: str,
) -> None:
    member = UserFactory(role__code=RoleCode.MEMBER)
    client = _auth_client(member)
    payload = _valid_pet_payload()
    payload.pop(missing_field)

    response = client.post(PETS_URL, payload, format="multipart")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert expected_error in response.json()[missing_field]
    assert Pet.objects.count() == 0


def test_create_pet_rejects_oversized_and_invalid_photos() -> None:
    member = UserFactory(role__code=RoleCode.MEMBER)
    client = _auth_client(member)

    oversized = SimpleUploadedFile(
        "grande.jpg",
        b"\xff\xd8\xff" + (b"\x00" * MAX_IMAGE_SIZE_BYTES),
        content_type="image/jpeg",
    )
    response_size = client.post(
        PETS_URL,
        _valid_pet_payload(photos=[oversized]),
        format="multipart",
    )
    assert response_size.status_code == status.HTTP_400_BAD_REQUEST
    assert IMAGE_TOO_LARGE_ERROR in response_size.json()["photos"]

    fake_file = SimpleUploadedFile("fake.jpg", b"no soy imagen", content_type="image/jpeg")
    response_format = client.post(
        PETS_URL,
        _valid_pet_payload(photos=[fake_file]),
        format="multipart",
    )
    assert response_format.status_code == status.HTTP_400_BAD_REQUEST
    assert INVALID_IMAGE_FORMAT_ERROR in response_format.json()["photos"]
    assert Pet.objects.count() == 0


def test_create_pet_validates_text_lengths_and_birth_date() -> None:
    member = UserFactory(role__code=RoleCode.MEMBER)
    client = _auth_client(member)

    response_desc = client.post(
        PETS_URL,
        _valid_pet_payload(description="a" * 401),
        format="multipart",
    )
    assert response_desc.status_code == status.HTTP_400_BAD_REQUEST
    assert DESCRIPTION_TOO_LONG_ERROR in response_desc.json()["description"]

    response_care = client.post(
        PETS_URL,
        _valid_pet_payload(special_care="b" * 151),
        format="multipart",
    )
    assert response_care.status_code == status.HTTP_400_BAD_REQUEST
    assert SPECIAL_CARE_TOO_LONG_ERROR in response_care.json()["special_care"]

    future_date = (timezone.localdate() + timedelta(days=1)).isoformat()
    response_date = client.post(
        PETS_URL,
        _valid_pet_payload(estimated_birth_date=future_date),
        format="multipart",
    )
    assert response_date.status_code == status.HTTP_400_BAD_REQUEST
    assert FUTURE_BIRTH_DATE_ERROR in response_date.json()["estimated_birth_date"]


# ---------------------------------------------------------------------------
# PATCH /api/pets/{id}/
# ---------------------------------------------------------------------------


def test_update_pet_by_owner_updates_allowed_fields_and_ignores_protected_ones() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    other_user = UserFactory(role__code=RoleCode.MEMBER)
    pet = PetFactory(
        published_by=owner,
        name="Nombre Viejo",
        status=Pet.Status.IN_REVIEW,
        is_urgent_requested=True,
        is_urgent_validated=False,
    )
    PetHealthFactory(pet=pet, general_status="Inicial")

    client = _auth_client(owner)
    response = client.patch(
        f"{PETS_URL}{pet.id}/",
        {
            "name": "Nombre Nuevo",
            "description": "Descripción actualizada.",
            "health": {"general_status": "Actualizado", "vaccines": "Completas"},
            "status": Pet.Status.PUBLISHED,
            "is_urgent_validated": True,
            "published_by": other_user.id,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    pet.refresh_from_db()
    pet.health.refresh_from_db()
    assert pet.name == "Nombre Nuevo"
    assert pet.description == "Descripción actualizada."
    assert pet.health.general_status == "Actualizado"
    assert pet.health.vaccines == "Completas"
    # Campos protegidos intactos
    assert pet.status == Pet.Status.IN_REVIEW
    assert pet.is_urgent_validated is False
    assert pet.published_by_id == owner.id


def test_update_pet_unchecking_urgent_clears_validated_flag() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    pet = PetFactory(
        published_by=owner,
        is_urgent_requested=True,
        is_urgent_validated=True,
    )
    PetHealthFactory(pet=pet)

    client = _auth_client(owner)
    response = client.patch(
        f"{PETS_URL}{pet.id}/",
        {"is_urgent_requested": False},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    pet.refresh_from_db()
    assert pet.is_urgent_requested is False
    assert pet.is_urgent_validated is False


@pytest.mark.parametrize("role_code", [RoleCode.STAFF, RoleCode.ADMIN])
def test_update_pet_allowed_for_staff_and_admin(role_code: str) -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    moderator = UserFactory(role__code=role_code)
    pet = PetFactory(published_by=owner, name="Original")
    PetHealthFactory(pet=pet)

    client = _auth_client(moderator)
    response = client.patch(f"{PETS_URL}{pet.id}/", {"name": "Editada"}, format="json")

    assert response.status_code == status.HTTP_200_OK
    pet.refresh_from_db()
    assert pet.name == "Editada"


def test_update_pet_forbidden_for_non_owner_member() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    intruder = UserFactory(role__code=RoleCode.MEMBER)
    pet = PetFactory(published_by=owner, name="Protegida")
    PetHealthFactory(pet=pet)

    client = _auth_client(intruder)
    response = client.patch(f"{PETS_URL}{pet.id}/", {"name": "Hackeada"}, format="json")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["detail"] == FORBIDDEN_ERROR_MESSAGE
    pet.refresh_from_db()
    assert pet.name == "Protegida"


# ---------------------------------------------------------------------------
# DELETE /api/pets/{id}/
# ---------------------------------------------------------------------------


def test_delete_pet_performs_soft_delete_for_owner_staff_and_admin() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    staff = UserFactory(role__code=RoleCode.STAFF)
    admin = UserFactory(role__code=RoleCode.ADMIN)

    for actor in (owner, staff, admin):
        pet = PetFactory(published_by=owner)
        client = _auth_client(actor)

        response = client.delete(f"{PETS_URL}{pet.id}/")

        assert response.status_code == status.HTTP_204_NO_CONTENT
        pet.refresh_from_db()
        assert pet.is_active is False
        assert Pet.objects.filter(pk=pet.id).exists()

        # Una mascota ya dada de baja responde 404 en operaciones posteriores.
        second_response = client.delete(f"{PETS_URL}{pet.id}/")
        assert second_response.status_code == status.HTTP_404_NOT_FOUND


def test_delete_pet_forbidden_for_other_member() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    intruder = UserFactory(role__code=RoleCode.MEMBER)
    pet = PetFactory(published_by=owner)

    client = _auth_client(intruder)
    response = client.delete(f"{PETS_URL}{pet.id}/")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    pet.refresh_from_db()
    assert pet.is_active is True


# ---------------------------------------------------------------------------
# POST /api/pets/{id}/adopt/
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("actor_role", [RoleCode.MEMBER, RoleCode.STAFF, RoleCode.ADMIN])
def test_adopt_pet_succeeds_from_published_and_logs_transition(actor_role: str) -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    actor = owner if actor_role == RoleCode.MEMBER else UserFactory(role__code=actor_role)
    pet = PetFactory(published_by=owner, status=Pet.Status.PUBLISHED)
    PetHealthFactory(pet=pet)

    client = _auth_client(actor)
    response = client.post(
        f"{PETS_URL}{pet.id}/adopt/",
        {"note": "Adoptada por familia de barrio Alberdi."},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == Pet.Status.ADOPTED

    pet.refresh_from_db()
    assert pet.status == Pet.Status.ADOPTED
    log = PetStatusLog.objects.filter(pet=pet, new_status=Pet.Status.ADOPTED).get()
    assert log.previous_status == Pet.Status.PUBLISHED
    assert log.performed_by_id == actor.id
    assert log.note == "Adoptada por familia de barrio Alberdi."


@pytest.mark.parametrize(
    "initial_status",
    [Pet.Status.IN_REVIEW, Pet.Status.REJECTED, Pet.Status.ADOPTED],
)
def test_adopt_pet_rejects_non_published_statuses(initial_status: str) -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    pet = PetFactory(published_by=owner, status=initial_status)

    client = _auth_client(owner)
    response = client.post(f"{PETS_URL}{pet.id}/adopt/", {}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert ADOPT_ONLY_PUBLISHED_ERROR in response.json()["status"]
    assert not PetStatusLog.objects.filter(pet=pet, new_status=Pet.Status.ADOPTED).exists()


def test_adopt_pet_forbidden_for_non_owner_member() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    intruder = UserFactory(role__code=RoleCode.MEMBER)
    pet = PetFactory(published_by=owner, status=Pet.Status.PUBLISHED)

    client = _auth_client(intruder)
    response = client.post(f"{PETS_URL}{pet.id}/adopt/", {}, format="json")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    pet.refresh_from_db()
    assert pet.status == Pet.Status.PUBLISHED


# ---------------------------------------------------------------------------
# POST /api/pets/{id}/photos/ y DELETE /api/pets/{id}/photos/{photo_id}/
# ---------------------------------------------------------------------------


def test_add_and_remove_pet_photos_with_soft_delete_and_reindexing() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    pet = PetFactory(published_by=owner)
    first_photo = PetPhotoFactory(pet=pet, position=0)

    client = _auth_client(owner)

    # Agregar segunda foto válida en formato WEBP
    upload_response = client.post(
        f"{PETS_URL}{pet.id}/photos/",
        {
            "image": _make_image(
                filename="segunda.webp",
                image_format="WEBP",
                content_type="image/webp",
            )
        },
        format="multipart",
    )
    assert upload_response.status_code == status.HTTP_201_CREATED
    second_photo_id = upload_response.json()["id"]
    assert upload_response.json()["position"] == 1

    # Borrar la foto principal (position=0) hace baja lógica y promueve la restante a position=0
    delete_response = client.delete(f"{PETS_URL}{pet.id}/photos/{first_photo.id}/")
    assert delete_response.status_code == status.HTTP_204_NO_CONTENT

    first_photo.refresh_from_db()
    assert first_photo.is_active is False

    remaining = PetPhoto.objects.get(pk=second_photo_id)
    assert remaining.is_active is True
    assert remaining.position == 0

    # Intentar borrar la última foto activa debe fallar
    last_delete_response = client.delete(f"{PETS_URL}{pet.id}/photos/{second_photo_id}/")
    assert last_delete_response.status_code == status.HTTP_400_BAD_REQUEST
    assert LAST_PHOTO_ERROR in last_delete_response.json()["photos"]
    remaining.refresh_from_db()
    assert remaining.is_active is True


def test_add_pet_photo_rejects_invalid_and_oversized_images() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    pet = PetFactory(published_by=owner)
    PetPhotoFactory(pet=pet, position=0)

    client = _auth_client(owner)

    oversized = SimpleUploadedFile(
        "gigante.jpg",
        b"\xff\xd8\xff" + (b"\x00" * MAX_IMAGE_SIZE_BYTES),
        content_type="image/jpeg",
    )
    response_size = client.post(
        f"{PETS_URL}{pet.id}/photos/",
        {"image": oversized},
        format="multipart",
    )
    assert response_size.status_code == status.HTTP_400_BAD_REQUEST
    assert IMAGE_TOO_LARGE_ERROR in response_size.json()["image"]

    gif = _make_image(filename="anim.gif", image_format="GIF", content_type="image/gif")
    response_gif = client.post(
        f"{PETS_URL}{pet.id}/photos/",
        {"image": gif},
        format="multipart",
    )
    assert response_gif.status_code == status.HTTP_400_BAD_REQUEST
    assert INVALID_IMAGE_FORMAT_ERROR in response_gif.json()["image"]


def test_photo_endpoints_enforce_owner_or_staff_admin_permissions() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    intruder = UserFactory(role__code=RoleCode.MEMBER)
    staff = UserFactory(role__code=RoleCode.STAFF)
    pet = PetFactory(published_by=owner)
    photo_0 = PetPhotoFactory(pet=pet, position=0)
    photo_1 = PetPhotoFactory(pet=pet, position=1)

    intruder_client = _auth_client(intruder)
    assert (
        intruder_client.post(
            f"{PETS_URL}{pet.id}/photos/",
            {"image": _make_image()},
            format="multipart",
        ).status_code
        == status.HTTP_403_FORBIDDEN
    )
    assert (
        intruder_client.delete(f"{PETS_URL}{pet.id}/photos/{photo_1.id}/").status_code
        == status.HTTP_403_FORBIDDEN
    )

    staff_client = _auth_client(staff)
    assert (
        staff_client.delete(f"{PETS_URL}{pet.id}/photos/{photo_1.id}/").status_code
        == status.HTTP_204_NO_CONTENT
    )
    assert photo_0.is_active is True


# ---------------------------------------------------------------------------
# Regla de vuelta a revisión al editar mascota publicada + Swagger
# ---------------------------------------------------------------------------


def test_owner_editing_published_pet_returns_to_in_review_and_logs() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    pet = PetFactory(published_by=owner, status=Pet.Status.PUBLISHED, description="Original")
    PetHealthFactory(pet=pet)

    client = _auth_client(owner)
    response = client.patch(
        f"{PETS_URL}{pet.id}/",
        {"description": "Descripción editada por el autor."},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == Pet.Status.IN_REVIEW

    pet.refresh_from_db()
    assert pet.status == Pet.Status.IN_REVIEW
    log = PetStatusLog.objects.filter(pet=pet, new_status=Pet.Status.IN_REVIEW).get()
    assert log.previous_status == Pet.Status.PUBLISHED
    assert log.performed_by_id == owner.id


def test_owner_editing_photos_of_published_pet_returns_to_in_review_and_logs() -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    pet = PetFactory(published_by=owner, status=Pet.Status.PUBLISHED)
    photo_0 = PetPhotoFactory(pet=pet, position=0)

    client = _auth_client(owner)

    # 1. Agregar foto en estado `published` vuelve a `in_review` y deja log
    add_response = client.post(
        f"{PETS_URL}{pet.id}/photos/",
        {"image": _make_image(filename="extra.jpg")},
        format="multipart",
    )
    assert add_response.status_code == status.HTTP_201_CREATED
    pet.refresh_from_db()
    assert pet.status == Pet.Status.IN_REVIEW
    assert (
        PetStatusLog.objects.filter(
            pet=pet,
            previous_status=Pet.Status.PUBLISHED,
            new_status=Pet.Status.IN_REVIEW,
            performed_by=owner,
        ).count()
        == 1
    )

    # 2. Volvemos a aprobar y borramos una foto: también debe volver a `in_review` y loguear
    pet.status = Pet.Status.PUBLISHED
    pet.save(update_fields=["status", "updated_at"])

    delete_response = client.delete(f"{PETS_URL}{pet.id}/photos/{photo_0.id}/")
    assert delete_response.status_code == status.HTTP_204_NO_CONTENT
    pet.refresh_from_db()
    assert pet.status == Pet.Status.IN_REVIEW
    assert (
        PetStatusLog.objects.filter(
            pet=pet,
            previous_status=Pet.Status.PUBLISHED,
            new_status=Pet.Status.IN_REVIEW,
            performed_by=owner,
        ).count()
        == 2
    )


@pytest.mark.parametrize("role_code", [RoleCode.STAFF, RoleCode.ADMIN])
def test_staff_and_admin_editing_published_pet_and_photos_keeps_published(
    role_code: str,
) -> None:
    owner = UserFactory(role__code=RoleCode.MEMBER)
    moderator = UserFactory(role__code=role_code)
    pet = PetFactory(published_by=owner, status=Pet.Status.PUBLISHED)
    PetHealthFactory(pet=pet)
    photo_0 = PetPhotoFactory(pet=pet, position=0)

    client = _auth_client(moderator)

    patch_response = client.patch(
        f"{PETS_URL}{pet.id}/",
        {"description": "Ajuste de moderación."},
        format="json",
    )
    assert patch_response.status_code == status.HTTP_200_OK
    pet.refresh_from_db()
    assert pet.status == Pet.Status.PUBLISHED

    add_response = client.post(
        f"{PETS_URL}{pet.id}/photos/",
        {"image": _make_image(filename="mod.jpg")},
        format="multipart",
    )
    assert add_response.status_code == status.HTTP_201_CREATED
    pet.refresh_from_db()
    assert pet.status == Pet.Status.PUBLISHED

    delete_response = client.delete(f"{PETS_URL}{pet.id}/photos/{photo_0.id}/")
    assert delete_response.status_code == status.HTTP_204_NO_CONTENT
    pet.refresh_from_db()
    assert pet.status == Pet.Status.PUBLISHED
    assert not PetStatusLog.objects.filter(pet=pet, new_status=Pet.Status.IN_REVIEW).exists()


def test_pets_endpoints_are_documented_in_openapi_schema() -> None:
    client = APIClient()
    response = client.get("/api/schema/", {"format": "json"})

    assert response.status_code == status.HTTP_200_OK
    paths = response.json()["paths"]
    assert "/api/pets/" in paths
    assert "/api/pets/{pet_id}/" in paths
    assert "/api/pets/{pet_id}/adopt/" in paths
    assert "/api/pets/{pet_id}/photos/" in paths
    assert "/api/pets/{pet_id}/photos/{photo_id}/" in paths
