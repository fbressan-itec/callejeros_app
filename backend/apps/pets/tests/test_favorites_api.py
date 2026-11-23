"""Tests de API para favoritos de mascotas, filtro en catálogo, `is_favorite` y Swagger (BK-05b)."""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.pets.models import Favorite, Pet
from apps.pets.tests.factories import FavoriteFactory, PetFactory
from apps.users.models import RoleCode
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_favorites_endpoints_require_authentication() -> None:
    pet = PetFactory(status=Pet.Status.PUBLISHED)
    client = APIClient()

    assert client.post(f"/api/pets/{pet.id}/favorite/").status_code == status.HTTP_401_UNAUTHORIZED
    assert (
        client.delete(f"/api/pets/{pet.id}/favorite/").status_code == status.HTTP_401_UNAUTHORIZED
    )
    assert client.get("/api/pets/favorites/").status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.parametrize(
    "role_code",
    [RoleCode.MEMBER, RoleCode.VERIFIED_SHELTER, RoleCode.STAFF, RoleCode.ADMIN],
)
def test_all_authenticated_roles_can_manage_favorites(role_code: str) -> None:
    user = UserFactory(role__code=role_code)
    pet = PetFactory(status=Pet.Status.PUBLISHED)
    client = _auth_client(user)

    add_resp = client.post(f"/api/pets/{pet.id}/favorite/")
    assert add_resp.status_code == status.HTTP_201_CREATED
    assert add_resp.json() == {"pet_id": pet.id, "is_favorite": True}

    list_resp = client.get("/api/pets/favorites/")
    assert list_resp.status_code == status.HTTP_200_OK
    assert [item["id"] for item in list_resp.json()["results"]] == [pet.id]

    del_resp = client.delete(f"/api/pets/{pet.id}/favorite/")
    assert del_resp.status_code == status.HTTP_204_NO_CONTENT


def test_add_remove_reactivate_favorite_is_idempotent_and_soft_deletes() -> None:
    user = UserFactory()
    pet = PetFactory(status=Pet.Status.PUBLISHED)
    client = _auth_client(user)

    # Primera marcación: crea el registro (201)
    first_add = client.post(f"/api/pets/{pet.id}/favorite/")
    assert first_add.status_code == status.HTTP_201_CREATED
    assert first_add.json() == {"pet_id": pet.id, "is_favorite": True}
    assert Favorite.objects.filter(user=user, pet=pet, is_active=True).count() == 1

    # Segunda marcación: idempotente (200) sin duplicar
    second_add = client.post(f"/api/pets/{pet.id}/favorite/")
    assert second_add.status_code == status.HTTP_200_OK
    assert second_add.json() == {"pet_id": pet.id, "is_favorite": True}
    assert Favorite.objects.filter(user=user, pet=pet).count() == 1

    # Desmarcar: baja lógica (204), la fila persiste inactiva
    first_remove = client.delete(f"/api/pets/{pet.id}/favorite/")
    assert first_remove.status_code == status.HTTP_204_NO_CONTENT
    favorite = Favorite.objects.get(user=user, pet=pet)
    assert favorite.is_active is False

    # Volver a desmarcar: idempotente (204)
    second_remove = client.delete(f"/api/pets/{pet.id}/favorite/")
    assert second_remove.status_code == status.HTTP_204_NO_CONTENT

    # Volver a marcar: reactiva la misma fila (200) sin crear duplicado
    reactivate = client.post(f"/api/pets/{pet.id}/favorite/")
    assert reactivate.status_code == status.HTTP_200_OK
    assert reactivate.json() == {"pet_id": pet.id, "is_favorite": True}
    favorite.refresh_from_db()
    assert favorite.is_active is True
    assert Favorite.objects.filter(user=user, pet=pet).count() == 1


def test_add_favorite_rejects_non_public_or_inactive_pets_with_404() -> None:
    user = UserFactory()
    client = _auth_client(user)

    in_review_pet = PetFactory(status=Pet.Status.IN_REVIEW)
    rejected_pet = PetFactory(status=Pet.Status.REJECTED)
    inactive_pet = PetFactory(status=Pet.Status.PUBLISHED)
    inactive_pet.deactivate()
    adopted_pet = PetFactory(status=Pet.Status.ADOPTED)

    assert (
        client.post(f"/api/pets/{in_review_pet.id}/favorite/").status_code
        == status.HTTP_404_NOT_FOUND
    )
    assert (
        client.post(f"/api/pets/{rejected_pet.id}/favorite/").status_code
        == status.HTTP_404_NOT_FOUND
    )
    assert (
        client.post(f"/api/pets/{inactive_pet.id}/favorite/").status_code
        == status.HTTP_404_NOT_FOUND
    )
    assert client.post("/api/pets/999999/favorite/").status_code == status.HTTP_404_NOT_FOUND
    assert client.delete("/api/pets/999999/favorite/").status_code == status.HTTP_404_NOT_FOUND

    # Una mascota adoptada sigue siendo visible y se puede marcar como favorita
    adopted_resp = client.post(f"/api/pets/{adopted_pet.id}/favorite/")
    assert adopted_resp.status_code == status.HTTP_201_CREATED


