# White-Label Deployment Guide — AUM Context Foundry

## Architecture summary

The platform is already multi-tenant at the data layer (each org is fully isolated
in Firestore). White-labeling adds brand isolation at the presentation layer without
requiring any code forks or backend changes.

---

## Option A: Vercel environment variable (simplest — one config per deployment)

1. In your client's Vercel project, set:

```
NEXT_PUBLIC_TENANT_CONFIG={"brandName":"Acme AI Search Readiness Platform","brandSlug":"acme","colorPrimary":"#1d4ed8","colorAccent":"#0891b2","logoUrl":"https://cdn.acme.com/logo.png","faviconUrl":"https://cdn.acme.com/favicon.svg","supportEmail":"support@acme.com","hidePricing":true}
```

2. All branding (logo, colors, name) updates immediately on next build.
3. Each client = one Vercel project = one domain. Vercel free tier supports unlimited projects.

---

## Option B: Firestore-driven multi-hostname (one deployment, many brands)

Use this when you want a single Vercel deployment serving multiple branded hostnames.

1. In Firestore, create documents at:
   `platform_config/tenant_configs/hosts/{hostname_with_dots_replaced_by_underscores}`

   Example document for `acme.yourplatform.com`:
   ```json
   {
     "brandName": "Acme AI Search Readiness Platform",
     "colorPrimary": "#1d4ed8",
     "logoUrl": "https://cdn.acme.com/logo.png",
     "hidePricing": true
   }
   ```

2. In `layout.tsx`, replace the static `tenantConfig` import with the async version:
   ```ts
   import { getTenantConfigForHostname } from "@/lib/whitelabel";
   // In a server component:
   const config = await getTenantConfigForHostname();
   ```

3. The backend `/api/tenant-config` endpoint serves the config with 5-minute caching.

---

## Components to update when white-labeling

| File | Change |
|------|--------|
| `src/components/Logo.tsx` | Replace with `BrandLogo.tsx` (provided) |
| `src/app/layout.tsx` | Import `applyBrandCssVars` and call in root client component |
| `src/app/globals.css` | Replace `#4f46e5` hardcoded values with `var(--brand-primary)` |
| `src/components/Navbar.tsx` | Use `tenantConfig.brandName` instead of "AUM Context Foundry" |
| `src/components/Footer.tsx` | Use `tenantConfig.brandName` and `tenantConfig.supportEmail` |
| `src/app/page.tsx` | Wrap pricing section with `{!tenantConfig.hidePricing && ...}` |
| `src/components/UpgradeModal.tsx` | Use `tenantConfig.brandName` in copy |

---

## Backend: No changes needed for white-label

All tenant isolation is already handled by `orgId` scoping in Firestore.
The new `/api/tenant-config` endpoint is additive — existing routes unchanged.

---

## Custom domain setup (per client)

1. Client points `geo.acme.com` CNAME to `cname.vercel-dns.com`
2. In Vercel project → Domains → Add `geo.acme.com`
3. SSL auto-provisioned by Vercel
4. Set `NEXT_PUBLIC_TENANT_CONFIG` in that project's env vars

Total setup time per new white-label client: ~15 minutes.

---

## Concurrency notes (50 concurrent users on free tiers)

- **Vercel free**: 100GB bandwidth/month, unlimited serverless function invocations.
  50 concurrent users at ~10 req/min each = 500 req/min. Vercel handles this fine.
- **GCP Cloud Run**: already configured with `--concurrency 80` default per instance.
  Auto-scales to multiple instances under load. Free tier: 2M requests/month.
- **Firestore**: 1 read/write per document per second limit only matters for
  the org root document. The usage ledger pattern (append-only sub-collection)
  already bypasses this — no contention at 50 users.
- **SWR polling in SoMCommandCenter (Visibility Command Center)**: default interval not set, so it only
  fetches on mount + manual trigger. Safe for 50 users.


## Update: 2026-03-17
- Quick Scan prompt tuned to reduce negative claims for strong brands; competitor tile label now adapts to score.
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

