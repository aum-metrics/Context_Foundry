import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app
from api.audit import log_audit_event

client = TestClient(app, base_url="http://localhost")

@patch("api.audit.db")
def test_log_audit_event(mock_db):
    """
    Test that log_audit_event correctly writes to Firestore
    """
    mock_collection = MagicMock()
    mock_document = MagicMock()
    mock_subcollection = MagicMock()
    
    mock_db.collection.return_value = mock_collection
    mock_collection.document.return_value = mock_document
    mock_document.collection.return_value = mock_subcollection

    log_audit_event(
        org_id="test_org",
        actor_id="user_123",
        event_type="document_ingestion",
        resource_id="doc_456",
        metadata={"filename": "test.pdf"}
    )
    
    mock_db.collection.assert_called_with("organizations")
    mock_collection.document.assert_called_with("test_org")
    mock_document.collection.assert_called_with("auditLogs")
    mock_subcollection.add.assert_called_once()
    
    # Verify the payload
    args, kwargs = mock_subcollection.add.call_args
    payload = args[0]
    assert payload["actorId"] == "user_123"
    assert payload["eventType"] == "document_ingestion"
    assert payload["resourceId"] == "doc_456"
    assert payload["status"] == "success"
    assert payload["metadata"]["filename"] == "test.pdf"

@patch("api.audit.db")
def test_get_org_audit_logs(mock_db):
    """
    Test the GET endpoint for retrieving audit logs.
    """
    # Mock Firestore stream
    mock_collection = MagicMock()
    mock_document = MagicMock()
    mock_subcollection = MagicMock()
    mock_query1 = MagicMock()
    mock_query2 = MagicMock()
    
    mock_db.collection.return_value = mock_collection
    mock_collection.document.return_value = mock_document
    mock_document.collection.return_value = mock_subcollection
    mock_subcollection.order_by.return_value = mock_query1
    mock_query1.limit.return_value = mock_query2
    
    mock_log = MagicMock()
    mock_log.to_dict.return_value = {"eventType": "test_event"}
    mock_query2.stream.return_value = [mock_log]
    
    try:
        response = client.get("/api/audit/logs/test_org", headers={"Authorization": "Bearer mock-dev-token"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["eventType"] == "test_event"
    finally:
        pass
