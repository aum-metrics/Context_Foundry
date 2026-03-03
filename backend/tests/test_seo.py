"""
Tests for the SEO Audit module.
Covers: audit submission, status check, dev-mode mock, unauthorized access.
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app, base_url="http://localhost")


@patch("api.seo.verify_user_org_access")
@patch("api.seo.db")
def test_seo_audit_submission(mock_db, mock_verify):
    """Test SEO audit job submission returns processing status."""
    mock_verify.return_value = True

    mock_org_doc = MagicMock()
    mock_org_doc.exists = True
    mock_org_doc.to_dict.return_value = {"subscription": {"planId": "growth"}}
    mock_db.collection.return_value.document.return_value.get.return_value = mock_org_doc
    mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.set = MagicMock()

    response = client.post(
        "/api/seo/audit",
        headers={"Authorization": "Bearer mock-dev-token"},
        json={"url": "https://example.com", "orgId": "test_org"}
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] == "processing"
    assert "jobId" in data


@patch("api.seo.verify_user_org_access")
@patch("api.seo.db")
def test_seo_audit_explorer_blocked(mock_db, mock_verify):
    """Test that Explorer tier users are blocked from SEO audits."""
    mock_verify.return_value = True

    mock_org_doc = MagicMock()
    mock_org_doc.exists = True
    mock_org_doc.to_dict.return_value = {"subscription": {"planId": "explorer"}}
    mock_db.collection.return_value.document.return_value.get.return_value = mock_org_doc

    response = client.post(
        "/api/seo/audit",
        headers={"Authorization": "Bearer mock-dev-token"},
        json={"url": "https://example.com", "orgId": "test_org"}
    )
    assert response.status_code == 403, response.text


@patch("api.seo.verify_user_org_access")
@patch("api.seo.db")
def test_seo_audit_status_check(mock_db, mock_verify):
    """Test SEO audit job status retrieval."""
    mock_verify.return_value = True

    mock_job = MagicMock()
    mock_job.exists = True
    mock_job.to_dict.return_value = {
        "status": "completed",
        "result": {"seoScore": 85, "overallScore": 80}
    }
    mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value = mock_job

    response = client.get(
        "/api/seo/audit/status/test_org/job_123",
        headers={"Authorization": "Bearer mock-dev-token"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "completed"


@patch("api.seo.verify_user_org_access")
@patch("api.seo.db")
def test_seo_audit_status_not_found(mock_db, mock_verify):
    """Test SEO audit returns 404 for non-existent job."""
    mock_verify.return_value = True

    mock_job = MagicMock()
    mock_job.exists = False
    mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value = mock_job

    response = client.get(
        "/api/seo/audit/status/test_org/nonexistent",
        headers={"Authorization": "Bearer mock-dev-token"}
    )
    assert response.status_code == 404


@patch("api.seo.verify_user_org_access")
def test_seo_audit_unauthorized(mock_verify):
    """Test SEO audit rejects unauthorized users."""
    mock_verify.return_value = False
    response = client.post(
        "/api/seo/audit",
        headers={"Authorization": "Bearer mock-dev-token"},
        json={"url": "https://example.com", "orgId": "test_org"}
    )
    assert response.status_code == 403
