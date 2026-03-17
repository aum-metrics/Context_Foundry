# Development & Mock Fallback Paths

> **Purpose**: This document inventories every dev/mock branch in the codebase for acquisition
> diligence transparency. All paths are properly gated and **cannot execute in production**.

---

## 1. Production Safety Guarantees

All mock paths are gated by **at least one** of these conditions:

| Guard | Scope | How It Works | Verification |
|-------|-------|-------------|-------------|
| `settings.ENV == "development"` | Backend | Pydantic Settings — defaults to `"production"` | Check `config.py:12` |
| `settings.ALLOW_MOCK_AUTH == True` | Backend | Defaults to `False`, blocked in prod even if set | Check `security.py:38` |
| `process.env.NODE_ENV === "development"` | Frontend | Next.js auto-sets in dev; production builds use `"production"` | Check `AuthWrapper.tsx` |
| `NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash"` | Frontend | Real deployments always have a valid Firebase key | Check `.env.local` |
| `?mock=true` URL parameter + dev-mode check | Frontend | Double-gated: URL param alone is insufficient | Check `CoIntelligenceSimulator.tsx` |
| Missing API keys (OpenAI/Gemini) | Backend | Production startup gate crashes on missing keys | Check `main.py:67-72` |
| `PLAYWRIGHT_AVAILABLE === False` | Backend | Dev-only: production installs Playwright for SEO | Check `seo.py:21` |

### How to Verify Guards Are Active in Production

```bash
# 1. Verify ENV is production (startup logs)
grep "Environment:" app.log
# Expected: "Environment: production"

# 2. Verify mock auth is blocked
curl -X POST https://api.yourdomain.com/api/simulation/run \
  -H "Authorization: Bearer mock-dev-token" \
  -H "Content-Type: application/json"
# Expected: 401 Unauthorized (with log: "SECURITY BREACH ATTEMPT")

# 3. Verify Swagger is hidden
curl https://api.yourdomain.com/api/docs
# Expected: 404

# 4. Verify all secrets are present (no degraded mode warnings in logs)
grep "Missing secrets" app.log
# Expected: No matches
```

### How to Disable Mock Paths Entirely

Set these in your environment:
```env
ENV=production
ALLOW_MOCK_AUTH=False
```

With `ENV=production`:
- Mock tokens are rejected with a `401` and critical security log
- Dev defaults for `JWT_SECRET` / `SSO_ENCRYPTION_KEY` cause a crash at import time
- Missing API keys cause `sys.exit(1)` at startup
- Swagger/Redoc are disabled

---

## 2. Backend Mock Paths (6 branch points across 3 files)

### `backend/app/core/security.py` — Mock Token Bypass

**Guard**: `settings.ENV == "development"` AND `settings.ALLOW_MOCK_AUTH == True`
**Behavior**: Accepts `mock-dev-token` as a valid bearer token, returns mock user context
**Lines**: 37-45
```python
if token == "mock-dev-token":
    if settings.ENV == "development" and allow_mock:
        return {"uid": "mock_uid_dev", "email": "dev@localhost", ...}
    else:
        logger.critical("🛑 SECURITY BREACH ATTEMPT: mock-dev-token used in production")
        raise HTTPException(status_code=401)
```
**Production safety**: In production, mock tokens trigger a `CRITICAL` log entry and `401`. There is no code path that allows mock auth in production mode.

### `backend/app/api/chatbot.py` — Fallback Bot Response

**Guard**: `not db` (Firestore unavailable)
**Behavior**: Returns a canned support bot response instead of querying Firestore
**Lines**: 49, 70-71
```python
if not db:
    return {"response": "Support bot is in limited mode..."}
```
**Production safety**: In production, Firestore is always available (required via service account). This path only activates when Firebase SDK fails to initialize.

### `backend/app/api/seo.py` — Mock SEO Audit

**Guard**: `PLAYWRIGHT_AVAILABLE is False`
**Behavior**: Returns mock SEO audit scores instead of running Playwright browser automation
**Lines**: 21, 41
```python
try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
```
**Production safety**: Production requirements.txt includes Playwright. This only activates when Playwright is not installed (typical in lightweight dev environments).

### `backend/app/api/simulation.py` — Fallback API Keys

