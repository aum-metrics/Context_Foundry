# AUM Context Foundry: Operational User Guide

## 1. Authentication & Workspace Setup
- **Access Control**: Users sign in via Firebase Auth. 
- **Organizational Isolation**: You are strictly confined to your `orgId`. 
- **Seats & Pricing**: 
    - **Explorer**: (1 seat) 3 simulations/mo.
    - **Growth**: (5 seats) 100 simulations/mo.
    - **Scale**: (25 seats) 500 simulations/mo.
- **Invitations**: Admins can invite team members via the "Team Settings" dashboard.

## 2. Ingesting Your Ground Truth
1. Navigate to **"Ingestion Control"**.
2. Upload your authoritative knowledge base (PDF format).
3. **Zero-Retention Processing**: The raw PDF is flushed immediately. What remains is a 1536-dimensional vector representation and a Schema.org JSON-LD extraction.
4. **Manifest State**: The most recent successful ingestion becomes your active "Ground Truth" for all future simulations.

## 3. The Co-Intelligence Simulator (LCRS Analysis)
1. Enter a high-priority customer prompt or search query.
2. Select **"Generate Analysis"**.
3. **Multi-Model Compare**: GPT-4o Mini, Gemini 2.0 Flash, and Claude 3.5 Haiku execute the query concurrently using your Ground Truth as injected context.
4. **Reading the LCRS Score**:
    - **Green (>85%)**: High Fidelity. The AI is accurately citing your truth.
    - **Yellow (55%-85%)**: Drift Alert. The AI is paraphrasing with significant semantic divergence.
    - **Red (<55% or Contradicted)**: Hallucination. The AI has stated a fact that directly contradicts your Ground Truth.

## 4. Share of Model (SoM) Command Center
- **ASoV Radar Chart**: Visualizes brand presence across the agentic engine ecosystem.
- **Historical Fidelity**: Track how model updates (e.g., GPT-4o vs 4o-mini) affect your brand accuracy over time.
- **Competitor Displacement**: Identifies queries where competitors are being cited more frequently than your own ground truth.

## 5. Proactive Remediation (Agent Manifests)
1. Go to **"Identity Router"**.
2. Copy the generated `/llms.txt` configuration.
3. Deploy to your site's root directory (`https://yourdomain.com/llms.txt`).
4. This forces Generative Engines (SearchGPT, Perplexity) to prioritize your verified semantic structure over legacy web scrapes.

## 6. Enterprise Exports
- **Brand Health Certificate**: Download a high-design verifiable report (PNG/PDF) of your current ASoV scores for stakeholders and investors.

---
© 2026 AUM Data Labs.
