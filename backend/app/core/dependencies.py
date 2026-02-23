# backend/app/core/dependencies.py
"""
Shared dependency injection functions for authentication and authorization
"""

from fastapi import Depends, HTTPException, Header, status
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import logging

from .jwt import decode_access_token, TokenData

logger = logging.getLogger(__name__)

# ============================================================================
# CURRENT USER DEPENDENCY
# ============================================================================

async def get_current_user(
    token_data: TokenData = Depends(decode_access_token)
) -> Dict[str, Any]:
    """
    Dependency to get current authenticated user from JWT token
    
    Returns:
        dict with 'email' and 'id' fields
    """
    if not token_data or not token_data.sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user session"
        )
    
    return {
        "email": token_data.sub,
        "id": token_data.sub  # Using email as ID for now
    }


# ============================================================================
# OPTIONAL CURRENT USER (for public endpoints that support auth)
# ============================================================================

async def get_current_user_optional(
    authorization: Optional[str] = Header(None)
) -> Optional[Dict[str, Any]]:
    """
    Optional user authentication - returns None if not authenticated
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    try:
        token = authorization.replace("Bearer ", "")
        # Simple token validation
        payload = decode_access_token(authorization)
        return {
            "email": payload.sub if payload else None,
            "id": payload.sub if payload else None
        }
    except Exception:
        return None


# ============================================================================
# SUBSCRIPTION TIER VERIFICATION
# ============================================================================

def check_subscription_tier(required_tier: str = "free"):
    """
    Dependency factory to check if user has required subscription tier
    
    Args:
        required_tier: One of "free", "starter", "professional"
    
    Returns:
        Dependency function
    """
    async def verify_tier(
        user: Dict[str, Any] = Depends(get_current_user)
    ) -> Dict[str, Any]:
        # For now, assume all authenticated users have access
        # In production, query Supabase for actual tier
        return user
    
    return verify_tier


# ============================================================================
# PROFESSIONAL TIER ONLY
# ============================================================================

async def require_professional_tier(
    user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Dependency to require professional subscription tier
    """
    # TODO: Check against Supabase user_profiles.subscription_type
    return user


# ============================================================================
# API KEY VALIDATION
# ============================================================================

async def validate_api_key(
    authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    Validate API key from Authorization header
    
    Returns:
        dict with user info associated with API key
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header"
        )
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization format"
        )
    
    api_key = authorization.replace("Bearer ", "")
    
    # TODO: Validate against Supabase api_keys table
    # For now, accept any key
    return {
        "api_key": api_key,
        "email": "api_user@example.com"
    }