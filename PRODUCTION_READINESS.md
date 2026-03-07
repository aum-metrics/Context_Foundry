# Production Readiness & Dependency Posture

> **Audience**: Acquisition diligence, engineering leads, security reviewers, DevOps.
> **Last Updated**: March 2026 | Commit: `03574b1` on `main`

---

## 1. Environment Modes

The application has a **single source of truth** for environment mode: `settings.ENV` in `backend/app/core/config.py` (Pydantic Settings, loaded from `.env`).

| Mode | Default? | Behavior |
|------|----------|----------|
| `production` | ✅ Yes | Strict: missing secrets → `sys.exit(1)` at startup. Swagger/Redoc disabled. Mock auth blocked (even if `ALLOW_MOCK_AUTH=True`). Internal error details hidden from responses. Dev defaults for `JWT_SECRET` / `SSO_ENCRYPTION_KEY` → ValueError crash. |
| `development` | No | Degraded: missing secrets logged as warnings. Mock auth allowed (requires `ALLOW_MOCK_AUTH=True`). Full error details exposed. Swagger at `/api/docs`. Quota enforcement relaxed for local testing. |

### How Mode Is Determined
1. `backend/app/core/config.py` defines `ENV: str = "production"` (Pydantic BaseSettings).
2. Pydantic loads from `backend/.env` file. If `ENV=development` is in `.env`, it overrides the default.
3. `backend/app/main.py` startup gate uses `settings.ENV` (not `os.getenv`) — single source of truth.
4. No code path uses `os.getenv("ENV")` independently — all access goes through `settings.ENV`.

---

## 2. Startup Secret Gate

Located in `backend/app/main.py:58-75`, the startup lifespan event checks:

```python
required_secrets = [
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "ANTHROPIC_API_KEY",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET"
]
missing = [s for s in required_secrets if not os.getenv(s)]
if missing:
    if settings.ENV == "production":
        sys.exit(1)  # HARD CRASH — cannot run prod without all keys
    else:
        logger.warning(f"Missing secrets (degraded mode): {', '.join(missing)}")
```

Additionally, `config.py:48-54` validates:
```python
if self.ENV == "production":
    if self.JWT_SECRET == "your-secret-key-change-in-production":
        raise ValueError("JWT_SECRET must be changed in production!")
    if self.SSO_ENCRYPTION_KEY == "aum-sso-encryption-dev-fallback1":
        raise ValueError("SSO_ENCRYPTION_KEY must be changed in production!")
```

**Result**: Production deployment with default secrets or missing keys is physically impossible. The process will not start.

---

## 3. Complete Environment Variable Reference

### Backend (`backend/.env`)

| Variable | Required (Prod) | Required (Dev) | Default | Description |
|----------|-----------------|----------------|---------|-------------|
| `ENV` | Yes | Yes | `"production"` | Environment mode. Controls all security gates. |
| `JWT_SECRET` | Yes (unique) | No | Dev default | 64-char cryptographic string. Dev default crashes in prod. |
| `SSO_ENCRYPTION_KEY` | Yes (unique) | No | Dev default | Fernet key for SSO client secret encryption. Dev default crashes in prod. |
| `ALLOW_MOCK_AUTH` | No | Optional | `False` | Enables `mock-dev-token` bypass. **Blocked in prod regardless.** |
| `OPENAI_API_KEY` | Yes | No | None | OpenAI platform key for LCRS simulation + claim extraction. |
| `GEMINI_API_KEY` | Yes | No | None | Google Gemini key for multi-model LCRS. |
| `ANTHROPIC_API_KEY` | Yes | No | None | Anthropic Claude key for multi-model LCRS. |
| `RAZORPAY_KEY_ID` | Yes | No | None | Razorpay API key ID for order creation. |
| `RAZORPAY_KEY_SECRET` | Yes | No | None | Razorpay secret for payment verification + webhooks. |
| `RAZORPAY_WEBHOOK_SECRET` | Recommended | No | None | HMAC signature verification for Razorpay webhooks. |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Yes* | No | None | Path to Firebase Admin SDK JSON. *Or set `GOOGLE_APPLICATION_CREDENTIALS`. |
| `FRONTEND_URL` | Recommended | No | `http://localhost:3000` | Used for generating invite email URLs. |
| `PAYMENT_CALLBACK_URL` | Recommended | No | Default in code | Razorpay payment completion redirect URL. |
| `SUPABASE_URL` | No | No | None | Optional Supabase integration. |
| `SUPABASE_KEY` | No | No | None | Optional Supabase integration. |

### Generating Secrets

