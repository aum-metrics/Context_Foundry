# AUM Context Foundry — Enterprise Technical Specification
**v5.1.0-hardened | March 2026**

---

## 1. System Architecture

AUM is a decoupled, multi-tenant infrastructure platform with a stateless edge client and a stateful evaluation gateway.

### Stack
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Edge Client | Next.js 15 (App Router, React 19) | Dashboard, Simulator UI, Dynamic `/llms.txt` |
| Gateway | Python FastAPI 0.115+ | Visibility Score evaluation, ingestion, billing, SSO |
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

### Admin Panel Auth (Custom Claims)
1. Admin access is strictly governed by the `admin: true` custom claim on the Firebase ID token.
2. Backend validates claims in `verify_admin` dependency; unauthorized attempts are blocked at the gateway.
3. Plaintext admin login routes have been disabled to prevent credential leakage.

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
| `/api/sso/callback` | OAuth2 (Redirect) | N/A |
| `/api/sso/status/{orgId}` | Firebase JWT | ✅ |
| `/api/audit/logs/{orgId}` | Firebase JWT | ✅ |
| `/api/competitor/displacement/{orgId}` | Firebase JWT | ✅ |

---

## 3. Visibility Scoring Engine (Simulation)

### Mathematical Formula
```
Visibility Score = (0.60 × claim_accuracy) + (0.40 × semantic_fidelity)
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
| < 60 | `drift_detected` | Brand narrative actively misrepresented |

When `apiKeys.openai == "internal_platform_managed"` (auto-provisioned orgs), the engine resolves at runtime:
```python
if openai_key == "internal_platform_managed":
    openai_key = os.getenv("OPENAI_API_KEY")
```
Sensitive keys are **always redacted** from the final API response to prevent client-side exposure.

### Visibility Score Formula (Scoring Heuristic)

The Logical Contextual Representation Score is a blended metric:

```
Visibility Score = (0.6 × Cs/Ct) + (0.4 × (1 − Dc))
```

> **Methodology candor**: The 60/40 weighting is an engineering design choice optimizing for factual accuracy over semantic similarity. It is not derived from ablation studies, published research, or peer review. A diligence buyer should understand this is a practical heuristic, not a scientifically validated metric.

### Simulation Quota Enforcement
Enforced via a **per-run usage ledger** at `organizations/{orgId}/usageLedger` with cycle-aware counting. `subscription.simsThisCycle` is a derived rollup (updated by cron) for dashboards, not the source of truth:
```
Explorer:   1 simulation run / one free report
Growth:   100 simulations/cycle
Scale:    500 simulations/cycle
Enterprise: 2000 simulations/cycle by default (admin-managed override supported)
```
Ledger writes and quota checks are skipped in `ENV=development` for local testing.

> **Note:** `settings.ENV` in `config.py` is the single source of truth for environment mode. Production startup gate hard-crashes on missing API keys.

### Cache
SHA-256 hash of `(orgId + prompt + resolvedManifestVersion)` is used as a cache key stored in `organizations/{orgId}/simulationCache`. When the request uses `manifestVersion=latest`, the system resolves it to the actual manifest document ID before hashing to avoid stale cache hits. Cache TTL: 24 hours. Bypassed for Explorer plan users on new prompts.

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
[Zero-Retention] 24-hour TTL assigned via `expiresAt` → raw PDF purged
        ↓
[Chunking] recursive_split(text, max_size=2000, overlap=200)
        ↓
[Embedding] text-embedding-3-small via OpenAI (batched, 16/req)
        ↓
[Schema] GPT-4o JSON-LD CIM extraction
        ↓
[Persistence] Firestore transaction → manifests/{id} + latest (with TTL)
        ↓
[Chunks] Batch write → manifests/{id}/chunks/{i} (with TTL)
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
        ↓
Write (atomic):
  - organizations/{org_id}: name, subscription{planId: "explorer"}, apiKeys{sentinel}
  - users/{uid}: uid, email, orgId, role: "admin"
        ↓
Return: { orgId, status: "provisioned" }
```

