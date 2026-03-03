# AUM Context Foundry: Backend API & Logic Reference

**Target Audience:** Backend Engineers, System Operators, Interns
**Prerequisites:** Python 3.12, FastAPI, basic understanding of concurrent programming (`asyncio`).
**Last Updated:** March 2026 | Reflects hardening passes 1-5.

---

## 1. FastAPI Architecture Overview

Our backend is built on **FastAPI**. It is designed to be highly modular, asynchronous, and self-documenting.

### The Entry Point (`main.py`)
Everything starts at `backend/app/main.py`. This file does four critical things:
1.  **CORS Configuration:** Defines which frontend domains are allowed to talk to us.
2.  **Startup Secret Gate:** Checks for required environment variables. In production, missing secrets cause `sys.exit(1)`. In development, logs warnings.
3.  **Lifecycle Events:** Uses `asynccontextmanager` lifespan to start the periodic job recovery worker and stop it on shutdown.
4.  **Router Registration:** Uses a `load_router()` helper to dynamically import and mount all API modules with clean error handling.

### Directory Structure
*   `app/api/`: Contains all the route handlers (15 modules):
    *   `simulation.py` (810 lines) — LCRS engine + B2B API gateway
    *   `ingestion.py` — Zero-retention PDF → CIM pipeline
    *   `workspaces.py` — Org provisioning, members, invites, manifest, rate limiter
    *   `payments.py` — Razorpay orders, verify, webhooks, payment links
    *   `sso.py` — Enterprise SSO OAuth2 config + callback
    *   `admin.py` — Admin dashboard endpoints (session cookie auth)
    *   `api_keys.py` — B2B API key generate/revoke/list
    *   `chatbot.py` — RAG-powered support chatbot
    *   `seo.py` — Async SEO audit (Playwright-based)
    *   `competitor.py` — Competitive displacement analysis
    *   `batch_analysis.py` — Batch domain evaluation
    *   `audit.py` — SOC2 audit log writer
    *   `cron.py` — Internal scheduled task triggers (billing reset)
    *   `methods.py` — Scoring methodology reference endpoint
*   `app/core/`: Contains the foundational system logic:
    *   `config.py` — Pydantic Settings (single ENV source of truth)
    *   `security.py` — Auth: `get_current_user`, `get_auth_context`, `verify_user_org_access`, `validate_api_key`
    *   `firebase_config.py` — Firebase Admin SDK initialization
    *   `limiter.py` — SlowAPI global rate limiter config
    *   `rate_limiter.py` — Firestore-backed per-IP rate limiting
    *   `logging_config.py` — Structured logging with file rotation
*   `app/utils/`: Contains helpers:
    *   `task_queue.py` — Async task queue + DLQ logic
    *   `task_queue_recovery.py` — Stalled job sweep + retry (5-min interval)
    *   `email_service.py` — Transactional email sender (invites)

---

## 2. API Security & Dependencies (The Bouncer)

FastAPI uses a system called "Dependencies" (`Depends()`). Think of a dependency as a bouncer at a club. Before the code inside your route can run, the dependency must let the user in.

### `get_auth_context`
This is our primary bouncer. Located in `core/security.py`.
```python
@router.post("/my-secure-route")
async def secure_route(payload: dict, auth: dict = Depends(get_auth_context)):
    # If the code reaches here, the user's JWT is 100% valid.
    uid = auth["uid"]
    return {"message": "Success"}
```

**What it actually does:**
1. Checks the `Authorization: Bearer <token>` header.
2. If `ENV == "development"`, it checks for the `mock-dev-token` bypass.
3. Otherwise, it calls Google Firebase via `auth.verify_id_token()`. If the token is expired or forged, it throws a `401 Unauthorized` and halts execution.

### `verify_user_org_access`
Just because a user is logged in doesn't mean they can view another company's data.
```python
if not verify_user_org_access(auth["uid"], request.orgId):
    raise HTTPException(status_code=403, detail="Forbidden")
```
This performs a quick Firebase lookup to ensure the `uid` actually belongs to `orgId`.

---

## 3. The LCRS Simulation Pipeline (`api/simulation.py`)

This is the crown jewel of the platform. If you touch this file, test it locally first.

### The 60/40 Math
The LCRS (Logical Contextual Representation Score) grades AI model accuracy using two blended metrics:
*   **60% Weight - Claim Verification (Reproducible):** Did the AI output include all the strictly required facts from the source Context Document? We use an `LLM-as-a-judge` sub-routine to evaluate this at `temperature=0` for consistent results. Note: "reproducible" means same inputs yield same outputs, not "academically validated."
*   **40% Weight - Semantic Divergence (Vector Math):** We convert the AI's answer into a vector embedding and compare its cosine distance to the original Context Document's embedding. This catches "vibe" drift or subtle hallucinations.

