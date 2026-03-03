# Context Foundry: Backend Secrets & API Key Architecture

**Target Audience:** Backend Engineers, DevOps, SecOps
**Prerequisites:** Understanding of `.env` files, Google Secret Manager, and the FastAPI `pydantic_settings` module.

---

## 1. Platform-Managed API Keys

Context Foundry interacts with OpenAI, Anthropic, and Gemini. A single simulation run costs API credits. To handle billing and permissions securely across environments, the backend operates entirely on **Platform-Managed Keys**.

We do not support Bring-Your-Own-Key (BYOK). All simulation runs are billed to our central corporate accounts, and we bill the client a flat subscription fee in return.

1. Organizations in Firestore do not store raw LLM API keys. 
2. The FastAPI `simulation.py` engine seamlessly injects the **Global Master Keys** loaded into the server's environment memory.

---

## 2. Environment Implementation (Dev, QA, Prod)

Because we use Mode B for 90% of clients, we must inject the "Global Master Keys" securely. We use `pydantic_settings` in `backend/app/core/config.py` to achieve this.

### The DEV Environment (Localhost)
In DEV, you want your engineers iterating rapidly without accidentally burning $500 of the company's production OpenAI credits if they write an infinite loop.

*   **Implementation:** The backend reads from a local `.env` file that is **strictly `.gitignore`'d**.
*   **The Keys:** You provide your engineers with restricted "Dev-Only" API keys generated from OpenAI/Anthropic. These keys should have hard monthly spend limits of $20.
*   **Fallback Logic:** In DEV mode (`ENV=development`), if the database is missing a client's key, the backend automatically falls back to your local `.env` keys so the simulation never crashes.

### The QA Environment (Staging)
QA is a live URL on the internet (e.g., `api-qa.contextfoundry.com`). You cannot use a `.env` file because the code runs inside a serverless Docker image on Google Cloud Run.

*   **Implementation:** Google Cloud Secret Manager.
*   **The Workflow:** 
    1. A DevOps Admin creates a secret named `OPENAI_API_KEY_QA` in Google Cloud.
    2. When configuring the Cloud Run QA Service, you bind this secret to the container as an environment variable (`OPENAI_API_KEY`).
    3. FastAPI boots up, reads `os.getenv("OPENAI_API_KEY")`, and safely holds it in RAM.

### The PROD Environment (Live)
This is the mission-critical environment.

*   **Implementation:** Google Cloud Secret Manager (Production Tier).
*   **The Security Boundary:** The DevOps Admin creates `OPENAI_API_KEY_PROD`. **Engineers do not have access to view this string.** The Cloud Build pipeline has an IAM (Identity Access Management) role that allows it to pull the secret at runtime and inject it into the PROD Cloud Run container.
*   **The Keys:** These are the massive, high-limit keys with strict auto-recharge billing attached to the corporate credit card.

---

## 3. Implementation Breakdown: Payment Keys (Stripe/Razorpay)

Payments follow the exact same isolation logic as AI keys, but the stakes are higher.

`backend/app/core/config.py` expects:
*   `RAZORPAY_KEY_ID`
*   `RAZORPAY_KEY_SECRET`

**How they map across environments:**
1.  **DEV (`.env`):** Use the Razorpay **Test Mode** API keys. (e.g., `rzp_test_12345`). This allows engineers to simulate checkout flows using fake credit card numbers without moving real money.
2.  **QA (Cloud Run Env Vars):** Also uses **Test Mode** keys. QA testers verify the webhook integrations end-to-end.
3.  **PROD (Cloud Run Secret Manager):** This is the **ONLY** place where the **Live Mode** keys (`rzp_live_98765`) exist. If you put Live keys in QA, you will accidentally process real credit card charges while testing.

---

## 4. Summary Checklist for Backend Deployment

If you are a DevOps engineer deploying a new environment tomorrow, you must inject these 7 core secrets into the runtime container:

1.  `ENV` (String: "qa" or "production")
2.  `JWT_SECRET` (A 64-character randomized cryptographic string)
3.  `FIREBASE_SERVICE_ACCOUNT_PATH` (The JSON credential path)
4.  `OPENAI_API_KEY`
5.  `GEMINI_API_KEY`
6.  `ANTHROPIC_API_KEY`
7.  `RAZORPAY_KEY_SECRET`

Once these are injected via the Cloud Console, the FastAPI `config.py` engine automatically parses and validates them on boot, establishing the secure Foundation for the Bouncer (`security.py`) and the Simulation Engine (`simulation.py`).
