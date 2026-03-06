"""
Author: "Sambath Kumar Natarajan"
Date: "02-Mar-2026"
Org: "Start-up/AUM Context Foundry"
Product: "AUM Context Foundry"
Description: Live Competitor Displacement Monitoring Engine.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict
from pydantic import BaseModel
from core.security import get_auth_context, verify_user_org_access
from core.firebase_config import db
from openai import OpenAI
import os
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class CompetitorProfile(BaseModel):
    name: str
    displacementRate: float
    strengths: List[str]
    weaknesses: List[str]

class CompetitorResponse(BaseModel):
    competitors: List[CompetitorProfile]

@router.get("/displacement/{org_id}", response_model=CompetitorResponse)
async def get_competitor_displacement(org_id: str, auth: dict = Depends(get_auth_context)):
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

    # 🛡️ DEMO MOCKING (P0): Deterministic competitor metrics for Lumina Analytics
    if org_id == "demo_org_id":
        return {
            "competitors": [
                {
                    "name": "Salesforce Data Cloud",
                    "displacementRate": 18.5,
                    "strengths": ["Enterprise Ecosystem", "Reliability"],
                    "weaknesses": ["Context Precision", "Pricing"]
                },
                {
                    "name": "HubSpot Operations Hub",
                    "displacementRate": 12.2,
                    "strengths": ["UX", "Ease of Use"],
                    "weaknesses": ["Scale", "Deep Analytics"]
                },
                {
                    "name": "ZoomInfo",
                    "displacementRate": 8.4,
                    "strengths": ["Database Size"],
                    "weaknesses": ["Agentic Strategy", "Fidelity"]
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
            manifests = db.collection("organizations").document(org_id) \
                          .collection("manifests") \
                          .order_by("createdAt", direction="DESCENDING") \
                          .limit(1).stream()
            latest = next(manifests, None)
            if latest:
                doc_data = latest.to_dict() or {}
                # Use the llms.txt markdown content as the grounding context
                manifest_content = doc_data.get("content", "")
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
        prompt = f"""You are analyzing AI recommendation engines for a company called '{org_name}'.
Based on this company's actual business context:

<Context>
{manifest_content[:4000]}
</Context>

What are the top 3 real, specific competitors that an AI engine would likely 
recommend INSTEAD of '{org_name}' when users ask about this industry?
Only name real companies that operate in the same space as shown by the context above.
Do NOT invent placeholders or use generic AI/SaaS tools unless the company is actually in that space.

Provide a JSON response with a 'competitors' array. Each item MUST have:
- 'name': real competitor company name
- 'displacementRate': estimated percentage (0.0 to 25.0) of times they are recommended over {org_name}
- 'strengths': array of 1-2 words explaining their advantage (e.g. ['Pricing', 'Scale'])
- 'weaknesses': array of 1-2 words explaining their weakness

Return ONLY valid JSON."""

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
