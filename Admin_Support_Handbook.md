# AUM Context Foundry: Administrator & Support Handbook

This runbook acts as the source of truth for Sales Engineering, Infrastructure Support, and Database Administration when managing the AUM Context Foundry API and Onboarding pipelines. 

## 1. Zero-Friction Environment Configurations (`.env`)
To ensure the automated provisioning hook (`/api/workspaces/provision`) successfully maps "Explorer" users to internal Platform capacity, the server environment **MUST** possess the "Master Keys".

### Required Master Inference Keys:
```env
OPENAI_API_KEY="sk-proj-...."   # Used for GPT-4o audits and Core Embeddings (1536d)
GEMINI_API_KEY="AIzaSy...."      # Used for Gemini 2.0 Flash comparative audits
ANTHROPIC_API_KEY="sk-ant-..."   # Used for Claude 3.5 Sonnet comparative audits
```
*Note: If these keys expire or run out of external credits, all "Explorer" users will encounter an `HTTP 503 Simulation Engine Unavailable`. Paid users utilizing their own BYOK setup will remain unaffected.*

### Required Cryptographic Keys:
```env
JWT_SECRET="generate-a-hardened-64-char-string"
CRON_SECRET="generate-another-hardened-string-for-scheduler"
SSO_ENCRYPTION_KEY="32-byte-base64-fernet-key=="
```

## 2. API Licensing (B2B Infrastructure)
When an enterprise purchases "API Access" to bypass the dashboard and integrate AUM directly into their CI/CD pipelines, they use the B2B Gateway.

**Endpoint:** `POST https://api.aumdatalabs.com/api/simulation/v1/run`

### B2B Rate Limiting & DDOS Protection
- **The Limit:** The `/v1/run` endpoint is protected by `slowapi` at a hard limit of `100 requests per minute` aggregated per IP Address.
- **Exceeding Limits:** If an API consumer bursts past 100/min, the server immediately drops requests at the middleware layer, returning `HTTP 429 Too Many Requests`. This prevents upstream inference DDOS attacks on the OpenAI bounds.
- **Atomic Billing:** B2B calls successfully passing the `slowapi` IP-layer are still subject to atomic token-bucket billing in Firestore. If their tenant plan allows 500 requests per month, the 501st request will return `HTTP 402 Payment Required`.

### Key Structure
`aum_` keys are mathematically generated via `secrets.token_urlsafe(32)`. They are shown to the user **exactly once** during the provisioning redirect.
*The backend ONLY stores the SHA-256 hash of this key. It is impossible to recover a lost API key. If a client loses their key, they must revoke it in the dashboard and rotate a new one.*

## 3. Tier Management & Administration
Users are gated by Subscription Plan strings inside their Firestore Organization document (`organizations/{orgId}`).

### Gated Tiers:
- **`explorer`**: The default onboarding tier. Allows 3 simulations per month. Uses central platform `.env` inference keys to provide zero-friction setup.
- **`growth`**: Allows 100 simulations per month. Requires active Razorpay subscription.
- **`scale`**: Allows 500 simulations per month and unlocks the Batch Over-Night Evaluation routes.

To manually upgrade a tenant during a sales proof-of-concept (POC), modify the Firestore `subscription.planId` to `"scale"` and increment the `subscription.maxSimulations` limit securely via the Firebase Console.
