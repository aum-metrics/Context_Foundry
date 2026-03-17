# AUM Context Foundry: Master Architecture & System Design Guide

**Target Audience:** New Developers, Interns, and Solutions Architects
**Prerequisites:** Basic knowledge of React, APIs, and Cloud Databases.
**Last Updated:** March 2026 | Reflects v1.2.6 hardened build.

---

## 1. Executive Summary & The "Why"

Welcome to **AUM Context Foundry**. Before you look at a single line of code, you must understand *why* this product exists. 

Current Large Language Models (LLMs) like GPT-4o, Gemini 3 Flash, and Claude 4.5 Sonnet often "hallucinate"—meaning they confidently invent facts. For a business, if an AI chatbot lies about a refund policy or a feature, it creates massive legal liability and destroys brand trust. 

**AUM Context Foundry solves this.** We provide an enterprise-grade platform that ingest a company's source of truth (a pricing PDF, a feature list, a security document) and acts as an **Independent Auditor** for AI models. We test different AI engines against this "Context Document" to score them on how faithfully they represent that company, preventing context drift and hallucinations.

---

## 2. High-Level System Architecture

AUM Context Foundry is built on a modern, serverless **B2B SaaS Architecture**. It is designed to be highly secure, extremely fast, and horizontally scalable.

### 2.1 The Tech Stack

| Layer | Technology | Why we chose it (The "Rationale") |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js 15 (App Router) + React 19 | SSR for SEO, API route proxying to backend, edge deployment on Vercel. |
| **Frontend Styling** | Vanilla CSS + Framer Motion | Custom CSS design system (`globals.css`) with CSS custom properties for theming. Framer Motion handles dynamic UI animations (radar charts, loading pulses). |
| **Backend API Server** | FastAPI (Python 3.12) | AI integrations (OpenAI, Gemini, Anthropic) are natively built for Python. FastAPI is asynchronous, incredibly fast, and auto-generates our API documentation (Swagger, dev-only). |
| **Database** | Firebase / Firestore | A NoSQL document database. Real-time data syncing, built-in Authentication, and rapid prototyping without SQL migrations. |
| **Identity & Auth** | Firebase Auth + Custom JWT + API Keys | Firebase for user sessions, `aum_`-prefixed B2B API keys (SHA-256 hashed, stored in Firestore), enterprise SSO (OAuth2 via Fernet-encrypted client secrets). |
| **Payments** | Razorpay | Server-to-server webhook integrations with HMAC signature verification (`hmac.compare_digest`). Subscription tiers upgraded atomically via Firestore transactions. |
| **CI/CD** | GitHub Actions + Vercel | CI runs frontend lint + backend syntax/smoke + pytest on every push. Vercel auto-deploys frontend. |
| **Rate Limiting** | SlowAPI + Firestore-backed per-IP | Global request throttle (100/min) + cross-region crawler protection (100/15min per IP). Fail-closed at both backend and edge. |

---

## 3. The Core Developer Workflow (How Data Moves)

If you are an intern trying to fix a bug or add a feature, you must understand the "Flow of State":

### Step 1: Client Request (Frontend)
A user clicks a button in the UI (e.g., "Run Simulation"). 
*   **Where to find it:** `frontend/src/components/CoIntelligenceSimulator.tsx`.
*   **What happens:** The frontend uses the `fetch()` API. It grabs the user's Firebase token (`await auth.currentUser.getIdToken()`) and sends a `POST` request to the backend. **Critical:** Local components are now strictly decoupled from the Firestore SDK; all data flow is gated through FastAPI.

### Step 2: The API Gateway (Backend)
The request hits our FastAPI server router.
*   **Where to find it:** `backend/app/api/simulation.py`.
*   **What happens:** The `@router.post("/run")` decorator catches the request. 

### Step 3: Security & Auth Gate (The "Bouncer")
Before any logic runs, the backend verifies the user.
*   **Where to find it:** `backend/app/core/security.py`.
*   **What happens:** A dependency (`Depends(get_auth_context)`) checks if the Bearer token is valid and hasn't been forged. If the user doesn't belong to the Organization they are trying to access, it instantly terminates the request with a `403 Forbidden` error.

### Step 4: The Logic Execution
The backend talks to OpenAI, Gemini, and Claude concurrently. 
*   **Why Async?** We use Python's `asyncio.gather()` to ask all 3 AI models the same question simultaneously. If we did it sequentially, the user would wait 30 seconds. Instead, they wait 10 seconds.

### Step 5: Database Mutation & Return
The backend writes the new simulation results to Firestore for billing and historical logging.
*   **Where to find it:** A background task `_store_simulation_results()`. 
*   **What happens:** We append a usage ledger entry per run and store scoring history for analytics. Ledger writes avoid per-document contention while still enforcing quotas by counting ledger entries in the current billing cycle.

---

## 4. Understanding How We Store Data (Firestore Schema)

Firestore is NoSQL. We don't have tables; we have Collections and Documents. It looks like a giant, nested JSON object.

### The "Root" Collections

1.  **`users/` Collection**
    *   **Purpose:** Tracks identity.
    *   **Structure:** `{uid}` -> `{ email, orgId, role: "admin" | "member" }`
    *   **Intern Note:** Every user *must* belong to an `orgId`. A single user maps 1:1 to an Organization role. 

