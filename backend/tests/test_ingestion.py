import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app
from api.ingestion import recursive_split
from core.security import get_auth_context

client = TestClient(app, base_url="http://localhost")


def make_auth_override(uid: str):
    def _auth():
        return {"uid": uid, "type": "session"}
    return _auth


def test_recursive_split():
    """
    Test that recursive_split correctly chunks text while preserving paragraph and sentence boundaries.
    """
    text = "This is a sentence. This is another sentence.\n\nHere is a new paragraph. It contains multiple words."
    chunks = recursive_split(text, max_size=40, overlap_size=10)

    assert len(chunks) > 0
    # The first chunk should ideally break at the paragraph or sentence
    assert "This is a sentence." in chunks[0]


@patch("core.security.db")
@patch("api.ingestion.OpenAI")
@patch("api.ingestion.db")
def test_process_markdown(mock_db, mock_openai, mock_sec_db):
    """
    Test the parse endpoint which simulates zero-retention extraction.
    """
    # Security Mock
    mock_user_doc = MagicMock()
    mock_user_doc.exists = True
    mock_user_doc.to_dict.return_value = {"orgId": "test_org"}
    mock_sec_db.collection.return_value.document.return_value.get.return_value = mock_user_doc

    # Mock Firestore Database
    mock_batch = MagicMock()
    mock_db.batch.return_value = mock_batch

    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {"apiKeys": {"openai": "test_key"}}
    mock_db.collection().document().get.return_value = mock_doc

    # Mock Firestore transaction
    mock_tx = MagicMock()
    mock_db.transaction.return_value = mock_tx

    # Mock Firestore document ref for manifest write
    mock_manifest_ref = MagicMock()
    mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value = mock_manifest_ref
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    # Mock OpenAI
    mock_client = MagicMock()
    mock_openai.return_value = mock_client

    # Mock Embeddings Response
    mock_embedding = MagicMock()
    mock_embedding.embedding = [0.1] * 1536
    mock_data = MagicMock()
    mock_data.data = [mock_embedding]
    mock_client.embeddings.create.return_value = mock_data

    # Mock Completion Response for Schema Extraction
    mock_message = MagicMock()
    mock_message.content = '{"name": "test schema"}'
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_completion = MagicMock()
    mock_completion.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_completion

    # Happy Path — user belongs to test_org
    app.dependency_overrides[get_auth_context] = make_auth_override("test_user_123")
    response = client.post(
        "/api/ingestion/parse",
        headers={"Authorization": "Bearer mock-dev-token"},
        data={"orgId": "test_org"},
        files={"file": ("test.pdf", b"dummy pdf content", "application/pdf")}
    )
    assert response.status_code == 200, f"Status {response.status_code}: {response.text}"

    # Unhappy Path — user belongs to different org
    mock_user_doc.to_dict.return_value = {"orgId": "hacker"}
    response2 = client.post(
        "/api/ingestion/parse",
        headers={"Authorization": "Bearer mock-dev-token"},
        data={"orgId": "test_org"},
        files={"file": ("test.pdf", b"dummy pdf content", "application/pdf")}
    )
    assert response2.status_code == 403, response2.text

    # Cleanup
    app.dependency_overrides.pop(get_auth_context, None)
