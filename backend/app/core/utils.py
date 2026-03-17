# backend/app/core/utils.py
import re
import logging
from typing import Optional
from datetime import datetime
from google.cloud.firestore import FieldFilter

logger = logging.getLogger(__name__)

def sanitize_for_prompt(text: str) -> str:
    """
    🛡️ SECURITY HARDENING (P0): Strip common prompt injection patterns.
    Prevents manifest content from overriding system instructions.
    """
    if not text:
        return ""
    # Strip common injection patterns
    # 1. Ignore/Disregard patterns
    text = re.sub(r'(?i)(ignore|disregard|forget|bypass).{0,50}(above|previous|instructions|rules|system)', '[FILTERED]', text)
    # 2. Markdown/Tag escape patterns
    text = text.replace("<|", "").replace("|>", "")
    # 3. Delimiter escape
    text = text.replace("</Context>", "").replace("<Context>", "")
    
    return text[:4000]

def count_usage_since(db, org_id: str, since: datetime) -> int:
    """
    🛡️ CANONICAL AGGREGATION (P1): Unifies Firestore count accessors.
    Handles SDK-specific nested list unpacking to prevent crashes.
    """
    if not db:
        return 0
    try:
        usage_ref = db.collection("organizations").document(org_id).collection("usageLedger")
        # Aggregation query
        query = usage_ref.where(filter=FieldFilter("timestamp", ">=", since)).count()
        snapshot = query.get()
        
        # Canonical unpacking for firebase-admin 6.x / google-cloud-firestore 2.x
        # Returns a list of lists of AggregationResult
        if snapshot and len(snapshot) > 0 and len(snapshot[0]) > 0:
            return int(snapshot[0][0].value)
        return 0
    except Exception as e:
        logger.error(f"Aggregation count failed for {org_id}: {e}")
        # Fallback to stream count if aggregation fails (expensive but safe)
        try:
            return len(list(usage_ref.where(filter=FieldFilter("timestamp", ">=", since)).select([]).stream()))
        except Exception:
            return 0
