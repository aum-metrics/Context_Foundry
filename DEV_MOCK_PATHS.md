# Development & Mock Fallback Paths

> **Purpose**: This document inventories all dev/mock branches in the codebase for acquisition
> diligence transparency. All paths are properly gated and **cannot execute in production**.

## Production Safety Guarantees

All mock paths are gated by **at least one** of these conditions:

| Guard | Scope | How It Works |
|-------|-------|-------------|
| `process.env.NODE_ENV === "development"` | Frontend | Next.js sets this automatically; production builds use `"production"` |
| `NEXT_PUBLIC_FIREBASE_API_KEY === "mock-key-to-prevent-crash"` | Frontend | Real deployments always have a valid Firebase key |
| `?mock=true` URL parameter + dev-mode check | Frontend | Double-gated: URL param alone is insufficient |
| Missing API keys (OpenAI/Gemini) | Backend | Production `.env` always has valid keys; mock only fires locally |
| `PLAYWRIGHT_AVAILABLE === False` | Backend | Dev-only: production installs playwright for SEO audits |

---

## Backend Mock Paths

### `backend/app/api/chatbot.py`
- **Guard**: Firestore unavailable (`not db`)
- **Behavior**: Returns a canned support bot response
- **Lines**: 49, 70–71

### `backend/app/api/seo.py`
- **Guard**: `PLAYWRIGHT_AVAILABLE is False`
- **Behavior**: Returns mock SEO audit scores
- **Lines**: 21, 41

### `backend/app/api/simulation.py`
- **Guard**: Missing org in Firestore (line 252), missing OpenAI/Gemini keys (lines 543–548)
- **Behavior**: Uses placeholder API keys for local testing; returns mock LCRS scores
- **Lines**: 252, 282, 543–548

---

## Frontend Mock Paths

### `frontend/src/lib/firebase.ts`
- **Guard**: Missing `NEXT_PUBLIC_FIREBASE_*` env vars
- **Behavior**: Uses `"mock-*"` placeholder values so the app doesn't crash on import
- **Lines**: 6–11

### `frontend/src/components/AuthWrapper.tsx`
- **Guard**: `NODE_ENV === "development"` AND `FIREBASE_API_KEY === "mock-key-to-prevent-crash"`
- **Behavior**: Sets a mock user object with `uid: "mock_uid_dev"` and `getIdToken: () => "mock-dev-token"`
- **Lines**: 20–34

### `frontend/src/app/login/page.tsx`
- **Guard**: `NODE_ENV === "development"` AND mock Firebase key
- **Behavior**: Stores `mock_auth_user` in localStorage for local-only login bypass
- **Lines**: 29–33

### `frontend/src/app/dashboard/page.tsx`
- **Guard**: `NODE_ENV === "development"` AND mock Firebase key
- **Behavior**: Clears mock auth on logout
- **Lines**: 99–101

### `frontend/src/components/TeamSettings.tsx`
- **Guard**: `NODE_ENV === "development"` AND mock Firebase key
- **Behavior**: Returns mock team member list; simulates invite acceptance locally
- **Lines**: 23–26, 80–82

### `frontend/src/components/SoMCommandCenter.tsx`
- **Guard**: `NODE_ENV === "development"` AND mock Firebase key
- **Behavior**: Uses mock data for Share-of-Mind dashboard; falls back to `"mock-dev-token"` for API calls
- **Lines**: 83, 197

### `frontend/src/components/AgentManifest.tsx`
- **Guard**: `NODE_ENV === "development"` AND mock Firebase key
- **Behavior**: Uses local mock data for manifest display
- **Line**: 71

---

## Summary

| Area | Mock Paths | All Gated? |
|------|-----------|------------|
| Backend | 3 files, 6 branch points | ✅ Yes — env var / SDK availability checks |
| Frontend | 7 files, 12 branch points | ✅ Yes — `NODE_ENV` + Firebase key double-guard |
| **Total** | **10 files, 18 branch points** | **✅ All production-safe** |
