# AUM Context Foundry - User Guide
**March 2026**

## 1. What the product does

AUM Context Foundry helps a company understand how GPT-4o, Claude 4.5 Sonnet, and Gemini 3 Flash describe it in public-answer workflows. The product compares model answers against a verified context document and surfaces:
- representation accuracy
- missing claims
- competitor displacement
- remediation suggestions

## 2. First login

1. Go to [https://aumcontextfoundry.com](https://aumcontextfoundry.com).
2. Sign in with your work email.
3. The platform creates a workspace for your organization.
4. New workspaces start on the `Explorer` plan unless an admin has assigned a paid tier.

Explorer currently includes:
- 1 seat
- 1 document ingestion
- 1 simulation run / one free report

## 3. Workspace model

The product has two separate ideas that users should not confuse:
- **Workspace organization**: the tenant that owns billing, users, and admin settings
- **Active context**: the company / manifest currently being analyzed

Analytical screens and reports follow the **active context**.

## 4. Context setup

Use the `Context Studio` / ingestion workflow to create or refresh the active context.

Supported setup path:
1. Upload a PDF or parse a public URL
2. Let the ingestion pipeline generate a manifest
3. Review the generated context
4. Publish it as the latest active version

Explorer allows one ingestion. Paid tiers remove that cap.

## 5. Running a simulation

The `Co-Intelligence` surface is the prompt-level evaluation screen.

1. Select the active context
2. Choose or edit a buyer-intent prompt
3. Run the simulation
4. Review the model-by-model output

The current default prompts are B2B enterprise-oriented. They focus on:
- enterprise analytics consulting ranking
- cloud and data modernization fit
- named competitor comparisons
- buyer shortlist rationale
- domain expertise coverage

## 6. Understanding the scores

### SoM
SoM is the core answer-quality score. It combines:
- claim recall against the verified manifest
- semantic alignment with the active context

### ASoV
ASoV is the broader visibility / representation lens. It is intended to show how strongly the company shows up with the right narrative across the model outputs.

### GEO
GEO is not the same thing as prompt-level drift. GEO focuses on:
- page readiness
- structured data quality
- manifest alignment
- generative-discovery friendliness

## 7. Dashboard workflow

Paid plans unlock the full command layer.

The main operating flow is:
1. Set or switch the active context
2. Run the enterprise query pack
3. Review KPI strip and model comparison
4. Review winning and losing query clusters
5. Review competitor intelligence
6. Review prescriptive remediation guidance
7. Export the executive report

## 8. Reports

The executive report is the buyer-facing artifact. It includes:
- average SoM
- model breakdown
- executive interpretation
- GEO snapshot
- competitor displacement summary
- ASoV radar explanation
- remediation delta when historical baseline is available

Explorer can view the teaser/free-report experience. Paid tiers unlock the full export workflow.

## 9. Team management

Seat limits currently enforced by plan:
- Explorer: 1
- Growth: 5
- Scale: 25
- Enterprise: 100 by default, admin-managed

Admins can invite users from the team settings area. Members can run allowed workflows but should not assume billing or admin privileges.

## 10. API access

API access is a paid-tier capability.

Current behavior:
- Explorer: no external API-key generation
- Growth / Scale / Enterprise: can generate `aum_...` API keys from the API Keys screen

## 11. Billing

Current public pricing:
- Growth: $79/month or Rs6,499/month
- Scale: $249/month or Rs20,999/month

Enterprise is not publicly self-serve on the landing page. It is admin-managed / contract-driven.

## 12. SSO

Scale and Enterprise organizations can configure SSO. Supported provider patterns in the product include Okta, Azure AD, and Google Workspace.

## 13. Support

Contact: hello@aumcontextfoundry.com