def test_my_favorites_list_filters_privacy_ordering_and_pagination() -> None:
    user = UserFactory()
    other_user = UserFactory()
    client = _auth_client(user)

    # 13 mascotas publicadas marcadas como favoritas por `user` para probar paginación de a 12
    user_pets = [
        PetFactory(name=f"Fav {idx:02d}", status=Pet.Status.PUBLISHED) for idx in range(13)
    ]
    for pet in user_pets:
        FavoriteFactory(user=user, pet=pet)

    # Favorito de otro usuario, favorito dado de baja y mascota dada de baja no deben aparecer
    other_pet = PetFactory(name="Ajena", status=Pet.Status.PUBLISHED)
    FavoriteFactory(user=other_user, pet=other_pet)

    removed_fav_pet = PetFactory(name="Desmarcada", status=Pet.Status.PUBLISHED)
    removed_fav = FavoriteFactory(user=user, pet=removed_fav_pet)
    removed_fav.deactivate()

    deleted_pet = PetFactory(name="Baja", status=Pet.Status.PUBLISHED)
    FavoriteFactory(user=user, pet=deleted_pet)
    deleted_pet.deactivate()

    page1 = client.get("/api/pets/favorites/")
    assert page1.status_code == status.HTTP_200_OK
    body1 = page1.json()
    assert body1["count"] == 13
    assert len(body1["results"]) == 12
    assert body1["next"] is not None
    assert body1["previous"] is None
    assert all(item["is_favorite"] is True for item in body1["results"])
    assert all("contact_phone" not in item for item in body1["results"])

    page2 = client.get("/api/pets/favorites/?page=2")
    assert page2.status_code == status.HTTP_200_OK
    body2 = page2.json()
    assert body2["count"] == 13
    assert len(body2["results"]) == 1
    assert body2["next"] is None


def test_catalog_favorites_filter_and_is_favorite_field() -> None:
    user = UserFactory()
    other_user = UserFactory()

    dog_fav = PetFactory(
        name="Loki",
        species=Pet.Species.DOG,
        status=Pet.Status.PUBLISHED,
    )
    cat_fav = PetFactory(
        name="Luna",
        species=Pet.Species.CAT,
        status=Pet.Status.PUBLISHED,
    )
    dog_not_fav = PetFactory(
        name="Rocco",
        species=Pet.Species.DOG,
        status=Pet.Status.PUBLISHED,
    )
    adopted_fav = PetFactory(
        name="Pancho",
        species=Pet.Species.DOG,
        status=Pet.Status.ADOPTED,
    )

    FavoriteFactory(user=user, pet=dog_fav)
    FavoriteFactory(user=user, pet=cat_fav)
    FavoriteFactory(user=user, pet=adopted_fav)
    FavoriteFactory(user=other_user, pet=dog_not_fav)

    # Anónimo: `is_favorite` siempre false y `?favorites=true` devuelve vacío
    anon_client = APIClient()
    anon_catalog = anon_client.get("/api/pets/").json()["results"]
    assert all(item["is_favorite"] is False for item in anon_catalog)

    anon_favs = anon_client.get("/api/pets/?favorites=true").json()
    assert anon_favs["count"] == 0
    assert anon_favs["results"] == []

    # Autenticado: `is_favorite` refleja solo los favoritos propios
    client = _auth_client(user)
    catalog_by_id = {item["id"]: item for item in client.get("/api/pets/").json()["results"]}
    assert catalog_by_id[dog_fav.id]["is_favorite"] is True
    assert catalog_by_id[cat_fav.id]["is_favorite"] is True
    assert catalog_by_id[dog_not_fav.id]["is_favorite"] is False

    # `?favorites=true` en catálogo devuelve solo publicados favoritos (no adoptados)
    fav_published = client.get("/api/pets/?favorites=true").json()
    assert {item["id"] for item in fav_published["results"]} == {dog_fav.id, cat_fav.id}

    # Combinable con otros filtros (`species=dog`) y con `adopted=true`
    fav_dogs = client.get("/api/pets/?favorites=true&species=dog").json()
    assert [item["id"] for item in fav_dogs["results"]] == [dog_fav.id]

    fav_adopted = client.get("/api/pets/?favorites=true&adopted=true").json()
    assert [item["id"] for item in fav_adopted["results"]] == [adopted_fav.id]

    # `?favorites=false` excluye los favoritos del usuario
    non_favs = client.get("/api/pets/?favorites=false").json()
    assert [item["id"] for item in non_favs["results"]] == [dog_not_fav.id]

    # Ficha individual (`GET /api/pets/{id}/`): `is_favorite` según sesión
    assert client.get(f"/api/pets/{dog_fav.id}/").json()["is_favorite"] is True
    assert client.get(f"/api/pets/{dog_not_fav.id}/").json()["is_favorite"] is False
    assert anon_client.get(f"/api/pets/{dog_fav.id}/").json()["is_favorite"] is False


def test_favorites_endpoints_and_filter_appear_in_openapi_schema() -> None:
    client = APIClient()
    response = client.get("/api/schema/?format=json")
    assert response.status_code == status.HTTP_200_OK

    paths = response.json()["paths"]
    assert "get" in paths["/api/pets/favorites/"]
    assert "post" in paths["/api/pets/{pet_id}/favorite/"]
    assert "delete" in paths["/api/pets/{pet_id}/favorite/"]

    catalog_params = {param["name"] for param in paths["/api/pets/"]["get"]["parameters"]}
    assert "favorites" in catalog_params
