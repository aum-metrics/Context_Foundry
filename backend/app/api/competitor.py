"""
Author: "Sambath Kumar Natarajan"
Date: "02-Mar-2026"
Org: "Start-up/AUM Data Labs"
Product: "Context Foundry"
Description: Competitor Displacement Monitoring Engine.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict
from pydantic import BaseModel
from core.security import get_current_user
from core.firebase_config import db
import random

router = APIRouter()

class CompetitorProfile(BaseModel):
    name: str
    displacementRate: float
    strengths: List[str]
    weaknesses: List[str]

@router.get("/displacement/{org_id}", response_model=List[CompetitorProfile])
async def get_competitor_displacement(org_id: str, current_user: dict = Depends(get_current_user)):
    """
    Calculates how often competitors are cited in place of the tenant's brand.
    In a real production environment, this would pull from actual simulation results in scoringHistory.
    """
    # Simulate extraction from historic scoring history
    competitors = [
        {"name": "Competitor Alpha", "displacementRate": 12.4, "strengths": ["Pricing", "API Docs"], "weaknesses": ["Security Claims"]},
        {"name": "Competitor Beta", "displacementRate": 8.2, "strengths": ["Market Presence"], "weaknesses": ["Technical Accuracy"]},
        {"name": "Competitor Gamma", "displacementRate": 4.1, "strengths": ["Legacy Reputation"], "weaknesses": ["Agentic Readiness"]}
    ]
    
    # Random variance for demo fidelity
    for comp in competitors:
        comp["displacementRate"] = round(comp["displacementRate"] + random.uniform(-1, 1), 1)
        
    return competitors