2.  **`organizations/` Collection**
    *   **Purpose:** The highest boundary. Everything belongs to an Org.
    *   **Structure:** `{orgId}` -> `{ name, allowedDomains, subscription, apiKeys }`
    *   **Subcollections:** An Org contains massive amounts of nested data:
        *   `organizations/{orgId}/manifests/`: Stores the uploaded Context Documents.
        *   `organizations/{orgId}/usageLedger/`: Append-only ledger of simulation usage (source of truth for quota enforcement).
        *   `organizations/{orgId}/scoringHistory/`: Simulation results for dashboards and reporting.

3.  **`batchJobs/` & `seoJobs/` Collections**
    *   **Purpose:** Long-running analytics.
    *   **Intern Note:** Sometimes fixing a bug means you just need to update the status of a stalled job document in Firestore from `processing` to `failed_permanent`.

---

## 5. Security & Isolation Fundamentals

As an intern, you can break the platform if you do not understand these rules:

### Rule 1: Fail-Closed Design
If an API request is missing parameters, or if a user accidentally sends a malformed token, the default action is **always** to reject the request (`403` or `401`). We never guess or assume context.

- Rate limiter fails → `503` (not allow-through)
- Database unavailable → org access denied (`return False`)
- Missing production secrets → startup crash (`sys.exit(1)`)
- Dev defaults in production → crash at config load (`ValueError`)

### Rule 2: API Keys are Radioactive
We store OpenAI and Gemini keys belonging to our clients in Firebase (`organizations/{orgId}.apiKeys`).
*   **Never print them:** Never add `print(org_data)` in a backend route, as it might write an API key to the server logs.
*   **Always Redact:** The backend uses `.pop('apiKeys', None)` before sending any Organization data struct back to the frontend.
*   **Firestore Rules:** The `firestore.rules` file mathematically prevents any user (even an authenticated `member` of the org) from directly querying the `apiKeys` field via the web UI. Only the backend can access it.

### Rule 3: Mock Auth is Double-Gated
Mock tokens (`mock-dev-token`) require BOTH conditions:
1. `settings.ENV == "development"` (defaults to `production`)
2. `settings.ALLOW_MOCK_AUTH == True` (defaults to `False`)

In production, attempts to use mock tokens trigger a `CRITICAL` security log entry and `401` rejection. There is no code path that allows mock auth in production.

### Rule 4: Single Source of Truth for Environment
`settings.ENV` in `backend/app/core/config.py` is the only source of truth. No code uses `os.getenv("ENV")` independently.

---

## 6. How To Add a New Feature (Intern Golden Path)

Let's say the CEO asks you: *"I want users to be able to save their favorite simulation prompts."*

Here is the exact framework you take:

1.  **Database Design:** Decide where the data lives. In Firestore, you would add a new subcollection: `organizations/{orgId}/savedPrompts/`. 
2.  **Backend Route:** Create a new file in `backend/app/api/prompts.py`. Write a POST route to save the prompt. Secure it with `@router.post("/save")` and inject `auth=Depends(get_auth_context)`. Update `main.py` to `include_router(prompts.router)`.
3.  **Backend Testing:** Write a quick Pytest in `backend/tests/test_prompts.py`. You MUST mock the `security.verify_user_org_access` method so it returns `True`, allowing your test to run locally without hitting a real database. Run `pytest`.
4.  **Frontend API Hook:** Create a TypeScript function in a `lib/` file that calls the new backend route, attaching the Bearer token.
5.  **Frontend UI:** Build a shiny new Tailwind Button "Save Prompt" in `CoIntelligenceSimulator.tsx`. Wire the onClick event to your hook. 

---

## 7. Core Subsystems Dictionary

If you hear senior engineers throw around these terms, here is what they mean:

*   **Visibility Score:** Our scoring heuristic. It's the 60/40 blend of claim verification (LLM-as-a-judge) and semantic similarity (cosine distance) that gives an AI a grade from 0-100%. v1.2.6 introduces Zero-Burn caching to serve redundant evaluations instantly.
*   **DLQ (Dead Letter Queue):** The graveyard for background tasks that crashed. Jobs that fail 3 times are marked `failed_permanent`. Found in `backend/app/utils/task_queue_recovery.py`.
*   **CIM (Context Information Model):** The mathematical and semantic representation of an organization's verified ground truth — JSON-LD schema + 1536-dimensional embeddings. Now supports **Versioned Context Switching**.
*   **Manifest (`llms.txt`):** The CIM synthesized into AI-crawler-friendly plain text. Served at `/llms.txt?orgId=...`. Hardened: org-specific failures return 503 (no silent fallback).
*   **AI Visibility Index:** The competitive metric AUM tracks — what percentage of AI-generated answers represent your brand vs. competitors.

---

## 8. CI/CD Pipeline

CI runs automatically via `.github/workflows/ci.yml` on every push to `main` and all PRs.

| Stage | What It Checks |
|-------|---------------|
| Frontend Lint | `npx next lint` — ESLint errors in TypeScript/React |
| Backend Syntax | `py_compile` on all `.py` files |
| Backend Smoke | `python test_main.py` — FastAPI imports + router loads |
| Backend Tests | `pytest` (10 tests) — simulation, ingestion, audit, competitor, RAG |

Build policy: `ignoreDuringBuilds: false` in `next.config.ts` — lint errors fail production builds.

*Proceed to Guide 02: Frontend Implementation Guide for UI-specific deep dives.*


## Update: 2026-03-17
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

