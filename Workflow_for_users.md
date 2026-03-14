# AUM Context Foundry - Workflow Guide
**March 2026**

## Workflow 1: First-time workspace setup

**Who**: first user at a company  
**Result**: workspace created and ready for context ingestion

1. Sign in at [https://aumcontextfoundry.com](https://aumcontextfoundry.com)
2. Verify your email if required
3. The platform provisions your organization workspace
4. You land in the product on the Explorer tier unless a paid plan is already assigned

Current Explorer scope:
- 1 seat
- 1 document ingestion
- 1 simulation run / one free report

## Workflow 2: Create the active context

**Who**: admin or member  
**Result**: manifest created for the company being analyzed

1. Open the context / ingestion workflow
2. Upload a PDF or submit a public URL
3. Wait for the zero-retention parse and manifest generation
4. Confirm the active context is the company you want to analyze

## Workflow 3: Run a B2B enterprise simulation

**Who**: admin or member  
**Result**: model-by-model prompt evaluation

1. Open `Co-Intelligence`
2. Confirm the active context
3. Use one of the enterprise buyer-intent prompts, for example:
   - "Who are the top enterprise analytics consulting firms for retail and CPG transformation, and where does this firm fit?"
   - "How does this firm compare with Accenture, Tiger Analytics, Fractal, and Mu Sigma for enterprise AI and analytics transformation?"
   - "Which partner is best for large-scale AI and analytics transformation for Fortune 500 companies, and why would a buyer shortlist this firm?"
4. Run the simulation
5. Review:
   - score per model
   - grounded vs drifting output
   - claim support
   - competitor narrative pressure

## Workflow 4: Move from simulation to decision view

**Who**: paid-tier user  
**Result**: a unified operating surface instead of isolated screens

1. Open the command center / dashboard
2. Review the KPI strip
3. Review the winning and losing query clusters
4. Review competitor intelligence
5. Review the remediation panel
6. Export the executive report

This is the main product flow for Growth, Scale, and Enterprise users.

## Workflow 5: Understand remediation guidance

**Who**: marketing, comms, growth, or strategy owner  
**Result**: exact next actions to improve representation

For weak clusters, the product surfaces:
- observed outcome
- winning competitor
- missing claims
- manifest-backed URLs to update
- suggested copy block
- suggested schema / FAQ / `llms.txt` additions

## Workflow 6: Compare before vs after

**Who**: team proving ROI internally  
**Result**: baseline vs current improvement evidence

1. Refresh the context after making content changes
2. Re-run the same query cluster
3. Open the report
4. Review the remediation delta section:
   - baseline LCRS
   - current LCRS
   - hallucination-rate delta
   - historical prompt comparison

## Workflow 7: Invite the team

**Who**: organization admin  
**Result**: additional members added within plan limits

Seat limits currently enforced:
- Explorer: 1
- Growth: 5
- Scale: 25
- Enterprise: 100 by default

## Workflow 8: Generate API keys

**Who**: paid-tier admin  
**Result**: programmatic access for external integrations

1. Open the API Keys screen
2. Generate a new `aum_...` key
3. Store it securely
4. Use it against the paid-tier API surface

Explorer does not auto-provision or expose external API keys.

## Workflow 9: Upgrade

**Who**: organization admin  
**Result**: higher limits and more workflow depth

Current public plans:
- Growth: $79 / Rs6,499 monthly
- Scale: $249 / Rs20,999 monthly

Upgrade flow:
1. Trigger checkout from landing page or in-product paywall
2. Complete Razorpay checkout
3. Plan activates and quotas reset for the billing cycle

## Workflow 10: Configure SSO

**Who**: Scale or Enterprise admin  
**Result**: centralized login for the team

1. Open SSO settings
2. Configure the provider credentials
3. Register the callback URL with the IdP
4. Test tenant login

## Workflow 11: Export the executive artifact

**Who**: paid-tier user  
**Result**: stakeholder-ready PDF

1. Open the executive report
2. Confirm the active context and query set
3. Export the PDF
4. Share the report with buyers, operators, or leadership

