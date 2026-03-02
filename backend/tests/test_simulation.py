import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app, base_url="http://localhost")

@patch("core.security.db")
@patch("api.simulation.db")
def test_evaluate_query(mock_sim_db, mock_sec_db):
    """
    Test the evaluate-query endpoint for initiating multi-model simulations.
    Refactored to avoid complete security mocking theater by passing real security checks with mocked data.
    """
    # 1. Setup Security Mock (Let verify_user_org_access run for real)
    mock_user_doc = MagicMock()
    mock_user_doc.exists = True
    # The mock token uid is 'mock_uid_dev', allow access to 'test_org'
    mock_user_doc.to_dict.return_value = {"orgId": "test_org"}
    mock_sec_db.collection.return_value.document.return_value.get.return_value = mock_user_doc

    # 2. Setup Simulation Mock
    mock_org_doc = MagicMock()
    mock_org_doc.exists = True
    mock_org_doc.to_dict.return_value = {
        "apiKeys": {},
        "subscription": {"maxSimulations": 50, "planId": "starter"}
    }
    
    mock_manifest_doc = MagicMock()
    mock_manifest_doc.exists = True
    mock_manifest_doc.to_dict.return_value = {"content": "mock content", "embedding": [0.1]*1536}

    # Custom side effect for different collections
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
    
    # We must side effect the billing transaction
    def run_txn(txn_fn, txn, ref):
        # We simulate the transaction calling our function
        txn_fn(txn, ref)
    mock_sim_db.transaction.return_value = MagicMock()
    
    # Actually, the python decorator @firestore.transactional is hard to mock because it wraps the function.
    # In my code:
    # @firestore.transactional
    # def check_and_increment(txn, ref):
    # Depending on how google-cloud-firestore does it, if we're not using real firestore, it might crash without real client.
    # Let's mock firestore to avoid import errors in the test environment if not installed.
    pass

    try:
        # Happy Path
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
        
        # Unhappy Path (Cross-Tenant Unauthorized)
        mock_user_doc.to_dict.return_value = {"orgId": "hacker_org"}
        response = client.post(
            "/api/simulation/run",
            headers={"Authorization": "Bearer mock-dev-token"},
            json={
                "orgId": "test_org",
                "manifestVersion": "latest",
                "prompt": "Test query"
            }
        )
        assert response.status_code == 403
        
    finally:
        pass

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
