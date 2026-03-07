# AUM Context Foundry: Diligence Draft Pack

> **Authoritative Specification for Acquisition Review**  
> **Status**: [DRAFT] Transitioning to Hard Acquisition-Grade Proofs  
> **Version**: 5.2.1-Diligence-HardEvidence  
> **Confidentiality**: High (Technical Data Room)

---

## 1. Executive Summary
AUM Context Foundry is a production-grade B2B SaaS platform for LLM Brand Accuracy & Safety. It provides a specialized LCRS (Library-Claim-Recall-Score) engine that mathematically proves how accurately frontier models (GPT-4o, Gemini 3 Flash, Claude 4.5 Sonnet) represent a corporate "Source of Truth."

### Verification Maturity & Proof Pack
This document serves as a **Diligence Draft Pack**. We have transitioned from narrative-only claims to **Hard Artifact Verification**. 
- **Level 1 (Narrative)**: Documentation of system behavior.
- **Level 2 (Trace)**: Raw JSON request/response captures including HTTP status lines and headers.
- **Level 3 (State)**: Verified database mutations and quota decrements (In Progress).

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

## 4. Verification Proof (The Evidence Folder)
The following artifacts provide immutable proof of system functionality under staging/production conditions.

| Proof Point | Location | Description |
|-------------|----------|-------------|
| **Security Fail-Closed** | [security_fail_closed_proof.md](evidence/security_fail_closed_proof.md) | Proof of 503 rejection on database loss. |
| **SSO Callback Integrity** | [sso_lookup_proof.md](evidence/sso_lookup_proof.md) | Verified domain-masked login initiation. |
| **Payment Fulfillment** | [payment_webhook_proof.md](evidence/payment_webhook_proof.md) | HMAC-verified Razorpay order fulfillment logs. |
| **Frontier API Contract** | [e2e_simulation_proof.md](evidence/e2e_simulation_proof.md) | Verified 3-model parallel simulation with LCRS scoring. |

---

## 5. Maintenance & Reliability
- **Test Suite**: 62 Backend tests covering LCRS math, DB transactions, and security controllers.
- **CI/CD**: Gated via GitHub Actions (Lint + Build + Test).
- **Graceful Degradation**: System handles missing third-party providers via standardized mock paths in development mode.

---
*End of Diligence Specification*
