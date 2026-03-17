# AUM Context Foundry: Sales and Lead Onboarding Guide

**Target audience:** BDRs, AEs, founder-led sales, solutions leads

## 1. Core pitch

**Hook:**  
Do you know how GPT-4o, Claude 4.5 Sonnet, and Gemini 3 Flash rank and describe your firm against competitors right now?

**Problem:**  
Enterprise buyers increasingly use frontier models to compare consulting, analytics, and AI-transformation partners. If those answers omit your proof, flatten your positioning, or over-credit competitors, you lose shortlist quality before a real sales conversation starts.

**Solution:**  
AUM Context Foundry measures that representation, shows which competitors win which buyer-intent categories, and tells the team what exact claims, pages, and manifest content to improve.

## 2. Buyer personas

### CMO / head of marketing
What they care about:
- category positioning
- buyer discovery
- competitor narrative pressure
- proof of improvement

Pitch:
*"Your website can look fine and still lose in AI-driven shortlisting. We show where frontier models place your firm, which competitors they prefer, and what to change to improve that outcome."*

### Strategy / growth / revenue leader
What they care about:
- enterprise shortlist presence
- competitive standing
- clear differentiation

Pitch:
*"AUM is not just a score. It shows the buyer-intent categories you win or lose and gives you prescriptive guidance tied to the claims and proof your public narrative is missing."*

### CTO / security / platform owner
What they care about:
- tenant isolation
- data handling
- SSO
- auditability

Pitch:
*"The product uses a fail-closed access model, zero-retention ingestion workflow, Firestore-backed tenancy, and support for Scale / Enterprise SSO controls."*

## 3. Discovery questions

Use questions like:
1. *"When buyers compare your firm with Accenture, Tiger Analytics, Fractal, or Mu Sigma, do you know how AI models rank that comparison?"*
2. *"Which public proof points do you rely on today to show enterprise transformation credibility?"*
3. *"Do you want a one-time audit, or a weekly operating workflow that tracks narrative movement over time?"*
4. *"Will this need SSO and multi-user governance?"*

## 4. Objection handling

**Objection:** *"Why not test prompts manually?"*  
**Answer:** Manual prompting does not create a repeatable baseline, competitor view, or remediation trail. AUM turns the exercise into a scored, reportable workflow.

**Objection:** *"We already pay for SEO."*  
**Answer:** SEO and AI answer visibility overlap, but they are not the same thing. AUM measures model representation against verified context and shows where competitor narratives are winning.

**Objection:** *"Is the score scientifically proven?"*  
**Answer:** No. Do not oversell it. Visibility Score is an auditable engineering heuristic designed for operational consistency, not a peer-reviewed academic metric.

## 5. Demo flow

1. Set the active company context
2. Run the enterprise buyer-intent prompt pack
3. Show the winning and losing query clusters
4. Show competitor intelligence
5. Show the prescriptive remediation guidance
6. Show the executive report and remediation delta

## 6. Packaging in sales conversations

### Explorer
Use it as a proof-of-value teaser:
- 1 document
- 1 simulation run
- 1 free report

### Growth
Position as the first real operating tier:
- 100 simulations
- full dashboard
- report export
- API-key generation

### Scale
Position for agency or heavier multi-user use:
- 500 simulations
- competitor tracking
- white-labeled exports
- 25 seats

### Enterprise
Position as contract-led:
- 100 seats by default
- 2000 simulations by default
- admin-managed overrides

## 7. Close

Always set the next step:
- run the first context
- deliver the first report
- agree the remediation owner
- schedule the follow-up measurement



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

