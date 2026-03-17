# AUM Context Foundry - Frequently Asked Questions

## Product

**What is AUM Context Foundry?**  
AUM Context Foundry measures how frontier AI models describe a company, compares those answers with a verified context document, and shows where the public narrative is strong, missing, or drifting.

**Which models does AUM evaluate today?**  
The current runtime model set is:
- GPT-4o
- Claude 4.5 Sonnet
- Gemini 3 Flash

**What is Visibility Score?**  
Visibility Score is the product's representation score. It blends:
- claim recall against the verified manifest
- semantic alignment between the answer and the verified context

The implementation uses a transparent 60/40 weighting. It is an engineering heuristic, not a peer-reviewed academic metric.

**What is the `/llms.txt` manifest?**  
It is a machine-readable summary of the active verified context. AUM generates it from the current manifest so AI crawlers and answer engines have a cleaner representation of the company's approved claims, services, and links.

## Security and data handling

**Do you store uploaded documents?**  
Raw uploads are processed through the zero-retention ingestion pipeline and are not kept as source files. The generated manifest and embeddings are stored with TTL-based lifecycle handling.

**Where is tenant data stored?**  
Organization metadata, manifests, scores, and audit records are stored in Google Firestore.

**Do users need to provide their own model API keys?**  
No for normal product use. The platform can run simulations with platform-managed provider keys. BYOK and admin-managed key rotation are separate administrative concerns.

## Plans and packaging

**What is included in Explorer?**  
Explorer is the free proof-of-value tier:
- 1 seat
- 1 document ingestion
- 1 simulation run / one free report
- `/llms.txt` preview
- no scoring history
- no paid exports
- no API-key generation

**What is included in Growth?**  
Growth is the first paid operating tier:
- 5 seats
- 100 simulations per billing cycle
- full tri-model comparison
- full dashboard access
- SEO + AI Search Readiness audit
- report export
- API-key generation

Public price:
- USD: $79/month
- INR: Rs6,499/month

**What is included in Scale?**  
Scale is the higher-volume team tier:
- 25 seats
- 500 simulations per billing cycle
- everything in Growth
- competitor tracking
- white-labeled exports
- agency-oriented workflow

Public price:
- USD: $249/month
- INR: Rs20,999/month

**What is Enterprise?**  
Enterprise is admin-managed and contract-driven. Current code defaults are:
- 100 seats
- 2000 simulations per billing cycle

These values can be overridden by admin controls for a contracted tenant.

**What happens when the simulation limit is reached?**  
The product blocks new runs and prompts the user to upgrade or renew capacity. Stored results remain available according to plan access.

**What payment methods are supported?**  
Razorpay is the active payment rail for the product. That supports cards, UPI, and common India-first payment methods.

## API and integrations

**Does every account get an API key automatically?**  
No. Explorer does not auto-provision an external API key. API-key generation is available on paid tiers through the API Keys screen.

**Which tiers can generate API keys?**  
Growth, Scale, and Enterprise.

**What is the API used for?**  
It exposes simulation and related programmatic workflows so a paid organization can integrate scoring into its own internal systems.

## Enterprise controls

**Does AUM support SSO?**  
Yes. Scale and Enterprise organizations can configure SSO for supported providers such as Okta, Azure AD, and Google Workspace.

**Can AUM be deployed in a private environment?**  
The product is containerized and can be discussed for private deployment or custom enterprise environments. That is a commercial / implementation discussion, not the default self-serve path.

**How should buyers think about AI Search Readiness vs drift?**  
They are not the same metric:
- drift / Visibility Score measures how well model answers match the verified context on tested prompts
- AI Search Readiness measures page-level readiness and manifest alignment for generative discovery

A company can improve one without automatically improving the other.

## Support

**How do customers contact AUM?**  
hello@aumcontextfoundry.com
