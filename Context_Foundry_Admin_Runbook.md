# Context Foundry - Master Administrative Runbook

*Version: 1.1.0* | *Status: Enterprise-Hardened (Post P0-P3 Remediation)*

This exhaustive runbook provides system administrators, DevOps engineers, and support staff with the authoritative procedures for operating, configuring, and troubleshooting the Context Foundry platform.

---

## Table of Contents
1. [Core Configuration Prerequisites](#1-core-configuration-prerequisites)
2. [Platform Initialization & Seeding](#2-platform-initialization--seeding)
3. [Tenant (Organization) Onboarding](#3-tenant-organization-onboarding)
4. [Enterprise SSO Configuration (SAML/OIDC)](#4-enterprise-sso-configuration)
5. [User & Seat Management](#5-user--seat-management)
6. [Billing & Subscription Enforcement](#6-billing--subscription-enforcement)
7. [System Monitoring & Background Workers](#7-system-monitoring--background-workers)
8. [Troubleshooting Common Issues & Fixes](#8-troubleshooting-common-issues--fixes)
9. [Security Hardening Protocols](#9-security-hardening-protocols)

---

## 1. Core Configuration Prerequisites

To run Context Foundry securely in `production`, the Admin must provide the following baseline configurations. 

### Backend Environment Variables (`backend/.env`)
The platform is strict-closed by default. These variables are mandatory.
```env
# 1. System Environment
ENV=production
# MUST be 'production'. If 'development', mock-auth escapes are activated.

# 2. Security Keys
JWT_SECRET=your-secure-64-char-random-string
API_ENCRYPTION_KEY=base64-url-safe-32-byte-key
SSO_ENCRYPTION_KEY=base64-url-safe-32-byte-key
CRON_SECRET=super-secure-cron-trigger-key

# 3. Firebase Admin Credentials
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/firebase-adminsdk.json

# 4. Master AI Keys (Optional: Only if offering Platform-Managed Keys)
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...
```

### Frontend Environment Variables (`frontend/.env.local`)
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=context-foundry-prod.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=context-foundry-prod
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## 2. Platform Initialization & Seeding

### Creating the First "Super Admin"
Since `firestore.rules` block anonymous modification of critical collections, the first admin must be assigned via the Firebase CLI or Google Cloud Console.

**How-To: Master Admin Provisioning**
1. User logs into the Web UI normally, creating a Firebase Auth identity.
2. The user will be placed in a pending state without an organization.
3. Open Firestore Console.
4. Locate the `users/{uid}` document.
5. Manually edit the fields:
   * `role`: `"admin"`
   * `orgId`: `"system_admin_org"` (or a master provisioning tenant ID).

---

## 3. Tenant (Organization) Onboarding

Organizations are the primary boundary for data isolation, billing, and API Key resolution.

### How-To: Provision a New Organization
When a new Enterprise signs up:
1. **Org Creation:** Triggered via the `/api/workspaces/provision` endpoint. 
2. **Domain Whitelisting:** The system auto-extracts the `@company.com` domain. Add this to the `allowedDomains` array if auto-join is allowed.
3. **Plan Assignment:** Update `organizations/{orgId}/subscription`:
   ```json
   {
       "planId": "growth", // explorer, growth, scale, enterprise
       "maxSimulations": 100,
       "simsThisCycle": 0
   }
   ```
4. **AI Key Injection:** If the client "Brings Their Own Key" (BYOK), it is injected via the dashboard. If using Platform-Managed keys, set backend overrides to `"internal_platform_managed"`.

---

## 4. Enterprise SSO Configuration

Enterprise clients (Scale/Enterprise tiers) require SSO (Okta, Azure AD, Google).

### Admin Requirements per Tenant
The tenant IT admin must provide:
1. `Client ID`
2. `Client Secret`
3. `Identity Provider Domain / Tenant ID`

### How-To: Configure SSO for a Tenant
1. User navigates to **Settings -> Security & SSO**.
2. Submits the credentials. CF encrypts the `Client Secret` using `SSO_ENCRYPTION_KEY` via Fernet AES-128 before saving to `sso_configs/{orgId}`.
3. **Callback URI:** The IT Admin MUST whitelist `https://api.yourdomain.com/v1/sso/callback` in their IdP (Okta/Azure).

---

## 5. User & Seat Management

### Team Invitation Flow
* **Sending an Invite:** Users click "Invite Member". A placeholder document is created in `users` with `status: "invited"`. 
* **Accepting:** The new user clicks the magic link, authenticates via Firebase, and hits `/accept-invite`. The backend automatically merges the placeholder with their live UID.

### Fix: "User sees 'Access Denied' after invitation"
* **Diagnosis:** The user logged in with a different email than was invited, OR the race condition merged failed.
* **Resolution:** Delete the orphaned `users/{uid}` document and re-send the invite to the correct email.

---

## 6. Billing & Subscription Enforcement

The LCRS Engine utilizes strictly enforced transactional billing.

### Understanding the Billing Cycle
Every time an AI simulation runs, the `@firestore.transactional` lock increments `simsThisCycle`. If it exceeds `maxSimulations`, a `402 Payment Required` is thrown.

### How-To: Resetting Quotas Monthly
You must invoke the automated Cron endpoint on the 1st of the month:
```bash
curl -X POST https://api.yourdomain.com/api/cron/reset-quotas \
     -H "x-cron-secret: super-secure-cron-trigger-key"
```
*Note: This utilizes a background queue. It will asynchronously batch-reset 500 orgs per sweep to avoid Firestore timeout limits.*

---

## 7. System Monitoring & Background Workers

Back-office batch processing (e.g., Deep SEO Analytics, Competitor Displacement) runs asynchronously.

### Background Queue Architecture (apscheduler + asyncio)
If jobs (e.g., scraping competitor sites) fail, they enter the DLQ (Dead Letter Queue).
1. Background Sweepers run every 5 minutes natively inside the FastAPI event loop (`main.py`).
2. They pull from `batchJobs` and `seoJobs` where `status == 'pending'`.
3. If `attempts > 3`, the job moves to status `failed_permanent`.

### Fix: "Stalled Background Jobs"
* **Diagnosis:** Application restarted ungracefully and lock leases didn't release.
* **Resolution:** 
  1. Call `/api/admin/system/sweeper-force` (Requires Admin Auth).
  2. Or manually change Firestore job status from `processing` to `pending`.

---

## 8. Troubleshooting Common Issues & Fixes

### Issue 1: LCRS Simulation Returns "Simulation Engine Unavailable"
* **Cause 1:** Org `apiKeys` are missing or invalid.
* **Cause 2:** Organization has reached its simulation quota limit (`402`).
* **Fix:** Tell the client to supply valid keys in Settings, or upgrade their Subscription Tier via the Stripe portal.

### Issue 2: Frontend Throws "CORS Error" on Login
* **Cause:** Firebase `authDomain` is not matching the deployment origin.
* **Fix:** Add your production domain inside the Firebase Console -> Authentication -> Authorized Domains.

### Issue 3: 403 Forbidden "Mock Dev Token Rejected"
* **Cause:** `ENV` properly set to `production`, but `AuthWrapper.tsx` in frontend failed to build in production mode, passing a mock token.
* **Fix:** Rebuild the frontend (`npm run build`) ensuring `NODE_ENV=production`. The application is secured tightly against mock token bypasses natively now.

### Issue 4: Dashboard Radar Charts are Empty
* **Cause:** Semantic Document (Context Manifest) failed to partition into vector chunks.
* **Fix:** Ensure the API server has sufficient RAM to run the embeddings model. Ask the user to re-upload the Context Document to trigger a fresh `/api/ingestion/parse` transaction. 

### Issue 5: SearchGPT or Perplexity Missing from Matrix
* **Cause:** The Explorer Plan artificially bounds the response engine to GPT-4o Mini to preserve API budget. The UI natively locks premium frontier models.
* **Fix:** Advise user to upgrade to Growth or Scale plan.

---

## 9. Security Hardening Protocols

This platform enforces **Fail-Closed Security**.

* **Firestore Rules:** Any user modifying `firestore.rules` MUST NOT grant `read/write` to `member` roles for collections: `/apiKeys/`, `/payments/`, `/auditLogs/`. These are restricted to backend SDK bypass only.
* **API Key Redaction:** Whenever `/api/simulation/run` accesses the database, it natively executes `.pop("apiKeys")` before passing organization data down the call stack to protect against logging breaches.
* **Audit Traces:** Every state mutation produces an immutable log in `subcollections('auditLogs')` tagged with `{uid}`, `{action}`, and `UTC Timestamp`.

---

# Maintenance Checklist (Weekly)
- [ ] Review DLQ entries for failed web-scraping jobs.
- [ ] Verify `firestore.indexes.json` is perfectly matched with frontend sorting requirements.
- [ ] Re-issue Cron trigger manually if webhook provider failed.
- [ ] Export LCRS Scoring History CSVs for enterprise clients upon request to prove SLA adherence.

*End of Runbook*
