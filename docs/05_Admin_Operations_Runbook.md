# AUM Context Foundry: Administrator & Operations Runbook

**Target Audience:** Product Managers, Operations Interns, DevOps
**Prerequisites:** Access to Google Cloud Console (Firestore, Cloud Run).

---

## 1. The Operations Mindset

As a platform administrator or intern running the show, your primary job is to ensure the system is healthy, tenants have access to the features they paid for, and anomalies are triaged instantly. You do not need to write code to fix 90% of operational issues—you just need to know how to read the database.

---

## 2. Managing Tenants (Organizations)

### 2.1 Viewing a Customer's Data
If a customer emails support: *"I cannot access the Scale features!"*

**How to audit them:**
1. Log into Google Cloud Console -> Firestore Database.
2. Go to the `users/` collection and search or filter for their email.
3. Copy their `orgId`.
4. Go to the `organizations/` collection and find the document matching that `orgId`.
5. Check the `subscription` map:
   * Is `planId` set to `scale`?
   * Is `simsThisCycle` greater than `maxSimulations`? (If so, they are locked out because they hit their quota).

### 2.2 Manually Upgrading a Customer
If a customer pays via wire transfer instead of Stripe, you must manually upgrade them.
1. Open their `organizations/{orgId}` document.
2. Edit the `subscription` mapping:
   ```json
   {
       "planId": "enterprise",
       "maxSimulations": 10000,
       "simsThisCycle": 0,
       "status": "active"
   }
   ```
3. Hit Save. The React frontend will instantly unlock the premium features on their dashboard via real-time websockets.

---

## 3. Managing Users & Seats

### 3.1 Resolving "Stuck" Invitations
Sometimes a user is invited, but when they log in, the dashboard is blank.
*   **Cause:** They were invited at `bob@acme.com` but they logged in using Google OAuth with `bob.smith@acme.com`. The backend `users` record didn't merge because the emails didn't match perfectly.
*   **The Fix:** 
    1. Find their new, blank `users/{uid}` document and copy their `uid`.
    2. Add the `orgId: "acme-123"` field to this document manually.
    3. Add `role: "member"`.
    4. Delete the old "invited" placeholder document.
    5. Tell the user to refresh the page.

### 3.2 Promoting a User to Admin
Only Admins can change billing settings or API keys for a company.
1. Find the user in the `users/` collection.
2. Change the `role` field from `"member"` to `"admin"`.

---

## 4. Enterprise SSO Operations

When a Massive Enterprise (like Fortune 500 Bank) signs up, they will demand Single Sign-On (SAML/Okta). Interns will often be assigned to help them configure this.

### The Handshake Process
1. Tell the Enterprise IT Admin to create an Application in their Okta/Azure portal.
2. Give them our **Callback URL**: `https://api.aumcontextfoundry.com/api/v1/sso/callback`
3. They will give you two things: a **Client ID** and a **Client Secret**.
4. You (or the enterprise admin) logs into the AUM Context Foundry Dashboard -> Settings -> SSO.
5. Paste the ID and Secret. The backend will instantly encrypt the Secret using our `SSO_ENCRYPTION_KEY` via AES-128 before saving it to the database.

**Troubleshooting:** If SSO fails, it is almost always because the IT Admin forgot to whitelist our Callback URL in their system. Ask them to verify the redirect URI.

---

## 5. Monitoring & The DLQ (Dead Letter Queue)

We run massive background jobs (like reading 1,000 pages of a competitor's website for SEO analysis). These run in the `batchJobs/` collection.

### Health Checking the Background Queue
1. Open Firestore -> `batchJobs/`
2. Filter by `status == "processing"`.
3. Look at the `updatedAt` timestamp. If a job has been "processing" for 3 hours, the background Python worker crashed and forgot to release the lock.

### How to Rescue a Crashed Job
1. Edit the stalled job document.
2. Change `status` from `"processing"` back to `"pending"`.
3. The `apscheduler` loop in the backend will automatically discover it on the next 5-minute sweep and attempt to process it again.
4. If it fails 3 times, the system will mark it `failed_permanent`.

---

## 6. The Monthly Billing Reset Pipeline

At 12:00 AM on the 1st of every month, all organizations must have their `simsThisCycle` reset to `0`. If this fails, customers will wake up locked out of the system.

### The Automated Flow
A Google Cloud Scheduler trigger fires a webhook to `/api/cron/reset-quotas` with the `CRON_SECRET` header.

### The Manual Override (In Case of Emergency)
If Google Cloud is down, or the webhook fails, you must trigger it manually using the terminal on your laptop:

```bash
curl -X POST https://api.aumcontextfoundry.com/api/cron/reset-quotas \
     -H "x-cron-secret: YOUR-SUPER-SECRET-CRON-KEY"
```

*Proceed to Guide 06: Troubleshooting & Incident Response.*
