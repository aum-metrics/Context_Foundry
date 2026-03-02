import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def patch_firestore(monkeypatch):
    """
    Automatically patch `core.firebase_config.db` and `core.security.db` for every test.
    This prevents real Firestore connections during tests while allowing individual
    tests to further customize the mock behavior.
    """
    mock_db = MagicMock()
    monkeypatch.setattr("core.firebase_config.db", mock_db)
    monkeypatch.setattr("core.security.db", mock_db)
    yield mock_db


@pytest.fixture(autouse=True)
def clean_dependency_overrides():
    """
    After every test, clear FastAPI dependency overrides to prevent test contamination.
    """
    from main import app
    yield
    app.dependency_overrides.clear()
