"""
AUM Context Foundry — Centralized Model Version Configuration

Defaults live in code. Runtime overrides (admin Model Control) are loaded from
Firestore and cached in-memory for a short TTL to avoid per-request reads.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from threading import Lock
from typing import Any, Dict, List

# ── LLM Chat Models ──────────────────────────────────────────────────────────
OPENAI_SIMULATION_MODEL = "gpt-4o"                 # For simulation inference
OPENAI_SCHEMA_MODEL = "gpt-4o"              # For JSON-LD extraction
OPENAI_MANIFEST_MODEL = "gpt-4o"            # For llms.txt generation
OPENAI_CLAIM_MODEL = "gpt-4o"               # For claim extraction/verify
OPENAI_ADJUDICATION_MODEL = "gpt-4o"        # For multi-model adjudication

GEMINI_SIMULATION_MODEL = "gemini-3-flash"       # Product label for Gemini inference
CLAUDE_SIMULATION_MODEL = "claude-sonnet-4-5"    # Product label for Claude inference

# ── Embedding Models ──────────────────────────────────────────────────────────
OPENAI_EMBEDDING_MODEL = "text-embedding-3-small" # For vector embeddings

# ── Model Display Names (shown in UI) ─────────────────────────────────────────
MODEL_DISPLAY_NAMES = {
    OPENAI_SIMULATION_MODEL: "GPT-4o",
    GEMINI_SIMULATION_MODEL: "Gemini 3 Flash",
    CLAUDE_SIMULATION_MODEL: "Claude 4.5 Sonnet",
}

# ── API Model Mapping (Prevents 404s for Frontier Names) ───────────────────
# Product labels stay stable in the UI, while provider calls use supported API IDs.
API_MODEL_MAPPING = {
    "gemini-3-flash": "gemini-2.5-flash",
    "claude-sonnet-4-5": "claude-sonnet-4-20250514",
    "gpt-4o": "gpt-4o",
}

_MODEL_CACHE_LOCK = Lock()
_MODEL_CATALOG_CACHE: Dict[str, Any] = {"fetchedAt": None, "payload": None}


def _default_model_catalog() -> List[Dict[str, Any]]:
    return [
        {
            "provider": "openai",
            "slot": "simulation",
            "displayName": MODEL_DISPLAY_NAMES.get(OPENAI_SIMULATION_MODEL, "GPT-4o"),
            "productLabel": OPENAI_SIMULATION_MODEL,
            "apiModelId": API_MODEL_MAPPING.get(OPENAI_SIMULATION_MODEL, OPENAI_SIMULATION_MODEL),
            "enabled": True,
            "order": 1,
        },
        {
            "provider": "gemini",
            "slot": "simulation",
            "displayName": MODEL_DISPLAY_NAMES.get(GEMINI_SIMULATION_MODEL, "Gemini 3 Flash"),
            "productLabel": GEMINI_SIMULATION_MODEL,
            "apiModelId": API_MODEL_MAPPING.get(GEMINI_SIMULATION_MODEL, GEMINI_SIMULATION_MODEL),
            "enabled": True,
            "order": 2,
        },
        {
            "provider": "anthropic",
            "slot": "simulation",
            "displayName": MODEL_DISPLAY_NAMES.get(CLAUDE_SIMULATION_MODEL, "Claude 4.5 Sonnet"),
            "productLabel": CLAUDE_SIMULATION_MODEL,
            "apiModelId": API_MODEL_MAPPING.get(CLAUDE_SIMULATION_MODEL, CLAUDE_SIMULATION_MODEL),
            "enabled": True,
            "order": 3,
        },
    ]


def get_runtime_model_catalog(ttl_seconds: int = 300) -> Dict[str, Any]:
    """
    Fetch model catalog from Firestore (admin Model Control).
    Returns defaults if Firestore is unavailable.
    """
    now = datetime.now(timezone.utc)
    cached = _MODEL_CATALOG_CACHE.get("payload")
    fetched_at = _MODEL_CATALOG_CACHE.get("fetchedAt")
    if cached and fetched_at and (now - fetched_at) < timedelta(seconds=ttl_seconds):
        return cached

    from core.firebase_config import db

    payload = {
        "models": _default_model_catalog(),
        "source": "code_default",
        "updatedAt": None,
        "updatedBy": None,
    }

    if not db:
        _MODEL_CATALOG_CACHE["payload"] = payload
        _MODEL_CATALOG_CACHE["fetchedAt"] = now
        return payload

    with _MODEL_CACHE_LOCK:
        cached = _MODEL_CATALOG_CACHE.get("payload")
        fetched_at = _MODEL_CATALOG_CACHE.get("fetchedAt")
        if cached and fetched_at and (now - fetched_at) < timedelta(seconds=ttl_seconds):
            return cached

        try:
            doc = db.collection("platform_config").document("model_catalog").get()
            if doc.exists:
                data = doc.to_dict() or {}
                models = data.get("models")
                if isinstance(models, list) and models:
                    payload["models"] = sorted(models, key=lambda item: item.get("order", 999))
                    payload["source"] = "firestore"
                    payload["updatedAt"] = data.get("updatedAt")
                    payload["updatedBy"] = data.get("updatedBy")
        except Exception:
            # Fall back silently to defaults; the caller can still operate.
            pass

        _MODEL_CATALOG_CACHE["payload"] = payload
        _MODEL_CATALOG_CACHE["fetchedAt"] = now

    return payload


def get_simulation_model_catalog() -> Dict[str, Dict[str, Any]]:
    """
    Returns per-provider simulation model config:
    { openai: {displayName, productLabel, apiModelId, enabled}, ... }
    """
    catalog = get_runtime_model_catalog()
    models = catalog.get("models") or []
    selected: Dict[str, Dict[str, Any]] = {}
    for entry in models:
        if entry.get("slot") != "simulation":
            continue
        provider = (entry.get("provider") or "").lower()
        if not provider:
            continue
        selected[provider] = {
            "displayName": entry.get("displayName") or entry.get("productLabel") or provider,
            "productLabel": entry.get("productLabel") or provider,
            "apiModelId": entry.get("apiModelId") or entry.get("productLabel") or provider,
            "enabled": entry.get("enabled", True),
        }

    defaults = {
        "openai": {
            "displayName": MODEL_DISPLAY_NAMES.get(OPENAI_SIMULATION_MODEL, "GPT-4o"),
            "productLabel": OPENAI_SIMULATION_MODEL,
            "apiModelId": API_MODEL_MAPPING.get(OPENAI_SIMULATION_MODEL, OPENAI_SIMULATION_MODEL),
            "enabled": True,
        },
        "gemini": {
            "displayName": MODEL_DISPLAY_NAMES.get(GEMINI_SIMULATION_MODEL, "Gemini 3 Flash"),
            "productLabel": GEMINI_SIMULATION_MODEL,
            "apiModelId": API_MODEL_MAPPING.get(GEMINI_SIMULATION_MODEL, GEMINI_SIMULATION_MODEL),
            "enabled": True,
        },
        "anthropic": {
            "displayName": MODEL_DISPLAY_NAMES.get(CLAUDE_SIMULATION_MODEL, "Claude 4.5 Sonnet"),
            "productLabel": CLAUDE_SIMULATION_MODEL,
            "apiModelId": API_MODEL_MAPPING.get(CLAUDE_SIMULATION_MODEL, CLAUDE_SIMULATION_MODEL),
            "enabled": True,
        },
    }
    for provider, default in defaults.items():
        selected.setdefault(provider, default)

    return selected


# ── Automated Health Monitoring (Future: P1) ──────────────────────────────────
# In production, a background job should periodically ping these models
# to detect provider-side deprecation before it hits the user path.
def check_model_availability():
    """Future: Implement provider pings (FastAPI Startup / Task Queue)"""
    return True
