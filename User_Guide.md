# AUM Context Foundry — User Guide
**v5.1.0 | March 2026**

---

## Welcome to AUM Context Foundry

AUM Context Foundry answers a critical question every brand now faces:
**"When someone asks an AI about your product, does the AI answer correctly?"**

This guide covers everything you need to get started — from uploading your first document to reading your simulation results.

---

## 1. Getting Started

### 1.1 Creating Your Account
1. Go to [aumcontextfoundry.com](https://aumcontextfoundry.com).
2. Click **Sign Up** and use your business email.
3. Verify your email address.
4. Your workspace is automatically created — **no credit card required** to start on the Explorer plan.

### 1.2 Your Workspace
When you first log in, AUM automatically:
- Creates an **Organization** for your company.
- Provisions a **B2B API Key** for direct API access.
- Sets you up on the **Explorer plan** (3 simulations/month, free).
- Supports **Enterprise** scale out with priority support.

You'll be taken straight to the Dashboard.

---

## 2. Setting Up Your Context (Ingestion)

> **What is a Context Information Model (CIM)?**
> It's the mathematical "ground truth" AUM uses to evaluate AI responses. Think of it as your brand's verified knowledge base — the source all AI answers should match.

### 2.1 Uploading Your First Document
1. Navigate to **Semantic Ingestion** in the sidebar.
2. Click **Upload Document** and select a PDF.
   - Accepted files: PDFs (< 10MB).
   - Example documents: Product specs, FAQs, company overviews, technical data sheets.
3. Click **Process Document**.
4. AUM processes your document entirely in-memory (zero-retention) and builds your CIM.
5. You'll see a success confirmation when embedding is complete.

> **Explorer Plan**: You can upload 1 document. Upgrade to Growth or Scale for unlimited documents.

### 2.2 What Happens to My Document?
- The raw PDF is **never stored**. It is processed in volatile memory and immediately purged.
- Only the mathematical embeddings and structured JSON-LD schema are persisted.
- This is AUM's Zero-Retention guarantee — compliance-friendly for regulated industries.

---

## 3. Running Your First Simulation

### 3.1 The Co-Intelligence Simulator

1. Navigate to **Co-Intelligence Simulator** in the sidebar.
2. Enter a question a customer might ask an AI about your brand:
   - Example: *"What is Acme Corp's data retention policy?"*
   - Example: *"Does TechBrand support integration with Salesforce?"*
3. Click **Run Simulation**.

### 3.2 Reading Your Results

AUM runs your question through **GPT-4o, Claude 3.5, and Gemini 2.0** simultaneously and scores each response:

```
LCRS Score = (60% × Factual Accuracy) + (40% × Semantic Alignment)
```

| Score Range | Grade | What It Means |
|-------------|-------|---------------|
| 85–100 | 🟢 High Fidelity | AI is accurately representing your brand |
| 60–84 | 🟡 Minor Drift | Some narrative deviation — worth monitoring |
| 0–59 | 🔴 Critical Drift | AI is actively misrepresenting your brand |

**Per-Model Breakdown**: See which AI model represents you best (and which is the worst offender).

**Claim Analysis**: See exactly which factual claims each model got right or wrong.

> **Explorer Plan**: 3 simulations per month. Upgrade for more.

---

## 4. The SoM (Share of Mind) Command Center

Access via **SoM Command Center** in the sidebar. This is your proactive monitoring dashboard.

### 4.1 Batch Stability Check
Runs your key customer questions across all three AI models in one click. Identifies which questions produce inconsistent answers across AI models. (Growth/Scale plans only.)

### 4.2 SEO & LLM Audit
Analyzes your website for:
- JSON-LD structured data completeness.
- LLM-readability of your key pages.
- Core Web Vitals (Lighthouse score).

> This is an async process — results appear within 30–60 seconds.

### 4.3 Competitor Displacement Analysis
Answers: *"Is AI recommending my competitors instead of me?"*
Shows displacement rate and competitive positioning across AI models.

---

## 5. The Agent Manifest (`/llms.txt`)

Every AUM account gets a dynamic **Agent Manifesto** — a machine-readable file at:
```
https://aumcontextfoundry.com/llms.txt?orgId=your_org_id
```

This is automatically indexed by AI crawlers (SearchGPT, Perplexity, Claude). It tells them:
- Who you are.
- What you offer.
- Your canonical ground-truth URLs.

No configuration needed — it updates automatically as you update your CIM.

You can also view and copy your manifesto from the **Agent Manifest** page in the dashboard.

---

## 6. Managing Your Team

Navigate to **Settings → Team** to:
- Invite team members by email.
- Set roles: **Admin** (full access) or **Member** (read + simulate).
- View active seats.

> **Seat Limits**: Explorer: 1 seat. Growth: 5 seats. Scale: 25 seats. Enterprise: Unlimited.

### 6.1 Accepting an Invitation
1. Check your email for an invitation from AUM Context Foundry.
2. Click the **Join Organization** link.
3. Sign in or create an account to activate your seat.
4. Your name will now appear as "Seat Active" in the team directory.

### 6.2 Enterprise SSO
Organizations on the **Scale** plan can configure Single Sign-On (Okta, Azure AD, Google) via **Settings → Enterprise SSO**.
1. Select your provider.
2. Enter your Domain, Client ID, and Client Secret.
3. Click **Configure SSO**.
4. Once active, your team can sign in via your company's IdP using the centralized callback flow.

---

## 7. API Access (Developer Mode)

Your **B2B API Key** (format: `aum_...`) is shown on the **API Keys** page. Use it to:

### Run a Simulation via API
```bash
curl -X POST https://api.aumcontextfoundry.com/v1/run \
  -H "Authorization: Bearer aum_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "your_org_id",
    "prompt": "What is your data retention policy?",
    "manifestVersion": "latest"
  }'
```

### Response
```json
{
  "results": [
    {
      "model": "gpt-4o",
      "response": "...",
      "lcrsScore": 91.5,
      "grade": "high_fidelity",
      "claimsSupported": 4,
      "claimsTotal": 4
    }
    ...
  ],
  "lowestScore": 74.2,
  "highestScore": 91.5
}
```

---

## 8. Upgrading Your Plan

1. Go to **Settings → Billing**.
2. Choose **Growth** (5 seats, 100 sims/mo) or **Scale** (25 seats, 500 sims/mo).
3. Complete checkout via Razorpay (cards, UPI, Net Banking accepted).
4. Your plan upgrades instantly after payment confirmation.

---

## 9. Frequently Asked Questions

See `FAQ.md` for a full list. Quick answers:

**Q: Do you store my documents?**
A: No. Raw documents are processed in memory and immediately purged. Mathematical embeddings (the CIM) are stored for 24 hours and then automatically deleted via platform-wide TTL.

**Q: Which AI models are tested?**
A: GPT-4o (OpenAI), Claude 3.5 Sonnet (Anthropic), Gemini 2.0 Flash (Google).

**Q: Do I need to provide my own API keys?**
A: No. AUM provides platform-managed inference keys for all plans.

**Q: What happens when I hit my simulation limit?**
A: You'll see a clear "Limit Reached" message. You can upgrade immediately to continue.

---

*AUM Context Foundry — User Guide v5.1.0*
