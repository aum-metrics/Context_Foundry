# backend/app/core/rate_limiter.py
# Author: Sambath Kumar Natarajan
# Company: AUM Data Labs
# Purpose: Rate limiting for API endpoints using Firestore

from fastapi import HTTPException
from datetime import datetime, timedelta, timezone
import logging
from core.firebase_config import db

logger = logging.getLogger(__name__)

LIMITS = {
    'scale': {
        'requests_per_minute': 60,
    },
    'growth': {
        'requests_per_minute': 20,
    },
    'explorer': {
        'requests_per_minute': 10,
    }
}

async def check_rate_limit(api_key: str, endpoint: str, tier: str = 'growth'):
    """
    Check rate limits matching tier configuration using Firestore.
    Raises HTTPException if limit exceeded.
    """
    if tier not in LIMITS:
        tier = 'growth'
        
    limits = LIMITS[tier]
    
    if not db:
        return True
        
    try:
        now = datetime.now(timezone.utc)
        sanitized_endpoint = endpoint.replace("/", "_").replace(".", "_")
        doc_id = f"rl_{api_key[:15]}_{sanitized_endpoint}"
        
        ref = db.collection("rateLimits").document(doc_id)
        doc = ref.get()
        
        if doc.exists:
            data = doc.to_dict() or {}
            reset_at = data.get("resetAt")
            count = data.get("count", 0)
            
            if reset_at and reset_at.replace(tzinfo=None) > now:
                if count >= limits["requests_per_minute"]:
                    logger.warning(f"Rate limit exceeded for API key {api_key[:10]}... on {endpoint}")
                    raise HTTPException(
                        status_code=429,
                        detail=f"Rate limit exceeded: {limits['requests_per_minute']} requests per minute"
                    )
                ref.update({"count": count + 1})
            else:
                ref.set({"count": 1, "resetAt": now + timedelta(minutes=1)})
        else:
            ref.set({"count": 1, "resetAt": now + timedelta(minutes=1)})
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Firestore rate limiting failed (fail-closed — request allowed to avoid false blocking): {e}")
        
    return True

