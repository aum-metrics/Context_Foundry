# AUM Context Foundry — Workflow Guide
**Step-by-step user workflows**
**v4.1.0 | March 2026**

---

## Workflow 1: First-Time Setup (New Organization)

**Who**: First user at a company, signing up for the first time.
**Result**: Organization provisioned, first simulation ready to run.

```
1. Navigate to [YOUR_FRONTEND_URL]
2. Click "Sign Up" → Enter business email + password
3. Verify email (check inbox)
4. First login triggers auto-provisioning:
   - Organization created
   - B2B API key generated
   - Explorer plan active
5. Land on Dashboard ✓
```

**Expected time**: < 60 seconds from sign-up to first dashboard view.

---

## Workflow 2: Uploading Your First Document (Building the CIM)

**Who**: Admin or Member.
**Result**: Brand's ground truth indexed and ready for simulation.

```
1. Navigate to "Semantic Ingestion" in the sidebar
2. Click "Upload Document"
3. Select a PDF (< 10MB)
   Good candidates: Product spec, FAQ, Company overview, Data sheet
4. Click "Process Document"
5. Wait 15–45 seconds for processing
6. See success confirmation: "CIM Updated — Version 1.0.0"
```

**What happens behind the scenes**:
- PDF read into memory → extracted → chunked → embedded → JSON-LD synthesized → written to Firestore → raw file deleted.
- Your `/llms.txt` manifesto is automatically updated.

**Explorer Plan**: 1 document maximum. Upgrade for unlimited.

---

## Workflow 3: Running a Simulation

**Who**: Admin or Member.
**Prerequisites**: At least one document ingested (CIM built).
**Result**: LCRS scores for GPT-4o, Claude 3.5, Gemini 2.0 on your question.

```
1. Navigate to "Co-Intelligence Simulator"
2. Enter a customer question in the prompt box
   Example: "What is Acme Corp's return policy?"
   Example: "Does TechCo integrate with Salesforce?"
3. Click "Run Simulation"
4. Wait 8–15 seconds for tri-model evaluation
5. Review results:
   ├── LCRS Score per model (0–100)
   ├── Grade: High Fidelity / Minor Drift / Critical Drift
   ├── Per-model response text
   └── Which claims were supported vs. hallucinated
```

**If you see a 402 error**: You've hit your simulation limit. Upgrade your plan.
**If you see a 503 error**: API keys are being provisioned. Wait 30 seconds and retry.

---

## Workflow 4: Viewing & Sharing Your Agent Manifesto

**Who**: Admin or Member.
**Result**: Live `/llms.txt` URL ready to share with AI crawlers and partners.

```
1. Navigate to "Agent Manifest" in the sidebar
2. View the auto-generated manifesto content
3. Copy the shareable URL:
   [YOUR_FRONTEND_URL]/llms.txt?orgId=your_org_id
4. (Optional) Submit to AI crawler indexing services
```

Your manifesto updates automatically whenever you upload a new document.

---

## Workflow 5: Inviting Team Members

**Who**: Admin only.
**Result**: New member added to organization, seat count updated.

```
1. Navigate to "Settings → Team"
2. View current member list
3. Enter colleague's email in the invite field
4. Click "Send Invite"
5. Member receives email (or you share the signup link)
6. When they sign up, they are linked to your organization
```

**Seat Limits**: Explorer: 1 • Growth: 5 • Scale: 25

---

## Workflow 6: Running a Batch Stability Check

**Who**: Admin or Member (Growth/Scale plan).
**Result**: Stability report across your top customer questions.

```
1. Navigate to "SoM Command Center"
2. Click "Run Batch Stability Check"
3. Wait for background processing (30–120 seconds)
4. Review batch results:
   ├── Per-question LCRS scores
   ├── Model consistency (which model is most reliable)
   └── Lowest-scoring questions to focus improvement on
```

---

## Workflow 7: Running an SEO & LLM Audit

**Who**: Admin.
**Result**: Audit of your website's AI-crawler readiness.

```
1. Navigate to "SoM Command Center"
2. Click "Run SEO Audit"
3. Wait for async job completion (30–60 seconds)
4. Review results:
   ├── Core Web Vitals
   ├── JSON-LD structured data gaps
   ├── LLM readability score
   └── Recommended improvements
```

---

## Workflow 8: B2B API Integration

**Who**: Developer.
**Result**: LCRS scoring integrated into your own system.

```
1. Navigate to "Settings → API Keys"
2. Copy your aum_... key (shown once at provision time; regenerate if lost)
3. Make API calls:

   POST [YOUR_BACKEND_URL]/v1/run
   Authorization: Bearer aum_your_key
   Content-Type: application/json

   {
     "orgId": "your_org_id",
     "prompt": "Customer question here",
     "manifestVersion": "latest"
   }

4. Parse the response:
   {
     "results": [
       { "model": "gpt-4o", "lcrsScore": 92.1, "grade": "high_fidelity" },
       { "model": "claude-3-5-sonnet", "lcrsScore": 78.3, "grade": "minor_drift" },
       { "model": "gemini-2-0-flash", "lcrsScore": 65.7, "grade": "minor_drift" }
     ]
   }
```

---

## Workflow 9: Upgrading Your Plan

**Who**: Admin.
**Result**: Plan upgraded, additional simulations and seats unlocked.

```
1. Navigate to "Settings → Billing"
2. Click "Upgrade Plan"
3. Select Growth or Scale
4. Enter payment details (Razorpay — card / UPI / Net Banking)
5. Confirm payment
6. Plan upgrades instantly — no restart needed
```

---

## Workflow 10: Revoking an API Key

**Who**: Admin.
**Result**: Old API key deactivated, breach risk eliminated.

```
1. Navigate to "Settings → API Keys"
2. Find the key to revoke
3. Click "Revoke Key"
4. Key is immediately deactivated
5. Generate a new key if needed
```

All revocations are logged in the SOC2 audit trail.

---

*AUM Data Labs — Workflow Guide v4.1.0*