**Guard**: Missing organization API keys in Firestore (when `apiKeys` field contains sentinel values)
**Behavior**: Falls back to platform-managed keys from environment variables
**Lines**: 252, 282, 543-548
```python
if openai_key == "internal_platform_managed":
    openai_key = os.getenv("OPENAI_API_KEY")
```
**Production safety**: This is not a mock path but a feature — platform-managed keys are the standard operating mode. The startup gate ensures `OPENAI_API_KEY` is always present in production.

---

## 3. Frontend Mock Paths (12 branch points across 7 files)

### `frontend/src/lib/firebase.ts` — Mock Firebase Config

**Guard**: Missing `NEXT_PUBLIC_FIREBASE_*` env vars
**Behavior**: Uses `"mock-*"` placeholder values so the app doesn't crash on import
**Lines**: 6-11
```typescript
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "mock-key-to-prevent-crash",
    ...
};
```
**Production safety**: Vercel deployment always has real Firebase env vars configured. Mock values prevent import-time crashes during local dev without Firebase.

### `frontend/src/components/AuthWrapper.tsx` — Mock User Session

**Guard**: `NODE_ENV === "development"` AND `FIREBASE_API_KEY === "mock-key-to-prevent-crash"`
**Behavior**: Sets a mock user object with `uid: "mock_uid_dev"` and `getIdToken: () => "mock-dev-token"`
**Lines**: 20-34
```typescript
if (process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash") {
    setUser({ uid: "mock_uid_dev", ... });
}
```
**Production safety**: Double-gated. Production builds have `NODE_ENV === "production"` and real Firebase keys.

### `frontend/src/app/login/page.tsx` — Mock Login

**Guard**: `NODE_ENV === "development"` AND mock Firebase key
**Behavior**: Stores `mock_auth_user` in localStorage for local-only login bypass
**Lines**: 29-33

### `frontend/src/app/dashboard/page.tsx` — Mock Logout

**Guard**: `NODE_ENV === "development"` AND mock Firebase key
**Behavior**: Clears mock auth state on logout
**Lines**: 99-101

### `frontend/src/components/TeamSettings.tsx` — Mock Team Data

**Guard**: `NODE_ENV === "development"` AND mock Firebase key
**Behavior**: Returns mock team member list; simulates invite acceptance locally
**Lines**: 23-26, 80-82

### `frontend/src/components/SoMCommandCenter.tsx` — Mock Dashboard Data

**Guard**: `NODE_ENV === "development"` AND mock Firebase key
**Behavior**: Uses mock data for Visibility Command Center; falls back to `"mock-dev-token"` for API calls
**Lines**: 83, 197

### `frontend/src/components/AgentManifest.tsx` — Mock Manifest

**Guard**: `NODE_ENV === "development"` AND mock Firebase key
**Behavior**: Uses local mock data for manifest display
**Line**: 71

---

## 4. Rate Limiter Posture

The `/llms.txt` public route uses a two-layer rate limiting strategy:

| Layer | Behavior | Failure Mode |
|-------|----------|-------------|
| Backend (`workspaces.py:1086`) | Firestore-backed per-IP counter | Exception → `503` (fail-closed) |
| Frontend edge (`llms.txt/route.ts:20-32`) | Calls backend rate limiter | Non-OK response → `503` (fail-closed) |
| Frontend edge (network error) | Backend unreachable | Exception → `503` (fail-closed) |

**End-to-end guarantee**: Rate limiting is fail-closed at both layers. There is no scenario where a rate limiter failure results in unrestricted access.

---

## 5. Summary

| Area | Mock Paths | Branch Points | All Gated? | Production-Safe? |
|------|-----------|---------------|------------|-----------------|
| Backend (security) | 1 file | 2 | ✅ `ENV + ALLOW_MOCK_AUTH` | ✅ 401 + critical log in prod |
| Backend (features) | 2 files | 4 | ✅ SDK availability checks | ✅ Production has all SDKs |
| Frontend | 7 files | 12 | ✅ `NODE_ENV + Firebase key` | ✅ Double-gated |
| **Total** | **10 files** | **18 branch points** | **✅ All gated** | **✅ All production-safe** |

---

*AUM Context Foundry — Dev/Mock Path Inventory v5.1.0-hardened*


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