**OrganizationContext.tsx** normalizes the Firestore shape:
```ts
subscriptionTier = rawOrg.subscriptionTier ?? rawOrg.subscription?.planId ?? "explorer"
```

---

## 6. B2B API Licensing (External Integrators)

### Eligibility
External API-key licensing is intended for paid tiers:
- Growth
- Scale
- Enterprise

Explorer workspaces do not auto-provision an external `aum_...` key.

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
- Per-org quota enforced via usage ledger counting for the current billing cycle.
- IP-level: 5 requests/second (configurable via `RATE_LIMIT_PER_SECOND` env).

### Key Lifecycle
- Generate: `POST /api/keys/generate` (Firebase JWT).
- List: `GET /api/keys/list` (Firebase JWT, returns own org's keys).
- Revoke: `DELETE /api/keys/{key_id}` (Firebase JWT, ownership verified by `userId`).

---

## 7. Firestore Data Model

```
users/
  {uid}: { uid, email, orgId, role }

organizations/
  {orgId}/
    doc: { id, name, activeSeats, subscription{planId, simsThisCycle, maxSimulations, lastUsageResetAt}, apiKeys }
    manifests/
      latest: { content (JSON-LD), embedding, createdAt, version, totalChunks }
      {manifestId}/
        chunks/{i}: { text, embedding, index }
    simulationCache/
      {sha256_hash}: { results, prompt, timestamp }
    usageLedger/
      {auto_id}: { timestamp, prompt, manifestVersion, planId }
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
1. `POST /api/seo/audit` with JSON body (`{ orgId, url }`) → returns `{ jobId }` immediately (Playwright runs in background).
2. Frontend polls `GET /api/seo/audit/status/{orgId}/{jobId}` until `status: "complete"`.
3. Results include Core Web Vitals, meta tags, JSON-LD validation, LLM-readability score.

---

- Endpoint: `GET /api/competitor/displacement/{orgId}`.
- Returns: `{ competitors: [{ name, displacementRate, strengths, weaknesses }] }`.
- Powered by GPT-4o with org context from the latest CIM manifest.
- **Fail-Closed**: Requires active authentication and valid CIM; no development fallbacks.

---

## 10. Enterprise SSO

Supported providers: Okta, Azure AD, Google Workspace.

- `POST /api/sso/configure` — org membership required, client secret encrypted with Fernet (32-byte key from `SSO_ENCRYPTION_KEY` env). Managed via `SSOSettings.tsx` UI.
- `GET /api/sso/status/{orgId}` — org membership required.
- `GET /api/sso/login?intent=...` — public redirect endpoint, invoked with a signed short-lived SSO intent token.

---

## 11. Task Queue & Recovery Worker

A distributed-safe background job recovery system:

- **Collection Architecture**: Jobs stored in `organizations/{orgId}/batchJobs` and `organizations/{orgId}/seoJobs`.
- **States**: `queued` → `processing` → `complete`/`failed`.
- **Recovery Worker**: `TaskQueueRecovery.sweep_stalled_jobs()` runs at startup and scans for jobs in `processing` state for >30 mins.
- **Retry Logic**: Automatic retry up to 3 times before setting to `failed_permanent`.
- **Performance**: Uses `select()` projections to scan large job sets with minimal memory overhead.

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
  test_simulation.py   — Visibility scoring math + simulation endpoint (happy + unhappy path)
  test_ingestion.py    — recursive_split + parse endpoint
  test_competitor.py   — displacement endpoint + dev fallback
  test_audit.py        — audit log write + retrieval endpoint
  test_rag_logic.py    — cosine similarity math, scoring logic
```
The methodology endpoint transparently discloses the scoring formula:
- Standards references (ISO/IEC 42001, NIST AI RMF) indicate design principles the system was **informed by**, not formal certifications or compliance attestations.
- The 60/40 blend is a design choice. The `/api/methods/` endpoint exposes the full formula for audibility.

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

*AUM Context Foundry — AUM Context Foundry Enterprise Technical Specification v5.1.0-hardened*
