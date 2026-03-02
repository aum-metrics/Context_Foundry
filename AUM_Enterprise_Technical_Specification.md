# AUM Context Foundry — Enterprise Technical Specification
**v4.1.0 | March 2026**

---

## 1. System Architecture

AUM is a decoupled, multi-tenant infrastructure platform with a stateless edge client and a stateful evaluation gateway.

### Stack
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Edge Client | Next.js 15 (App Router, React 19) | Dashboard, Simulator UI, Dynamic `/llms.txt` |
| Gateway | Python FastAPI 0.115+ | LCRS evaluation, ingestion, billing, SSO |
| State | Google Firestore (NoSQL) | Semantic namespaces, org metadata, audit logs |
| Identity | Firebase Auth + firebase-admin | Multi-tenant session management |
| Payments | Razorpay | Subscription lifecycle (INR billing) |
| Inference | OpenAI, Anthropic, Google GenAI | Multi-model evaluation |

### Deployment Topology
- **Backend**: Docker container, port 8000. Entry: `uvicorn app.main:app`.
- **Frontend**: Vercel Edge Network or self-hosted Node.js, port 3000.
- **Database**: Google Firestore (regional, Mumbai preferred for latency).

---

## 2. Authentication & Authorization Model

### Session Auth (Users)
1. Firebase Auth issues a JWT after email/Google sign-in.
2. Frontend attaches it as `Authorization: Bearer <token>`.
3. Backend calls `firebase_admin.auth.verify_id_token(token)` to decode.
4. `verify_user_org_access(uid, orgId)` queries `users/{uid}.orgId` in Firestore and compares — **fail-closed** on DB errors.

### API Key Auth (B2B)
1. Provisioning generates `aum_<32-byte-urlsafe-token>`.
2. Backend stores `SHA-256(key)` as the document ID in `api_keys` collection.
3. Incoming requests are validated by hashing the presented key and looking it up — **timing-safe comparison**.
4. API keys carry `orgId` to scope access without a user session.

### Endpoint Authorization Matrix
| Endpoint | Auth Method | Org Check |
|----------|------------|-----------|
| `/api/simulation/run` | Firebase JWT or `aum_` key | ✅ |
| `/v1/run` | `aum_` key only | ✅ |
| `/api/ingestion/parse` | Firebase JWT or `aum_` key | ✅ |
| `/api/workspaces/provision` | Firebase JWT | N/A (creates org) |
| `/api/workspaces/{orgId}/members` | Firebase JWT | ✅ |
| `/api/payments/create-order` | Firebase JWT | ✅ |
| `/api/payments/verify` | Firebase JWT | ✅ |
| `/api/payments/payment-link` | Firebase JWT | ✅ |
| `/api/sso/configure` | Firebase JWT | ✅ |
| `/api/sso/status/{orgId}` | Firebase JWT | ✅ |
| `/api/audit/logs/{orgId}` | Firebase JWT | ✅ |
| `/api/competitor/displacement/{orgId}` | Firebase JWT | ✅ |

---

## 3. LCRS Engine (Simulation)

### Mathematical Formula
```
LCRS Score = (0.60 × claim_accuracy) + (0.40 × semantic_fidelity)
```

Where:
- `claim_accuracy` = `supported_claims / total_claims` (0.0–1.0)
- `semantic_fidelity` = `max(0.0, 1.0 - cosine_divergence)` (0.0–1.0)
- `cosine_divergence` = angular distance between manifest embedding and AI response embedding

### Fidelity Grades
| Score | Grade | Meaning |
|-------|-------|---------|
| > 85 | `high_fidelity` | AI accurately represents brand |
| 60–85 | `minor_drift` | Manageable narrative deviation |
| < 60 | `critical_drift` | Brand narrative actively misrepresented |

### Sentinel Key Resolution
When `apiKeys.openai == "internal_platform_managed"` (auto-provisioned orgs), the engine resolves at runtime:
```python
if openai_key == "internal_platform_managed":
    openai_key = os.getenv("OPENAI_API_KEY")
```
This ensures BYOK and platform-managed orgs use the same code path with zero behavior difference.

### Simulation Quota Enforcement
Enforced via **Firestore atomic transaction** on `organizations/{orgId}.subscription.simsThisCycle`:
```
Explorer:  3 simulations/cycle
Growth:   100 simulations/cycle
Scale:    500 simulations/cycle
```
Transaction is skipped in `ENV=development` for local testing.

### Cache
SHA-256 hash of `(orgId + prompt + manifestVersion)` is used as a cache key stored in `organizations/{orgId}/simulationCache`. Cache TTL: 24 hours. Bypassed for Explorer plan users on new prompts.

---

## 4. Zero-Retention Ingestion Pipeline

```
PDF Upload (multipart/form-data)
        ↓
[Security] Firebase JWT validation + org ownership check
        ↓
[Plan Gate] Check manifests count for Explorer limit (1 doc)
        ↓
[Memory] Read binary stream into volatile RAM (<10MB limit)
        ↓
[Extraction] PyMuPDF4LLM → Markdown in RAM
        ↓
[Zero-Retention] del content; gc.collect() — raw PDF purged
        ↓
[Chunking] recursive_split(text, max_size=2000, overlap=200)
        ↓
[Embedding] text-embedding-3-small via OpenAI (batched, 16/req)
        ↓
[Schema] GPT-4o-mini JSON-LD CIM extraction
        ↓
[Persistence] Firestore transaction → manifests/{id} + latest
        ↓
[Chunks] Batch write → manifests/{id}/chunks/{i} (400/batch limit)
        ↓
[Audit] SOC2 log → organizations/{orgId}/auditLogs
```

