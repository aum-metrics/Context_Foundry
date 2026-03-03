# Production Readiness & Dependency Posture

> **Audience**: Acquisition diligence, engineering leads, security reviewers.

## Environment Modes

The application has a single source of truth for environment mode: `settings.ENV` in `backend/app/core/config.py`.

| Mode | Behavior |
|------|----------|
| `production` | Strict: missing secrets → hard crash at startup. Swagger/Redoc disabled. Mock auth blocked. Internal error details hidden. |
| `development` | Degraded: missing secrets logged as warnings. Mock auth allowed. Full error details exposed. |

## Production Secret Requirements

All secrets below are **mandatory** in production (`settings.ENV = "production"`). Missing any triggers `sys.exit(1)` at startup.

| Secret | Purpose |
|--------|---------|
| `OPENAI_API_KEY` | LCRS simulation (GPT-4o) |
| `GEMINI_API_KEY` | LCRS simulation (Gemini) |
| `ANTHROPIC_API_KEY` | LCRS simulation (Claude) |
| `RAZORPAY_KEY_ID` | Payment processing |
| `RAZORPAY_KEY_SECRET` | Payment verification + webhooks |
| `JWT_SECRET` | Must differ from dev default — enforced at startup |
| `SSO_ENCRYPTION_KEY` | Must differ from dev default — enforced at startup |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Firebase Admin SDK (Firestore, Auth) |

## Dev/Mock Path Inventory

See [DEV_MOCK_PATHS.md](./DEV_MOCK_PATHS.md) for a complete inventory of all 18 mock branches, their guards, and production safety guarantees.

**Key guarantee**: No mock path can execute in production. All are double-gated behind `NODE_ENV === "development"` (frontend) or missing SDK/keys (backend).

## CI Pipeline

| Stage | Tool | What It Checks |
|-------|------|---------------|
| Frontend Lint | `npx next lint` | ESLint rules, import safety |
| Backend Syntax | `py_compile` | All `.py` files parse correctly |
| Backend Smoke | `test_main.py` | FastAPI app imports and router loads |
| Backend Tests | `pytest` (10 tests) | Simulation engine, LCRS math, audit, ingestion, competitor, RAG |

Build policy: `ignoreDuringBuilds: false` — lint errors fail production builds.

## Optional Dependencies (Graceful Degradation)

These libraries enhance functionality but allow the app to start without them in development:

| Library | Feature | Production Status |
|---------|---------|------------------|
| `playwright` | SEO audit crawler | Required for SEO features |
| `razorpay` SDK | Payment processing | Required for payment features |
| Firebase ADC | Firestore/Auth | Required for all tenant features |

In production, all optional dependencies must be installed. The startup gate ensures this.
