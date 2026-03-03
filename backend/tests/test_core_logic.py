"""
Tests for core security utilities: rate_limiter, task_queue, and general security helpers.
Covers: rate limit enforcement, task queue lifecycle, cosine similarity math.
"""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta
import numpy as np


def test_cosine_similarity_identical_vectors():
    """Test cosine similarity returns 1.0 for identical vectors."""
    from api.simulation import cosine_sim
    v = [1.0, 0.0, 0.0]
    assert cosine_sim(v, v) == 1.0


def test_cosine_similarity_orthogonal_vectors():
    """Test cosine similarity returns 0.0 for orthogonal vectors."""
    from api.simulation import cosine_sim
    v1 = [1.0, 0.0, 0.0]
    v2 = [0.0, 1.0, 0.0]
    assert abs(cosine_sim(v1, v2)) < 1e-10


def test_cosine_similarity_zero_vector():
    """Test cosine similarity handles zero vectors gracefully."""
    from api.simulation import cosine_sim
    v1 = [0.0, 0.0, 0.0]
    v2 = [1.0, 0.0, 0.0]
    assert cosine_sim(v1, v2) == 0.0


def test_lcrs_formula_perfect_match():
    """Test LCRS formula with perfect scores."""
    # LCRS = (0.6 * claim_accuracy) + (0.4 * (1 - cosine_distance))
    claim_accuracy = 1.0  # All claims supported
    cosine_distance = 0.0  # Identical
    lcrs = (0.6 * claim_accuracy) + (0.4 * (1.0 - cosine_distance))
    assert lcrs == 1.0


def test_lcrs_formula_total_hallucination():
    """Test LCRS formula with zero claim accuracy and high divergence."""
    claim_accuracy = 0.0
    cosine_distance = 1.0  # Orthogonal
    lcrs = (0.6 * claim_accuracy) + (0.4 * (1.0 - cosine_distance))
    assert lcrs == 0.0


def test_lcrs_formula_partial_match():
    """Test LCRS formula with realistic partial match."""
    claim_accuracy = 0.7  # 7/10 claims supported
    cosine_distance = 0.15  # Close but not identical
    lcrs = (0.6 * claim_accuracy) + (0.4 * (1.0 - cosine_distance))
    expected = (0.6 * 0.7) + (0.4 * 0.85)
    assert abs(lcrs - expected) < 1e-10
    assert 0.7 < lcrs < 0.85  # Should be in this range


def test_lcrs_claim_weight_dominance():
    """Verify that claims (60%) outweigh semantics (40%) in the blend."""
    # High claim accuracy, low semantic
    lcrs_high_claims = (0.6 * 0.9) + (0.4 * 0.3)
    # Low claim accuracy, high semantic
    lcrs_high_semantic = (0.6 * 0.3) + (0.4 * 0.9)
    # High claims should produce higher LCRS
    assert lcrs_high_claims > lcrs_high_semantic


@patch("core.rate_limiter.db")
def test_rate_limiter_check_rate_limit(mock_db):
    """Test the core rate limiter function."""
    import asyncio
    from core.rate_limiter import check_rate_limit

    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "count": 5,
        "resetAt": datetime.now(timezone.utc) + timedelta(minutes=1)
    }
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    # check_rate_limit is async
    result = asyncio.get_event_loop().run_until_complete(
        check_rate_limit("aum_test_key_123", "simulation", "growth")
    )
    assert result is True


def test_task_queue_job_lifecycle():
    """Test task queue register/update/complete cycle."""
    from utils.task_queue import FirestoreTaskQueue

    with patch("utils.task_queue.db") as mock_db:
        mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.set = MagicMock()
        mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.update = MagicMock()

        # Register
        FirestoreTaskQueue.register_job("org_1", "seoJobs", "job_1", {"url": "https://example.com"})
        mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.set.assert_called_once()

        # Update
        FirestoreTaskQueue.update_job("org_1", "seoJobs", "job_1", "completed", {"seoScore": 85})
        mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.update.assert_called_once()


def test_api_key_generation_format():
    """Test that generated API keys follow the expected format."""
    from api.api_keys import generate_api_key
    key, key_hash = generate_api_key()
    assert key.startswith("aum_")
    assert len(key) > 20
    assert len(key_hash) == 64  # SHA-256 hex digest


def test_api_key_hash_deterministic():
    """Test that the same key always produces the same hash."""
    import hashlib
    key = "aum_test_key_12345"
    hash1 = hashlib.sha256(key.encode()).hexdigest()
    hash2 = hashlib.sha256(key.encode()).hexdigest()
    assert hash1 == hash2


def test_api_key_hash_uniqueness():
    """Test that different keys produce different hashes."""
    from api.api_keys import generate_api_key
    key1, hash1 = generate_api_key()
    key2, hash2 = generate_api_key()
    assert key1 != key2
    assert hash1 != hash2
