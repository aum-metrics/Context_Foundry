# AUM Context Foundry: Frequently Asked Questions (FAQ)

## General & Product Focus

**What is AUM Context Foundry?**
AUM is an enterprise infrastructure platform designed for Generative Engine Optimization (GEO). It allows brands to monitor how Large Language Models (LLMs) like ChatGPT, Claude, and Gemini talk about their products, and provides the tools to inject verified "Ground Truth" directly into those models to prevent hallucinations and brand drift.

**Who is this product for?**
AUM is built for enterprise marketing teams, CMOs, Product Strategists, and Risk & Compliance officers who need to ensure their brand narrative is factually represented in the emerging "Agentic Web" (AI search).

**How is this different from traditional SEO?**
Traditional SEO optimizes for keyword rankings and link clicks on Google. GEO (Generative Engine Optimization) optimizes for semantic weighting and factual accuracy *inside* AI chat completions. AI agents synthesize answers instead of providing links; AUM ensures those synthesis pipelines prioritize your verified data.

## Security & Data Privacy

**Is my proprietary corporate data safe?**
Yes. AUM employs a "Zero-Retention" ingestion pipeline. When you upload a document (PDF), it is parsed strictly in volatile memory (RAM). The semantic meaning is converted into mathematical vectors, and the original file is instantly and permanently destroyed (`gc.collect()`). We never store your raw files on our disks.

**Does AUM use my data to train its own models?**
Absolutely not. AUM is an evaluation and routing engine, not a foundational model provider. Your Context Information Model (CIM) is segregated in a strict, multi-tenant Firebase enclave specific to your organization.

**How is platform access secured?**
AUM utilizes Firebase Authentication with ID Tokens for session validation. Critical backend API endpoints are locked down with strict Dependency injection checks, and programmatic access relies on HMAC-SHA256 authenticated webhook signatures. Enterprise Single Sign-On (SSO) configurations are encrypted at rest using AES Fernet cryptography.

## Billing & Infrastructure

**Do I need to provide my own OpenAI or Anthropic API keys (BYOK)?**
No. AUM utilizes an "Automated Provider Provisioning" model. When your organization is created, we dynamically generate and assign isolated AI API keys to your tenant. This ensures frictionless onboarding and allows us to provide granular, transparent billing based on your subscription tier without you managing infrastructure secrets.

**What happens if I exceed my monthly simulation limit?**
AUM features a robust, Firestore-backed "Token Bucket" rate limiter. If you exhaust your tier's limits (Explorer, Growth, or Scale), the API will gracefully return an `HTTP 402 Payment Required` response, and the frontend will present an option to upgrade your plan. The system will never silently crash or incur unchecked overage charges.

## Technical Operations

**What is LCRS?**
LCRS stands for Latent Contextual Rigor Score. It is our proprietary mathematical evaluation engine. It takes an AI's answer, breaks it down into atomic factual claims, and cross-references those claims against your uploaded "Ground Truth" vectors using cosine similarity. It provides a deterministic score (0-100%) proving the fidelity of the AI.

**What is the `/llms.txt` file?**
It is a standardized manifesto format designed specifically for AI web crawlers (like SearchGPT or Perplexity). AUM automatically compiles your verified Ground Truth into this format and hosts it. When bots crawl your domain, they ingest this file, ensuring your controlled narrative overrides out-of-date training data.

**How does the Tri-Model arbitration work?**
When you run a simulation, AUM doesn't just ask one AI. It concurrently queries GPT-4o, Claude 3.5 Sonnet, and Gemini 2.0 Flash. If they disagree on a fact regarding your brand, a separate Master Adjudicator evaluates the variance against your Ground Truth to issue a final Consensus Verdict.
