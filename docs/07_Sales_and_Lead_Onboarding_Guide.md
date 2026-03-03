# AUM Context Foundry: Sales & Lead Onboarding Guide

**Target Audience:** Sales Interns, BDRs (Business Development Reps), Account Executives
**Prerequisites:** Basic understanding of B2B SaaS sales cycles.

---

## 1. The Core Pitch (The Elevator Pitch)

*   **The Hook:** Do you know what ChatGPT is saying about your brand right now?
*   **The Problem:** Large Language Models (LLMs) hallucinate. If a customer asks Perplexity or Gemini about your refund policy, and the AI invents a "30-day no questions asked" policy that you don't actually have, your brand takes the financial and reputational hit.
*   **The Solution:** AUM Context Foundry is a platform that allows you to upload your definitive "Source of Truth" (your pricing, policies, and products). We then run hundreds of automated, simulated conversations against ChatGPT, Claude, and Gemini to mathematically prove how accurately they represent your business. We score them using our proprietary LCRS logic.

---

## 2. Knowing Your Buyer Personas

When an intern gets on a call with a lead, they must adapt the pitch depending on who is talking.

### Persona 1: The CMO (Chief Marketing Officer)
*   **What they care about:** Brand Reputation, PR disasters, "Search Generative Experience" (SGE).
*   **How you pitch them:** *"CMO, traditional SEO is dying. Users are switching to Perplexity and ChatGPT to find products. If ChatGPT hallucinates your features, you lose the lead before they even hit your website. AUM Context Foundry gives you real-time Radar charts tracking your AI brand health."*

### Persona 2: The CTO / CISO (Chief Security Officer)
*   **What they care about:** Data Privacy, API Security, SOC2 Compliance.
*   **How you pitch them:** *"CTO, our architecture is built on a paranoid 'Fail-Closed' trust model. Our Firestore Rules mathematically prevent raw data exfiltration, and we integrate natively with your Okta/SAML SSO. We handle all the API provisioning and scaling so your teams don't have to manage keys."*

### Persona 3: Legal & Compliance
*   **What they care about:** Liability, Audit trails, SLA verification.
*   **How you pitch them:** *"Legal, our LCRS engine leaves an immutable, cryptographically timestamped audit trail for every single AI output tested. You can export these to CSV to prove due diligence if an AI hallucination causes a class-action lawsuit."*

---

## 4. Handling Common Objections

Interns must memorize these rebuttals:

**Objection:** *"Why don't we just use ChatGPT directly to test it ourselves?"*
**Rebuttal:** *"You could, but doing it manually doesn't scale and gives you no historical baseline. AUM Context Foundry runs concurrent multi-model evaluations (GPT-4o, Claude, Gemini simultaneously) and produces a reproducible LCRS score that combines semantic distance with factual claim verification. You get a single auditable number you can trend over time — not a one-off subjective assessment."*

> **Important: Do NOT describe LCRS as "scientifically proven," "academically validated," or "mathematically verified."** Describe it as "reproducible," "auditable," and "transparent." The methodology is honest and well-documented but has no peer-reviewed backing. Enterprise legal teams will check this.

**Objection:** *"Is our data safe? You are reading our internal pricing PDFs."*
**Rebuttal:** *"All Context Documents are immediately vectorized and sharded on Google Cloud. We operate on a strict tenant-isolation architecture. Furthermore, organizations on the Enterprise tier use their own SAML SSO to ensure departing employees instantly lose access."*

**Objection:** *"We already pay for an SEO agency."*
**Rebuttal:** *"SEO agencies optimize for Google Blue Links. AUM Context Foundry optimizes for RAG (Retrieval-Augmented Generation) ingestion. We generate the `llms.txt` manifest that AI bots specifically look for when crawling domains."*

---

## 5. Walkthrough: Conducting a Live Demo

If you are asked to demo the product on a Zoom call, follow this exact script:

### Step 1: The Context Upload
Navigate to **Semantic Ingestion**. 
*   **Action:** Click 'New Manifest' and upload a dummy company overview PDF.
*   **Script:** *"First, we teach the platform your absolute Source of Truth. This takes about 3 seconds to vector-encode."*

### Step 2: The Multi-Model Simulation
Navigate to **Co-Intelligence Simulator**.
*   **Action:** Select the "Test Prompts" and hit "Run". Let the radar charts load.
*   **Script:** *"We just asked GPT-4o, Claude 3.5, and Gemini the same exact question simultaneously. As you can see, Claude scored an 85% LCRS match, but Gemini hallucinated a feature in red. This is your blind spot."*

### Step 3: The Enterprise Upsell
Navigate to **Settings -> Team & Security**.
*   **Action:** Show them the SSO configuration and Role-Based Access Control list.
*   **Script:** *"As you scale this across your organization, your IT team can lock it down behind your corporate SSO and manage billing atomically across teams."*

---

## 6. Closing the Lead & Next Steps

1. Always define the Next Step on the call: *"Would you like us to provision a 14-day Explorer tier for you today to test this on 5 prompts?"*
2. If they say yes, send them the specific registration URL for your staging/production environment.
3. If they are Enterprise, send them the `AUM_Context_Foundry_Admin_Runbook.md` so their IT team can review our SSO and Security architecture prior to signing the contract.

*End of Document Suite.*
