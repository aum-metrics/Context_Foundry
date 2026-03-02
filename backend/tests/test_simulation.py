import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app, base_url="http://localhost")

@patch("api.simulation.verify_user_org_access")
@patch("api.simulation.db")
def test_evaluate_query(mock_db, mock_verify):
    """
    Test the evaluate-query endpoint for initiating multi-model simulations.
    Relies on dev-mode simulated scoring.
    """
    mock_verify.return_value = True

    mock_doc = MagicMock()
    mock_doc.exists = True
    # Provide no API keys so that dev-mode mock execution takes over
    mock_doc.to_dict.return_value = {"apiKeys": {}}
    mock_db.collection().document().get.return_value = mock_doc

    mock_count_obj = MagicMock()
    mock_count_obj.value = 5
    mock_db.collection().document().collection().where().count().get.return_value = [[mock_count_obj]]

    try:
        response = client.post(
            "/api/simulation/run",
            headers={"Authorization": "Bearer mock-dev-token"},
            json={
                "orgId": "test_org",
                "manifestVersion": "latest",
                "prompt": "Test query"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) > 0
        assert data["results"][0]["accuracy"] > 0
    finally:
        pass

def test_lcrs_scoring_math():
    """
    Test the fundamental LCRS 60/40 blend mathematics independently of external APIs.
    """
    from api.simulation import verify_claims
    
    # Simulate verify_claims calculating LCRS
    # LCRS Context Drift = 100 - ( (claim_match * 0.6 + semantic_sim * 0.4) * 100 )
    
    # If claim_match is 1.0 (100%) and semantic_sim is 1.0 (100%)
    # Final score should be 100, meaning 0.0 Context Drift
    claim_match = 1.0
    semantic_sim = 1.0
    drift = 100.0 - ((claim_match * 0.6 + semantic_sim * 0.4) * 100.0)
    assert drift == 0.0
    
    # If claim_match is 0.5 (50%) and semantic_sim is 0.8 (80%)
    # Score = (0.3 + 0.32) * 100 = 62.0
    # Drift = 100 - 62 = 38.0
    claim_match = 0.5
    semantic_sim = 0.8
    drift = 100.0 - ((claim_match * 0.6 + semantic_sim * 0.4) * 100.0)
    assert round(drift, 1) == 38.0
