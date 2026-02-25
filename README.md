# AUM Context Foundry

Production-grade Generative Engine Optimization (GEO) Infrastructure for the Agentic Web.

## 🏗 Architecture Overview

- **Backend**: FastAPI (Python 3.12+) - Scalable, async-first GEO engine.
- **Frontend**: Next.js 14+ (App Router) - Premium, high-performance UI.
- **Database**: Google Firestore - Multi-tenant, real-time data layer.
- **Vector Search**: Native Firestore Vector Indexing (O(log N)) with legacy Python fallback.
- **Job Queue**: FirestoreTaskQueue - Persistent, state-aware background job management.
- **AI Models**: Multi-provider (OpenAI, Gemini, Anthropic) LCRS scoring logic with automatic provider-fallback.

## 🛡 Hardening & Enterprise Scalability (v2.2.0-hardened)

The codebase has undergone a "Brutal Hardening" audit to ensure acquisition-readiness:

- **Logic Resilience**: 
    - **Recursive Chunking**: Smart splitting on paragraph and sentence boundaries for high fact-integrity.
    - **Scoring Fallback**: Automatic failover to Gemini 2.0 Flash for claim verification if OpenAI is unavailable.
- **Performance at Scale**:
    - **Native Vector Search**: Transitioned from $O(N)$ memory search to $O(\log N)$ native indexing.
    - **Persistent Job Queueing**: Long-running SEO and Batch Analysis jobs are persisted to Firestore, surviving server restarts.
- **Security & Multi-Tenancy**:
    - **IDOR Prevention**: All requests validated against organizational membership via `verify_user_org_access`.
    - **Dynamic Provisioning**: Plan-based simulation caps are read from the database, not hardcoded.
    - **Zero-Retention Ingestion**: Raw binary data is flushed from RAM immediately after parsing.

## 🚀 Getting Started (Production)

### 1. Project Configuration
Ensure all required environment variables are set. Production mode is triggered via `ENV=production`.

```bash
# Example .env
ENV=production
JWT_SECRET=YOUR_SECURE_RANDOM_SECRET
CORS_ORIGINS=https://aumdatalabs.com
TRUSTED_HOSTS=aumdatalabs.com
OPENAI_API_KEY=...
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/creds.json
```

### 2. Backend Deployment
```bash
cd backend
python3 -m pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
*The app will critically fail at startup if `JWT_SECRET` is set to default or mission-critical keys are missing in production mode.*

### 3. Frontend Deployment
```bash
cd frontend
npm install
npm run build
npm run start
```

## 📊 Operations & Observability

- **Structured Logging**: Logs are formatted with environment tags and rotated.
  - `app.log`: General application logs.
  - `error.log`: (Prod only) Critical error tracking.
- **Health Checks**: `/api/health` indicates simulation engine readiness.
- **Audit Logs**: All LCRS scoring events are persisted to Firestore with organizational `orgId` metadata.

---
© 2026 AUM Data Labs. All rights reserved.
