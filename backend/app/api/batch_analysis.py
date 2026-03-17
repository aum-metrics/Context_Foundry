"""
Author: "Sambath Kumar Natarajan"
Date: "26-Dec-2025"
Org: " Start-up/AUM Context Foundry"
Product: "AUM Context Foundry"
Description: Batch & Scheduled Scoring Engine — supports on-demand batch and cron-triggered weekly crawls.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends

logger = logging.getLogger(__name__)
from api.simulation import run_simulation, SimulationRequest
from fastapi import BackgroundTasks

async def evaluate_simulation(req: SimulationRequest, skip_billing: bool = False):
    return await run_simulation(req, BackgroundTasks(), {"uid": "batch_worker", "orgId": req.orgId, "email": "batch@aumcontextfoundry.com"}, skip_billing=skip_billing)
from core.firebase_config import db
from core.security import get_auth_context, verify_user_org_access


router = APIRouter()


class BatchSimulationRequest(BaseModel):
    prompts: List[str]
    orgId: str
    manifestVersion: Optional[str] = "latest"


from utils.task_queue import FirestoreTaskQueue

async def _execute_batch_calculation(request: BatchSimulationRequest):
    """Core logic to run multiple simulations and calculate aggregate metrics."""
    tasks = [evaluate_simulation(SimulationRequest(
        prompt=p, orgId=request.orgId, manifestVersion=request.manifestVersion
    ), skip_billing=True) for p in request.prompts]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    formatted_results = []
    total_accuracy = 0
    drift_count = 0
    model_scores: Dict[str, List[float]] = {}

    for i, res in enumerate(results):
        if isinstance(res, Exception):
            formatted_results.append({"prompt": request.prompts[i], "error": str(res)})
        else:
            formatted_results.append(res)
            for model_result in res.get("results", []):
                m_name = model_result.get("model", "unknown")
                acc = model_result.get("accuracy", 0)
                if m_name not in model_scores: model_scores[m_name] = []
                model_scores[m_name].append(acc)
                total_accuracy += acc
                if model_result.get("hasHallucination"): drift_count += 1

    total_checks = sum(len(v) for v in model_scores.values())
    avg_accuracy = total_accuracy / total_checks if total_checks else 0

    has_errors = any(isinstance(r, Exception) for r in results)
    
    return {
        "status": "completed_with_errors" if has_errors else "completed",
        "domainStability": round(avg_accuracy, 1),
        "driftRate": round((drift_count / total_checks * 100) if total_checks else 0, 1),
        "modelAverages": {m: round(sum(s)/len(s), 1) for m, s in model_scores.items()},
        "totalChecks": total_checks,
        "results": formatted_results,
    }

async def _process_batch_background(request: BatchSimulationRequest, job_id: str):
    """Background worker to process the batch and write results to Firestore."""
    async def worker():
        # USAGE LEDGER: Record each simulation without touching the org root doc
        if db:
            try:
                org_ref = db.collection("organizations").document(request.orgId)

                usage_ref = org_ref.collection("usageLedger")
                batch = db.batch()
                now = datetime.now(timezone.utc)

                for idx, prompt in enumerate(request.prompts):
                    doc_ref = usage_ref.document()
                    batch.set(doc_ref, {
                        "timestamp": now,
                        "prompt": (prompt or "")[:100],
                        "manifestVersion": request.manifestVersion or "latest",
                        "source": "batch",
                    })
                    if (idx + 1) % 400 == 0:
                        batch.commit()
                        batch = db.batch()
                batch.commit()

                logger.info(f"Usage Ledger: Recorded {len(request.prompts)} sims for {request.orgId}")
            except Exception as e:
                logger.error(f"Usage Ledger write failed: {e}")
                # Fail-closed to prevent unmetered batch runs.
                raise RuntimeError("Usage ledger write failed")

        return await _execute_batch_calculation(request)

    await FirestoreTaskQueue.run_persistent_task(request.orgId, "batchJobs", job_id, worker)

@router.post("/batch")
async def run_batch_simulation(
    request: BatchSimulationRequest, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_auth_context)
):
    uid = current_user.get("uid")
    if not verify_user_org_access(uid, request.orgId):
        raise HTTPException(status_code=403, detail="Unauthorized")

    # Entitlement Check: Batch Analysis requires Growth, Scale, or Enterprise
    org_doc = db.collection("organizations").document(request.orgId).get()
    if org_doc.exists:
        plan = org_doc.to_dict().get("subscription", {}).get("planId", "explorer")
        if plan not in ["growth", "scale", "enterprise"]:
            raise HTTPException(status_code=403, detail=f"Batch Analysis requires a Growth, Scale, or Enterprise plan. Current plan: {plan}.")

    job_id = str(uuid.uuid4())
    FirestoreTaskQueue.register_job(request.orgId, "batchJobs", job_id, request.model_dump())
    
    background_tasks.add_task(_process_batch_background, request, job_id)
    return {"status": "processing", "jobId": job_id, "message": "Batch analysis queued"}


@router.get("/batch/status/{org_id}/{job_id}")
async def get_batch_status(
    org_id: str, 
    job_id: str,
    current_user: dict = Depends(get_auth_context)
):
    """Returns the status of a scheduled background batch job."""
    # Tenant authorization check
    uid = current_user.get("uid")
    if not verify_user_org_access(uid, org_id):
        raise HTTPException(status_code=403, detail="Unauthorized access to this organization")

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
    "Who are the top enterprise analytics consulting firms for retail and CPG transformation, and where does {org_name} fit?",
    "Which firms are strongest in Databricks, Snowflake, and Google Cloud data modernization, and how does {org_name} compare?",
    "How does {org_name} compare with Accenture, Tiger Analytics, Fractal, and Mu Sigma for enterprise AI and analytics transformation?",
    "Which partner is best for large-scale AI and analytics transformation for Fortune 500 companies, and why would a buyer shortlist {org_name}?",
    "Which vendors have domain expertise in CPG, BFSI, retail, and supply chain analytics, and what evidence supports {org_name}?",
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
    cron_secret = os.getenv("CRON_SECRET", None)
    if not cron_secret:
        raise HTTPException(status_code=500, detail="CRON_SECRET environment variable is missing.")
    
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
                
                # 🛡️ SECURITY FIX (P1): Enforce plan entitlement for scheduled crawls
                plan = org_data.get("subscription", {}).get("planId", "explorer")
                if plan not in ["growth", "scale", "enterprise"]:
                    logger.info(f"Skipping scheduled crawl for {org_id}: Plan '{plan}' not entitled for batch analysis.")
                    continue
            else:
                continue # Skip non-existent orgs

            prompts = [p.format(org_name=org_name) for p in DEFAULT_AUDIT_PROMPTS]

            batch_req = BatchSimulationRequest(
                prompts=prompts,
                orgId=org_id,
                manifestVersion="latest"
            )
            result = await _execute_batch_calculation(batch_req)

            # Store weekly snapshot
            db.collection("organizations").document(org_id).collection("weeklySnapshots").add({
                "timestamp": datetime.now(timezone.utc),
                "domainStability": result["domainStability"],
                "driftRate": result["driftRate"],
                "modelAverages": result.get("modelAverages", {}),
                "totalChecks": result.get("totalChecks", 0),
            })

            crawl_results.append({
                "orgId": org_id,
                "orgName": org_name,
                "domainStability": result["domainStability"],
                "driftRate": result["driftRate"],
                "status": "success",
            })
        except Exception as e:
            logger.error(f"Crawl failed for {org_id}: {e}")
            crawl_results.append({"orgId": org_id, "status": "error", "error": str(e)})

    return {
        "status": "completed",
        "orgsCrawled": len(crawl_results),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "results": crawl_results,
    }
