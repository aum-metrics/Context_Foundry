import pytest
import os

# Set environment variables BEFORE importing any app code to bypass production checks
os.environ["ENV"] = "development"
os.environ["ALLOW_MOCK_AUTH"] = "True"

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
    
    # Force mock auth allowed and env=development for tests using mock tokens
    from core.config import settings
    monkeypatch.setattr(settings, "ENV", "development")
    monkeypatch.setattr(settings, "ALLOW_MOCK_AUTH", True)
    
    yield mock_db


@pytest.fixture(autouse=True)
def clean_dependency_overrides():
    """
    After every test, clear FastAPI dependency overrides to prevent test contamination.
    """
    from app.main import app
    yield
    app.dependency_overrides.clear()