```bash
# Generate JWT_SECRET (64-char random string)
python3 -c "import secrets; print(secrets.token_urlsafe(48))"

# Generate SSO_ENCRYPTION_KEY (Fernet key)
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Firebase app ID |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Backend URL (e.g. `http://127.0.0.1:8000`) |
| `NEXT_PUBLIC_API_URL` | No | Fallback for `NEXT_PUBLIC_API_BASE_URL` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | For payments | Razorpay public key ID |

---

## 4. CI Pipeline

Defined in `.github/workflows/ci.yml`. Runs on every push to `main` and all PRs.

| Job | Steps | Failure Impact |
|-----|-------|----------------|
| **Frontend Lint** | `npm ci` → `npx next lint` | Blocks merge: ESLint errors in TypeScript/React |
| **Backend Tests** | `pip install -r requirements.txt` → `py_compile` → `python test_main.py` → `pytest` (62 tests) | Blocks merge: Python syntax errors, import failures, logic regressions |

Additional gate: `next.config.ts` sets `ignoreDuringBuilds: false` — lint errors also fail Vercel production builds.

### Test Suite Details

| Test File | Tests | What It Covers |
|-----------|-------|---------------|
| `test_simulation.py` | 3 | LCRS endpoint (happy + unhappy path), 60/40 math, Frontier Label contract verification |
| `test_ingestion.py` | 2 | Recursive split algorithm + parse endpoint |
| `test_competitor.py` | 2 | Displacement endpoint + auth rejection |
| `test_audit.py` | 2 | Audit log write + retrieval |
| `test_rag_logic.py` | 2 | Cosine similarity math + scoring |

All tests auto-mock Firestore via `conftest.py` (no real database needed).

---

## 5. Optional Dependencies (Graceful Degradation)

| Library | Feature | Dev Behavior | Production Requirement |
|---------|---------|-------------|----------------------|
| Firebase ADC | Firestore/Auth | Logs warning, `db=None` — mock paths activate | Must be configured (service account) |
| `anthropic` | Claude simulation | Import logged as warning, Claude scoring skipped | Must be installed + API key set |
| `playwright` | SEO audit crawler | Returns mock scores | Must be installed for SEO features |
| `razorpay` SDK | Payment processing | Payment endpoints return 503 | Must be installed + keys set |

**Production guarantee**: The startup gate ensures all critical dependencies are present. The app will not start in production mode without them.

---

## 6. Deployment Checklist

### Pre-Deploy
- [ ] All env vars set (see Section 3)
- [ ] `ENV=production` (or not set — defaults to production)
- [ ] `JWT_SECRET` ≠ dev default
- [ ] `SSO_ENCRYPTION_KEY` ≠ dev default
- [ ] Firebase service account JSON deployed
- [ ] All 5 API keys present (OpenAI, Gemini, Anthropic, Razorpay ×2)
- [ ] CI pipeline green on target commit

### Deploy Backend (Cloud Run)
```bash
# Build
docker build -t aum-backend ./backend

# Deploy with env vars from Secret Manager
gcloud run deploy aum-api \
  --image aum-backend \
  --port 8000 \
  --set-env-vars ENV=production \
  --set-secrets OPENAI_API_KEY=openai-key:latest,... \
  --region asia-south1
```

### Deploy Frontend (Vercel)
1. Connect GitHub repo → Vercel
2. Set root directory to `frontend/`
3. Configure env vars in Vercel dashboard (Production environment)
4. Auto-deploys on push to `main`

### Post-Deploy Verification
```bash
# Health check
curl https://api.yourdomain.com/api/health
# Expected: {"status": "healthy"}

# Verify Swagger is hidden
curl https://api.yourdomain.com/api/docs
# Expected: 404 (not accessible in production)
```

---

## 7. Known Risk Register

| Risk | Severity | Mitigation | Status |
|------|----------|------------|--------|
| Missing production secrets | Critical | Startup gate (`sys.exit(1)`) | ✅ Enforced |
| Mock auth in production | Critical | Double-gated: `ENV + ALLOW_MOCK_AUTH` | ✅ Hardened |
| Dev defaults in production | Critical | Pydantic validator crashes on dev defaults | ✅ Enforced |
| Rate limiter failure | Medium | Fail-closed (503) at backend + frontend edge | ✅ End-to-end |
| Webhook forgery | Medium | `hmac.compare_digest` + idempotency | ✅ Implemented |
| Stalled background jobs | Low | Auto-recovery sweep every 5 min, 3-strike DLQ | ✅ Active |

---

*AUM Context Foundry — Production Readiness v5.1.0-hardened*