**Key Properties:**
- Plan limit checks `organizations/{orgId}/manifests` collection (not `documents`).
- Ingestion API key resolves: BYOK key → filtered by sentinel → env fallback.
- Transaction atomicity ensures manifest + latest are always consistent.

---

## 5. Auto-Provisioning & Onboarding

```
Frontend: POST /api/workspaces/provision (Bearer token, no body required)
        ↓
Backend: Decode JWT → extract uid, email, name
        ↓
Check: users/{uid} exists? → return orgId (idempotent)
        ↓
Generate: org_id = "org_{timestamp}_{6-byte-random}"
Generate: b2b_key = "aum_{32-byte-urlsafe-token}"
Generate: key_hash = SHA-256(b2b_key)
        ↓
Write (atomic):
  - organizations/{org_id}: name, subscription{planId: "explorer"}, apiKeys{sentinel}
  - users/{uid}: uid, email, orgId, role: "admin"
  - api_keys/{key_hash}: keyHash, orgId, status: "active"
        ↓
Return: { orgId, apiKey (ONCE ONLY), status: "provisioned" }
```

**OrganizationContext.tsx** normalizes the Firestore shape:
```ts
subscriptionTier = rawOrg.subscriptionTier ?? rawOrg.subscription?.planId ?? "explorer"
```

---

## 6. B2B API Licensing (External Integrators)

### Endpoint
```
POST /v1/run
Authorization: Bearer aum_<token>
Content-Type: application/json

{
  "orgId": "org_abc123",
  "prompt": "What is your data retention policy?",
  "manifestVersion": "latest"
}
```

### Rate Limiting (Production)
- `slowapi` IP-level rate limiter applied at the `/v1/run` route.
- Per-org quota enforced via Firestore atomic transaction.
- IP-level: 5 requests/second (configurable via `RATE_LIMIT_PER_SECOND` env).

### Key Lifecycle
- Generate: `POST /api/api-keys` (Firebase JWT).
- List: `GET /api/api-keys` (Firebase JWT, returns own org's keys).
- Revoke: `DELETE /api/api-keys/{key_id}` (Firebase JWT, ownership verified by `userId`).

---

## 7. Firestore Data Model

```
users/
  {uid}: { uid, email, orgId, role }

organizations/
  {orgId}/
    doc: { id, name, activeSeats, subscription{planId, simsThisCycle, maxSimulations}, apiKeys }
    manifests/
      latest: { content (JSON-LD), embedding, createdAt, version, totalChunks }
      {manifestId}/
        chunks/{i}: { text, embedding, index }
    simulationCache/
      {sha256_hash}: { results, prompt, timestamp }
    auditLogs/
      {auto_id}: { timestamp, actorId, eventType, resourceId, metadata, status }
    activity/
      {auto_id}: { type, timestamp, detail }

api_keys/
  {sha256_hash}: { keyHash, orgId, userId, name, status, createdAt, lastUsedAt }

sso_configs/
  {orgId}: { provider, domain, client_id, client_secret (encrypted), is_active }
```

---

## 8. SEO Audit Pipeline

Async job pattern:
1. `GET /api/seo/audit?orgId=...` → returns `{ jobId }` immediately (Playwright runs in background).
2. Frontend polls `GET /api/seo/audit/status/{orgId}/{jobId}` until `status: "complete"`.
3. Results include Core Web Vitals, meta tags, JSON-LD validation, LLM-readability score.

---

## 9. Competitor Displacement Analysis

- Endpoint: `GET /api/competitor/displacement/{orgId}`.
- Returns: `{ competitors: [{ name, displacementRate, strengths, weaknesses }] }`.
- Powered by GPT-4o-mini with org context from the latest CIM manifest.
- Falls back to simulated data if no API key available in `ENV=development`.

---

## 10. Enterprise SSO

Supported providers: Okta, Azure AD, Google Workspace.

- `POST /api/sso/configure` — org membership required, client secret encrypted with Fernet (32-byte key from `SSO_ENCRYPTION_KEY` env).
- `GET /api/sso/status/{orgId}` — org membership required.
- `POST /api/sso/initiate` — auth required.

---

## 11. Subscription & Payment Flow

Provider: **Razorpay** (INR)

```
POST /api/payments/create-order [auth + org-verify]
  → Razorpay order created
  → Order stored in Firestore

POST /api/payments/verify [auth + org-verify]
  → HMAC-SHA256 webhook signature validated (hmac.compare_digest)
  → organizations/{orgId}.subscription updated

POST /api/payments/payment-link [auth + org-verify]
  → Razorpay payment link generated

POST /api/payments/webhook
  → No auth (public Razorpay callback)
  → Signature validated with hmac.compare_digest
```

---

## 12. Test Infrastructure

```
backend/tests/
  conftest.py          — autouse Firestore mock + dependency override cleanup per test
  test_simulation.py   — LCRS math + simulation endpoint (happy + unhappy path)
  test_ingestion.py    — recursive_split + parse endpoint
  test_competitor.py   — displacement endpoint + dev fallback
  test_audit.py        — audit log write + retrieval endpoint
  test_rag_logic.py    — cosine similarity math, scoring logic
```

Run:
```bash
cd backend && PYTHONPATH=app pytest tests -v
```

---

## 13. Environment Variables

See `Admin_Support_Handbook.md` for the complete variable reference.

**Critical variables (without which the system will not start):**
- `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_PATH`
- `OPENAI_API_KEY`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`

---

*AUM Data Labs — Context Foundry Enterprise Technical Specification v4.1.0*
