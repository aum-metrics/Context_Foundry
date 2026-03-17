# AUM Context Foundry — Admin Support Handbook
**v5.1.0-hardened | March 2026 | CONFIDENTIAL — Internal Operations Only**

---

## 1. Environment Variable Reference

### 1.1 Backend (`backend/.env`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `OPENAI_API_KEY` | **YES** | Master OpenAI key (used for platform-managed orgs) | `sk-proj-...` |
| `ANTHROPIC_API_KEY` | YES | Master Anthropic key | `sk-ant-...` |
| `GEMINI_API_KEY` | YES | Master Google Gemini key | `AIzaSy...` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **YES** | Full JSON string of Firebase service account | `{"type":"service_account",...}` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Alt | Path to service account file (used if JSON not set) | `/secrets/firebase.json` |
| `RAZORPAY_KEY_ID` | YES (payments) | Razorpay API Key ID | `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | YES (payments) | Razorpay API Key Secret | `...` |
| `RAZORPAY_WEBHOOK_SECRET` | YES (payments) | HMAC webhook signing secret | `...` |
| `PAYMENT_CALLBACK_URL` | YES (payments) | Frontend URL for payment redirect | `https://aumcontextfoundry.com/dashboard` |
| `SSO_ENCRYPTION_KEY` | YES (SSO) | Fernet key for encrypting SSO client secrets | `base64url-encoded 32-byte key` |
| `SSO_JWT_SECRET` | YES (SSO) | HS256 key for signing transient SSO intent tokens | `secure-random-string` |
| `RESEND_API_KEY` | YES (email) | Required for sending workspace invitations | `re_...` |
| `CRON_SECRET` | YES (cron) | Bearer token for authenticating the billing cron | random 32+ char string |
| `ENV` | NO | `development` or `production` (default: `production`) | `production` |
| `ADMIN_SESSION_SECRET` | **YES** | Secret for signing admin session cookies | `random-string` |
| `RATE_LIMIT_PER_SECOND` | NO | IP-level rate limit for B2B API (default: 5) | `10` |

> **Generating SSO_ENCRYPTION_KEY:**
> ```bash
> python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
> ```

> **Generating CRON_SECRET:**
> ```bash
> python3 -c "import secrets; print(secrets.token_urlsafe(48))"
> ```

### 1.2 Frontend (`frontend/.env.local`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | **YES** | Firebase Web API Key | `AIzaSy...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | **YES** | Firebase Auth Domain | `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | **YES** | Firebase Project ID | `your-project-id` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | YES | Firebase Storage Bucket | `your-project.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | YES | Firebase Sender ID | `...` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | YES | Firebase App ID | `1:...:web:...` |
| `NEXT_PUBLIC_API_BASE_URL` | **YES** | Backend URL (no trailing slash) | `https://api.aumcontextfoundry.com` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | YES (payments) | Razorpay Key ID (public) | `rzp_live_...` |

---

## 2. Firestore Database Administration

### 2.1 Collections Overview

| Collection | Purpose | Admin Action |
|------------|---------|--------------|
| `users/{uid}` | User → org mapping | Read to verify membership |
| `organizations/{orgId}` | Org config, plan, API keys | Modify plan, reset sims |
| `organizations/{orgId}/manifests` | Ground truth CIM docs | Delete or wait for 24h TTL |
| `organizations/{orgId}/simulationCache` | 24hr cache | Automatically cleared by TTL |
| `organizations/{orgId}/auditLogs` | SOC2 audit trail | Read-only |
| `api_keys/{sha256hash}` | B2B API keys | Revoke by setting `status: revoked` |
| `ssoConfigs/{orgId}` | Enterprise SSO configs | Delete to disable SSO |

### 2.2 Manually Reset Simulation Quota
```
organizations/{orgId}.subscription.lastUsageResetAt = now()
organizations/{orgId}.subscription.simsThisCycle = 0
```
`lastUsageResetAt` controls the ledger counting window. Use Firestore Console or `firebase-admin` script.

### 2.3 Manually Upgrade Plan
Edit `organizations/{orgId}.subscription`:
```json
{
  "planId": "growth",
  "maxSimulations": 100,
  "status": "active"
}
```

### 2.4 Revoke a B2B API Key
1. Get the SHA-256 hash of the key: `hashlib.sha256(key.encode()).hexdigest()`
2. Set `api_keys/{hash}.status = "revoked"` in Firestore.
3. Or use the dashboard: **Admin Panel → API Keys → Revoke**.

### 2.5 Firestore Security Rules
Client-side access is restricted:
- `users/{uid}` — users can only read/write their own doc.
- `organizations/{orgId}` — members can read; writes are backend-only (Admin SDK).
- `api_keys` — backend-only access.
- All sensitive writes go through the FastAPI backend which uses the Admin SDK.
- **`apiKeys` field is explicitly blocked** for all client-side reads in `firestore.rules`.

---

## 3. Rate Limiting & DDoS Protection

### 3.2 Rate Limiter Posture

| Layer | Mechanism | Threshold | Failure Mode |
|-------|-----------|-----------|-------------|
| Global | `slowapi` (in-process) | 100 req/min per IP | `429 Too Many Requests` |
| Crawler | Firestore-backed per-IP | 100 req/15min per IP | `503` (fail-closed) |
| Edge (`/llms.txt`) | Frontend checks backend | Non-OK → blocked | `503` (fail-closed) |
| Token-level | Usage ledger count (per billing cycle) | Per-tier simulation quota | Quota exceeded error |
| Payload | FastAPI request size limit | 10MB per ingestion upload | `413 Payload Too Large` |
| Webhook | HMAC signature validation | Reject on mismatch | `401 Unauthorized` |

