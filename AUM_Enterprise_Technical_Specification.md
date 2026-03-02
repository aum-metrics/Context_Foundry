# AUM Context Foundry: Technical Specification v3.0 (Wired & Tested)

## 1. System Overview
AUM Context Foundry is a deterministic event architecture for evaluating and optimizing Agentic Share of Voice (ASoV) within RAG-based LLM retrieval pipelines. It utilizes a stateless Next.js edge client communicating with a Python FastAPI backend protected by Firebase JWT authentication.

## 2. Core Functional Pipelines

### A. Zero-Retention Semantic Ingestion (`backend/app/api/ingestion.py`)
- **Process**: Multi-part form-data PDF upload -> PyMuPDF4LLM Markdown conversion -> Recursive Paragraph/Sentence chunking -> `text-embedding-3-small` vectorization.
- **Verification**: `backend/tests/test_ingestion.py` validates the `del content` manual memory garbage collection, ensuring raw data never persists in long-term storage.

### B. LCRS Scoring Engine (`backend/app/api/simulation.py`)
- **Algorithm**: Blended 60/40 math:
    - **60% Claim Verification**: Deterministic fact-extraction and cross-checking via concurrent LLM calls (GPT-4o Mini, Gemini 2.0 Flash, Claude 3.5 Haiku).
    - **40% Embedding Divergence**: Cosine similarity calculation between the AI response and the ground-truth manifest vector namespace.
- **Resiliency**: `@retry` decorators with exponential backoff handle provider timeouts (503s). Validated by `backend/tests/test_simulation.py` for mathematical edge cases.

### C. Agent Manifest Syndication (`frontend/src/app/llms.txt/route.ts`)
- **Protocol**: Exposes `/llms.txt` and `JSON-LD` schemas per organization.
- **Implementation**: Dynamically rendered (`force-dynamic`) to serve the latest organization-specific context directly from Firestore, bypassing static build caches.

## 3. Security & Multitenancy
- **Authentication**: Strict Firebase ID Token verification via `core/api_auth.py`. 
- **IDOR Prevention**: All database mutations require `verify_user_org_access(uid, orgId)` checks.
- **Audit Logging** (`backend/app/api/audit.py`): Append-only `systemLogs` collective records all sensitive state changes for enterprise compliance.

## 4. Resource Gating & Licensing (`backend/app/api/rate_limiter.py`)
Current tiers enforced by atomic Firestore transactions:
- **Explorer**: 3 simulations/mo, 1 doc.
- **Growth**: 100 simulations/mo, Unlimited docs, 5 seats.
- **Scale**: 500 simulations/mo, Unlimited docs, 25 seats.

## 5. Test Matrix
- **Backend (Pytest)**: Focused on mathematical scoring constraints and memory flushing.
- **Frontend (Playwright)**: Focused on E2E user journeys, Auth boundaries, and `BrandHealthCertificate` PDF generation.

---
© 2026 AUM Data Labs.
