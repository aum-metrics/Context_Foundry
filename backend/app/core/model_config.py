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

GEMINI_SIMULATION_MODEL = "gemini-3-flash"       # For Gemini inference
CLAUDE_SIMULATION_MODEL = "claude-sonnet-4-5"    # For Claude inference

# ── Embedding Models ──────────────────────────────────────────────────────────
OPENAI_EMBEDDING_MODEL = "text-embedding-3-small" # For vector embeddings

# ── Model Display Names (shown in UI) ─────────────────────────────────────────
MODEL_DISPLAY_NAMES = {
    OPENAI_SIMULATION_MODEL: "GPT-4o",
    GEMINI_SIMULATION_MODEL: "Gemini 3 Flash",
    CLAUDE_SIMULATION_MODEL: "Claude 4.5 Sonnet",
}

# ── API Model Mapping (Prevents 404s for Frontier Names) ───────────────────
# These futuristic names are used for display/demo, but mapped to stable IDs
# for the actual API calls until the frontier models are officially released.
API_MODEL_MAPPING = {
    "gemini-3-flash": "gemini-1.5-flash",
    "claude-sonnet-4-5": "claude-3-5-sonnet-20241022",
    "gpt-4o": "gpt-4o",
}
