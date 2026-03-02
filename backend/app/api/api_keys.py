# backend/app/api/api_keys.py
# Author: Sambath Kumar Natarajan
# Company: AUM Data Labs
# Purpose: API Key Management - Professional tier ONLY
# Tiers: explorer, growth, scale (only growth and scale get API access)

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import secrets
import hashlib
from datetime import datetime, timezone
import logging

from core.config import settings
from core.security import get_auth_context, verify_user_org_access
from core.firebase_config import db
from api.audit import log_audit_event

router = APIRouter()
logger = logging.getLogger(__name__)

# Supabase has been deprecated in favor of unified Firestore architecture.
# All subscription data is now stored in the 'organizations' collection.
# API keys are now stored in the 'api_keys' collection (keyed by hash) for O(1) validation.

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

def check_api_tier_subscription(user_id: str) -> bool:
    """
    Check if user has a Growth or Scale subscription in Firestore.
    ONLY growth and scale tiers get API access.
    """
    if not db:
        return False
    
    try:
        # 1. Fetch user mapping
        user_doc = db.collection("users").document(user_id).get()
        if not user_doc.exists:
            return False
            
        user_data = user_doc.to_dict() or {}
        org_id = user_data.get("orgId")
        if not org_id:
            return False
            
        # 2. Fetch organization subscription
        org_doc = db.collection("organizations").document(org_id).get()
        if not org_doc.exists:
            return False
            
        org_data = org_doc.to_dict() or {}
        subscription = org_data.get("subscription", {})
        
        plan_id = subscription.get("planId", "explorer").lower()
        status = subscription.get("status", "inactive").lower()
        
        # ONLY growth and scale tiers get API access
        if plan_id not in ["growth", "scale"] or status != "active":
            return False
        
        # Check expiry if applicable
        expiry = subscription.get("currentPeriodEnd")
        if expiry:
            # Firestore timestamps are returned as datetime objects
            if datetime.now(timezone.utc) > expiry.replace(tzinfo=timezone.utc) if hasattr(expiry, 'replace') else expiry:
                return False
        
        return True
    except Exception as e:
        logger.error(f"Subscription check failed: {e}")
        return False

# ============================================
# Endpoints
# ============================================

@router.post("/generate", response_model=APIKeyResponse)
async def generate_api_key_endpoint(
    req: CreateAPIKeyRequest,
    current_user: dict = Depends(get_auth_context)
):
    """
    Generate a new API key (Growth/Scale tier ONLY).
    Tiers: explorer, growth, scale
    The key is shown only once - store it securely!
    """
    try:
        user_email = current_user.get("email")
        uid = current_user.get("uid")
        
        if not user_email or not uid:
            raise HTTPException(status_code=401, detail="Invalid user session")
        
        # Check if user has an eligible subscription
        if not check_api_tier_subscription(uid):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "API keys are only available for Growth and Scale subscribers",
                    "message": "Upgrade to the Growth or Scale plan to generate API keys. Available tiers: explorer, growth, scale",
                    "upgrade_url": "https://aumdatalabs.com/pricing"
                }
            )
        
        # Generate key
        api_key, key_hash = generate_api_key()
        key_prefix = api_key[:12] + "..."
        
        # Store in database
        key_data = {
            "userId": uid,
            "orgId": "user_level", # Default if org mapping fails
            "name": req.name,
            "keyHash": key_hash,
            "keyPrefix": key_prefix,
            "status": "active",
            "createdAt": datetime.utcnow().isoformat(),
            "lastUsedAt": None
        }
        
        # Try to get real orgId for audit/mapping
        user_doc = db.collection("users").document(uid).get()
        if user_doc.exists:
            key_data["orgId"] = user_doc.to_dict().get("orgId", "user_level")

        # Save to Firestore
        db.collection("api_keys").document(key_hash).set(key_data)
        
        logger.info(f"✅ API key created for Professional user {uid}: {key_prefix}")
        
        # SOC2 Audit Log
        log_audit_event(
            org_id=key_data["orgId"],
            actor_id=user_email,
            event_type="api_key_generated",
            resource_id=key_hash,
            metadata={"key_name": req.name}
        )
        
        return APIKeyResponse(
            id=key_hash, # Using hash as ID in Firestore
            name=req.name,
            key=api_key,  # Only shown once!
            key_prefix=key_prefix,
            created_at=key_data["createdAt"],
            last_used_at=None,
            is_active=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate API key: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list", response_model=List[APIKeyResponse])
async def list_api_keys(current_user: dict = Depends(get_auth_context)):
    """List all API keys for the current user"""
    try:
        uid = current_user.get("uid")
        
        if not db:
            raise HTTPException(status_code=503, detail="Database unavailable")
        
        # Query Firestore
        query = db.collection("api_keys").where("userId", "==", uid).stream()
        
        keys = []
        for doc in query:
            key = doc.to_dict()
            keys.append(APIKeyResponse(
                id=doc.id,
                name=key["name"],
                key=None,  # Never return the actual key
                key_prefix=key.get("keyPrefix", ""),
                created_at=key.get("createdAt", ""),
                last_used_at=key.get("lastUsedAt"),
                is_active=(key.get("status") == "active" or key.get("is_active") == True)
            ))
        
        # Sort by creation date descending
        keys.sort(key=lambda x: x.created_at, reverse=True)
        return keys
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list API keys: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{key_id}")
async def revoke_api_key(
    key_id: str,
    current_user: dict = Depends(get_auth_context)
):
    """Revoke (deactivate) an API key"""
    try:
        user_id = current_user.get("id")
        
        if not db:
            raise HTTPException(status_code=503, detail="Database unavailable")
        
        # Verify ownership
        doc_ref = db.collection("api_keys").document(key_id)
        doc = doc_ref.get()
        
        if not doc.exists or doc.to_dict().get("userId") != uid:
            raise HTTPException(status_code=404, detail="API key not found")
        
        # Deactivate
        doc_ref.update({
            "status": "revoked",
            "is_active": False # Legacy support
        })
        
        logger.info(f"✅ API key revoked: {key_id}")
        
        # SOC2 Audit Log
        log_audit_event(
            org_id="user_level",
            actor_id=current_user.get("email", "unknown"),
            event_type="api_key_revoked",
            resource_id=key_id,
        )
        
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
        "database_connected": db is not None,
        "tier_requirement": ["growth", "scale"]
    }
