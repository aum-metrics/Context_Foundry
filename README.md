*Built by AUM Data Labs — AUM Context Foundry v5.1.0*

---

## 🏗 Architecture

```
┌────────────────────────────────────────────────────────────┐
│  EDGE CLIENT (Next.js 15 + React 19)                       │
│  Firebase Auth → Dashboard → Simulator → SoM Command Center│
└──────────────────────────┬─────────────────────────────────┘
                           │ HTTPS + Bearer Token
┌──────────────────────────▼─────────────────────────────────┐
│  /api/simulation  /api/ingestion  /api/seo  /api/competitor│
│  /api/workspaces  /api/payments   /api/sso  /api/admin     │
│  /api/auth/sso/callback                                    │
└──────────────────────────┬─────────────────────────────────┘
                           │ firebase-admin + Service Account
┌──────────────────────────▼─────────────────────────────────┐
│  STATE (Firestore)                                          │
│  organizations/{orgId}/manifests  users  api_keys          │
│  auditLogs  simulationCache  sso_configs                   │
└────────────────────────────────────────────────────────────┘
```

---

## 🔬 Core Technical Moats

### 1. LCRS Engine (60/40 Mathematical Scoring)
The **Low-Latency Claim-based Reliability Scoring** engine produces deterministic fidelity verdicts:
- **60% Claim Accuracy**: Atomic factual claims are extracted from AI responses and cross-verified against the organization's ground-truth vector set.
- **40% Semantic Fidelity**: Cosine similarity between embedded AI response and the Context Information Model (CIM) in 1536-dimensional space.
- **Divide-by-zero protected**: Claims and total initialized before scoring, no undefined scoring states.

### 2. Zero-Retention Semantic Pipeline
- Raw PDF uploaded → processed in volatile RAM via `PyMuPDF4LLM`.
- Chunked, embedded (`text-embedding-3-small`), synthesized into JSON-LD CIM.
- Raw bytes explicitly flushed (`del content; gc.collect()`).
- **24-Hour TTL**: All ingested manifests and chunks are automatically purged after 24 hours via `expiresAt` timestamps.
- **Zero S3/disk storage footprint.**

### 3. Identity Syndication
- Every tenant gets a dynamic `/llms.txt` manifesto served from the backend via admin-SDK-authenticated reads.
- Forces RAG agents (SearchGPT, Perplexity) to prioritize ground-truth over hallucinated training data.

### 4. Zero-Friction B2B Onboarding
- New users provision via `POST /api/workspaces/provision` (no JSON body needed — inferred from Firebase JWT).
- Auto-generates organization, user record, and B2B `aum_...` prefix API key in a single atomic operation.
- Platform manages OpenAI/Gemini/Anthropic inference keys so users start immediately without BYOK.

### 6. Fault-Tolerant Reliability
- **Persistent Task Queue Recovery**: A dedicated background sweep detects and restarts stalled or crashed simulations/SEO audits.
- **Fail-Safe Retries**: Automatic 3-strike retry logic for all async background operations.

---

## 🛡 Security & Compliance

| Mechanism | Implementation |
|-----------|---------------|
| Auth | Firebase ID Token verification; **Custom Claims for Admin Access** |
| Multi-tenancy | `verify_user_org_access` enforced on every org-scoped endpoint |
| API Security | **Global `apiKeys` Redaction** across all workspace and simulation responses |
| Payments | All Razorpay endpoints require auth + org ownership; Transaction-based atomic webhooks |
| SSO | OAuth2 Redirect & Callback flow; Fernet encryption for client secrets |
| Reliability | `TaskQueueRecovery` worker handles stalled/crashed background jobs |
| Webhook Security | `hmac.compare_digest` for Razorpay webhook verification + Idempotency checks |

---

## 🚀 Quick Start

### Requirements
- Python 3.12+, Node.js 22+, Firebase project (Firestore + Auth enabled)

### Environment Setup
```bash
# Backend — create .env with required variables (see Admin_Support_Handbook.md)
touch backend/.env
# Required: OPENAI_API_KEY, FIREBASE_SERVICE_ACCOUNT_JSON, RAZORPAY_KEY_ID, etc.

# Frontend — create .env.local with required variables
touch frontend/.env.local
# Required: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_API_BASE_URL, etc.
```

