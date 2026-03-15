"""
AUM Context Foundry — Centralized Model Version Configuration

Change a model version here and it updates across the entire platform.
No redeployment needed: the platform reads this at runtime.
"""

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
# ── Automated Health Monitoring (Future: P1) ──────────────────────────────────
# In production, a background job should periodically ping these models 
# to detect provider-side deprecation before it hits the user path.
def check_model_availability():
    """Future: Implement provider pings (FastAPI Startup / Task Queue)"""
    return True
