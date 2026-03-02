import pytest
from unittest.mock import patch, MagicMock
import os
from fastapi.testclient import TestClient
from main import app

client = TestClient(app, base_url="http://localhost")

@patch("core.security.db")
@patch("api.competitor.OpenAI")
@patch("api.competitor.db")
def test_get_competitor_displacement(mock_db, mock_openai, mock_sec_db):
    """
    Test live competitor displacement analysis endpoint using mocked GPT-4o-mini output.
    """
    # 1. Setup Security Mock (Let verify_user_org_access run for real)
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
        assert "competitors" in data
        assert len(data["competitors"]) == 1
        assert data["competitors"][0]["name"] == "Acme Corp"
        assert data["competitors"][0]["displacementRate"] == 10.5
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

    # Mock os.getenv to return None for API key and set ENV to development
    with patch.dict(os.environ, {"OPENAI_API_KEY": "", "ENV": "development"}, clear=True):
        try:
            # Need to mock the security layer for test_org
            with patch("core.security.db") as mock_sec_db:
                mock_user_doc = MagicMock()
                mock_user_doc.exists = True
                mock_user_doc.to_dict.return_value = {"orgId": "test_org"}
                mock_sec_db.collection.return_value.document.return_value.get.return_value = mock_user_doc
                
                response = client.get("/api/competitor/displacement/test_org", headers={"Authorization": "Bearer mock-dev-token"})
                assert response.status_code == 200
                data = response.json()
                assert "competitors" in data
                assert len(data["competitors"]) == 3
                assert data["competitors"][0]["name"] == "Competitor Alpha (Simulated)"
        finally:
            pass
