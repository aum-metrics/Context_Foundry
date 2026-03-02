import pytest
from unittest.mock import patch, MagicMock
import os
from fastapi.testclient import TestClient
from main import app
from core.security import get_auth_context

client = TestClient(app, base_url="http://localhost")


def make_auth_override(uid: str):
    def _auth():
        return {"uid": uid, "type": "session"}
    return _auth


@patch("core.security.db")
@patch("api.competitor.OpenAI")
@patch("api.competitor.db")
def test_get_competitor_displacement(mock_db, mock_openai, mock_sec_db):
    """
    Test live competitor displacement analysis endpoint using mocked GPT-4o-mini output.
    """
    # Security Mock
    mock_user_doc = MagicMock()
    mock_user_doc.exists = True
    mock_user_doc.to_dict.return_value = {"orgId": "test_org"}
    mock_sec_db.collection.return_value.document.return_value.get.return_value = mock_user_doc

    # Mock Firestore
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {"name": "Test Org", "apiKeys": {"openai": "test_key"}}
    mock_db.collection().document().get.return_value = mock_doc

    # Mock OpenAI
    mock_client = MagicMock()
    mock_openai.return_value = mock_client

    mock_message = MagicMock()
    mock_message.content = '''
    {
        "competitors": [
            {
                "name": "Acme Corp",
                "displacementRate": 10.5,
                "strengths": ["Enterprise", "API"],
                "weaknesses": ["Price"]
            }
        ]
    }
    '''
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_completion = MagicMock()
    mock_completion.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_completion

    app.dependency_overrides[get_auth_context] = make_auth_override("test_user_123")
    response = client.get("/api/competitor/displacement/test_org", headers={"Authorization": "Bearer mock-dev-token"})
    assert response.status_code == 200, response.text
    data = response.json()
    assert "competitors" in data
    assert len(data["competitors"]) == 1
    assert data["competitors"][0]["name"] == "Acme Corp"
    assert data["competitors"][0]["displacementRate"] == 10.5

    app.dependency_overrides.pop(get_auth_context, None)


@patch("api.competitor.db")
def test_get_competitor_displacement_no_api_key(mock_db):
    """
    Test fallback behavior if no API key is provided — returns simulated data in dev mode.
    """
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {"name": "Test Org", "apiKeys": {}}
    mock_db.collection().document().get.return_value = mock_doc

    with patch("core.security.db") as mock_sec_db:
        mock_user_doc = MagicMock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {"orgId": "test_org"}
        mock_sec_db.collection.return_value.document.return_value.get.return_value = mock_user_doc

        app.dependency_overrides[get_auth_context] = make_auth_override("test_user_123")
        with patch.dict(os.environ, {"OPENAI_API_KEY": "", "ENV": "development"}, clear=False):
            response = client.get(
                "/api/competitor/displacement/test_org",
                headers={"Authorization": "Bearer mock-dev-token"}
            )
        app.dependency_overrides.pop(get_auth_context, None)

    assert response.status_code == 200, response.text
    data = response.json()
    assert "competitors" in data
    assert len(data["competitors"]) == 3
    assert data["competitors"][0]["name"] == "Competitor Alpha (Simulated)"
