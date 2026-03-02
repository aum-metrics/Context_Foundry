# AUM Context Foundry

> **The Verified Identity Router for the Agentic Era**

AUM Context Foundry is a production-hardened, **API-First Data Infrastructure** that evaluates, optimizes, and enforces how multi-modal Large Language Models ingest and cite enterprise data. It provides quantified Agentic Share of Voice (ASoV) scoring across GPT-4o, Claude 3.5, and Gemini 2.0 — giving enterprises mathematical visibility into whether their brand is winning or losing in the AI-answer layer.

[![Python](https://img.shields.io/badge/Python-3.12+-blue)](https://python.org) [![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org) [![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green)](https://fastapi.tiangolo.com) [![Firebase](https://img.shields.io/badge/Firebase-Firestore+Auth-orange)](https://firebase.google.com)

---

## 🏗 Architecture

```
┌────────────────────────────────────────────────────────────┐
│  EDGE CLIENT (Next.js 15 + React 19)                       │
│  Firebase Auth → Dashboard → Simulator → SoM Command Center│
└──────────────────────────┬─────────────────────────────────┘
                           │ HTTPS + Bearer Token
┌──────────────────────────▼─────────────────────────────────┐
│  LCRS GATEWAY (FastAPI 0.115)                              │
│  /api/simulation  /api/ingestion  /api/seo  /api/competitor│
│  /api/workspaces  /api/payments   /api/sso  /api/audit     │
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
- **Zero S3/disk storage footprint.**

### 3. Identity Syndication
- Every tenant gets a dynamic `/llms.txt` manifesto served from the backend via admin-SDK-authenticated reads.
- Forces RAG agents (SearchGPT, Perplexity) to prioritize ground-truth over hallucinated training data.

### 4. Zero-Friction B2B Onboarding
- New users provision via `POST /api/workspaces/provision` (no JSON body needed — inferred from Firebase JWT).
- Auto-generates organization, user record, and B2B `aum_...` prefix API key in a single atomic operation.
- Platform manages OpenAI/Gemini/Anthropic inference keys so users start immediately without BYOK.

### 5. B2B API Licensing
- External integrators use `aum_` prefix Bearer tokens for direct API access.
- Rate limiting via `slowapi` (IP + Token layer).
- All B2B key usage logged to SOC2 audit trail.

---

## 🛡 Security & Compliance

| Mechanism | Implementation |
|-----------|---------------|
| Auth | `firebase-admin` ID token verification; `aum_` prefix API keys with SHA-256 hash |
| Multi-tenancy | `verify_user_org_access` enforced on every org-scoped endpoint |
| Payments | All Razorpay endpoints require auth + org ownership (`/create-order`, `/verify`, `/payment-link`) |
| SSO | `/configure` and `/status` require org membership; Fernet encryption for client secrets |
| Audit | SOC2-compliant append-only logs in `organizations/{orgId}/auditLogs` |
| Rate Limiting | `slowapi` + Firestore atomic transaction-based simulation quotas |
| Webhook Security | `hmac.compare_digest` for Razorpay webhook verification |

---

## 🚀 Quick Start

### Requirements
- Python 3.12+, Node.js 22+, Firebase project (Firestore + Auth enabled)

### Environment Setup
```bash
# Backend (copy and fill values)
cp backend/.env.example backend/.env

# Frontend (copy and fill values)
cp frontend/.env.example frontend/.env.local
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
| Growth | 5 | 100 | ✓ | ₹4,999/mo |
| Scale | 25 | 500 | ✓ | ₹14,999/mo |

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
| POST | `/api/simulation/run` | Firebase JWT | LCRS simulation |
| POST | `/v1/run` | `aum_` API Key | B2B simulation gateway |
| POST | `/api/ingestion/parse` | Firebase JWT | Zero-retention PDF ingestion |
| GET | `/api/competitor/displacement/{orgId}` | Firebase JWT | Competitor analysis |
| GET | `/api/seo/audit` | Firebase JWT | Async SEO audit |
| POST | `/api/payments/create-order` | Firebase JWT + org-verify | Razorpay order |
| POST | `/api/sso/configure` | Firebase JWT + org-verify | Enterprise SSO config |
| GET | `/llms.txt` | Public | Tenant-aware AI manifesto |

---

*Built by AUM Data Labs — Context Foundry v4.1.0*
