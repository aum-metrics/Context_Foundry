"""
Tests for the Cron billing quota reset endpoint.
Covers: auth (cron secret), force-all reset, cycle-anchor logic, db unavailable.
"""
import pytest
import os
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app, base_url="http://localhost")


@patch("api.cron.db")
def test_reset_quotas_dev_mode_no_secret(mock_db):
    """Test cron runs without secret in development mode."""
    mock_org = MagicMock()
    mock_org.id = "org_1"
    mock_org.to_dict.return_value = {
        "subscription": {"simsThisCycle": 5, "cycleAnchor": 1}
    }
    mock_db.collection.return_value.stream.return_value = [mock_org]
    mock_db.batch.return_value = MagicMock()

    with patch.dict(os.environ, {"CRON_SECRET": ""}, clear=False):
        response = client.post("/api/cron/reset-quotas")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] == "success"


@patch("api.cron.db")
def test_reset_quotas_force_all(mock_db):
    """Test force_all=true resets all orgs regardless of cycle anchor."""
    mock_org = MagicMock()
    mock_org.id = "org_1"
    mock_org.to_dict.return_value = {
        "subscription": {"simsThisCycle": 50, "cycleAnchor": 15}
    }
    mock_db.collection.return_value.stream.return_value = [mock_org]
    mock_batch = MagicMock()
    mock_db.batch.return_value = mock_batch

    with patch.dict(os.environ, {"CRON_SECRET": ""}, clear=False):
        response = client.post("/api/cron/reset-quotas?force_all=true")
    assert response.status_code == 200
    data = response.json()
    assert data["reset_count"] >= 1


@patch("api.cron.db")
def test_reset_quotas_with_valid_cron_secret(mock_db):
    """Test cron endpoint accepts valid secret."""
    mock_db.collection.return_value.stream.return_value = []
    mock_db.batch.return_value = MagicMock()

    with patch.dict(os.environ, {"CRON_SECRET": "my_secret"}, clear=False):
        response = client.post(
            "/api/cron/reset-quotas",
            headers={"Authorization": "Bearer my_secret"}
        )
    assert response.status_code == 200


@patch("api.cron.db")
def test_reset_quotas_invalid_secret(mock_db):
    """Test cron endpoint rejects invalid secret."""
    with patch.dict(os.environ, {"CRON_SECRET": "real_secret"}, clear=False):
        response = client.post(
            "/api/cron/reset-quotas",
            headers={"Authorization": "Bearer wrong_secret"}
        )
    assert response.status_code == 401


def test_reset_quotas_db_unavailable(patch_firestore):
    """Test cron returns 503 when db is None."""
    with patch("api.cron.db", None):
        with patch.dict(os.environ, {"CRON_SECRET": ""}, clear=False):
            response = client.post("/api/cron/reset-quotas")
    assert response.status_code == 503
