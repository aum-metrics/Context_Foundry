"""
Author: "Sambath Kumar Natarajan"
Date: "26-Dec-2025"
Org: " Start-up/AUM Data Labs"
Product: "Context Foundry"
Description: Batch & Scheduled Scoring Engine — supports on-demand batch and cron-triggered weekly crawls.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import logging
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends

logger = logging.getLogger(__name__)

from api.simulation import evaluate_simulation, SimulationRequest
from core.firebase_config import db
from core.security import get_current_user, verify_user_org_access


router = APIRouter()


class BatchSimulationRequest(BaseModel):
    prompts: List[str]
    orgId: str
    manifestVersion: Optional[str] = "latest"


async def _process_batch_background(request: BatchSimulationRequest, job_id: str):
    """Background worker to process the batch and write results to Firestore."""
    try:
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
        total_accuracy = 0
        hallucination_count = 0
        model_scores: Dict[str, List[float]] = {}

        for i, res in enumerate(results):
            if isinstance(res, Exception):
                formatted_results.append({"prompt": request.prompts[i], "error": str(res)})
            else:
                formatted_results.append(res)
                # Aggregate per-model scores
                for model_result in res.get("results", []):
                    model_name = model_result.get("model", "unknown")
                    acc = model_result.get("accuracy", 0)
                    if model_name not in model_scores:
                        model_scores[model_name] = []
                    model_scores[model_name].append(acc)
                    total_accuracy += acc
                    if model_result.get("hasHallucination"):
                        hallucination_count += 1

        total_checks = sum(len(v) for v in model_scores.values())
        avg_accuracy = total_accuracy / total_checks if total_checks else 0

        summary = {
            "domainStability": round(avg_accuracy, 1),
            "hallucinationRate": round((hallucination_count / total_checks * 100) if total_checks else 0, 1),
            "modelAverages": {m: round(sum(s)/len(s), 1) for m, s in model_scores.items()},
            "totalChecks": total_checks,
            "results": formatted_results,
        }

        if db:
            db.collection("organizations").document(request.orgId).collection("batchJobs").document(job_id).update({
                "status": "completed",
                "completedAt": datetime.utcnow(),
                "summary": summary
            })
    except Exception as e:
        logger.error(f"Background Batch Job {job_id} failed: {e}")
        if db:
            db.collection("organizations").document(request.orgId).collection("batchJobs").document(job_id).update({
                "status": "failed",
                "error": str(e)
            })

@router.post("/batch")
async def run_batch_simulation(
    request: BatchSimulationRequest, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Executes multiple simulations asynchronously to generate a Domain-Level Stability report.
    Pushes job to BackgroundTasks and returns a job ID to poll.
    """
    uid = current_user.get("uid")
    if not verify_user_org_access(uid, request.orgId):
        raise HTTPException(status_code=403, detail="Unauthorized access to this organization")

    if not request.prompts or not request.orgId:
        raise HTTPException(status_code=400, detail="Prompts and orgId required")

    # Enforce Enterprise Plan Limit for Batch Analysis
    if db:
        try:
            org_doc = db.collection("organizations").document(request.orgId).get()
            if org_doc.exists:
                org_plan = org_doc.to_dict().get("subscription", {}).get("planId", "starter")
                if org_plan != "enterprise":
                    raise HTTPException(status_code=403, detail="Batch Domain Analysis requires an Enterprise plan.")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to fetch org plan for batch analysis: {e}")

    job_id = str(uuid.uuid4())
    
    if db:
        db.collection("organizations").document(request.orgId).collection("batchJobs").document(job_id).set({
            "status": "processing",
            "createdAt": datetime.utcnow(),
            "totalPrompts": len(request.prompts)
        })

    background_tasks.add_task(_process_batch_background, request, job_id)

    return {"status": "processing", "jobId": job_id, "message": "Batch analysis queued successfully"}


@router.get("/batch/status/{org_id}/{job_id}")
async def get_batch_status(
    org_id: str, 
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Returns the status of a scheduled background batch job."""
    if not db:
        raise HTTPException(status_code=503, detail="Firestore not available")
    
    try:
        doc_ref = db.collection("organizations").document(org_id).collection("batchJobs").document(job_id).get()
        if not doc_ref.exists:
            raise HTTPException(status_code=404, detail="Job not found")
        return doc_ref.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# SCHEDULED WEEKLY CRAWL — triggered by cron, runs standard prompts for all orgs
# ============================================================================

DEFAULT_AUDIT_PROMPTS = [
    "What is {org_name}?",
    "What is the pricing for {org_name}?",
    "What features does {org_name} offer?",
    "Who are {org_name}'s competitors?",
    "Is {org_name} a good choice for enterprise?",
]


class ScheduledCrawlRequest(BaseModel):
    orgId: Optional[str] = None  # If None, crawls ALL orgs
    secret: str  # Simple shared secret for cron auth


@router.post("/scheduled")
async def run_scheduled_crawl(request: ScheduledCrawlRequest):
    """
    Cron-triggered endpoint for automated weekly scoring.
    
    Call via: curl -X POST http://localhost:8000/api/batch/scheduled \
              -H "Content-Type: application/json" \
              -d '{"secret": "aum-cron-2025"}'
    
    This runs standard audit prompts for every org (or a specific org)
    and stores the results in Firestore scoringHistory.
    """
    cron_secret = os.getenv("CRON_SECRET", "aum-cron-2025")
    if request.secret != cron_secret:
        raise HTTPException(status_code=403, detail="Invalid cron secret")

    if not db:
        raise HTTPException(status_code=503, detail="Firestore not available")

    # Get orgs to crawl
    org_ids = []
    if request.orgId:
        org_ids = [request.orgId]
    else:
        try:
            orgs = db.collection("organizations").stream()
            for org in orgs:
                org_ids.append(org.id)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to list orgs: {e}")

    if not org_ids:
        return {"status": "no_orgs", "message": "No organizations found to crawl"}

    crawl_results = []
    for org_id in org_ids:
        try:
            # Get org name for prompt personalization
            org_doc = db.collection("organizations").document(org_id).get()
            org_name = "this company"
            if org_doc.exists:
                org_data = org_doc.to_dict() or {}
                org_name = org_data.get("name", org_id)

            prompts = [p.format(org_name=org_name) for p in DEFAULT_AUDIT_PROMPTS]

            batch_req = BatchSimulationRequest(
                prompts=prompts,
                orgId=org_id,
                manifestVersion="latest"
            )
            result = await run_batch_simulation(batch_req)

            # Store weekly snapshot
            db.collection("organizations").document(org_id).collection("weeklySnapshots").add({
                "timestamp": datetime.utcnow(),
                "domainStability": result["domainStability"],
                "hallucinationRate": result["hallucinationRate"],
                "modelAverages": result.get("modelAverages", {}),
                "totalChecks": result.get("totalChecks", 0),
            })

            crawl_results.append({
                "orgId": org_id,
                "orgName": org_name,
                "domainStability": result["domainStability"],
                "hallucinationRate": result["hallucinationRate"],
                "status": "success",
            })
        except Exception as e:
            logger.error(f"Crawl failed for {org_id}: {e}")
            crawl_results.append({"orgId": org_id, "status": "error", "error": str(e)})

    return {
        "status": "completed",
        "orgsCrawled": len(crawl_results),
        "timestamp": datetime.utcnow().isoformat(),
        "results": crawl_results,
    }
