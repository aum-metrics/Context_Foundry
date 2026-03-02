# AUM Context Foundry — Frequently Asked Questions

---

## Product & Technology

**Q: What exactly is AUM Context Foundry?**
AUM is an infrastructure platform that measures and improves how AI models (ChatGPT, Claude, Perplexity) represent your brand. It answers: *"When someone asks an AI about your product, does the AI answer correctly?"* — and gives you the math to prove it.

**Q: What is LCRS?**
LCRS (Low-Latency Claim-based Reliability Scoring) is AUM's proprietary scoring methodology. It evaluates AI responses on a 0–100 scale:
- **60% Factual Accuracy**: Verified claims against your uploaded ground-truth documents.
- **40% Semantic Fidelity**: Cosine similarity between AI response embedding and your brand's verified knowledge base.

**Q: Which AI models does AUM test?**
GPT-4o (OpenAI), Claude 3.5 Sonnet (Anthropic), and Gemini 2.0 Flash (Google). All three are evaluated simultaneously for each simulation.

**Q: What is a "Context Information Model" (CIM)?**
The CIM is the mathematical representation of your brand's verified knowledge base. It's built from documents you upload — PDFs, product specs, FAQs, etc. — and stored as vector embeddings. All simulations test AI responses against this model.

**Q: What is the `/llms.txt` manifesto?**
A machine-readable file served at your organization's URL that tells AI crawlers (SearchGPT, Perplexity) exactly who you are and what you stand for. AUM generates and hosts this automatically from your CIM.

---

## Privacy & Data Security

**Q: Do you store my documents?**
**No.** Documents are processed entirely in volatile memory using our Zero-Retention pipeline. The raw file is deleted immediately after processing. Only the mathematical embeddings are persisted — never the original text.

**Q: Where is my data stored?**
Vector embeddings and organization metadata are stored in Google Firestore (regional, encrypted at rest). No raw documents or PII from documents is stored.

**Q: Is AUM SOC2 compliant?**
AUM maintains an append-only SOC2 audit trail of all sensitive operations (ingestion, API key events, member changes) in Firestore. Organizations on Growth+ plans can query their audit logs via the API.

**Q: Who can access my organization's data?**
Only members of your organization (verified by Firestore user lookup). Backend uses `verify_user_org_access()` on every org-scoped endpoint — fail-closed on any database error.

---

## Setup & Onboarding

**Q: Do I need to provide my own OpenAI/Anthropic/Gemini API keys?**
No. AUM provides platform-managed inference keys for all plans. You start running simulations immediately after sign-up with zero configuration. Enterprise customers can optionally bring their own keys (BYOK) for isolated billing.

**Q: How do I get started?**
1. Sign up at [[YOUR_FRONTEND_URL]]([YOUR_FRONTEND_URL]).
2. Upload a PDF document (product spec, FAQ, data sheet).
3. Run your first simulation by typing a customer question.
4. Read your LCRS score for each AI model.

No developer setup, no API keys required.

**Q: How long does provisioning take?**
Instant. Your organization, user record, and B2B API key are created in a single transaction as soon as you verify your email.

---

## Plans & Billing

**Q: What's included in the Explorer plan?**
- 1 seat
- 3 simulations per month
- 1 document upload
- Agent Manifesto (`/llms.txt`)
- Free forever

**Q: What's the difference between Growth and Scale plans?**

| Feature | Growth | Scale |
|---------|--------|-------|
| Seats | 5 | 25 |
| Simulations/mo | 100 | 500 |
| Batch Stability Check | ✓ | ✓ |
| Priority Support | ✓ | ✓ |
| Enterprise SSO | — | ✓ |

**Q: What payment methods are accepted?**
All major credit/debit cards, UPI, and Net Banking via Razorpay.

**Q: What happens when I hit my simulation limit?**
You'll see a "Limit Reached" message in the simulator. You can upgrade immediately to continue. Your data is never deleted.

**Q: Can I get a refund?**
Yes, within 7 days of purchase. Contact [your-support-email].

---

## API & Developer Access

**Q: Can I access AUM programmatically?**
Yes. Every account comes with a `aum_...` B2B API key. Use it to:
- Run simulations directly from your code.
- Integrate LCRS scoring into your CI/CD pipeline.
- Build custom dashboards.

See the [B2B API section in the User Guide](./User_Guide.md).

**Q: What rate limits apply to the API?**
- 5 requests/second per IP (configurable in enterprise agreements).
- Per-org simulation quotas enforced same as dashboard usage.

**Q: Is the API versioned?**
Yes. The public B2B API is at `/v1/run`. Internal dashboard APIs are at `/api/*`.

---

## Enterprise

**Q: Does AUM support SSO?**
Yes. Enterprise plans support Okta, Azure Active Directory, and Google Workspace SSO.

**Q: Can we deploy AUM on-premise?**
Yes, for enterprise agreements. The backend is fully containerized (Docker). Contact [your-enterprise-email].

**Q: Is there a white-label option?**
Contact [your-enterprise-email] for OEM and white-label licensing.

---

*AUM Data Labs — FAQ v4.1.0*
