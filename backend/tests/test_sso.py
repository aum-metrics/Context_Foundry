"""
Tests for the SSO module.
Covers: provider listing, SSO status check, domain lookup (with anti-enumeration masking),
SSO configuration, and login redirect.
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app, base_url="http://localhost")


def test_list_sso_providers():
    """Test listing available SSO providers."""
    response = client.get("/api/sso/providers")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    providers = data["providers"]
    provider_ids = [p["id"] for p in providers]
    assert "okta" in provider_ids
    assert "azure_ad" in provider_ids
    assert "google" in provider_ids


@patch("core.security.verify_user_org_access")
@patch("api.sso.db")
def test_sso_status_not_configured(mock_db, mock_verify):
    """Test SSO status for an org with no SSO config."""
    mock_verify.return_value = True

    mock_doc = MagicMock()
    mock_doc.exists = False
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    response = client.get(
        "/api/sso/status/test_org",
        headers={"Authorization": "Bearer mock-dev-token"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["configured"] is False
    assert data["enabled"] is False


@patch("core.security.verify_user_org_access")
@patch("api.sso.db")
def test_sso_status_configured_active(mock_db, mock_verify):
    """Test SSO status for an org with active SSO."""
    mock_verify.return_value = True

    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {"provider": "okta", "is_active": True}
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    response = client.get(
        "/api/sso/status/test_org",
        headers={"Authorization": "Bearer mock-dev-token"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["configured"] is True
    assert data["enabled"] is True
    assert data["provider"] == "okta"


@patch("core.security.verify_user_org_access")
@patch("api.sso.db")
def test_sso_status_unauthorized(mock_db, mock_verify):
    """Test SSO status rejects unauthorized users."""
    mock_verify.return_value = False
    response = client.get(
        "/api/sso/status/test_org",
        headers={"Authorization": "Bearer mock-dev-token"}
    )
    assert response.status_code == 403


@patch("api.sso.db")
def test_sso_lookup_invalid_domain_format(mock_db):
    """Test domain lookup rejects email format (@ in domain)."""
    response = client.get("/api/sso/lookup?domain=user@example.com")
    assert response.status_code == 400


@patch("api.sso.db")
def test_sso_lookup_no_config_returns_masked_response(mock_db):
    """Test domain lookup returns anti-enumeration masked response for unconfigured domains."""
    # No results from query
    mock_db.collection.return_value.where.return_value.limit.return_value.stream.return_value = []
    mock_db.collection.return_value.document.return_value.get.return_value = MagicMock()

    response = client.get("/api/sso/lookup?domain=unknown.com")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    # Should still return an intent_token (masked), not leak "not found"
    assert "intent_token" in data


@patch("api.sso.db")
def test_sso_login_expired_intent(mock_db):
    """Test SSO login rejects expired intent tokens."""
    import jwt
    from core.config import settings
    from datetime import datetime, timezone

    payload = {
        "org_id": "test_org",
        "provider": "okta",
        "exp": (datetime(2020, 1, 1, tzinfo=timezone.utc)).timestamp()
    }
    expired_token = jwt.encode(payload, settings.SSO_ENCRYPTION_KEY, algorithm="HS256")

    response = client.get(f"/api/sso/login?intent={expired_token}")
    assert response.status_code == 400
    assert "expired" in response.json()["detail"].lower()
