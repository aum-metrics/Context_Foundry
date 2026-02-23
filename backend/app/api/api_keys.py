# backend/app/api/api_keys.py
# Author: Sambath Kumar Natarajan
# Company: AUM Data Labs
# Purpose: API Key Management - Professional tier ONLY
# Tiers: free, starter, professional (ONLY professional gets API access)

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import secrets
import hashlib
from datetime import datetime, timezone
import logging

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

from core.config import settings
from core.dependencies import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize Supabase
supabase: Optional[Client] = None
if settings.SUPABASE_URL and settings.SUPABASE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Supabase: {e}")

# ============================================
# Models
# ============================================

class APIKeyResponse(BaseModel):
    id: str
    name: str
    key: Optional[str] = None  # Only shown once during creation
    key_prefix: str
    created_at: str
    last_used_at: Optional[str] = None
    is_active: bool

class CreateAPIKeyRequest(BaseModel):
    name: str

# ============================================
# Helper Functions
# ============================================

def generate_api_key() -> tuple[str, str]:
    """
    Generate a secure API key and its hash.
    Returns: (api_key, key_hash)
    """
    # Generate 32-byte random key
    api_key = f"aum_{secrets.token_urlsafe(32)}"
    
    # Hash for storage
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    
    return api_key, key_hash

def check_professional_subscription(user_email: str) -> bool:
    """
    Check if user has PROFESSIONAL subscription.
    Tiers: free, starter, professional
    ONLY professional tier gets API access
    """
    if not supabase:
        return False
    
    try:
        result = supabase.table("user_profiles").select(
            "subscription_type, subscription_expiry"
        ).eq("email", user_email).execute()
        
        if not result.data or len(result.data) == 0:
            return False
        
        user = result.data[0]
        subscription_type = user.get("subscription_type", "free")
        
        # ONLY professional tier gets API access
        if subscription_type.lower() != "professional":
            return False
        
        # Check expiry
        subscription_expiry = user.get("subscription_expiry")
        if subscription_expiry:
            try:
                expiry_date = datetime.fromisoformat(subscription_expiry.replace('Z', '+00:00'))
                # Ensure UTC comparison
                if datetime.now(timezone.utc) > expiry_date:
                    return False
            except ValueError:
                pass
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to check subscription: {e}")
        return False

# ============================================
# Endpoints
# ============================================

@router.post("/generate", response_model=APIKeyResponse)
async def generate_api_key_endpoint(
    req: CreateAPIKeyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a new API key (Professional tier ONLY).
    Tiers: free, starter, professional
    The key is shown only once - store it securely!
    """
    try:
        user_email = current_user.get("email")
        user_id = current_user.get("id")
        
        if not user_email or not user_id:
            raise HTTPException(status_code=401, detail="Invalid user session")
        
        # Check if user has Professional subscription
        if not check_professional_subscription(user_email):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "API keys are only available for Professional subscribers",
                    "message": "Upgrade to Professional plan to generate API keys. Available tiers: free, starter, professional",
                    "upgrade_url": "https://aumdatalabs.com/pricing"
                }
            )
        
        if not supabase:
            raise HTTPException(status_code=503, detail="Service unavailable")
        
        # Generate key
        api_key, key_hash = generate_api_key()
        key_prefix = api_key[:12] + "..."
        
        # Store in database
        key_data = {
            "user_id": user_id,
            "name": req.name,
            "key_hash": key_hash,
            "key_prefix": key_prefix,
            "is_active": True,
            "created_at": datetime.utcnow().isoformat(),
            "last_used_at": None
        }
        
        result = supabase.table("api_keys").insert(key_data).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=500, detail="Failed to create API key")
        
        created_key = result.data[0]
        
        logger.info(f"✅ API key created for Professional user {user_email}: {key_prefix}")
        
        return APIKeyResponse(
            id=created_key["id"],
            name=created_key["name"],
            key=api_key,  # Only shown once!
            key_prefix=key_prefix,
            created_at=created_key["created_at"],
            last_used_at=created_key.get("last_used_at"),
            is_active=created_key["is_active"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate API key: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list", response_model=List[APIKeyResponse])
async def list_api_keys(current_user: dict = Depends(get_current_user)):
    """List all API keys for the current user"""
    try:
        user_id = current_user.get("id")
        
        if not supabase:
            raise HTTPException(status_code=503, detail="Service unavailable")
        
        result = supabase.table("api_keys").select(
            "id, name, key_prefix, created_at, last_used_at, is_active"
        ).eq("user_id", user_id).order("created_at", desc=True).execute()
        
        keys = []
        for key in result.data:
            keys.append(APIKeyResponse(
                id=key["id"],
                name=key["name"],
                key=None,  # Never return the actual key
                key_prefix=key["key_prefix"],
                created_at=key["created_at"],
                last_used_at=key.get("last_used_at"),
                is_active=key["is_active"]
            ))
        
        return keys
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list API keys: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{key_id}")
async def revoke_api_key(
    key_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Revoke (deactivate) an API key"""
    try:
        user_id = current_user.get("id")
        
        if not supabase:
            raise HTTPException(status_code=503, detail="Service unavailable")
        
        # Verify ownership
        result = supabase.table("api_keys").select("id").eq(
            "id", key_id
        ).eq("user_id", user_id).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="API key not found")
        
        # Deactivate
        supabase.table("api_keys").update({
            "is_active": False
        }).eq("id", key_id).execute()
        
        logger.info(f"✅ API key revoked: {key_id}")
        
        return {"success": True, "message": "API key revoked"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to revoke API key: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "api_keys",
        "supabase_connected": supabase is not None,
        "tier_requirement": "professional"
    }
