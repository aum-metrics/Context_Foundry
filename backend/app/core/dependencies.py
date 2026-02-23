# backend/app/core/dependencies.py
"""
Shared dependency injection functions for authentication and authorization
"""

from fastapi import Depends, HTTPException, Header, status
from typing import Optional, Dict, Any
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
    """
    if not token_data or not token_data.sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user session"
        )
    
    return {
        "email": token_data.sub,
        "id": token_data.sub
    }


# ============================================================================
# API KEY VALIDATION (Strategic Vault)
# ============================================================================

async def validate_api_key(
    authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    Validate API key from Authorization header
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
    
    # Logic is now handled via OrganizationContext and Firestore in endpoints
    return {
        "api_key": api_key,
        "email": "api_user@example.com"
    }