# RELEASE_CHECKLIST.md

## Pre-release (local)
- [ ] `backend/venv/bin/pytest -q` passes (record failures and fix)
- [ ] Frontend build passes:
  - [ ] `cd frontend && npm run build`
- [ ] Update version string(s) if applicable
- [ ] Confirm no mock auth in production:
  - [ ] `ALLOW_MOCK_AUTH` is `False`
  - [ ] No `mock-dev-token` usage in prod configs

## Backend deploy (GCP Cloud Run)
- [ ] Build image successfully
- [ ] Deploy to Cloud Run
- [ ] Confirm `/api/health` returns healthy
- [ ] Confirm `/api/workspaces/health` returns healthy
- [ ] Confirm `/api/simulation/suggest-prompts` works for a known org
- [ ] Confirm webhook endpoint accepts Razorpay signature

## Frontend deploy (Vercel)
- [ ] Set `NEXT_PUBLIC_API_BASE_URL` to production API
- [ ] Validate `/` loads and Quick Scan completes
- [ ] Validate `/login` and `/dashboard` auth flow
- [ ] Validate pricing toggle + Razorpay launch

## Data integrity checks
- [ ] Run a fresh ingestion, then:
  - [ ] Agent Manifest shows the correct org name
  - [ ] Co‑Intelligence uses the latest context
  - [ ] Brand Health PDF matches the latest run

## Security & billing
- [ ] Verify `JWT_SECRET`, `SSO_ENCRYPTION_KEY`, `SSO_JWT_SECRET` are non‑default
- [ ] Verify `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` secrets exist
- [ ] Run one paid plan upgrade end‑to‑end
- [ ] Confirm webhook idempotency uses `lastOrderId`

## Docs
- [ ] Update `docs/*` and root `*.md` update block
- [ ] Confirm support email is `hello@aumcontextfoundry.com`

## Post‑release
- [ ] Run smoke test flows:
  - [ ] Quick Scan
  - [ ] Ingestion → Manifest → Simulation
  - [ ] Admin → Org → Subscription update
- [ ] Monitor Cloud Run logs for 10 minutes
