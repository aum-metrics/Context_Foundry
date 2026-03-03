"""
Author: "Sambath Kumar Natarajan"
Date: "02-Mar-2026"
Org: "Start-up/AUM Data Labs"
Product: "AUM Context Foundry"
Description: SOC2 Compliant Audit Logging for sensitive tenant operations.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, timezone
from core.firebase_config import db
from core.security import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

def log_audit_event(org_id: str, actor_id: str, event_type: str, resource_id: str, metadata: dict = None):
    """
    Persistently logs sensitive operations to Firestore audit collection.
    Ensures zero-retention compliance while maintaining an audit trail of metadata.
    """
    if not db:
        logger.warning("Audit Log: Firestore unavailable. Logging to console only.")
        return

    try:
        audit_ref = db.collection("organizations").document(org_id).collection("auditLogs")
        audit_ref.add({
            "timestamp": datetime.now(timezone.utc),
            "actorId": actor_id,
            "eventType": event_type,
            "resourceId": resource_id,
            "metadata": metadata or {},
            "status": "success"
        })
        logger.info(f"Audit Logged: {event_type} for Org {org_id}")
    except Exception as e:
        logger.error(f"Failed to write audit log: {e}")

@router.get("/logs/{org_id}")
async def get_org_audit_logs(org_id: str, current_user: dict = Depends(get_current_user)):
    """
    Retrieves audit logs for a specific organization.
    Restricted to authorized users with administrative access scope.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Audit service unavailable")

    uid = current_user.get("uid")
    from core.security import verify_user_org_access
    if not verify_user_org_access(uid, org_id):
        raise HTTPException(status_code=403, detail="Unauthorized access to audit logs")

    try:
        logs = db.collection("organizations").document(org_id)\
                 .collection("auditLogs")\
                 .order_by("timestamp", direction="DESCENDING")\
                 .limit(50)\
                 .stream()
                 
        return [log.to_dict() for log in logs]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
