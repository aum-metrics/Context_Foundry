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

    # Mock embeddings (Ensure 1536 dimensions for text-embedding-3-small)
    mock_embed = MagicMock()
    mock_embed.embedding = [0.1] * 1536
    mock_embed_response = MagicMock()
    mock_embed_response.data = [mock_embed]
    mock_client.embeddings.create.return_value = mock_embed_response

    # Mock chat completions (Sequence: Extraction -> Answer -> Verification)
    def mock_completion_side_effect(*args, **kwargs):
        sys_prompt = kwargs.get('messages', [{}])[0].get('content', '')
        
        # 1. Verification step
        if "Compare each claim" in sys_prompt:
            mock_choice = MagicMock()
            mock_choice.message.content = '{"results": [{"claim": "Claim 1 about the product", "verdict": "supported", "detail": "Mock explanation"}]}'
            mock_resp = MagicMock()
            mock_resp.choices = [mock_choice]
            return mock_resp
            
        # 2. Extraction step
        if "Extract standalone factual claims" in sys_prompt:
            mock_choice = MagicMock()
            mock_choice.message.content = '{"claims": ["Claim 1 about the product"]}'
            mock_resp = MagicMock()
            mock_resp.choices = [mock_choice]
            return mock_resp
            
        # 3. Answer generation step
        mock_choice = MagicMock()
        mock_choice.message.content = "This is a mock answer from GPT."
        mock_resp = MagicMock()
        mock_resp.choices = [mock_choice]
        return mock_resp

    mock_client.chat.completions.create.side_effect = mock_completion_side_effect

    # Happy Path — user belongs to test_org
    response = client.post(
        "/api/simulation/run",
        headers={"Authorization": "Bearer mock-dev-token"},
        json={"orgId": "test_org", "manifestVersion": "latest", "prompt": "Test query"}
    )
    assert response.status_code == 200, f"Status {response.status_code}: {response.text}"
    data = response.json()
    assert "results" in data

    # Unhappy Path — user belongs to different org (force session type to trigger auth check)
    from core.security import get_auth_context
    app.dependency_overrides[get_auth_context] = lambda: {"uid": "intruder_uid", "type": "session"}
    mock_verify.return_value = False
    
    response = client.post(
        "/api/simulation/run",
        headers={"Authorization": "Bearer mock-dev-token"},
        json={"orgId": "test_org", "manifestVersion": "latest", "prompt": "Test query"}
    )
    
    # Restore override
    app.dependency_overrides.clear()
    
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
@patch("api.simulation.verify_user_org_access")
@patch("api.simulation.OpenAI")
@patch("api.simulation.db")
def test_frontier_model_labels(mock_sim_db, mock_openai, mock_verify):
    """
    Strictly verify that the frontier model labels (GPT-4o, Gemini 3 Flash, Claude 4.5 Sonnet)
    as defined in core.model_config are correctly returned by the mission-critical simulation endpoint.
    """
    from core.model_config import MODEL_DISPLAY_NAMES
    
    # 1. Setup Security & DB Mocks
    mock_verify.return_value = True
    mock_org_doc = MagicMock()
    mock_org_doc.exists = True
    mock_org_doc.to_dict.return_value = {
        "apiKeys": {"openai": "sk-mock"},
        "subscription": {"maxSimulations": 50, "planId": "growth"}
    }
    mock_org_doc.collection.return_value.document.return_value.get.return_value = MagicMock(exists=True, to_dict=lambda: {"content": "mock", "embedding": [0.1]*1536})
    mock_sim_db.collection.return_value.document.return_value.get.return_value = mock_org_doc

    # 2. Mock OpenAI client
    mock_client = MagicMock()
    mock_openai.return_value = mock_client
    mock_embed = MagicMock(embedding=[0.1]*1536)
    mock_client.embeddings.create.return_value = MagicMock(data=[mock_embed])
    
    # Mock response
    mock_choice = MagicMock()
    mock_choice.message.content = '{"results": [], "claims": ["claim1"], "answer": "mock answer"}'
    mock_client.chat.completions.create.return_value = MagicMock(choices=[mock_choice])

    # 3. Request
    response = client.post(
        "/api/simulation/run",
        headers={"Authorization": "Bearer mock-dev-token"},
        json={"orgId": "test_org", "manifestVersion": "latest", "prompt": "Verify Labels"}
    )
    
    assert response.status_code == 200
    results = response.json().get("results", [])
    
    # Check if all frontier labels from model_config are present in the response
    # In ENV="testing", the API may append " Mock" to labels
    returned_labels = [r["model"].replace(" Mock", "") for r in results]
    expected_labels = list(MODEL_DISPLAY_NAMES.values())
    
    for expected in expected_labels:
        assert expected in returned_labels, f"Expected frontier label '{expected}' missing from API response. Got: {returned_labels}"
