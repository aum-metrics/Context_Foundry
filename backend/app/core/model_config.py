"""
AUM Context Foundry — Centralized Model Version Configuration

Change a model version here and it updates across the entire platform.
No redeployment needed: the platform reads this at runtime.
"""

# ── LLM Chat Models ──────────────────────────────────────────────────────────
OPENAI_SIMULATION_MODEL = "gpt-4o-mini"          # For simulation inference
OPENAI_SCHEMA_MODEL = "gpt-4o-mini"              # For JSON-LD extraction
OPENAI_MANIFEST_MODEL = "gpt-4o-mini"            # For llms.txt generation
OPENAI_CLAIM_MODEL = "gpt-4o-mini"               # For claim extraction/verify
OPENAI_ADJUDICATION_MODEL = "gpt-4o-mini"        # For multi-model adjudication

GEMINI_SIMULATION_MODEL = "gemini-2.0-flash"     # For Gemini inference
CLAUDE_SIMULATION_MODEL = "claude-3-5-haiku-20241022"  # For Claude inference

# ── Embedding Models ──────────────────────────────────────────────────────────
OPENAI_EMBEDDING_MODEL = "text-embedding-3-small" # For vector embeddings

# ── Model Display Names (shown in UI) ─────────────────────────────────────────
MODEL_DISPLAY_NAMES = {
    OPENAI_SIMULATION_MODEL: "GPT-4o Mini",
    GEMINI_SIMULATION_MODEL: "Gemini 2.0 Flash",
    CLAUDE_SIMULATION_MODEL: "Claude 3.5 Haiku",
}
