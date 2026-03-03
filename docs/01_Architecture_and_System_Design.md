# AUM Context Foundry: Master Architecture & System Design Guide

**Target Audience:** New Developers, Interns, and Solutions Architects
**Prerequisites:** Basic knowledge of React, APIs, and Cloud Databases.

---

## 1. Executive Summary & The "Why"

Welcome to **AUM Context Foundry**. Before you look at a single line of code, you must understand *why* this product exists. 

Current Large Language Models (LLMs) like ChatGPT, Gemini, and Claude often "hallucinate"—meaning they confidently invent facts. For a business, if an AI chatbot lies about a refund policy or a feature, it creates massive legal liability and destroys brand trust. 

**AUM Context Foundry solves this.** We provide an enterprise-grade platform that ingest a company's source of truth (a pricing PDF, a feature list, a security document) and acts as an **Independent Auditor** for AI models. We test different AI engines against this "Context Document" to score them on how faithfully they represent that company, preventing context drift and hallucinations.

---

## 2. High-Level System Architecture

AUM Context Foundry is built on a modern, serverless **B2B SaaS Architecture**. It is designed to be highly secure, extremely fast, and horizontally scalable.

### 2.1 The Tech Stack

| Layer | Technology | Why we chose it (The "Rationale") |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js (React) 15 | Next.js provides App Router structural logic, blistering fast Server-Side Rendering (SSR) for SEO, and easy Vercel deployment. |
| **Frontend Styling** | Tailwind CSS + Framer Motion | Tailwind gives us rapid, consistent styling. Framer Motion handles the dynamic UI animations (like radar charts and loading pulses) that make the app feel "premium". |
| **Backend API Server** | FastAPI (Python 3.12) | AI integrations (OpenAI, Gemini, Anthropic) are natively built for Python. FastAPI is asynchronous, incredibly fast, and auto-generates our API documentation (Swagger). |
| **Database** | Firebase / Firestore | A NoSQL document database. We chose it because it gives us real-time data syncing, built-in Authentication, and rapid prototyping capabilities without writing raw SQL migrations. |
| **Identity & Auth** | Firebase Auth + Custom JWT | Handles email/password, magic links, and SSO integrations. It easily protects our backend endpoints via Bearer tokens. |
| **Payments**| Razorpay (or Stripe) | Handled purely via webhook integrations to upgrade subscription tiers in Firestore securely. |

---

## 3. The Core Developer Workflow (How Data Moves)

If you are an intern trying to fix a bug or add a feature, you must understand the "Flow of State":

### Step 1: Client Request (Frontend)
A user clicks a button in the UI (e.g., "Run Simulation"). 
*   **Where to find it:** `frontend/src/components/CoIntelligenceSimulator.tsx`.
*   **What happens:** The frontend uses the `fetch()` API. It grabs the user's Firebase token (`await auth.currentUser.getIdToken()`) and sends a `POST` request to the backend.

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
*   **What happens:** We use a transaction (atomic lock) so that if two users run a simulation at the EXACT same millisecond, the billing engine doesn't get confused and undercount their usage. The JSON result is then returned to the frontend.

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
        *   `organizations/{orgId}/scoringHistory/`: The atomic ledger tracking every simulation a client runs.

3.  **`batchJobs/` & `seoJobs/` Collections**
    *   **Purpose:** Long-running analytics.
    *   **Intern Note:** Sometimes fixing a bug means you just need to update the status of a stalled job document in Firestore from `processing` to `failed_permanent`.

---

## 5. Security & Isolation Fundamentals

As an intern, you can break the platform if you do not understand these two rules:

### Rule 1: Fail-Closed Design
If an API request is missing parameters, or if a user accidentally sends a malformed token, the default action is **always** to reject the request (`403` or `401`). We never guess or assume context.

### Rule 2: API Keys are Radioactive
We store OpenAI and Gemini keys belonging to our clients in Firebase (`organizations/{orgId}.apiKeys`).
*   **Never print them:** Never add `print(org_data)` in a backend route, as it might write an API key to the server logs.
*   **Always Redact:** The backend uses `.pop('apiKeys', None)` before sending any Organization data struct back to the frontend.
*   **Firestore Rules:** The `firestore.rules` file mathematically prevents any user (even an authenticated `member` of the org) from directly querying the `apiKeys` field via the web UI. Only the backend can access it.

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

*   **LCRS (Logical Contextual Representation Score):** Our proprietary formula. It's the 60/40 blend of semantic math (embeddings) and deterministic math (claim verification) that gives an AI a grade from 0-100%. Found in `backend/app/api/simulation.py`.
*   **DLQ (Dead Letter Queue):** The graveyard for background tasks that crashed. Swept by the `apscheduler` in the ASGI loop. Found in `backend/app/utils/task_queue.py`.
*   **Manifest (`llms.txt`):** The Context Document normalized into plain text for consumption by frontier AI models. Ground Truth. Found in `backend/app/api/ingestion.py`.

*Proceed to Guide 02: Frontend Implementation Guide for UI-specific deep dives.*
