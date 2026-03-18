"""
Tests for the RAG Support Chatbot endpoint.
Covers: auth, BYOK key extraction (Bug #1 fix), dev-mode fallback, missing manifest, 
and the full RAG pipeline with semantic chunk retrieval.
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, base_url="http://localhost")


@patch("api.chatbot.verify_user_org_access")
@patch("api.chatbot.AsyncOpenAI")
@patch("api.chatbot.db")
def test_chatbot_happy_path(mock_db, mock_openai, mock_verify):
    """Test chatbot endpoint returns a response when manifest chunks exist."""
    mock_verify.return_value = True

    # Mock org doc with apiKeys (tests Bug #1 fix: key extracted before pop)
    mock_org_ref = MagicMock()
    mock_org_ref.exists = True
    mock_org_ref.to_dict.return_value = {"apiKeys": {"openai": "sk-test-key"}}

    mock_manifest_doc = MagicMock()
    mock_manifest_doc.reference = MagicMock()
    mock_manifest_doc.to_dict.return_value = {"content": "mock content", "createdAt": "2026-01-01"}

    chunk_doc = MagicMock()
    chunk_doc.to_dict.return_value = {"embedding": [0.1] * 1536, "text": "AUM is a platform for AI brand monitoring."}
    mock_manifest_doc.reference.collection.return_value.get.return_value = [chunk_doc]

    def db_collection_side_effect(name):
        mock_coll = MagicMock()
        if name == "organizations":
            mock_doc_ref = MagicMock()
            mock_doc_ref.get.return_value = mock_org_ref
            # For manifest stream
            mock_subcoll = MagicMock()
            mock_subcoll.order_by.return_value.limit.return_value.stream.return_value = iter([mock_manifest_doc])
            mock_doc_ref.collection.return_value = mock_subcoll
            mock_coll.document.return_value = mock_doc_ref
        return mock_coll

    mock_db.collection.side_effect = db_collection_side_effect

    # Mock OpenAI client
    mock_client = MagicMock()
    mock_openai.return_value = mock_client

    mock_embed = MagicMock()
    mock_embed.embedding = [0.1] * 1536
    mock_client.embeddings.create = AsyncMock(return_value=MagicMock(data=[mock_embed]))

    mock_choice = MagicMock()
    mock_choice.message.content = "Based on the retrieved context, AUM monitors AI brand health."
    mock_client.chat.completions.create = AsyncMock(return_value=MagicMock(choices=[mock_choice]))

    response = client.post(
        "/api/chatbot/ask",
        headers={"Authorization": "Bearer mock-dev-token"},
        json={"orgId": "test_org", "query": "What does AUM do?"}
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "response" in data
    assert len(data["response"]) > 0


@patch("api.chatbot.verify_user_org_access")
def test_chatbot_unauthorized(mock_verify):
    """Test chatbot rejects unauthorized users."""
    mock_verify.return_value = False
    response = client.post(
        "/api/chatbot/ask",
        headers={"Authorization": "Bearer mock-dev-token"},
        json={"orgId": "test_org", "query": "test"}
    )
    assert response.status_code == 403


@patch("api.chatbot.verify_user_org_access")
@patch("api.chatbot.db")
def test_chatbot_dev_mode_no_key(mock_db, mock_verify):
    """Test chatbot returns mock response in dev mode when no API key exists."""
    mock_verify.return_value = True
    mock_org_ref = MagicMock()
    mock_org_ref.exists = True
    mock_org_ref.to_dict.return_value = {"apiKeys": {}}
    mock_db.collection.return_value.document.return_value.get.return_value = mock_org_ref

    response = client.post(
        "/api/chatbot/ask",
        headers={"Authorization": "Bearer mock-dev-token"},
        json={"orgId": "test_org", "query": "test"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "Simulated" in data["response"] or "mock" in data["response"].lower()


@patch("api.chatbot.verify_user_org_access")
@patch("api.chatbot.db")
def test_chatbot_no_manifest_returns_upload_prompt(mock_db, mock_verify):
    """Test chatbot prompts for document upload when no manifest exists."""
    mock_verify.return_value = True
    mock_org_ref = MagicMock()
    mock_org_ref.exists = True
    mock_org_ref.to_dict.return_value = {"apiKeys": {"openai": "sk-test"}}

    mock_manifest_stream = iter([])  # No manifests

    def db_collection_side_effect(name):
        mock_coll = MagicMock()
        if name == "organizations":
            mock_doc_ref = MagicMock()
            mock_doc_ref.get.return_value = mock_org_ref
            mock_subcoll = MagicMock()
            mock_subcoll.order_by.return_value.limit.return_value.stream.return_value = mock_manifest_stream
            mock_doc_ref.collection.return_value = mock_subcoll
            mock_coll.document.return_value = mock_doc_ref
        return mock_coll

    mock_db.collection.side_effect = db_collection_side_effect

    mock_client = MagicMock()
    mock_embed = MagicMock()
    mock_embed.embedding = [0.1] * 1536
    mock_client.embeddings.create = AsyncMock(return_value=MagicMock(data=[mock_embed]))

    with patch("api.chatbot.AsyncOpenAI", return_value=mock_client):
        response = client.post(
            "/api/chatbot/ask",
            headers={"Authorization": "Bearer mock-dev-token"},
            json={"orgId": "test_org", "query": "test"}
        )
    assert response.status_code == 200
    assert "upload" in response.json()["response"].lower() or "Context Document" in response.json()["response"]
