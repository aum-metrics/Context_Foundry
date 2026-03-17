# AUM Context Foundry: Diligence Draft Pack

> **Authoritative Specification for Acquisition Review**  
> **Status**: [DRAFT] Transitioning to Hard Acquisition-Grade Proofs  
> **Version**: 5.2.1-Diligence-HardEvidence  
> **Confidentiality**: High (Technical Data Room)

---

## 1. Executive Summary
AUM Context Foundry is a production-grade B2B SaaS platform for LLM Brand Accuracy & Safety. It provides a specialized Visibility Score engine that mathematically proves how accurately frontier models (GPT-4o, Gemini 3 Flash, Claude 4.5 Sonnet) represent a corporate "Source of Truth."

### Verification Maturity & Proof Pack
This document serves as a **Diligence Draft Pack**. We have transitioned from narrative-only claims to **Hard Artifact Verification**. 
- Level 1 (Narrative house): Documentation of system behavior.
- Level 2 (Trace): Raw JSON request/response captures from local execution.
- Level 3 (Identity): Domain-masked SSO intent traces.
- Level 4 (Environment): Verified traces from the hosted **Google Cloud Run** environment.

Current evidence artifacts are stored in the `evidence/raw/` directory with full cryptographic traces.

### Key Technical Pillars
- **Frontier-First Engine**: Native integration with the latest LLM benchmarks.
- **Fail-Closed Security**: Mandatory startup secret gating and Pydantic-validated environment isolation.
- **Enterprise Ready**: Full SSO (Okta/Azure AD) and regional payment routing (Razorpay India).
- **Auditable Methodology**: 62-test backend coverage with immutable diligence proof.

---

## 2. System Architecture & Integrity
Located in [01_Architecture_and_System_Design.md](../01_Architecture_and_System_Design.md).

### Core Stack
- **Backend**: Python (FastAPI), Pydantic (Settings/Validation), Firebase Admin SDK.
- **Frontend**: Next.js (TypeScript), Tailwind CSS, Firebase Client SDK.
- **Infrastructure**: Containerized (Docker), Google Cloud Platform (Cloud Run), Firebase (Firestore/Auth).

---

## 3. Security & Compliance Posture
Located in [04_Database_and_Security.md](../04_Database_and_Security.md) and [PRODUCTION_READINESS.md](../../PRODUCTION_READINESS.md).

- **Data Privacy**: Zero-Retention Ingestion. PDF and URL data are vectorized in RAM; raw content is never persisted.
- **Identity**: Okta-compatible SSO with Fernet-encrypted client secrets.
- **Environment Gating**: Production mode strictly blocks mock authentication and development defaults.

---

## 4. Internal Diligence Baseline (Local Traces)
The following artifacts provide high-fidelity request/response traces captured in a controlled local execution environment. These serve as the baseline for staging/production parity.

| Proof Point | Location | Description |
|-------------|----------|-------------|
| **Security Fail-Closed** | [security_fail_closed_proof.md](evidence/security_fail_closed_proof.md) | **Verified 503** rejection on database loss. |
| **SSO Identity Handshake** | [sso_identity_proof.md](evidence/sso_identity_proof.md) | Trace of domain-masked login intent generation. |
| **Payment Fulfillment** | [payment_webhook_hmac_proof.md](evidence/payment_webhook_hmac_proof.md) | HMAC-verified Razorpay fulfillment logic. |
| **Frontier API Contract** | [frontier_simulation_contract_proof.md](evidence/frontier_simulation_contract_proof.md) | **Local Baseline**: Parallel simulation contract trace. |
| **Cloud Run Verification** | [external_staging_proof.md](evidence/external_staging_proof.md) | **Level 4**: Real trace from hosted `a.run.app` service. |

---

## 5. Maintenance & Reliability
- **Test Suite**: 62 Backend tests covering Visibility scoring math, DB transactions, and security controllers.
- **CI/CD**: Gated via GitHub Actions (Lint + Build + Test).
- **Graceful Degradation**: System handles missing third-party providers via standardized mock paths in development mode.

---
*End of Diligence Specification*


## Update: 2026-03-17
- Quick Scan prompt tuned to reduce negative claims for strong brands; competitor tile label now adapts to score.
- Quick Scan edge proxy returns a demo fallback on upstream 5xx to avoid blank/failed landing scans.
- Release checklist added at docs/RELEASE_CHECKLIST.md.
- Workspace health endpoint (GET /api/workspaces/health) added for uptime checks.
- Prompt sanitization now strips <script> tags and ignores non-string input safely.
- Quick Scan landing page validates scan responses and handles non-200 errors to avoid invalid date/blank score rendering.
- Quick Scan public endpoint (`/api/quick-scan`) uses a platform OpenAI key with per-IP rate limiting.
- Competitor displacement API is gated to Growth/Scale/Enterprise plans.
- Simulation quota reservation uses sharded counters (`usageReservations`) to reduce org doc contention.
- Pricing defaults: Growth ₹6,499/mo, Scale ₹20,999/mo (Razorpay plan amounts).
- Default support email: hello@aumcontextfoundry.com (white-label config).

