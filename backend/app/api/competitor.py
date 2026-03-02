"""
Author: "Sambath Kumar Natarajan"
Date: "02-Mar-2026"
Org: "Start-up/AUM Data Labs"
Product: "Context Foundry"
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
        except Exception as e:
            logger.error(f"Failed to fetch org data: {e}")

    if not api_key:
        if is_dev:
            return {"competitors": [
                {"name": "Competitor Alpha (Simulated)", "displacementRate": 12.4, "strengths": ["Pricing", "API Docs"], "weaknesses": ["Security Claims"]},
                {"name": "Competitor Beta (Simulated)", "displacementRate": 8.2, "strengths": ["Market Presence"], "weaknesses": ["Technical Accuracy"]},
                {"name": "Competitor Gamma (Simulated)", "displacementRate": 4.1, "strengths": ["Legacy Reputation"], "weaknesses": ["Agentic Readiness"]}
            ]}
        raise HTTPException(status_code=402, detail="OpenAI API key missing for this organization")
        
    try:
        client = OpenAI(api_key=api_key)
        prompt = f"""You are analyzing AI recommendation engines (like ChatGPT and Perplexity).
What are the top 3 competitors to '{org_name}' that an AI would likely recommend instead? If '{org_name}' is generic, use general SaaS competitors.
Provide a JSON response with a 'competitors' array. Each item MUST have:
- 'name': competitor name
- 'displacementRate': estimated percentage (0.0 to 15.0) of times they are recommended over {org_name}
- 'strengths': array of 1-2 words explaining their advantage (e.g. ['Pricing', 'API'])
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
        return {"competitors": [
            {"name": "Generation Failed", "displacementRate": 0.0, "strengths": ["API Error"], "weaknesses": [str(e)[:15]]}
        ]}
