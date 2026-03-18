import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import os
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, base_url="http://localhost")


@patch("api.competitor.verify_user_org_access")
@patch("api.competitor.AsyncOpenAI")
@patch("api.competitor.db")
def test_get_competitor_displacement(mock_db, mock_openai, mock_verify):
    """
    Test live competitor displacement analysis endpoint using mocked GPT-4o-mini output.
    """
    # Security Mock
    mock_verify.return_value = True

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
    mock_client.chat.completions.create = AsyncMock(return_value=mock_completion)

    response = client.get("/api/competitor/displacement/test_org", headers={"Authorization": "Bearer mock-dev-token"})
    assert response.status_code == 200, response.text
    data = response.json()
    assert "competitors" in data
    assert len(data["competitors"]) == 1
    assert data["competitors"][0]["name"] == "Acme Corp"
    assert data["competitors"][0]["displacementRate"] == 10.5


@patch("api.competitor.verify_user_org_access")
@patch("api.competitor.db")
def test_get_competitor_displacement_no_api_key(mock_db, mock_verify):
    """
    Test fallback behavior if no API key is provided — returns simulated data in dev mode.
    """
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {"name": "Test Org", "apiKeys": {}}
    mock_db.collection().document().get.return_value = mock_doc

    mock_verify.return_value = True

    with patch.dict(os.environ, {"OPENAI_API_KEY": "", "ENV": "development"}, clear=False):
        response = client.get(
            "/api/competitor/displacement/test_org",
            headers={"Authorization": "Bearer mock-dev-token"}
        )

    assert response.status_code == 200, response.text
    data = response.json()
    assert "competitors" in data
    assert len(data["competitors"]) == 0
