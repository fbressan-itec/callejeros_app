"""Tests de ocultamiento y restauración de mascotas al desactivar y reactivar cuentas (BK-15c)."""

import pytest
from rest_framework.test import APIClient

from apps.pets.models import Favorite, Pet
from apps.pets.tests.factories import FavoriteFactory, PetFactory
from apps.users.models import RoleCode, User, UserStatusLog
from apps.users.services import deactivate_user, issue_tokens_for_user, reactivate_user
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _auth_client(user: User) -> APIClient:
    client = APIClient()
    tokens = issue_tokens_for_user(user, remember_me=False)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return client


@pytest.mark.parametrize(
    "reason",
    [UserStatusLog.Reason.ADMIN_ACTION, UserStatusLog.Reason.SELF_DELETED],
)
def test_deactivating_owner_hides_pets_without_modifying_rows_and_reactivating_restores(
    reason: str,
) -> None:
    admin = UserFactory(role__code=RoleCode.ADMIN)
    staff = UserFactory(role__code=RoleCode.STAFF)
    owner = UserFactory(role__code=RoleCode.MEMBER)
    other_member = UserFactory(role__code=RoleCode.MEMBER)

    published_pet = PetFactory(name="Loki", status=Pet.Status.PUBLISHED, published_by=owner)
    adopted_pet = PetFactory(name="Pancho", status=Pet.Status.ADOPTED, published_by=owner)
    in_review_pet = PetFactory(name="Mora", status=Pet.Status.IN_REVIEW, published_by=owner)
    visible_pet = PetFactory(name="Toby", status=Pet.Status.PUBLISHED, published_by=other_member)
    favorite = FavoriteFactory(user=other_member, pet=published_pet)

    anon_client = APIClient()
    other_client = _auth_client(other_member)
    staff_client = _auth_client(staff)

    # Desactivación (por Admin o baja propia).
    actor = admin if reason == UserStatusLog.Reason.ADMIN_ACTION else owner
    deactivate_user(target_user=owner, actor=actor, reason=reason)

    # Ninguna fila de Pet ni Favorite fue dada de baja ni alterada.
    for pet, expected_status in (
        (published_pet, Pet.Status.PUBLISHED),
        (adopted_pet, Pet.Status.ADOPTED),
        (in_review_pet, Pet.Status.IN_REVIEW),
    ):
        pet.refresh_from_db()
        assert pet.is_active is True
        assert pet.status == expected_status

    favorite.refresh_from_db()
    assert favorite.is_active is True

    # Catálogo disponible y catálogo de adoptadas ocultan sus mascotas.
    catalog_resp = anon_client.get("/api/pets/")
    assert catalog_resp.status_code == 200
    assert [p["id"] for p in catalog_resp.data["results"]] == [visible_pet.pk]

    adopted_resp = anon_client.get("/api/pets/?adopted=true")
    assert adopted_resp.status_code == 200
    assert adopted_resp.data["results"] == []

    # Ficha pública devuelve 404 para anónimos y otros miembros; Staff aún puede verla por ID.
    assert anon_client.get(f"/api/pets/{published_pet.pk}/").status_code == 404
    assert anon_client.get(f"/api/pets/{adopted_pet.pk}/").status_code == 404
    assert other_client.get(f"/api/pets/{published_pet.pk}/").status_code == 404
    assert staff_client.get(f"/api/pets/{published_pet.pk}/").status_code == 200

    # Favoritos de terceros la ocultan y no se puede agregar como favorita mientras está oculta.
    favs_resp = other_client.get("/api/pets/favorites/")
    assert favs_resp.status_code == 200
    assert favs_resp.data["results"] == []
    assert other_client.post(f"/api/pets/{adopted_pet.pk}/favorite/").status_code == 404

    # Cola de revisión de Staff oculta la mascota en revisión del usuario desactivado.
    queue_resp = staff_client.get("/api/pets/review-queue/")
    assert queue_resp.status_code == 200
    assert queue_resp.data["results"] == []

    # Al reactivar al usuario, todo vuelve a aparecer intacto.
    reactivate_user(target_user=owner, actor=admin)

    assert {p["id"] for p in anon_client.get("/api/pets/").data["results"]} == {
        published_pet.pk,
        visible_pet.pk,
    }
    assert [p["id"] for p in anon_client.get("/api/pets/?adopted=true").data["results"]] == [
        adopted_pet.pk
    ]
    assert anon_client.get(f"/api/pets/{published_pet.pk}/").status_code == 200
    assert [p["id"] for p in other_client.get("/api/pets/favorites/").data["results"]] == [
        published_pet.pk
    ]
    assert [p["id"] for p in staff_client.get("/api/pets/review-queue/").data["results"]] == [
        in_review_pet.pk
    ]
    assert Favorite.objects.filter(pk=favorite.pk, is_active=True).exists()
