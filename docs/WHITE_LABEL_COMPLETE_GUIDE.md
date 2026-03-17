# WHITE_LABEL_COMPLETE_GUIDE.md
# Complete white-label deployment guide — all 6 break points addressed

---

## What was broken (quick recap)

| Break | Problem | Fix |
|-------|---------|-----|
| 3a | Firebase project is shared — all tenants' users visible in one console | One Firebase project per tenant |
| 3b | Razorpay hardcoded to AUM — wrong brand in checkout modal | Tenant key_id from org doc (payments_whitelabel_patch_guide.py) |
| 3c | Invite emails sent from hello@aumcontextfoundry.com | Tenant-aware email_sender.py |
| 3d | PDF reports hardcode "AUM Context Foundry" | BrandHealthCertificate_pdf_patch.diff |
| 3e | /admin shows all orgs — tenant can see competitors' data | admin_tenant.py with tenant_admin role |
| 3f | CSS/logo hardcoded in UI | Already fixed: white_label_config.ts + BrandLogo.tsx |

---

## Break 3a: Firebase per-tenant setup (15 minutes per new client)

### Why one project per tenant
Firebase is free up to 100MB Firestore + unlimited Auth per project.
If you share a project, the tenant's Firebase console shows your other clients' users.
That is a data protection issue, not just aesthetics.

### Step-by-step

**Step 1: Create a new Firebase project for the tenant**
```bash
# Install Firebase CLI if not already done
npm install -g firebase-tools
firebase login

# Create project (replace TENANT_SLUG with e.g. "acme")
firebase projects:create aum-tenant-TENANT_SLUG
```

**Step 2: Enable Firestore and Auth on the new project**
```
Firebase console → new project → Build → Firestore Database → Create
Firebase console → Build → Authentication → Sign-in method → Google (enable)
```

**Step 3: Get the tenant's Firebase config**
```
Firebase console → Project settings → Your apps → Add app → Web
Copy the firebaseConfig object
```

**Step 4: Set up a new Vercel project for the tenant**
```bash
# Fork or duplicate your frontend deployment
# In Vercel dashboard: Add New Project → Import same repo

# Set these environment variables in the Vercel project:
NEXT_PUBLIC_FIREBASE_API_KEY=<tenant firebase api key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<tenant>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=aum-tenant-<tenant_slug>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=aum-tenant-<tenant_slug>.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<tenant sender id>
NEXT_PUBLIC_FIREBASE_APP_ID=<tenant app id>

NEXT_PUBLIC_API_BASE_URL=https://your-shared-gcp-backend.run.app

NEXT_PUBLIC_TENANT_CONFIG={"brandName":"Acme Analytics","brandSlug":"acme","colorPrimary":"#0066cc","colorAccent":"#00aa44","logoUrl":"https://acme.com/logo.png","faviconUrl":"https://acme.com/favicon.ico","supportEmail":"support@acme.com","hidePricing":true,"razorpayKeyId":"rzp_live_acme_xxxx"}
```

**Step 5: Set custom domain**
```
Vercel → your tenant project → Settings → Domains → Add → analytics.acme.com
(Tenant configures CNAME: analytics.acme.com → cname.vercel-dns.com)
```

**Step 6: Provision the tenant in the backend**
```bash
# Call the super_admin endpoint (use your own admin token)
curl -X POST https://your-backend.run.app/api/admin/provision-tenant \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_slug": "acme",
    "org_name": "Acme Analytics Platform",
    "admin_uid": "firebase-uid-of-acme-admin-user",
    "tenant_config": {
      "brandName": "Acme Analytics",
      "colorPrimary": "#0066cc",
      "supportEmail": "support@acme.com"
    }
  }'
```

**Time per new client: ~15-20 minutes.**
**Cost per new client: $0 (Firebase free tier, Vercel free tier).**

---

## Backend shared infrastructure (no changes needed)

The backend (FastAPI on GCP Cloud Run) is shared across all tenants.
Data isolation is already handled by `orgId` scoping in Firestore.
Each tenant's users have their `orgId` set to an org in their Firebase project —
there is no cross-tenant data leak at the data layer.

The backend doesn't need to know which Firebase project a user comes from
for normal operations — it only validates the JWT token (Firebase Admin SDK
verifies tokens from any project registered in FIREBASE_SERVICE_ACCOUNT).

**If you want strict project isolation at the backend level** (optional, for
enterprise clients with strict data residency requirements):
- Deploy a second Cloud Run service per tenant
- Set FIREBASE_PROJECT_ID per service to point at tenant's Firebase project
- Cost: ~$0 on Cloud Run free tier (2M requests/month)

---

## Revenue model for white-label

**Recommended: AUM Platform fee**
- Tenant pays you $X/month (e.g. $500-2000 depending on their org count)
- You give them unlimited orgs under their Firebase project
- They resell your platform at whatever price they want
- You don't need to track their per-org billing — flat monthly fee

**Alternative: Revenue share**
- Tenant uses Razorpay AUM account (Break 3b fix)
- You collect all payments, remit their share monthly
- Requires trust + contract

---

## Checklist before going live with a white-label client

- [ ] Firebase project created for tenant
- [ ] Vercel project created with correct env vars
- [ ] Custom domain configured + HTTPS working
- [ ] Tenant logo at HTTPS URL (not localhost)
- [ ] Color tested in light + dark mode
- [ ] PDF downloaded and verified to show tenant brand (BrandHealthCertificate patch)
- [ ] Invite email sent to test address — check From name + domain
- [ ] /admin tested — tenant_admin sees only their orgs
- [ ] Razorpay tested (or tenant notified that billing is handled via platform)
- [ ] GDPR: privacy policy updated to mention tenant brand
- [ ] Contract signed with revenue-share terms

---

## main.py additions (add all new routers)

```python
# In backend/app/main.py, add these alongside existing load_router calls:

load_router("api.quick_scan",       "/api",        "Quick Scan")        # Fix Area 1
load_router("api.data_management",  "/cron",       "Data Management")   # Fix Area 2
load_router("api.admin_tenant",     "/api/admin",  "Admin Tenant")      # Fix 3e

# NOTE: tenant_config.py was already in the previous session — keep it.
# NOTE: admin_orgs_route.ts is the frontend proxy — keep it too.
```

---

## Environment variables summary (new ones added by these fixes)

### Backend (Cloud Run)
```
PLATFORM_OPENAI_KEY=sk-...       # Used for QuickScan — separate budget from per-org keys
CRON_SECRET=<random 32+ chars>   # Already exists in cron.py — same value used here
SENDGRID_API_KEY=SG.xxx          # Already used for invites — now routed per tenant
EMAIL_FROM_ADDRESS=hello@aumcontextfoundry.com
EMAIL_REPLY_TO=hello@aumcontextfoundry.com
```

### Frontend (Vercel — per project)
```
NEXT_PUBLIC_TENANT_CONFIG={"brandName":"..."}   # Per-tenant Vercel project
NEXT_PUBLIC_API_BASE_URL=https://...            # Shared backend URL
NEXT_PUBLIC_FIREBASE_*                          # Per-tenant Firebase project values
```
