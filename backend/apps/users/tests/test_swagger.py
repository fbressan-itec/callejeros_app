"""Tests de disponibilidad y contenido del esquema OpenAPI y Swagger UI (BK-02d)."""

from rest_framework import status
from rest_framework.test import APIClient

SCHEMA_URL = "/api/schema/"
DOCS_URL = "/api/docs/"


def test_openapi_schema_endpoint_is_public_and_documents_auth_endpoints() -> None:
    client = APIClient()

    response = client.get(SCHEMA_URL, HTTP_ACCEPT="application/json")

    assert response.status_code == status.HTTP_200_OK
    schema = response.json()
    assert schema["info"]["title"] == "API de Callejeros Río Cuarto"

    paths = schema["paths"]
    expected_endpoints = {
        "/api/auth/register/": ("post", "201"),
        "/api/auth/login/": ("post", "200"),
        "/api/auth/refresh/": ("post", "200"),
        "/api/auth/logout/": ("post", "204"),
        "/api/auth/me/": ("get", "200"),
    }

    for path, (method, success_code) in expected_endpoints.items():
        assert path in paths
        operation = paths[path][method]
        assert operation["tags"] == ["Autenticación"]
        assert operation.get("summary")
        assert operation.get("description")
        assert success_code in operation["responses"]


def test_swagger_ui_endpoint_is_public_and_renders_html() -> None:
    client = APIClient()

    response = client.get(DOCS_URL)

    assert response.status_code == status.HTTP_200_OK
    assert "text/html" in response["Content-Type"]
    html = response.content.decode("utf-8")
    assert "API de Callejeros Río Cuarto" in html
    assert SCHEMA_URL in html