### The Async Parallel Gather
Usually, calling OpenAI takes 10 seconds. Calling Claude takes 8 seconds. Calling Gemini takes 7 seconds. 
If we ran them sequentially, a simulation would take `10 + 8 + 7 = 25 seconds`.

Instead, we use Python's `asyncio.gather()`:
```python
results = await asyncio.gather(
    _score_model("GPT-4o", ...),
    _score_model("Claude", ...),
    _score_model("Gemini", ...)
)
```
This runs all three requests in parallel across different threads. The total time is simply the time of the slowest model (10 seconds). **Massive performance win.**

---

## 4. Atomic Billing & FireStore Transactions

Every time a user runs a simulation, it costs us API credits. We must decrement their `simsThisCycle` quota perfectly. 

### The Race Condition Problem
Imagine two users manually firing the "Run Simulation" button at the exact same millisecond. 
*   Thread A reads: Quota is 99.
*   Thread B reads: Quota is 99.
*   Thread A writes: Quota is 100.
*   Thread B writes: Quota is 100. 
They ran 2 simulations, but the database only counted 1. This is a classic race condition.

### The Transactional Solution
We wrap our billing logic in a `@firestore.transactional` decorator.
```python
@firestore.transactional
def run_simulation_transaction(transaction, org_ref):
    org_doc = org_ref.get(transaction=transaction)
    current_sims = org_doc.get("subscription.simsThisCycle")
    
    if current_sims >= limit:
        raise Exception("402 Over Quota")
        
    # Transaction logically locks the document until the update completes
    transaction.update(org_ref, {
        "subscription.simsThisCycle": current_sims + 1
    })
```
If Thread B tries to write while Thread A holds the lock, Firestore throws an abort, Thread B waits 10ms, re-reads the new value (100), and updates it to 101.

---

## 5. Background Jobs & The Dead Letter Queue (`utils/task_queue.py`)

Sometimes we need to run jobs that take 10 minutes (like scraping 50 competitor websites for SEO). We cannot make the frontend wait 10 minutes; the browser will time out.

1.  **The Drop:** The API route instantly creates a document in `batchJobs/` with `status: "pending"` and returns a `202 Accepted` to the frontend.
2.  **The Sweep:** Every 5 minutes, our `apscheduler` loop running deep inside `main.py` sweeps the `batchJobs/` collection looking for pending jobs.
3.  **The Lock:** It changes the status to `processing` (so other workers don't grab it) and begins the hard work.
4.  **The DLQ:** If the job crashes (e.g., a website blocks our scraper), the worker increments the `attempts` counter. If `attempts > 3`, the job is marked `failed_permanent`. This is our Dead Letter Queue. It prevents broken jobs from infinitely crashing the server loop.

*Proceed to Guide 04: Database & Security Model.*

---

## 6. Rate Limiting Architecture

The platform has two rate limiting layers:

### Layer 1: Global Rate Limiter (SlowAPI)
Configured in `core/limiter.py`, applied globally:
- 100 requests/minute per IP
- Applied to all routes via `SlowAPIMiddleware`

### Layer 2: Firestore-Backed Per-IP Limiter
For the public `/llms.txt` endpoint:
- `POST /api/workspaces/llms-rate-limit` checks IP against Firestore counters
- 100 requests per 15-minute window per IP
- **Fail-closed**: Exception → `503` (never allows through on failure)
- Frontend edge also fail-closed: non-OK backend response → `503`

---

## 7. Test Suite (`backend/tests/`)

All tests use `conftest.py` which automatically:
1. **Mocks Firestore** via `MagicMock()` — no real DB needed
2. **Enables mock auth** — sets `ENV=development` + `ALLOW_MOCK_AUTH=True`
3. **Cleans up** — clears FastAPI dependency overrides after each test

| Test File | What It Tests |
|-----------|---------------|
| `test_simulation.py` | LCRS endpoint (happy + unhappy + 60/40 math) |
| `test_ingestion.py` | `recursive_split` algorithm + parse endpoint |
| `test_competitor.py` | Displacement endpoint + auth rejection |
| `test_audit.py` | Audit log write + retrieval |
| `test_rag_logic.py` | Cosine similarity math + scoring |

Run:
```bash
cd backend/app && python -m pytest ../tests/ -q --tb=short
# Expected: 10 passed
```
