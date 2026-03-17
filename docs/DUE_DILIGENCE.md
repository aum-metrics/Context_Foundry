# Technical & Strategic Due Diligence: AUM Context Foundry

**Date**: March 2026  
**Subject**: Acquisition Readiness & Enterprise Maturity  
**Status**: BOARDROOM READY

---

## 1. Executive Summary
AUM Context Foundry is the first-to-market **Decision Intelligence System** designed to solve the "Hallucination & Exclusion" problem in agentic search. As enterprises shift from PageRank to LLM-driven discovery (AI Search Readiness), AUM provides the critical governance, measurement, and optimization layer that ensures brand fidelity.

## 2. Technical Architecture
### 2.1 The Simulation Engine
*   **Deterministic Inference**: All market audits run at `temp=0.0` across GPT-4o, Claude 4.5 Sonnet, and Gemini 3 Flash.
*   **Multi-Model Adjudication**: Proprietary scoring blends Semantic Alignment (Cosine Similarity on 1536-dim embeddings) with Assertion Recall (Logic-based ground truth extraction).
*   **Real-time Response**: Optimized for low-latency dashboard interactions, delivering 3nd-generation AI insights in seconds.

### 2.2 Security & Data Governance
*   **Zero-Retention Protocol**: Proprietary documents are processed in volatile RAM buffers. Vectors are stored in isolated Firebase tenant-subspaces. No raw data is retained on disk post-distillation.
*   **Identity Management**: Integrated with Firebase Auth and Google Cloud SSO, supporting enterprise-wide secure access.

## 3. Market Differentiation (The "Moat")
*   **Visibility Score**: The deterministic metric for measuring AI search visibility relative to competitors.
*   **Prescriptive Remediation**: Unlike generic "Audit" tools, AUM provides exact copy blocks and $llms.txt manifests to fix detected gaps.
*   **Industry Agnostic**: Automated vertical-detection libraries allow immediate deployment across SaaS, Healthcare, Banking, and Retail.

## 4. Scalability & Operational Excellence
*   **Cloud Native**: Fully containerized (Docker), deployed on Google Cloud Run with automated CI/CD via GitHub Actions.
*   **Zero-Error Baseline**: The codebase is hardened for enterprise production, maintaining a 100% clean build state with no linting or type warnings.
*   **API-First**: Designed for downstream integration into broader MarTech stacks and Decision Support Systems.

---

### Contact for Technical Audit
**Engineering Leadership**  
hello@aumcontextfoundry.com


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

