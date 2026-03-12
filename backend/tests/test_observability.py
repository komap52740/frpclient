from __future__ import annotations

import re

import pytest
from rest_framework.test import APIClient

from config.observability import REDACTED_VALUE, redact_sensitive_processor


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.mark.django_db
def test_request_id_is_echoed_when_client_sends_valid_header(api_client: APIClient):
    request_id = "frontend-test-req-12345"
    response = api_client.get("/api/health/", HTTP_X_REQUEST_ID=request_id)

    assert response.status_code == 200
    assert response["X-Request-ID"] == request_id


@pytest.mark.django_db
def test_request_id_is_generated_for_invalid_header(api_client: APIClient):
    response = api_client.get("/api/health/", HTTP_X_REQUEST_ID="***")

    assert response.status_code == 200
    generated_request_id = response["X-Request-ID"]
    assert generated_request_id != "***"
    assert re.fullmatch(r"[a-f0-9]{32}", generated_request_id)


def test_redact_sensitive_processor_masks_nested_sensitive_fields():
    payload = {
        "password": "plain-secret",
        "nested": {
            "authorization": "Bearer abc",
            "rustdesk_password": "rd-secret",
            "safe": "ok",
        },
        "items": [{"refresh_token": "123"}, {"safe": "visible"}],
    }

    processed = redact_sensitive_processor(None, "info", payload)

    assert processed["password"] == REDACTED_VALUE
    assert processed["nested"]["authorization"] == REDACTED_VALUE
    assert processed["nested"]["rustdesk_password"] == REDACTED_VALUE
    assert processed["nested"]["safe"] == "ok"
    assert processed["items"][0]["refresh_token"] == REDACTED_VALUE
    assert processed["items"][1]["safe"] == "visible"
