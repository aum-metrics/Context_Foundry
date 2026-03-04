# Ultimate Environment Strategy: DEV ➡️ QA ➡️ PROD

*Date: March 2026* | *Architectural Blueprint for AUM Context Foundry*
*Last Updated: March 2026 | Reflects hardening passes 1-5*

Running a B2B Enterprise SaaS application on a single database is a ticking time bomb. One wrong database migration or bad code push will instantly wipe out all customer data. 

To safely operate, you need **Environment Isolation**. The goal is absolute separation of data, secrets, and code execution. 

---

## 1. The Three-Tier Architecture

You will create three completely independent silos. They never share databases. They never share API keys.

1.  **DEV (Development):** Where engineers write code. Runs entirely on `localhost`. 
2.  **QA (Quality Assurance / Staging):** A cloud replica of Production. This is where you test new code with fake data before releasing it.
3.  **PROD (Production):** The sacred ground. Only real paying customers live here.

---

## 2. Infrastructure Setup (How to split the resources)

### Step 1: Create 3 Firebase Projects
Firebase projects act as the absolute boundary for your database (`Firestore`) and user authentication (`Firebase Auth`).
*   **Firebase Project 1:** `aum-context-foundry-dev`
*   **Firebase Project 2:** `aum-context-foundry-qa`
*   **Firebase Project 3:** `aum-context-foundry-prod`

*Why?* If an engineer accidentally runs a script that deletes the `organizations` collection in DEV, it only deletes fake data in `aum-context-foundry-dev`. The PROD database is cryptographically unreachable.

### Step 2: Create 3 Sets of Razorpay Keys
You must never process a real $500 payment when testing a new feature.
*   **QA:** Use Razorpay's "Test Mode" API keys.
*   **PROD:** Use Razorpay's "Live Mode" API keys.

---

## 3. The Code Workflow (Git Branching Strategy)

You map your infrastructure directly to your Git branches.

*   `feature/*` branches ➡️ Runs locally against DEV.
*   `main` (or `staging`) branch ➡️ Deploys automatically to QA.
*   `production` branch ➡️ Deploys automatically to PROD.

---

## 4. Frontend Implementation (Next.js + Vercel)

Vercel makes environment management incredibly easy. 

1.  Connect your GitHub repository to Vercel.
2.  Go to Vercel Dashboard ➡️ Settings ➡️ **Environment Variables**.
3.  Vercel lets you define variables based on the Environment (Preview vs Production).

**Add the QA Firebase keys to the 'Preview' environment:**
```env
NEXT_PUBLIC_FIREBASE_PROJECT_ID=aum-context-foundry-qa
NEXT_PUBLIC_API_URL=https://api-qa.aumcontextfoundry.com
```

**Add the PROD Firebase keys to the 'Production' environment:**
```env
NEXT_PUBLIC_FIREBASE_PROJECT_ID=aum-context-foundry-prod
NEXT_PUBLIC_API_URL=https://api.aumcontextfoundry.com
```

*Result:* When you merge a PR to `main`, Vercel builds the "Preview" site and connects it to the QA database. When you push to the `production` branch, Vercel builds the live site pointing to the PROD database.

---

## 5. Backend Implementation (FastAPI + Cloud Run)

The backend requires the same strict isolation. 

### Managing The `.env` Files
You will maintain three separate `.env` files locally, though you only commit `.env.example` to Git.

**Local `.env` (Points to DEV):**
```env
ENV=development
JWT_SECRET=local-dev-secret
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-adminsdk-dev.json
```

**Cloud Run QA Deployment:**
Instead of `.env` files, you input these via the Google Cloud Run Console.
```env
ENV=qa
JWT_SECRET=qa-secure-secret-8923
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-adminsdk-qa.json
```

**Cloud Run PROD Deployment:**
```env
ENV=production
JWT_SECRET=super-secure-prod-secret-9999
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-adminsdk-prod.json
```

> **IMPORTANT**: The backend uses `settings.ENV` (Pydantic Settings, loaded from `.env`) as the **single source of truth** for environment mode. No code uses `os.getenv("ENV")` independently. In production:
> - Missing API keys → `sys.exit(1)` (hard crash at startup)
> - Dev default for `JWT_SECRET` → `ValueError` crash
> - Dev default for `SSO_ENCRYPTION_KEY` → `ValueError` crash
> - Mock auth → blocked and security-logged regardless of `ALLOW_MOCK_AUTH`

### The CI/CD Pipeline (GitHub Actions)
You will create a `.github/workflows/deploy.yml` file. 

*   **When code is pushed to `main`:** GitHub Actions pulls the code, builds a Docker container, and deploys it to a Google Cloud Run service named `aum-context-foundry-api-qa`.
*   **When code is pushed to `production`:** GitHub Actions deploys the exact same Docker container to `aum-context-foundry-api-prod`.

---

## 6. The "Promotion" Lifecycle (A Day in the Life)

Here is how a single code change moves securely through the environments.

**The Scenario:** You want to add a new "Export to PDF" button.

1.  **DEV Phase:**
    *   You create a branch `feature/export-pdf`.
    *   You run `npm run dev` and `python3 main.py` on your laptop.
    *   You write the code. It saves fake PDF data to the `aum-context-foundry-dev` Firebase project.
2.  **QA Phase:**
    *   You open a Pull Request to `main`.
    *   You merge the PR.
    *   Vercel and GitHub Actions automatically deploy the code to QA.
    *   You log into `https://qa.aumcontextfoundry.com`. You test the button. It works, and the data saves to `aum-context-foundry-qa`.
3.  **PROD Phase:**
    *   You confirm QA is perfectly stable.
    *   You open a Pull Request from `main` to `production`.
    *   You merge the PR.
    *   Vercel and GitHub Actions deploy the final code to PROD.
    *   Real users can now see the button, and it interacts safely with `aum-context-foundry-prod`.

---

## Summary Checklist
To achieve this tomorrow, you need:
- [ ] 3 Firebase Projects (Dev, QA, Prod).
- [ ] 3 Sets of Firebase Admin SDK JSON keys.
- [ ] 3 Sets of Razorpay keys (2 Test Mode, 1 Live Mode).
- [ ] 2 Vercel Environments (Preview, Production).
- [ ] 2 Google Cloud Run Services (`api-qa`, `api-prod`).
