# backend/app/api/sso.py
"""
ENTERPRISE SSO INTEGRATION
Support for Okta, Azure AD, Google Workspace, and generic SAML/OAuth2
"""

from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import RedirectResponse
from typing import Dict, Any, Optional
from pydantic import BaseModel
import logging
from datetime import datetime, timedelta

from core.config import settings
from core.firebase_config import db
from core.security import get_auth_context

router = APIRouter()
logger = logging.getLogger(__name__)

# Supabase has been deprecated. SSO configurations are stored in the 'sso_configs' collection.

# SSO Provider configurations
SSO_PROVIDERS = {
    "okta": {
        "name": "Okta",
        "auth_url": "https://{domain}/oauth2/v1/authorize",
        "token_url": "https://{domain}/oauth2/v1/token",
        "userinfo_url": "https://{domain}/oauth2/v1/userinfo",
        "scopes": ["openid", "profile", "email"]
    },
    "azure_ad": {
        "name": "Azure Active Directory",
        "auth_url": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
        "token_url": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        "userinfo_url": "https://graph.microsoft.com/v1.0/me",
        "scopes": ["openid", "profile", "email", "User.Read"]
    },
    "google": {
        "name": "Google Workspace",
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scopes": ["openid", "profile", "email"]
    }
}

class SSOConfig(BaseModel):
    """SSO configuration for an organization"""
    organization_id: str
    provider: str  # okta, azure_ad, google, saml
    domain: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    tenant_id: Optional[str] = None  # For Azure AD
    metadata_url: Optional[str] = None  # For SAML
    is_active: bool = True

class SSOConfigRequest(SSOConfig):
    pass

class SSOInitiateRequest(BaseModel):
    organization_id: str

@router.get("/providers")
async def list_sso_providers():
    """List available SSO providers"""
    return {
        "success": True,
        "providers": [
            {
                "id": provider_id,
                "name": config["name"]
            } for provider_id, config in SSO_PROVIDERS.items()
        ]
    }

@router.post("/configure")
async def configure_sso(request: SSOConfigRequest, auth: dict = Depends(get_auth_context)):
    """
    Configure SSO for an organization
    ENTERPRISE FEATURE - Requires Professional/Enterprise tier
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database connection unavailable")

    # Tenant ownership check: only members of the org can configure its SSO
    from core.security import verify_user_org_access
    uid = auth.get("uid")
    if not verify_user_org_access(uid, request.organization_id):
        raise HTTPException(status_code=403, detail="Unauthorized: you don't belong to this organization")

    if request.provider not in SSO_PROVIDERS:
        raise HTTPException(status_code=400, detail="Invalid SSO provider")
    
    # Save to Firestore - Mask client secret in storage
    try:
        config_data = request.model_dump()
        if config_data.get("client_secret"):
            from cryptography.fernet import Fernet
            import base64
            import os
            key = os.getenv("SSO_ENCRYPTION_KEY", base64.urlsafe_b64encode(b"aum-context-foundry-secure-key32").decode())
            f = Fernet(key)
            config_data["client_secret"] = f.encrypt(config_data["client_secret"].encode()).decode()
        db.collection("sso_configs").document(request.organization_id).set(config_data)
    except Exception as e:
        logger.error(f"Failed to save SSO config to Firestore: {e}")
        raise HTTPException(status_code=500, detail="Failed to save configuration")
    
    logger.info(f"✅ SSO configured for organization {request.organization_id}: {request.provider}")
    
    return {
        "success": True,
        "message": f"SSO configured successfully for {SSO_PROVIDERS[request.provider]['name']}",
        "organization_id": request.organization_id,
        "provider": request.provider
    }

@router.post("/initiate")
async def initiate_sso_login(request: SSOInitiateRequest, auth: dict = Depends(get_auth_context)):
    """
    Initiate SSO login flow (Admin Test)
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database connection unavailable")

    # Tenant ownership check
    from core.security import verify_user_org_access
    uid = auth.get("uid")
    if not verify_user_org_access(uid, request.organization_id):
        raise HTTPException(status_code=403, detail="Unauthorized to initiate SSO for this organization")

    try:
        doc = db.collection("sso_configs").document(request.organization_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="SSO not configured for this organization")
        
        config = doc.to_dict() or {}
        provider = config.get("provider")
        
        return {
            "auth_url": f"https://auth.aumdatalabs.com/sso/{provider}/login?org={request.organization_id}",
            "message": "Redirect user to this URL to complete SSO login"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SSO Initiation failed: {e}")
        raise HTTPException(status_code=500, detail="SSO initiation failed")

@router.get("/status/{organization_id}")
async def get_sso_status(organization_id: str, auth: dict = Depends(get_auth_context)):
    """
    Check if SSO is enabled for an organization.
    Restricted to members of the organization to prevent cross-tenant information disclosure.
    """
    if not db:
        return {"enabled": False, "error": "Database unavailable"}

    # Tenant ownership check
    from core.security import verify_user_org_access
    uid = auth.get("uid")
    if not verify_user_org_access(uid, organization_id):
        raise HTTPException(status_code=403, detail="Unauthorized to view SSO config for this organization")

    doc = db.collection("sso_configs").document(organization_id).get()
    if not doc.exists:
        return {"enabled": False}
    
    config = doc.to_dict() or {}
    return {
        "enabled": config.get("is_active", False),
        "provider": config.get("provider"),
        "provider_name": SSO_PROVIDERS.get(config.get("provider"), {}).get("name", "Unknown")
    }
@router.post("/callback")
async def sso_callback(request: Request):
    """
    SSO Assertion/Callback Placeholder (P2 Completion)
    In a real implementation, this would verify the SAML assertion or OAuth2 code.
    """
    return {"success": True, "method": "sso_callback", "status": "authenticated"}
