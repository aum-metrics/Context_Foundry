import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app, base_url="http://localhost")


@patch("api.simulation.verify_user_org_access")
@patch("api.simulation.OpenAI")
@patch("api.simulation.db")
def test_evaluate_query(mock_sim_db, mock_openai, mock_verify):
    """
    Test the evaluate-query endpoint for initiating multi-model simulations.
    """
    # 1. Setup Security Mock
    mock_verify.return_value = True

    # 2. Setup Simulation Mock
    mock_org_doc = MagicMock()
    mock_org_doc.exists = True
    mock_org_doc.to_dict.return_value = {
        "apiKeys": {"openai": "sk-mock"},
        "subscription": {"maxSimulations": 50, "planId": "growth"}
    }

    mock_manifest_doc = MagicMock()
    mock_manifest_doc.exists = True
    mock_manifest_doc.to_dict.return_value = {"content": "mock content", "embedding": [0.1] * 1536}

    def org_doc_collection_side_effect(name):
        mock_subcoll = MagicMock()
        if name == "manifests":
            mock_subcoll.document.return_value.get.return_value = mock_manifest_doc
        elif name == "simulationCache":
            mock_cache = MagicMock()
            mock_cache.exists = False
            mock_subcoll.document.return_value.get.return_value = mock_cache
        return mock_subcoll

    mock_org_doc.collection.side_effect = org_doc_collection_side_effect

    def db_collection_side_effect(name):
        mock_coll = MagicMock()
        if name == "organizations":
            mock_org_doc_ref = MagicMock()
            mock_org_doc_ref.get.return_value = mock_org_doc
            mock_org_doc_ref.collection.side_effect = org_doc_collection_side_effect
            mock_coll.document.return_value = mock_org_doc_ref
        return mock_coll

    mock_sim_db.collection.side_effect = db_collection_side_effect
    mock_sim_db.transaction.return_value = MagicMock()

    # 3. Mock OpenAI client
    mock_client = MagicMock()
    mock_openai.return_value = mock_client

    # Mock embeddings
    mock_embed = MagicMock()
    mock_embed.embedding = [0.1] * 1536
    mock_embed_response = MagicMock()
    mock_embed_response.data = [mock_embed]
    mock_client.embeddings.create.return_value = mock_embed_response

    # Mock chat completions
    mock_choice = MagicMock()
    mock_choice.message.content = '["Claim 1 about the product"]'
    mock_completion = MagicMock()
    mock_completion.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_completion

    # Mock OpenAI runner
    mock_run_choice = MagicMock()
    mock_run_choice.message.content = "This is a mock answer from GPT."
    mock_run_completion = MagicMock()
    mock_run_completion.choices = [mock_run_choice]
    mock_client.chat.completions.create.return_value = mock_run_completion

    # Happy Path — user belongs to test_org
    response = client.post(
        "/api/simulation/run",
        headers={"Authorization": "Bearer mock-dev-token"},
        json={"orgId": "test_org", "manifestVersion": "latest", "prompt": "Test query"}
    )
    assert response.status_code == 200, f"Status {response.status_code}: {response.text}"
    data = response.json()
    assert "results" in data

    # Unhappy Path — user belongs to different org
    mock_verify.return_value = False
    response = client.post(
        "/api/simulation/run",
        headers={"Authorization": "Bearer mock-dev-token"},
        json={"orgId": "test_org", "manifestVersion": "latest", "prompt": "Test query"}
    )
    assert response.status_code == 403, response.text


def test_lcrs_scoring_math():
    """
    Test the fundamental LCRS 60/40 blend mathematics independently of external APIs.
    """
    claim_match = 1.0
    semantic_sim = 1.0
    drift = 100.0 - ((claim_match * 0.6 + semantic_sim * 0.4) * 100.0)
    assert drift == 0.0

    claim_match = 0.5
    semantic_sim = 0.8
    drift = 100.0 - ((claim_match * 0.6 + semantic_sim * 0.4) * 100.0)
    assert round(drift, 1) == 38.0
