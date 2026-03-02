# AUM Context Foundry (v4.0.0-PROD)

**The Verified Identity Router for the Agentic Era**

AUM Context Foundry is a production-hardened infrastructure layer designed to evaluate, optimize, and enforce how multi-modal Large Language Models (LLMs) ingest and cite enterprise data. It provides the "Smoke Detector" and "Identity Router" for brands navigating the shift from traditional search to retrieval-augmented agents.

---

## 🏗 Core Technical Moats

AUM is architected as an **API-First Data Infrastructure** for the enterprise, moving beyond simple dashboard wrappers.

*   **LCRS Evaluation Engine**: A deterministic 60/40 mathematical scoring model (`backend/app/api/simulation.py`).
    *   **60% Logical Claim Verification**: Concurrent LLM cross-checking (GPT, Gemini, Claude) to detect factual contradictions.
    *   **40% Semantic Fidelity**: Cosine similarity divergence analysis within specialized 1536-dimensional namespaces.
*   **Zero-Retention Semantic Pipeline**: Secure ingestion (`backend/app/api/ingestion.py`) that processes documents in volatile memory. Embeddings are persisted to Firestore; raw files are flushed immediately. **Zero AWS/S3 storage footprint.**
*   **Identity Syndication**: Dynamically serves crawler-optimized `/llms.txt` and `JSON-LD` schemas per organization (`frontend/src/app/llms.txt/route.ts`), forcing RAG agents (SearchGPT, Perplexity) to prioritize ground-truth.
*   **Hardened Multi-Tenancy**: Strict organizational isolation powered by Firebase ID tokens and verified Firestore security rules.

## 🛡 Security & Compliance (Audit-Ready)

Cleared "Mechanical Hardening" for enterprise-scale deployment and Series A technical diligence:

*   **Standardized Auth**: Backend protected by `firebase-admin` ID token verification. Legacy JWT paths consolidated.
*   **Atomic Transactions**: Billing quotas and simulation limits enforced by Firestore atomic transaction blocks to prevent race-condition abuse.
*   **SOC2 Audit Trail**: Sensitive operations (Ingestion/Deletion/API Key Revocation) generate append-only logs in a protected `systemLogs` collective.
*   **Fail-Closed Logic**: Critical endpoints (Auth, Ingestion, Payments) are architected to fail closed on upstream dependency timeouts.
*   **Automatic Provider Provisioning**: No BYOK (Bring Your Own Key) required. Infrastructure API keys (OpenAI, Anthropic, Gemini) are automatically generated and securely assigned per-tenant during the onboarding lifecycle. This guarantees isolated billing transparency and instantaneous platform readiness.

## 🔄 Product Process Flow & Data Architecture

AUM executes a strict, linear progression from unstructured ambiguity to mathematical certainty:

### 1. The Ingestion Workflow
1.  **Transport**: User uploads raw PDF assets or enters a URL via the Semantic Ingestion dashboard.
2.  **Volatile Memory Processing**: `PyMuPDF4LLM` extracts text and document structure entirely within RAM. Zero bytes are written to disk storage.
3.  **Semantic Chunking & Embedding**: Content is recursively chunked and embedded via `text-embedding-3-small`.
4.  **Transformation**: The chunks are synthesized into a verified Context Information Model (CIM) and stored as JSON-LD in Firestore. Raw buffers are instantly purged (`gc.collect()`).

### 2. The LCRS Simulation Workflow
1.  **Trigger**: User initiates a prompt in the Co-Intelligence Simulator.
2.  **Tri-Model Dispatch**: The Backend routes the prompt concurrently to GPT-4o, Claude 3.5 Sonnet, and Gemini 2.0 Flash using the organization's automatically provisioned execution keys.
3.  **Cross-Examination**: Responses are parsed for atomic claims.
4.  **Mathematical Adjudication**: Claims are verified against the organization's embedded CIM (Ground Truth Vector Set).
5.  **Output**: A deterministic Fidelity Score (0-100%) and a Master Audit Verdict are generated to measure Context Drift.

### 3. The Edge Syndication Workflow
1.  **Generation**: Validated ground truth is compiled into an optimizer-friendly `/llms.txt` manifesto.
2.  **Routing**: Next.js App Router edge nodes dynamically serve the manifesto specific to the requesting tenant's configuration.
3.  **Consumption**: External AI Agents (SearchGPT, Perplexity) ingest the manifesto, ensuring the brand's verified context overrides hallucinated training data.

## 🚀 Quick Start (Local Development)

### 1. Requirements
- Python 3.12+
- Node.js 22+
- Firebase Project (Firestore + Auth enabled)

### 2. Service Orchestration
```bash
# 1. Start the FastAPI Gateway (Port 8000)
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000 --reload

# 2. Start the Edge Client (Port 3000)
cd frontend
npm install
npm run dev
```

## 📊 Verification Matrix

AUM enforces a "Zero-Mock" philosophy for mission-critical security and math.

### 1. Backend Integrity (Pytest)
Validates the mathematical engine and zero-retention memory lifecycle.
```bash
cd backend
python -m pytest tests/ --verbose
```

### 2. Frontend E2E (Playwright)
Validates auth boundaries, dashboard state, and PDF export integrity.
```bash
cd frontend
npx playwright test
```

---

© 2026 AUM Data Labs. All rights reserved.
