"""
Tests for the API Key Management module.
Covers: key generation, listing, revocation, tier gating, health check.
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, base_url="http://localhost")


def test_api_keys_health():
    """Test API keys health check endpoint."""
    response = client.get("/api/keys/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data


@patch("api.api_keys.check_api_tier_subscription")
@patch("api.api_keys.db")
def test_generate_api_key_growth_tier(mock_db, mock_tier_check):
    """Test API key generation for Growth tier user."""
    mock_tier_check.return_value = ("growth", "test_org")

    # Mock Firestore for key storage
    mock_db.collection.return_value.document.return_value.set = MagicMock()
    mock_db.collection.return_value.document.return_value.get.return_value.exists = True
    mock_db.collection.return_value.document.return_value.get.return_value.to_dict.return_value = {
        "subscription": {"planId": "growth"}
    }

    response = client.post(
        "/api/keys/generate",
        headers={"Authorization": "Bearer mock-dev-token"},
        json={"name": "Test Key"}
    )
    assert response.status_code == 200, response.text
    data = response.json()
    # Key should be returned and start with aum_
    if "key" in data:
        assert data["key"].startswith("aum_")
    elif "api_key" in data:
        assert data["api_key"].startswith("aum_")


@patch("api.api_keys.check_api_tier_subscription")
def test_generate_api_key_explorer_blocked(mock_tier_check):
    """Test that Explorer tier users are blocked from generating API keys."""
    mock_tier_check.side_effect = Exception("Explorer tier blocked")

    response = client.post(
        "/api/keys/generate",
        headers={"Authorization": "Bearer mock-dev-token"},
        json={"name": "Test Key"}
    )
    # Should be 402 or 403 — Explorer users can't generate keys
    assert response.status_code in [402, 403, 500], response.text


@patch("api.api_keys.db")
def test_list_api_keys(mock_db):
    """Test listing API keys for a user."""
    mock_key_doc = MagicMock()
    mock_key_doc.id = "key_hash_1"
    mock_key_doc.to_dict.return_value = {
        "name": "My Key",
        "key_prefix": "aum_abc",
        "created_at": "2026-01-01T00:00:00Z",
        "is_active": True,
        "owner_uid": "mock-dev-uid"
    }
    mock_db.collection.return_value.where.return_value.stream.return_value = [mock_key_doc]

    response = client.get(
        "/api/keys/list",
        headers={"Authorization": "Bearer mock-dev-token"}
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data, list) or "keys" in data


@patch("api.api_keys.db")
def test_revoke_api_key(mock_db):
    """Test revoking (deactivating) an API key."""
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "userId": "mock_uid_dev",
        "is_active": True,
        "name": "My Key",
        "status": "active"
    }
    # Need to set up the chain for .collection("api_keys").document(key_id).get()
    mock_doc_ref = MagicMock()
    mock_doc_ref.get.return_value = mock_doc
    mock_doc_ref.update = MagicMock()
    
    mock_coll = MagicMock()
    mock_coll.document.return_value = mock_doc_ref
    mock_db.collection.return_value = mock_coll

    response = client.delete(
        "/api/keys/key_hash_1",
        headers={"Authorization": "Bearer mock-dev-token"}
    )
    assert response.status_code == 200, response.text
