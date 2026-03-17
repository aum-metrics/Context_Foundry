# AUM Context Foundry - User-Facing Product Document
**March 2026**

## Product summary

AUM Context Foundry is an enterprise-facing AI visibility and representation product. It helps a company measure how frontier models describe it, compare that against a verified context, and then identify what to change to improve that outcome.

Current model families in production:
- GPT-4o
- Claude 4.5 Sonnet
- Gemini 3 Flash

## Core product story

AUM does three things:
1. **Measure** how accurately models describe the active company context
2. **Compare** that representation against competitors and buyer-intent query clusters
3. **Recommend** concrete remediation actions tied to the verified manifest

## Main product surfaces

### Co-Intelligence
Prompt-level evaluation across the active model set. This is where users see:
- model-by-model scores
- grounded vs drifting answers
- missing claims
- answer quality against the verified context

### Command Center
The decision workspace for paid tiers. It brings together:
- KPI strip
- query-cluster wins and losses
- competitor intelligence
- exact remediation guidance
- report export

### Context Studio / Ingestion
The place where the active company context is created or refreshed through:
- document upload
- URL parsing
- manifest generation

### Brand Health Report
The executive artifact. It summarizes:
- average Visibility Score
- model breakdown
- executive interpretation
- AI Search Readiness snapshot
- competitor displacement
- remediation delta

## Packaging

### Explorer
Free proof-of-value tier:
- 1 seat
- 1 document ingestion
- 1 simulation run / one free report
- `/llms.txt` preview
- no scoring history
- no API-key generation

### Growth
Operating tier for internal teams:
- 5 seats
- 100 simulations / billing cycle
- full dashboard
- tri-model access
- report export
- SEO + AI Search Readiness audit
- API-key generation

Public price:
- $79/month
- Rs6,499/month

### Scale
Higher-volume team tier:
- 25 seats
- 500 simulations / billing cycle
- everything in Growth
- competitor tracking
- white-labeled exports
- agency workflow support

Public price:
- $249/month
- Rs20,999/month

### Enterprise
Contract / admin-managed tier:
- 100 seats by default
- 2000 simulations by default
- custom overrides via admin controls

## Security and governance

- zero-retention ingestion path for raw source files
- Firestore-backed tenant isolation
- audit trail support
- Scale / Enterprise SSO support
- API keys are hashed at rest

## API access

External API-key generation is a paid-tier capability. Explorer does not auto-provision an external API key.

## Contact

hello@aumcontextfoundry.com


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

