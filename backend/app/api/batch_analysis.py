"""
Author: "Sambath Kumar Natarajan"
Date: "26-Dec-2025"
Org: " Start-up/AUM Data Labs"
Product: "Context Foundry"
Description: Batch Ingestion & Domain-Level Scoring Engine
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import asyncio
from api.simulation import evaluate_simulation, SimulationRequest

router = APIRouter()

class BatchSimulationRequest(BaseModel):
    prompts: List[str]
    orgId: str
    manifestVersion: Optional[str] = "latest"

@router.post("/batch")
async def run_batch_simulation(request: BatchSimulationRequest):
    """
    Executes multiple simulations in parallel to generate a Domain-Level ASoV Stability report.
    This clarifies how industry/domain level changes impact scoring via bulk testing.
    """
    if not request.prompts or not request.orgId:
        raise HTTPException(status_code=400, detail="Prompts and orgId required")

    tasks = []
    for prompt in request.prompts:
        sim_req = SimulationRequest(
            prompt=prompt,
            orgId=request.orgId,
            manifestVersion=request.manifestVersion
        )
        tasks.append(evaluate_simulation(sim_req))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    formatted_results = []
    total_score = 0
    hallucination_count = 0

    for i, res in enumerate(results):
        if isinstance(res, Exception):
            formatted_results.append({"prompt": request.prompts[i], "error": str(res)})
        else:
            formatted_results.append(res)
            total_score += res.get("score", 0)
            if res.get("hasHallucination"):
                hallucination_count += 1

    avg_score = total_score / len(request.prompts) if request.prompts else 0
    
    return {
        "domainStability": 1.0 - avg_score,
        "hallucinationRate": hallucination_count / len(request.prompts) if request.prompts else 0,
        "results": formatted_results
    }
