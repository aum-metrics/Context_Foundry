# AUM Context Foundry: Operator Guide

This guide covers the core operational workflows for AUM Context Foundry, from brand setup to proactive remediation.

## 1. Onboarding & Enterprise Provisioning
1.  **Automated Setup**: When your organization is created, AUM automatically provisions, encrypts, and assigns dedicated API keys (OpenAI, Anthropic, Gemini) to your workspace.
2.  **No BYOK Required**: You do not need to bring your own keys. This zero-friction setup ensures you can immediately use the Simulator while AUM isolates infrastructure inference costs for granular billing transparency.
 
## 2. Ground Truth Setup (Ingestion)
1.  Navigate to the **Ingestion Control** panel.
2.  Upload your authoritative source documents (PDF format).
3.  **Security Note**: Your files are processed in real-time and deleted from memory. Only the semantic vectors persist.
4.  Once ingestion is complete, your **Manifest State** is updated. This becomes the "Truth" anchor for all AI evaluations.

## 3. Running Simulations (LCRS Audit)
1.  Open the **Simulator**.
2.  Input a customer query, prompt, or competitor claim.
3.  The system will execute a tri-model audit (GPT, Gemini, Claude) using your automatically provisioned sandbox keys.
4.  **Interpreting the Score**:
    *   **90-100% (High)**: Accurate citation. SAFE.
    *   **60-90% (Low)**: Semantic Drift. The AI is paraphrasing inaccurately. CAUTION.
    *   **<60% (Hallucination)**: Factual contradiction. HIGH RISK.

## 4. Brand Monitoring (Command Center)
-   **ASoV Radar**: Track your "Agentic Share of Voice" across different models.
-   **Historical Fidelity**: Monitor how model updates (e.g., GPT 4.0 to 4.5) affect your brand consistency.
-   **Competitor Displacement**: Identify queries where AI agents favor competitor truth over yours.

## 5. Remediation (Identity Router)
1.  Go to the **Identity Router** tab.
2.  Your dynamic `/llms.txt` manifesto is automatically updated based on your last ingestion.
3.  Copy the URL or download the configuration and deploy it to your root domain (`yourbrand.com/llms.txt`).
4.  This signals to crawlers (SearchGPT, Perplexity) that your verified ground truth must take precedence over scraped data.

## 6. Stakeholder Reporting
-   **Brand Health Certificate**: Generate a tamper-evident PNG/PDF report of your current fidelity scores directly from the dashboard for board-level reporting.

## 7. Admin & Team Management
-   **Seat Management**: Invite team members based on your tier (Explorer/Growth/Scale).
-   **Billing Transparency**: View your aggregated simulation limits, active seats, and transparent infrastructure usage metrics natively in the Admin Dashboard.

---
© 2026 AUM Data Labs.
