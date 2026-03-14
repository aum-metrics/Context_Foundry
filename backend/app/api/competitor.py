"""
Author: "Sambath Kumar Natarajan"
Date: "02-Mar-2026"
Org: "Start-up/AUM Context Foundry"
Product: "AUM Context Foundry"
Description: Live Competitor Displacement Monitoring Engine.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict
from pydantic import BaseModel
from core.security import get_auth_context, verify_user_org_access
from core.firebase_config import db
from openai import OpenAI
import os
import json
import logging
from core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

class CompetitorProfile(BaseModel):
    name: str
    displacementRate: float
    strengths: List[str]
    weaknesses: List[str]
    winningCategory: str = ""
    claimsOwned: List[str] = []
    missingAssertions: List[str] = []

class CompetitorResponse(BaseModel):
    competitors: List[CompetitorProfile]

@router.get("/displacement/{org_id}", response_model=CompetitorResponse)
async def get_competitor_displacement(org_id: str, version: str = Query("latest"), auth: dict = Depends(get_auth_context)):
    """
    Live Agentic Competitor Analysis:
    Runs a parallel LLM simulation to determine which competitors are most likely 
    to be recommended by AI over the tenant's brand.
    """
    # Security Check
    if auth.get("type") == "session":
        if not verify_user_org_access(auth["uid"], org_id):
            raise HTTPException(status_code=403, detail="Unauthorized access to this organization")
    else:
        if auth.get("orgId") != org_id:
            raise HTTPException(status_code=403, detail="API key is not authorized for this organization")

    # 🛡️ DEMO MOCKING (P0): Deterministic competitor metrics for Sight Spectrum
    if org_id == "demo_org_id" and settings.ENV == "development" and getattr(settings, "ALLOW_MOCK_AUTH", False):
        return {
            "competitors": [
                {
                    "name": "Accenture AI",
                    "displacementRate": 14.5,
                    "strengths": ["Scale", "Brand"],
                    "weaknesses": ["Precision", "Niche Focus"],
                    "winningCategory": "Enterprise transformation",
                    "buyerQueries": ["Who leads enterprise AI transformation?", "Top Fortune 500 analytics partners"],
                    "claimsOwned": ["global delivery scale", "board-level transformation credibility"],
                    "missingAssertions": [
                        {"assertion": "Fortune 500 transformation proof", "gapConfidence": 88, "somImpact": 12},
                        {"assertion": "enterprise operating model depth", "gapConfidence": 74, "somImpact": 8}
                    ]
                },
                {
                    "name": "Tiger Analytics",
                    "displacementRate": 9.2,
                    "strengths": ["Specialized Data", "Delivery"],
                    "weaknesses": ["Agentic Strategy", "Integration"],
                    "winningCategory": "CPG and retail analytics",
                    "buyerQueries": ["Best CPG analytics partner", "Retail data science firms"],
                    "claimsOwned": ["domain expertise in retail and CPG", "analytics delivery depth"],
                    "missingAssertions": [
                        {"assertion": "industry-specific transformation proof", "gapConfidence": 81, "somImpact": 9},
                        {"assertion": "partner ecosystem strength", "gapConfidence": 65, "somImpact": 6}
                    ]
                },
                {
                    "name": "Mu Sigma",
                    "displacementRate": 7.4,
                    "strengths": ["Data Science", "Cost"],
                    "weaknesses": ["Product Fidelity", "Innovation"],
                    "winningCategory": "Decision science at scale",
                    "buyerQueries": ["Decision intelligence at scale", "Managed analytics services"],
                    "claimsOwned": ["decision sciences depth", "large-scale analytics operations"],
                    "missingAssertions": [
                        {"assertion": "decision intelligence narrative", "gapConfidence": 72, "somImpact": 7},
                        {"assertion": "scalable managed-services language", "gapConfidence": 69, "somImpact": 5}
                    ]
                }
            ]
        }

    org_name = "the company"
    api_key = None
    is_dev = os.getenv("ENV") == "development"
    
    if is_dev:
        api_key = os.getenv("OPENAI_API_KEY")

    if db:
        try:
            org_doc = db.collection("organizations").document(org_id).get()
            if org_doc.exists:
                org_data = org_doc.to_dict() or {}
                org_name = org_data.get("name", "Unknown Company")
                api_key = org_data.get("apiKeys", {}).get("openai", api_key)
                # 🛡️ SECURITY HARDENING: Redact apiKeys from org_data (consistent with simulation.py)
                org_data.pop("apiKeys", None)
        except Exception as e:
            logger.error(f"Failed to fetch org data: {e}")

    # Resolve platform-managed sentinel to environment key
    if api_key == "internal_platform_managed":
        api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        if is_dev:
            # No manifest yet — return empty rather than fake data
            return {"competitors": []}
        raise HTTPException(status_code=402, detail="OpenAI API key missing for this organization")

    # --- FETCH MANIFEST FOR CONTEXT GROUNDING ---
    manifest_content = ""
    if db:
        try:
            manifest_doc = db.collection("organizations").document(org_id) \
                          .collection("manifests") \
                          .document(version).get()
            if manifest_doc.exists:
                doc_data = manifest_doc.to_dict() or {}
                # Use the llms.txt markdown content as the grounding context
                manifest_content = doc_data.get("content", "")
                manifest_name = ((doc_data.get("schemaData") or {}).get("name") or "").strip()
                if manifest_name:
                    org_name = manifest_name
                if not manifest_content:
                    # Fallback: serialize schemaData
                    schema = doc_data.get("schemaData", {})
                    if schema:
                        manifest_content = json.dumps(schema)
        except Exception as e:
            logger.warning(f"Could not fetch manifest for competitor context: {e}")

    # If no manifest has been uploaded yet, return empty — don't hallucinate
    if not manifest_content:
        return {"competitors": []}
        
    try:
        client = OpenAI(api_key=api_key)
        prompt = f"""You are a B2B enterprise AI visibility analyst. A company called '{org_name}' wants to understand why AI recommendation engines shortlist competitors instead of them.

Here is '{org_name}'s actual business context:

<Context>
{manifest_content[:4000]}
</Context>

Identify the top 3 real competitors that AI models are most likely to recommend INSTEAD of '{org_name}' for the same buyer intent.
Only name companies that genuinely operate in the same space as shown by the context.
Do NOT invent placeholders.

For each competitor, return a JSON object with:
- 'name': competitor company name
- 'displacementRate': float 0.0-25.0 — how often they are recommended over {org_name}
- 'strengths': array of 1-2 words (their AI-perceived advantage)
- 'weaknesses': array of 1-2 words (their AI-perceived weakness)
- 'winningCategory': the buyer-intent theme where they consistently outrank {org_name}
- 'buyerQueries': array of 2 example buyer questions this competitor is winning on
- 'claimsOwned': array of 2 short proof points AI associates with this competitor
- 'missingAssertions': array of 2 objects, each with:
    - 'assertion': short string — what {org_name} is NOT saying clearly that this competitor IS saying
    - 'gapConfidence': integer 0-100 — how confident the model is that this is a real positioning gap (based on context)
    - 'somImpact': integer 1-20 — estimated SoM percentage points {org_name} could gain by closing this gap

Return ONLY valid JSON: {{"competitors": [...]}}"""

        completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            temperature=0.2
        )
        
        result = json.loads(completion.choices[0].message.content)
        competitors = result.get("competitors", [])
        return {"competitors": competitors[:3]}
        
    except Exception as e:
        logger.error(f"Competitor displacement generation failed: {e}")
        return {"competitors": []}
