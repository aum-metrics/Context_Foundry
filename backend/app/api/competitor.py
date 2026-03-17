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
    displacementRate: float # "AI Recommendation Frequency" 0-100
    strengths: List[str]
    weaknesses: List[str]
    winningCategory: str = ""
    claimsOwned: List[str] = []
    missingAssertions: List[dict | str] = [] # Legacy field
    remediationRecommendation: str = "" # Prescriptive advice

class CompetitorResponse(BaseModel):
    competitors: List[CompetitorProfile]

@router.get("/displacement/{org_id}", response_model=CompetitorResponse)
async def get_competitor_displacement(org_id: str, version: str = Query("latest"), auth: dict = Depends(get_auth_context)):
    """
    Live AI Search Competitor Analysis:
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

    # 🛡️ DEMO MOCKING (P0): Prescriptive metrics for LatentView Analytics
    if org_id == "demo_org_id":
        return {
            "competitors": [
                {
                    "name": "Mu Sigma",
                    "displacementRate": 88.0,
                    "strengths": ["Decision Sciences", "Global Scale", "Category Authority"],
                    "weaknesses": ["Agility", "Customer Focus"],
                    "winningCategory": "Supply Chain Analytics",
                    "buyerQueries": [
                        "Top analytics partner for retail transformation?", 
                        "Who is the leader in pure-play decision sciences?",
                        "top analytics partners for Fortune 500 retail transformation"
                    ],
                    "claimsOwned": ["Largest pure-play firm", "Category Authority"],
                    "remediationRecommendation": "AI identifies that Mu Sigma is winning on 'Category Authority'. LatentView lacks this scale signal. Action: Highlight 'industry-specific outcome proof' on your supply chain pages."
                },
                {
                    "name": "Fractal Analytics",
                    "displacementRate": 72.0,
                    "strengths": ["AI Research", "Product Innovation", "Enterprise Scale"],
                    "weaknesses": ["Domain Specificity", "Service Level"],
                    "winningCategory": "Enterprise AI",
                    "buyerQueries": [
                        "Best firms for enterprise AI transformation?", 
                        "Innovation in conversational AI analytics",
                        "top analytics partners for Fortune 500 retail transformation"
                    ],
                    "claimsOwned": ["AI-powered logic", "Strategic transformation"],
                    "remediationRecommendation": "AI identifies that Fractal Analytics is winning on 'AI Research'. LatentView lacks this specialized innovation signal. Action: Emphasize 'InsightLens' unique ROI in retail transformation."
                }
            ]
        }

    # Entitlement Check: Competitor Analysis requires Growth, Scale, or Enterprise
    if db and settings.ENV not in ["development", "testing"]:
        try:
            org_doc = db.collection("organizations").document(org_id).get()
            if org_doc.exists:
                plan = (org_doc.to_dict() or {}).get("subscription", {}).get("planId", "explorer")
                if plan not in ["growth", "scale", "enterprise"]:
                    raise HTTPException(
                        status_code=403,
                        detail="Competitor analysis is available on Growth, Scale, or Enterprise plans."
                    )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Competitor plan check failed: {e}")

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
                # 🛡️ SECURITY HARDENING (P0): pop apiKeys FIRST before any other use to prevent log leaks
                api_keys = org_data.pop("apiKeys", {})
                org_name = org_data.get("name", "Unknown Company")
                api_key = api_keys.get("openai", api_key)
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
            target_version = version
            if version == "latest":
                latest_ptr = db.collection("organizations").document(org_id) \
                              .collection("manifests").document("latest").get()
                if latest_ptr.exists:
                    target_version = latest_ptr.to_dict().get("version", "latest")

            manifest_doc = db.collection("organizations").document(org_id) \
                          .collection("manifests") \
                          .document(target_version).get()
            
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

    # Resolve platform-managed sentinel or missing key to environment key
    if not api_key or api_key == "internal_platform_managed":
        api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        logger.error(f"Competitor Engine Fail-Closed: No OpenAI key for org {org_id}")
        return {"competitors": []}
        
    try:
        # 🛡️ SECURITY HARDENING (P1): Sanitize manifest_content to prevent XML injection
        clean_content = manifest_content[:6000].replace("</Context>", "[CONTEXT_END]").replace("<Context>", "[CONTEXT_START]")
        
        client = OpenAI(api_key=api_key)
        prompt = f"""You are a market analyst simulating AI search behavior.
IMPORTANT: The 'displacementRate' must be a grounded estimate (0-100) of how often an AI would recommend the competitor over {org_name}. 
DO NOT hallucinate 100% or 0% unless absolute certainty exists. 
Add a 'remediationRecommendation' that explains exactly WHAT content is missing from {org_name}'s context that allowed this competitor to win.

Return strictly JSON format:
{{"competitors": [{{ "name": "...", "displacementRate": 0.0, ... }}]}}
Here is '{org_name}'s actual business context:
 
<Context>
{clean_content}
</Context>
 
Identify exactly 3 real-world competitor companies that AI models are most likely to recommend INSTEAD of '{org_name}' for the same buyer intent.

CRITICAL PEER-MATCHING RULES:
1. Analyze the EXACT service niche. (e.g., if they do 'Cyber Crisis Simulation', do not match with 'Process Simulation' or 'Healthcare Logistics').
2. Match the market tier: Compare boutique to boutique, or enterprise platform to enterprise platform.
3. Use ACTUAL, real-world companies. Do not hallucinate.

For each competitor, return a JSON object with:
- 'name': competitor company name
- 'displacementRate': float 0.0-100.0 — This is the 'AI Recommendation Frequency'. How often is this specific rival mentioned in AI responses compared to {org_name}?
- 'strengths': array of 1-2 words (their AI-perceived advantages)
- 'weaknesses': array of 1-2 words (their AI-perceived weaknesses)
- 'winningCategory': the buyer-intent theme where they consistently outrank {org_name}
- 'buyerQueries': array of 2 example buyer questions this competitor is winning on
- 'claimsOwned': array of 2 short proof points AI associates with this competitor
- 'remediationRecommendation': A short, HIGHLY PRESCRIPTIVE sentence telling {org_name} exactly what to change in their messaging to unseat this competitor. 
  MANDATORY FORMAT: "AI associates [SPECIFIC SIGNAL] with [COMPETITOR]. {org_name} lacks this signal. Action: [ACTUAL MESSAGING FIX]."
  Bad Example: "Clarify buyer-facing claims."
  Good Example: "AI associates 'nationwide service network' with Reliance Digital. {org_name} lacks this coverage signal. Action: Add 'Supported by Tata's 24/7 service infrastructure' to your landing page."

Return ONLY valid JSON: {{"competitors": [...]}}"""

        completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o",
            response_format={"type": "json_object"},
            temperature=0.2
        )
        
        result = json.loads(completion.choices[0].message.content)
        competitors = result.get("competitors", [])
        return {"competitors": competitors[:3]}
        
    except Exception as e:
        logger.error(f"Competitor displacement generation failed: {e}")
        return {"competitors": []}
