# AUM Context Foundry - Enterprise "How-To" Guide

## Multi-Tenant Onboarding/Offboarding

### 1. Onboarding a New Business/Tenant
AUM Context Foundry is designed for high-scale enterprise multi-tenancy. To provision a new "foundry" for a business:
1.  **Navigate to Team Settings**: Go to the Admin Dashboard > Settings > Organizations.
2.  **Provision New Moat**: Click the "Provision New Moat" button. This creates a fresh logical sandbox with a unique `orgId`.
3.  **Deploy /llms.txt**: Host the business's semantic manifest at `yourbusiness.com/llms.txt`.
4.  **Sync Source**: Enter the URL in the Foundry Dashboard to initiate the ARGUS-Thesis ingestion pipeline.

### 2. Offboarding a Tenant
To safely remove a business and purge its latent footprint:
1.  **Archive Organization**: In the Organization settings, select "Archive".
2.  **Zero-Retention Purge**: The system will automatically drop all cached JSON-LD maps for that `orgId`.
3.  **DNS/manifest De-coupling**: Revoke the API key access for that tenant to stop real-time edge updates.

## API Key Management Architecture

### "Why separate keys vary by business?"
We strongly recommend **separate API keys** (Gemini, Claude, OpenAI) for each business tenant for the following enterprise reasons:
*   **Cost Attribution**: Precisely track LLM spend per business unit or client without complex cross-billing logic.
*   **Rate Limit Isolation**: Prevent a heavy-usage business from exhausting the shared quota of other tenants (noisy neighbor problem).
*   **Security & Compliance**: If one business's key is compromised, the others remain secure. Each business can maintain their own CISO-approved keys.
*   **Model Specialization**: Different businesses may prefer different models (e.g., Gemini for high-performance retrieval vs. GPT-4 for complex reasoning).

---
*Support: hello@AUMDataLabs.com / +91-9080735297*
