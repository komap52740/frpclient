from __future__ import annotations

import json

import pytest
from django.conf import settings
from rest_framework.test import APIClient


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.mark.django_db
def test_openapi_schema_endpoint_is_public_and_contains_security_schemes(api_client: APIClient):
    response = api_client.get("/api/schema/", HTTP_ACCEPT="application/json")

    assert response.status_code == 200
    payload = json.loads(response.content.decode("utf-8"))
    assert payload["openapi"].startswith("3.")
    assert payload["info"]["title"] == settings.OPENAPI_TITLE
    assert payload["info"]["version"] == settings.OPENAPI_VERSION
    assert "/api/health/" in payload["paths"]
    assert "BearerAuth" in payload["components"]["securitySchemes"]
    assert "SessionCookieAuth" in payload["components"]["securitySchemes"]


@pytest.mark.django_db
def test_openapi_swagger_ui_endpoint_is_public(api_client: APIClient):
    response = api_client.get("/api/schema/swagger/")

    assert response.status_code == 200
    body = response.content.decode("utf-8")
    assert "SwaggerUIBundle" in body
    assert "/api/schema/" in body


@pytest.mark.django_db
def test_openapi_redoc_ui_endpoint_is_public(api_client: APIClient):
    response = api_client.get("/api/schema/redoc/")

    assert response.status_code == 200
    body = response.content.decode("utf-8")
    assert "redoc" in body.lower()
    assert "/api/schema/" in body
