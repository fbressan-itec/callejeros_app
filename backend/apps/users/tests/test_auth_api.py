"""Tests de los endpoints de registro, login, refresh y logout con JWT (BK-02b)."""

from datetime import timedelta

import pytest
from django.conf import settings
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import RoleCode, User, UserPreferences
from apps.users.services import PASSWORD_MIN_LENGTH_ERROR
from apps.users.tests.factories import UserFactory

REGISTER_URL = "/api/auth/register/"
LOGIN_URL = "/api/auth/login/"
REFRESH_URL = "/api/auth/refresh/"
LOGOUT_URL = "/api/auth/logout/"


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.mark.django_db
def test_register_creates_member_user_with_hashed_password_and_returns_jwt(
    api_client: APIClient,
) -> None:
    payload = {
        "email": "  Nuevo.Vecino@Callejeros.ar ",
        "password": "ClaveSegura123!",
        "first_name": "Lucía",
        "last_name": "Gómez",
    }

    response = api_client.post(REGISTER_URL, payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "access" in data
    assert "refresh" in data
    assert data["user"]["email"] == "nuevo.vecino@callejeros.ar"
    assert data["user"]["first_name"] == "Lucía"
    assert data["user"]["last_name"] == "Gómez"
    assert data["user"]["is_phone_verified"] is False
    assert data["user"]["role"] == {
        "code": RoleCode.MEMBER,
        "name": "Miembro de la comunidad",
    }
    assert "password" not in data["user"]
    assert "address" not in data["user"]

    user = User.objects.get(email="nuevo.vecino@callejeros.ar")
    assert user.password != payload["password"]
    assert user.check_password(payload["password"]) is True
    assert UserPreferences.objects.filter(user=user).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("short_password", ["", "1", "12345", "abcde"])
def test_register_with_short_password_returns_exact_error_message(
    api_client: APIClient,
    short_password: str,
) -> None:
    response = api_client.post(
        REGISTER_URL,
        {
            "email": "corto@callejeros.ar",
            "password": short_password,
            "first_name": "Mateo",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["password"] == [PASSWORD_MIN_LENGTH_ERROR]
    assert not User.objects.filter(email="corto@callejeros.ar").exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("weak_password", "expected_errors"),
    [
        (
            "123456",
            [
                "La contraseña tiene un valor demasiado común.",
                "La contraseña está formada completamente por dígitos.",
            ],
        ),
        (
            "perrito",
            ["La contraseña tiene un valor demasiado común."],
        ),
    ],
)
def test_register_rejects_common_and_numeric_passwords(
    api_client: APIClient,
    weak_password: str,
    expected_errors: list[str],
) -> None:
    response = api_client.post(
        REGISTER_URL,
        {
            "email": "debil@callejeros.ar",
            "password": weak_password,
            "first_name": "Mateo",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["password"] == expected_errors
    assert not User.objects.filter(email="debil@callejeros.ar").exists()


@pytest.mark.django_db
def test_register_rejects_duplicate_email_case_insensitive(api_client: APIClient) -> None:
    UserFactory(email="repetido@callejeros.ar")

    response = api_client.post(
        REGISTER_URL,
        {
            "email": "REPETIDO@Callejeros.ar",
            "password": "ClaveSegura123!",
            "first_name": "Sofía",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "email" in response.json()


@pytest.mark.django_db
def test_register_validates_mock_verification_code_when_provided(
    api_client: APIClient,
) -> None:
    bad_response = api_client.post(
        REGISTER_URL,
        {
            "email": "telefono@callejeros.ar",
            "password": "ClaveSegura123!",
            "first_name": "Valentina",
            "phone": "3584123456",
            "verification_code": "0000",
        },
        format="json",
    )
    assert bad_response.status_code == status.HTTP_400_BAD_REQUEST
    assert "verification_code" in bad_response.json()

    ok_response = api_client.post(
        REGISTER_URL,
        {
            "email": "telefono@callejeros.ar",
            "password": "ClaveSegura123!",
            "first_name": "Valentina",
            "phone": "3584123456",
            "verification_code": settings.MOCK_VERIFICATION_CODE,
        },
        format="json",
    )
    assert ok_response.status_code == status.HTTP_201_CREATED
    assert ok_response.json()["user"]["is_phone_verified"] is True


@pytest.mark.django_db
def test_login_without_remember_me_sets_one_day_refresh_lifetime(
    api_client: APIClient,
) -> None:
    UserFactory(email="login@callejeros.ar", password="ClaveSegura123!")

    response = api_client.post(
        LOGIN_URL,
        {
            "email": "  LOGIN@callejeros.ar ",
            "password": "ClaveSegura123!",
            "remember_me": False,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    refresh_token = RefreshToken(data["refresh"])
    lifetime_seconds = refresh_token["exp"] - refresh_token["iat"]
    expected_seconds = int(timedelta(days=settings.JWT_REFRESH_LIFETIME_DAYS).total_seconds())
    assert lifetime_seconds == expected_seconds


@pytest.mark.django_db
def test_login_with_remember_me_sets_thirty_days_refresh_lifetime(
    api_client: APIClient,
) -> None:
    UserFactory(email="recordarme@callejeros.ar", password="ClaveSegura123!")

    response = api_client.post(
        LOGIN_URL,
        {
            "email": "recordarme@callejeros.ar",
            "password": "ClaveSegura123!",
            "remember_me": True,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    refresh_token = RefreshToken(data["refresh"])
    lifetime_seconds = refresh_token["exp"] - refresh_token["iat"]
    expected_seconds = int(
        timedelta(days=settings.JWT_REMEMBER_ME_REFRESH_LIFETIME_DAYS).total_seconds()
    )
    assert lifetime_seconds == expected_seconds


@pytest.mark.django_db
def test_login_rejects_wrong_password_or_inactive_user(api_client: APIClient) -> None:
    user = UserFactory(email="activo@callejeros.ar", password="ClaveSegura123!")

    wrong_pass = api_client.post(
        LOGIN_URL,
        {"email": "activo@callejeros.ar", "password": "OtraClave999!"},
        format="json",
    )
    assert wrong_pass.status_code == status.HTTP_401_UNAUTHORIZED
    assert "detail" in wrong_pass.json()

    user.deactivate()
    inactive_resp = api_client.post(
        LOGIN_URL,
        {"email": "activo@callejeros.ar", "password": "ClaveSegura123!"},
        format="json",
    )
    assert inactive_resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert "detail" in inactive_resp.json()


@pytest.mark.django_db
def test_refresh_and_logout_blacklist_flow(api_client: APIClient) -> None:
    UserFactory(email="sesion@callejeros.ar", password="ClaveSegura123!")

    login_resp = api_client.post(
        LOGIN_URL,
        {"email": "sesion@callejeros.ar", "password": "ClaveSegura123!"},
        format="json",
    )
    refresh_token = login_resp.json()["refresh"]

    refresh_resp = api_client.post(
        REFRESH_URL,
        {"refresh": refresh_token},
        format="json",
    )
    assert refresh_resp.status_code == status.HTTP_200_OK
    assert "access" in refresh_resp.json()

    logout_resp = api_client.post(
        LOGOUT_URL,
        {"refresh": refresh_token},
        format="json",
    )
    assert logout_resp.status_code == status.HTTP_204_NO_CONTENT

    # Un refresh token dado de baja ya no puede emitir nuevos access tokens
    after_logout_refresh = api_client.post(
        REFRESH_URL,
        {"refresh": refresh_token},
        format="json",
    )
    assert after_logout_refresh.status_code == status.HTTP_401_UNAUTHORIZED

    # Intentar cerrar sesión de nuevo con el mismo token o uno inválido devuelve 400
    second_logout = api_client.post(
        LOGOUT_URL,
        {"refresh": refresh_token},
        format="json",
    )
    assert second_logout.status_code == status.HTTP_400_BAD_REQUEST
    assert "refresh" in second_logout.json()
