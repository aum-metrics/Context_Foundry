import pytest
from unittest.mock import patch, MagicMock
import os
from fastapi.testclient import TestClient
from main import app

client = TestClient(app, base_url="http://localhost")

@patch("api.competitor.OpenAI")
@patch("api.competitor.db")
def test_get_competitor_displacement(mock_db, mock_openai):
    """
    Test live competitor displacement analysis endpoint using mocked GPT-4o-mini output.
    """
    # Mock Firestore
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {"name": "Test Org", "apiKeys": {"openai": "test_key"}}
    mock_db.collection().document().get.return_value = mock_doc

    # Mock OpenAI
    mock_client = MagicMock()
    mock_openai.return_value = mock_client
    
    # Mock Completion Response
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

    try:
        response = client.get("/api/competitor/displacement/test_org", headers={"Authorization": "Bearer mock-dev-token"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Acme Corp"
        assert data[0]["displacementRate"] == 10.5
    finally:
        pass

@patch("api.competitor.db")
def test_get_competitor_displacement_no_api_key(mock_db):
    """
    Test fallback behavior if no API key is provided
    """
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {"name": "Test Org", "apiKeys": {}} # No OpenAI key
    mock_db.collection().document().get.return_value = mock_doc

    # Mock os.getenv to return None for API key
    with patch.dict(os.environ, {"OPENAI_API_KEY": ""}, clear=True):
        try:
            response = client.get("/api/competitor/displacement/test_org", headers={"Authorization": "Bearer mock-dev-token"})
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 3
            assert data[0]["name"] == "Competitor Alpha"
        finally:
            pass