### 3.3 DDoS Response Protocol

**Immediate Response:**
1. Enable Cloudflare "Under Attack Mode" or equivalent WAF.
2. Block source IPs at the load balancer level.
3. Reduce rate limits in `rate_limiter.py` and redeploy.

**Evidence Collection:**
1. Export `api_keys` collection — identify which key is being abused.
2. Review audit logs: `organizations/{orgId}/auditLogs`.
3. Revoke abusive API keys immediately (see section 2.4).

**Recovery:**
1. Restore normal rate limits.
2. Issue new API keys to affected legitimate users.
3. Document incident in incident log.

---

## 4. Task Queue & Job Reliability

The platform uses a persistent task queue with a recovery worker.

### 4.1 Monitoring Job Health
Check backend logs for `♻️ Periodic Recovery` or `TaskQueueRecovery sweep complete`.
- **Stalled Jobs**: Jobs in `processing` for >30m are automatically detected by the recovery worker.
- **Failures**: Jobs that fail 3 times are marked `failed_permanent` (Dead Letter Queue).
- **Recovery Worker**: Runs every 5 minutes via `asyncio.create_task()` in the FastAPI app lifespan.

### 4.2 Manual Recovery
If the automated worker is disabled, you can trigger a sweep via:
```bash
# Example if exposed via CLI or admin route
# curl -X POST /api/admin/tasks/recover -H "X-Admin-Token: $SECRET"
```

---

## 4. Subscription & Billing Administration

### 4.1 Razorpay Dashboard
- Live transactions: [dashboard.razorpay.com](https://dashboard.razorpay.com)
- Failed payments: Check Razorpay → Payments → Failed.
- Webhook logs: Razorpay → Settings → Webhooks.

### 4.2 Manually Apply a Plan Upgrade
If a payment succeeded but the plan wasn't updated (e.g., webhook failure):
1. Verify payment in Razorpay dashboard.
2. Edit `organizations/{orgId}.subscription` in Firestore directly:
   ```json
   { "planId": "scale", "maxSimulations": 500, "status": "active" }
   ```
3. Log the manual action in `organizations/{orgId}/auditLogs`.

### 4.3 Refund Process
1. Initiate refund from Razorpay dashboard.
2. Downgrade org plan in Firestore to `explorer`.
3. Document refund in internal records.

---

## 5. Enterprise SSO Support

### 5.1 Supported Providers
- Okta
- Microsoft Azure Active Directory
- Google Workspace

### 5.2 Customer Setup Guide
1. Customer configures their IdP (Okta/Azure/Google) with redirect URI: `https://api.aumcontextfoundry.com/api/sso/callback`.
2. Customer provides: Client ID, Client Secret, domain.
3. Admin calls `POST /api/sso/configure` with org membership to store config (client secret is Fernet-encrypted in Firestore).
4. Customer signs in via `GET /api/sso/login?intent={signed_intent_token}`.

### 5.3 Troubleshooting SSO
- **"Invalid SSO provider"**: Check `provider` field is one of `okta`, `azure`, `google`.
- **"Unauthorized"**: User's `users/{uid}.orgId` must match the target org.
- **Fernet decrypt error**: Rotate `SSO_ENCRYPTION_KEY` and re-configure SSO.

---

## 6. B2B API Licensing

### 6.1 On-boarding an API Customer
1. Customer creates an account (or admin provisions manually).
2. Zero-friction provisioning generates a `aum_...` key (returned once in provisioning response).
3. Customer uses key in: `Authorization: Bearer aum_<key>`.
4. Customer hits `POST /v1/run` with their `orgId`.

### 6.2 API-Only Tier Enforcement
Rate limits and quotas are enforced the same way as dashboard users. The key difference is the auth pathway bypasses Firebase JWT.

---

## 7. Tenant Data Isolation

**Every** data access in the backend verifies tenancy via `verify_user_org_access(uid, orgId)`:
- Returns `False` (fail-closed) if Firestore is unavailable.
- Returns `False` if `users/{uid}` doc doesn't exist.
- Returns `True` only if `users/{uid}.orgId == target_orgId`.

For B2B API key auth, the org is derived from `api_keys/{hash}.orgId` — no user lookup needed.

---

## 8. Backup & Disaster Recovery

### 8.1 Firestore Backup
Enable automated Firestore exports to Cloud Storage (GCP Console → Firestore → Import/Export). Schedule: Daily. Retention: 30 days.

### 8.2 Code Backup
All code is in Git (`main` branch). Tag each production deploy:
```bash
git tag -a v4.1.0 -m "Production release March 2026"
git push origin v4.1.0
```

### 8.3 Recovery Procedure
1. Restore Firestore from latest backup (GCP Console).
2. Redeploy backend Docker image from the last stable tag.
3. Verify: `GET /health` returns `{"status": "ok"}`.
4. Run smoke tests: `PYTHONPATH=app pytest tests -v`.

---

*AUM Context Foundry — Admin Support Handbook v5.1.0 | CONFIDENTIAL*


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