### Run Locally
```bash
# Terminal 1 — FastAPI Gateway (Port 8000)
cd backend
pip install -r requirements.txt
PYTHONPATH=app python3 app/main.py
# or: uvicorn app.main:app --port 8000 --reload

# Terminal 2 — Next.js Edge Client (Port 3000)
cd frontend
npm install
npm run dev
```

### Run Tests
```bash
cd backend
PYTHONPATH=app pytest tests -v
```

---

## 📊 Subscription Tiers

| Tier | Seats | Simulations/mo | Batch Analysis | Price |
|------|-------|----------------|----------------|-------|
| Explorer | 1 | 3 | ✗ | Free |
| Growth | 5 | 100 | ✓ | $79/mo |
| Scale | 25 | 500 | ✓ | $249/mo |
| Enterprise | Unlimited* | Unlimited | ✓ | Custom |

---

## 🗂 Project Structure

```
AUM/
├── backend/
│   ├── app/
│   │   ├── api/              # Route modules
│   │   │   ├── simulation.py    # LCRS engine + B2B API gateway
│   │   │   ├── ingestion.py     # Zero-retention PDF pipeline
│   │   │   ├── workspaces.py    # Org provisioning + manifest
│   │   │   ├── payments.py      # Razorpay integration
│   │   │   ├── sso.py           # Enterprise SSO
│   │   │   ├── competitor.py    # Competitive displacement
│   │   │   ├── seo.py           # SEO audit (async job)
│   │   │   ├── api_keys.py      # B2B key lifecycle
│   │   │   └── audit.py         # SOC2 audit logs
│   │   ├── core/
│   │   │   ├── security.py      # Auth + org access verification
│   │   │   ├── config.py        # Settings (Pydantic)
│   │   │   └── firebase_config.py
│   │   └── main.py             # FastAPI app + router mounts
│   └── tests/
│       ├── conftest.py          # Firestore mock + cleanup fixtures
│       ├── test_simulation.py
│       ├── test_ingestion.py
│       ├── test_competitor.py
│       ├── test_audit.py
│       └── test_rag_logic.py
├── frontend/
│   └── src/
│       ├── app/                 # Next.js App Router pages
│       ├── components/          # React UI components
│       └── lib/                 # Firebase config + utils
├── README.md
├── AUM_Enterprise_Technical_Specification.md
├── Admin_Support_Handbook.md
├── User_Guide.md
├── FAQ.md
└── CMO_Marketing_Guide.md
```

---

## 🔗 Key Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/workspaces/provision` | Firebase JWT | Auto-provision org + B2B key |
| GET | `/api/workspaces/{orgId}/members` | Firebase JWT + org-verify | List members + pending invites |
| POST | `/api/workspaces/{orgId}/members` | Firebase JWT + org-verify | Create pending invitation |
| POST | `/api/workspaces/{orgId}/accept-invite` | Firebase JWT | Accept invitation + join org |
| POST | `/api/simulation/run` | Firebase JWT | LCRS simulation |
| POST | `/api/simulation/v1/run` | `aum_` API Key | B2B simulation gateway |
| POST | `/api/ingestion/parse` | Firebase JWT | Zero-retention PDF ingestion |
| GET | `/api/competitor/displacement/{orgId}` | Firebase JWT + org-verify | Competitor analysis |
| POST | `/api/seo/audit` | Firebase JWT | Async SEO audit |
| GET | `/api/batch/batch/status/{orgId}/{jobId}` | Firebase JWT + org-verify | Batch job status |
| POST | `/api/payments/create-order` | Firebase JWT + org-verify | Razorpay order |
| POST | `/api/payments/verify` | Firebase JWT + org-verify | Payment verification |
| POST | `/api/sso/configure` | Firebase JWT + org-verify | Enterprise SSO config |
| GET | `/llms.txt` | Public | Tenant-aware AI manifesto |

---

*Built by AUM Data Labs — AUM Context Foundry v5.1.0*
