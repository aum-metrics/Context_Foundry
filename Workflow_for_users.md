# AUM Context Foundry: User Workflow Guidelines

This document outlines the standard operational workflows for a user navigating the AUM Context Foundry platform.

## Workflow 1: Initial Onboarding & Brand Anchor Setup
**Goal:** Establish the verified "Ground Truth" for your organization.
1. **Log In:** Access the platform using corporate credentials. You are automatically routed to your isolated Organizational tenant.
2. **Navigate to Ingestion:** Click on the "Semantic Ingestion" tab in the left-hand navigation.
3. **Upload Assets:** Drag and drop your most accurate, up-to-date corporate documents (e.g., Product Specifications, Corporate Fact Sheets, Pricing Matrices in PDF format).
4. **Processing:** The system will process these files through the Zero-Retention pipeline. 
5. **Verification:** Check the "Manifest State" panel. Once it reads "Active", your Context Information Model (CIM) is live and ready to anchor simulations.

## Workflow 2: Running a Competitive Fidelity Simulation
**Goal:** Audit how frontier AI models currently perceive your brand versus a competitor.
1. **Navigate to Simulator:** Click on the "Co-Intelligence Simulator" tab.
2. **Draft a Prompt:** Enter a query a potential customer might ask an AI (e.g., *"Compare [Our Brand] vs [Competitor] for enterprise security features."*).
3. **Execute Audit:** Click "Run Tri-Model Audit".
4. **Review Adjudication:** The system will dispatch the prompt to GPT, Claude, and Gemini. 
5. **Analyze LCRS Score:** 
   - Wait for the Master Adjudicator to return the final Latent Contextual Rigor Score (LCRS).
   - Review the specific atomic claims extracted by the engine to identify exactly where the AI hallucinated or drifted from your Ground Truth.

## Workflow 3: Dashboard Monitoring & Batch Analysis
**Goal:** Review historical trends and team-wide AI audit metrics.
1. **Navigate to Command Center:** Click on the "SoM Command Center" tab.
2. **Review ASoV:** Check the Agentic Share of Voice (ASoV) radar chart to see aggregated model bias over the last 7 days.
3. **Review Error Logs:** Identify recurring "Factual Drift" patterns in the historical charts.
4. **Batch Execution (Scale Tier):** If on the Scale tier, submit a CSV of top customer queries to the Batch Analysis engine to run bulk LCRS audits overnight. The UI will clearly display error states if any simulation fails.

## Workflow 4: Remediation via Identity Routing
**Goal:** Deploy corrected data to the Agentic Web to fix hallucinations.
1. **Navigate to Agent Manifest:** Click on the "Agent Manifest (/llms.txt)" tab.
2. **Review JSON-LD:** Inspect the synthesized schema representing your brand.
3. **Deploy to Edge:** Copy the provided `https://[your-brand].com/llms.txt` deployment snippet.
4. **Implementation:** Provide this snippet to your IT/Web team to place at the root of your corporate domain.
5. **Monitor:** Run Workflow 2 again in 7 days to verify that crawlers have ingested the new manifesto and corrected their outputs.

## Workflow 5: Reporting & Team Management
**Goal:** Export audit proofs for leadership and manage platform access.
1. **Generate Certificate:** From the Simulator or Dashboard, click "Generate Brand Health Certificate" to export a tamper-evident PNG of your current LCRS standing.
2. **Manage Seats (Admin Only):** Click on settings. Depending on your tier (Explorer, Growth, Scale), you can invite additional team members.
3. **Manage Upgrades:** If you hit your monthly simulation limit, gracefully upgrade your subscription tier via the integrated Razorpay secure checkout flow to unlock higher Firestore Token Bucket limits.
