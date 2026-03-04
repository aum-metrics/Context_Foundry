"""
Author: "Sambath Kumar Natarajan"
Date: "26-Dec-2025"
Org: " Start-up/AUM Context Foundry"
Product: "AUM Context Foundry"
Description: Internal Cron Jobs for Billing and Quotas
"""
from fastapi import APIRouter, HTTPException, Request, Depends
import logging
from datetime import datetime, timezone
from core.firebase_config import db
from core.config import settings
import os

logger = logging.getLogger(__name__)

router = APIRouter()

def verify_cron_secret(request: Request):
    """Ensure only authorized internal schedulers can trigger cron jobs."""
    auth_header = request.headers.get("Authorization", "")
    expected = os.getenv("CRON_SECRET")
    
    if not expected:
        # If not set in environment, block all cron jobs required for production
        if settings.ENV == "production":
            logger.error("CRON_SECRET missing in production. Blocking cron execution.")
            raise HTTPException(status_code=403, detail="Cron secret not configured")
        return True # Allow in dev if not set
        
    if auth_header != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Invalid cron secret")
    return True

@router.post("/reset-quotas")
async def reset_billing_quotas(force_all: bool = False, _: bool = Depends(verify_cron_secret)):
    """
    Reset simsThisCycle to 0 for organizations whose billing cycle resets today.
    To be called daily by an external cron scheduler (e.g. Vercel Cron, Google Cloud Scheduler).
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    today = datetime.now(timezone.utc).day
    reset_count = 0
    error_count = 0
    
    try:
        # Get all organizations
        orgs = db.collection("organizations").stream()
        batch = db.batch()
        batch_size = 0
        total_batches_committed = 0
        
        for org in orgs:
            org_data = org.to_dict() or {}
            sub = org_data.get("subscription", {})
            
            # Reset logic:
            # 1. force_all is True (manual override)
            # 2. cycleAnchor day matches today
            # 3. No cycleAnchor defined (default to 1st of month)
            cycle_anchor = sub.get("cycleAnchor", 1)
            
            plan = sub.get("planId", "explorer")
            if plan == "explorer":
                continue # Explorer is one-time, not monthly reset
            
            should_reset = force_all or (cycle_anchor == today)
            
            if should_reset and sub.get("simsThisCycle", 0) > 0:
                doc_ref = db.collection("organizations").document(org.id)
                batch.update(doc_ref, {"subscription.simsThisCycle": 0})
                reset_count += 1
                batch_size += 1
                
                # Firestore limit is 500 writes per batch
                if batch_size >= 450:
                    batch.commit()
                    total_batches_committed += 1
                    batch = db.batch()
                    batch_size = 0
                    
        # Commit remaining
        if batch_size > 0:
            batch.commit()
            
        logger.info(f"Cron /reset-quotas complete. Reset {reset_count} orgs.")
        return {"status": "success", "reset_count": reset_count, "errors": error_count}
        
    except Exception as e:
        logger.error(f"Cron reset_quotas failed: {e}")
        raise HTTPException(status_code=500, detail="Quota reset failed")
