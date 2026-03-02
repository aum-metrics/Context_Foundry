# AUM Context Foundry: Technical Specification v4.0.0

## 1. System Architecture
AUM leverages a decoupled architecture optimized for low-latency retrieval and high-precision evaluation.

*   **Frontend**: Next.js 15 (App Router, React 19) deployed as a stateless edge client.
*   **Backend**: Python FastAPI 0.110+ serving as an LCRS evaluation gateway.
*   **State Management**: Firestore (NoSQL) for semantic namespaces and organization metadata.
*   **Identity**: Firebase Auth (ID Tokens) for enterprise-grade multitenancy.

## 2. Proprietary Methodology

### A. LCRS (Low-latency Claim-based Reliability Scoring)
The LCRS engine (`simulation.py`) resolves "Context Drift" by executing a concurrent tri-model verification:
1.  **Fact Extraction**: Distills AI responses into atomic claims.
2.  **Cross-Verification**: Validates claims against an organization's 1536-dimensional "Ground Truth" vector set.
3.  **Weighted Blend**:
    *   `verify_score`: 0.6 weighting (factual accuracy).
    *   `fidelity_score`: 0.4 weighting (semantic alignment/cosine similarity).

### B. Zero-Retention Ingestion Pipeline
1.  **Ingestion**: Multi-part PDF stream parsing via `PyMuPDF4LLM`.
2.  **Vectorization**: Recursive chunking with overlap followed by `text-embedding-3-small` execution.
3.  **Memory Flush**: Mandatory `gc.collect()` and pointer deletion of raw bytes after index commitment.

## 3. API & Developer Platform
AUM is an **API-First** platform. Enterprise partners can license the evaluator via the `api/v1` namespace using HMAC-hashed API keys.
- **Rate Limiting**: Enforced via `slowapi` and periodic Firestore usage meters.
- **CORS Policy**: Restricted to verified organizational subdomains in production.
- **Automated Credentials (No BYOK)**: External frontier model API Keys (GPT, Claude, Gemini) required for the LCRS simulation are dynamically generated, encrypted, and injected per-organization during the initial onboarding transaction. This guarantees frictionless setup, sandboxes inference costs per tenant, and establishes granular billing transparency without exposing secrets to the frontend UI.

## 4. Exhaustive Data Flow Processes

### A. Ground Truth Ingestion Flow
1. **[Client]** Initiates multi-part form `POST /api/ingestion/parse` with Bearer auth.
2. **[API Gateway]** Validates Firebase ID token and extracts `orgId`.
3. **[Ingestion Engine]** Receives binary stream into volatile memory.
4. **[Extraction Node]** PyMuPDF4LLM parses structural text; JSON-LD Context Information Model (CIM) is synthesized.
5. **[Vector Node]** `text-embedding-3-small` creates 1536-dimensional vectors.
6. **[Database]** Atomic transaction writes vectors and JSON-LD to Firestore `organizations/{orgId}/knowledge`.
7. **[Garbage Collection]** Volatile memory buffers are destroyed.

### B. Tri-Model Adjudication Flow
1. **[Client]** `POST /api/simulation/run` with prompt payload.
2. **[Auth & Quota Layer]** Validates session and asserts rate/tier limits.
3. **[Execution Layer]** Retrieves organization's managed API keys. Asynchronously dispatches the prompt to OpenAI, Anthropic, and Google APIs.
4. **[LCRS Node]** Extracts claims, executes cosine similarity against the `knowledge` vectors, and calculates the 60/40 blended score.
5. **[Audit Layer]** Appends results to `scoringHistory` collective.
6. **[Client]** Receives deterministic mathematical verdict.

## 5. Resource Gating (Enforced Tiers)
- **Explorer**: Individual seat, 3 simulations/mo.
- **Growth**: 5 seats, 100 simulations/mo.
- **Scale**: 25 seats, 500 simulations/mo.
*Tier logic verified in `backend/app/api/rate_limiter.py`.*

## 5. Deployment Guidelines
- **Environment**: Containerized (FastAPI) and Edge-Optimized (Next.js).
- **Hardening**: Standardized `force-dynamic` routes for Manifesto syndication to ensure real-time crawler visibility.

---
© 2026 AUM Data Labs.
