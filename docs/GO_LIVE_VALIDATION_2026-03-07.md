# Go-Live Validation - 2026-03-07

## Scope
- Final release validation for the current production-candidate branch
- Evidence gathered from:
  - backend automated tests
  - frontend production build
  - local backend runtime boot with real Firebase Admin credentials
  - real Firebase admin login and admin session minting
  - safe read-only and fail-closed endpoint probes

## Phase 1 - Release Checklist

### Build and test gates
- Backend test suite passes
- Frontend production build passes

### Runtime boot gates
- Backend boots with current local env
- Firestore connects using Firebase Admin service account
- `/api/health` reports healthy

### Control-plane gates
- Admin Firebase login works
- Admin session minting works
- Admin session verification works
- Admin org list works
- Admin org detail works
- Admin model config endpoint works

### Public/fail-closed gates
- `/api/workspaces/health` works
- `/api/workspaces/{org_id}/manifest` returns 404 when manifest is absent
- `/api/workspaces/llms-rate-limit` responds and persists counters
- `/api/payments/webhook` fails closed when webhook secret is absent

## Phase 2 - Executed Results

### Passed
- `backend`: `62 passed`
- `frontend`: `next build` passed
- Backend local runtime booted successfully
- Firestore connected successfully
- `/api/health` returned:
  - `status: healthy`
  - `dependencies.firestore: connected`
- `/api/methods/model-catalog` returned the canonical runtime stack:
  - `GPT-4o`
  - `Gemini 3 Flash`
  - `Claude 4.5 Sonnet`
- Firebase Auth login succeeded for the provisioned admin account
- `/api/admin/mint-session` succeeded
- `/api/admin/verify-session` succeeded
- `/api/admin/orgs` succeeded
- `/api/admin/orgs/system_admin_org/details` succeeded
- `/api/admin/model-config` succeeded
- `/api/workspaces/health` succeeded
- `/api/payments/webhook` returned `503` fail-closed when `RAZORPAY_WEBHOOK_SECRET` was not configured
- `/api/workspaces/system_admin_org/manifest` returned `404 Manifest not found`
- `/api/workspaces/llms-rate-limit` returned `allowed: true`

### Fixed during validation
- Admin session bug:
  - `verify_admin` was incorrectly using a strict bearer dependency, which blocked `X-Admin-Token` fallback
  - fixed by switching admin auth dependency to `HTTPBearer(auto_error=False)`
- Razorpay runtime compatibility:
  - local venv required `setuptools<81` for `pkg_resources` compatibility with `razorpay`
  - repo requirements updated accordingly
- Local runtime completeness:
  - installed missing `beautifulsoup4`
- Static/public copy:
  - standardized to provider-family naming on public frontend surfaces

## Phase 3 - Go / No-Go Decision

## Decision
- **NO-GO for blind production cutover**
- **GO for controlled staging or guarded production cutover with manual smoke test**

## Why not blind GO
- The following high-risk live business flows were not fully executed end-to-end in a browser-backed user session during this validation pass:
  - authenticated frontend admin UI click-path
  - real ingestion mutation on a target org
  - real simulation mutation and render path on a target org
  - real payment order/link plus verification/webhook mutation path

## Why guarded GO is reasonable
- Core codebase is build-clean and test-clean
- Backend runtime boots with real credentials
- Firestore connectivity is proven
- Admin auth/session path is proven with a real Firebase account
- Read-only admin/control-plane endpoints are working
- Public/fail-closed behaviors are working as expected

## Required manual smoke tests before final production switch
1. Login via frontend `/admin`
2. Open admin dashboard and verify:
   - organizations list
   - org detail pane
   - model control tab
3. Login via frontend `/login`
4. Run one controlled ingestion on a test org
5. Verify:
   - org profile name
   - `/llms.txt`
   - `/llms-full.txt`
6. Run one real simulation on the ingested org
7. Verify one safe payment path:
   - create order or payment link only
   - avoid full billing mutation unless intentional

## Residual risks
- `razorpay` still depends on deprecated `pkg_resources`; current mitigation is pinning `setuptools<81`
- Firestore queries still emit a warning for positional `.where(...)` usage in some paths
- Browser-driven rendering/auth flows were not fully executed inside this environment


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

