# AUM Context Foundry - Enterprise "How-To" Guide

## Multi-Tenant Onboarding/Offboarding

### 1. Onboarding a New Business/Tenant
AUM Context Foundry is designed for high-scale enterprise multi-tenancy. To provision a new "foundry" for a business:
1.  **Navigate to Team Settings**: Go to the Admin Dashboard > Settings > Organizations.
2.  **Provision New Moat**: Click the "Provision New Moat" button. This creates a fresh logical sandbox with a unique `orgId`.
3.  **Deploy /llms.txt**: Host the business's semantic manifest at `yourbusiness.com/llms.txt`.
4.  **Sync Source**: Enter the URL in the Foundry Dashboard to initiate the semantic ingestion pipeline.

### 2. Offboarding a Tenant
To safely remove a business and purge its latent footprint:
1.  **Archive Organization**: In the Organization settings, select "Archive".
2.  **Zero-Retention Purge**: The system will automatically drop all cached JSON-LD maps for that `orgId`.
3.  **DNS/manifest De-coupling**: Revoke the API key access for that tenant to stop real-time edge updates.

## API Key Management Architecture

### "Why does AUM manage separate keys per business?"
AUM provisions and manages **dedicated API keys** (OpenAI, Gemini, Claude) for each business tenant. Tenants never need to handle keys themselves. This architecture provides:
*   **Cost Attribution**: Precisely track LLM spend per business unit without complex cross-billing.
*   **Rate Limit Isolation**: Prevent a heavy-usage business from exhausting shared quota (noisy neighbor problem).
*   **Security & Compliance**: If one business's key is compromised, others remain secure.
*   **Threshold Enforcement**: AUM can set per-org usage limits and cut off abuse.

---
*Support: hello@AUMDataLabs.com / +91-9080735297*
