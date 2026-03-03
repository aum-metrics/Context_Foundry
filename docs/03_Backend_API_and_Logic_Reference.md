# Context Foundry: Backend API & Logic Reference

**Target Audience:** Backend Engineers, System Operators, Interns
**Prerequisites:** Python 3.12, FastAPI, basic understanding of concurrent programming (`asyncio`).

---

## 1. FastAPI Architecture Overview

Our backend is built on **FastAPI**. It is designed to be highly modular, asynchronous, and self-documenting.

### The Entry Point (`main.py`)
Everything starts at `backend/app/main.py`. This file does three critical things:
1.  **CORS Configuration:** Defines which frontend domains are allowed to talk to us.
2.  **Lifecycle Events:** Starts and stops the `apscheduler` background task loops when the server boots up or shuts down.
3.  **Router Registration:** Pulls in all the separate API modules (like `simulation.py`, `workspaces.py`) and maps them to `/api/v1/...` URLs.

### Directory Structure
*   `app/api/`: Contains all the route handlers (the controllers). E.g., `sso.py`, `payments.py`.
*   `app/core/`: Contains the foundational system logic. E.g., `security.py`, `config.py`, `firebase_config.py`.
*   `app/utils/`: Contains helpers like the `task_queue.py` (DLQ logic).

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
*   **60% Weight - Claim Verification (Deterministic):** Did the AI output include all the strictly required facts from the source Context Document? We use an `LLM-as-a-judge` sub-routine to evaluate this deterministically.
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
