# AUM Context Foundry

**Verified Identity Router for the Agentic Era**

AUM Context Foundry is a production-grade infrastructure platform designed to evaluate and optimize how multi-modal Large Language Models (LLMs) ingest, process, and cite enterprise data. It bridges the gap between passive search monitoring and active retrieval augmentation.

---

## 🏗 Architecture & Core Moats

AUM is not a "dashboard wrapper." It is fundamentally architected as an **API-First Data Infrastructure** supporting multi-tenant enterprise isolation.

*   **Backend Array:** FastAPI (Python 3.12+). Evaluates deterministic RAG drift utilizing a 60/40 mathematical scoring engine (40% cosine similarity embedding divergence, 60% claim-by-claim LLM verification).
*   **Zero-Retention Semantic Pipeline:** Proprietary ingestion (`backend/app/api/ingestion.py`). Files are held in volatile RAM, vectorized into 1536-dimensional namespaces, committed to Firestore, and instantaneously deleted. *No AWS bucket persistence.*
*   **The Edge Client:** Next.js 15 (App Router). Operates as an API consumer of the FastAPI backend, protected by strict Firebase JWT authentication, offering the CMO/CISO an interpretable view of the underlying vector database.
*   **Dynamic Identity Routing:** Generates live, crawler-optimized `/llms.txt` and `JSON-LD` schemas per organization, forcing RAG engines (SearchGPT, Perplexity) to index ground-truth.

## 🛡 Security & Hardening (v2.2.0)

The platform has successfully cleared comprehensive "Brutal Hardening" criteria for Seed/Series A diligence:

*   **Firebase Standardized Auth:** Decentralized JWT session management seamlessly maps to FastAPI dependencies (`core/api_auth.py`). 
*   **Atomic Transactions:** Concurrency in billing cycles and simulation quotas (Explorer/Growth/Scale) are protected by strict NoSQL transaction blocks.
*   **Air-Gapped SOC2 Auditing:** Critical `create/update/delete` schema mutations write async logs to a protected `systemLogs` collective.
*   **Graceful Degradation:** Multi-provider API routing natively handles `503` timeouts from OpenAI/Anthropic/Google via exponential backoffs without crushing the client socket.

## 🚀 Execution & Automation

### 1. The Local B2B Stack
```bash
# 1. Start the API Gateway (Port 8000)
cd backend
python3 -m pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 2. Start the Edge Client (Port 3000)
cd frontend
npm install
npm run dev
```

### 2. "No Mocking" Test Suites
AUM features a robust dual-layer testing matrix. We do not mock security.

**Backend Integrity (PyTest):**
Validates the mathematical scoring constraints and zero-retention memory flushing.
```bash
cd backend
python3 -m pytest tests/ --verbose
```

**Frontend E2E (Playwright):**
Verifies the Next.js visual layer, Auth routing, and PDF Export pipelines.
```bash
cd frontend
npx playwright test
```

## 📊 Live Observability

*   **Health:** `/api/health` API heartbeat.
*   **Log Streams:** Unstructured request tracing routed through `logging.getLogger`.
*   **ASoV Radar Insights:** Real-time Aggregated Share of Voice tracking.

---
© 2026 AUM Data Labs. All rights reserved.
