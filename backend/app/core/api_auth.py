# backend/app/core/api_auth.py
# Author: Sambath Kumar Natarajan
# Company: AUM Data Labs
# Purpose: API Key authentication and Professional-tier access control

from fastapi import HTTPException, Security, Depends, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import os
import logging
from datetime import datetime
from supabase import create_client, Client
from app.core.config import settings
from app.core.jwt import decode_token

logger = logging.getLogger(__name__)
security = HTTPBearer()

# Initialize Supabase
supabase: Optional[Client] = None
if settings.SUPABASE_URL and settings.SUPABASE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info("✅ API Auth: Supabase initialized")
    except Exception as e:
        logger.error(f"❌ API Auth: Failed to initialize Supabase: {e}")

# ============================================
# API KEY VALIDATION
# ============================================

async def verify_api_key(api_key: str) -> dict:
    """
    Verify API key and return user info.
    Returns: {
        "user_id": str,
        "email": str,
        "subscription_type": str,
        "api_key_id": str
    }
    """
    if not supabase:
        raise HTTPException(
            status_code=503,
            detail="API authentication service unavailable"
        )
    
    try:
        # Query api_keys table
        result = supabase.table("api_keys").select(
            "id, user_id, key_hash, is_active, created_at, last_used_at"
        ).eq("key_hash", api_key).eq("is_active", True).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=401,
                detail="Invalid API key"
            )
        
        api_key_record = result.data[0]
        user_id = api_key_record["user_id"]
        
        # Get user profile to check subscription
        user_result = supabase.table("user_profiles").select(
            "id, email, subscription_type, subscription_expiry"
        ).eq("id", user_id).execute()
        
        if not user_result.data or len(user_result.data) == 0:
            raise HTTPException(
                status_code=401,
                detail="User not found"
            )
        
        user = user_result.data[0]
        
        # Update last_used_at
        supabase.table("api_keys").update({
            "last_used_at": datetime.utcnow().isoformat()
        }).eq("id", api_key_record["id"]).execute()
        
        return {
            "user_id": user["id"],
            "email": user["email"],
            "subscription_type": user.get("subscription_type", "free"),
            "subscription_expiry": user.get("subscription_expiry"),
            "api_key_id": api_key_record["id"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"API key verification failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to verify API key"
        )

# ============================================
# DEPENDENCY: REQUIRE API KEY
# ============================================

async def require_api_key(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    """
    Dependency that requires a valid API key.
    Can be used on any endpoint to require authentication.
    """
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Missing API key. Include 'Authorization: Bearer YOUR_API_KEY' header."
        )
    
    api_key = credentials.credentials
    return await verify_api_key(api_key)

# ============================================
# DEPENDENCY: REQUIRE PRO TIER
# ============================================

async def require_professional_tier(
    user_info: dict = Depends(require_api_key)
) -> dict:
    """
    Dependency that requires Professional tier subscription.
    ONLY Professional tier users can access the API.
    Tiers: free, starter, professional
    
    Note: Temporarily accepts 'enterprise' for backwards compatibility
    during migration period. Will be removed in future version.
    """
    subscription_type = user_info.get("subscription_type", "free")
    
    # Accept both 'professional' and 'enterprise' (enterprise is legacy)
    # This ensures users who paid for "Professional" plan (stored as "enterprise" in DB)
    # can still access the API during migration
    if subscription_type not in ["professional", "enterprise"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "API access requires Professional subscription",
                "current_plan": subscription_type,
                "required_plan": "professional",
                "message": "Upgrade to Professional plan to access the API. Available tiers: free, starter, professional",
                "upgrade_url": "https://aumdatalabs.com/pricing"
            }
        )
    
    # Check if subscription is still valid
    subscription_expiry = user_info.get("subscription_expiry")
    if subscription_expiry:
        try:
            expiry_date = datetime.fromisoformat(subscription_expiry.replace('Z', '+00:00'))
            if datetime.utcnow() > expiry_date:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "Professional subscription expired",
                        "expired_on": subscription_expiry,
                        "message": "Please renew your Professional subscription to continue using the API",
                        "upgrade_url": "https://aumdatalabs.com/pricing"
                    }
                )
        except ValueError:
            logger.warning(f"Invalid subscription_expiry format: {subscription_expiry}")
    
    return user_info

# ============================================
# DEPENDENCY: OPTIONAL API KEY (for mixed endpoints)
# ============================================

async def optional_api_key(
    authorization: Optional[str] = Header(None)
) -> Optional[dict]:
    """
    Optional API key authentication.
    Returns user info if valid API key provided, None otherwise.
    Useful for endpoints that work for both web users and API users.
    """
    if not authorization:
        return None
    
    if not authorization.startswith("Bearer "):
        return None
    
    api_key = authorization.replace("Bearer ", "")
    
    try:
        return await verify_api_key(api_key)
    except HTTPException:
        return None
    except Exception as e:
        logger.error(f"Optional API key check failed: {e}")
        return None

# ============================================
# HELPER: CHECK IF REQUEST IS FROM API
# ============================================

def is_api_request(user_info: Optional[dict]) -> bool:
    """
    Check if the request is coming from API (has api_key_id).
    """
    return user_info is not None and "api_key_id" in user_info
