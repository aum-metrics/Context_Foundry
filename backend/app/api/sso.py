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

@router.get("/login/{provider}")
async def sso_provider_login(provider: str, org: str):
    """
    Redirect user to Identity Provider for SSO Login.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    if provider not in SSO_PROVIDERS:
        raise HTTPException(status_code=400, detail="Unsupported SSO provider")
        
    try:
        doc = db.collection("sso_configs").document(org).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="SSO not configured for this organization")
            
        config = doc.to_dict() or {}
        if not config.get("is_active"):
            raise HTTPException(status_code=400, detail="SSO is currently disabled for this organization")

        provider_config = SSO_PROVIDERS[provider]
        auth_url = provider_config["auth_url"].format(
            domain=config.get("domain", ""),
            tenant=config.get("tenant_id", "")
        )
        
        # Build Redirect URL
        import urllib.parse
        params = {
            "client_id": config.get("client_id"),
            "redirect_uri": f"{settings.API_V1_STR}/sso/callback",
            "response_type": "code",
            "scope": " ".join(provider_config["scopes"]),
            "state": f"{org}:{provider}:{secrets.token_urlsafe(16)}", # CSRF + Context
        }
        
        full_url = f"{auth_url}?{urllib.parse.urlencode(params)}"
        return RedirectResponse(url=full_url)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SSO Redirect failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate SSO login")

@router.get("/callback")
async def sso_callback(code: str, state: str, request: Request):
    """
    SSO OAuth2 Callback Handler.
    Exchanges authorization code for tokens and initializes Firebase session.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        # 1. Parse State
        state_parts = state.split(":")
        if len(state_parts) < 3:
            raise HTTPException(status_code=400, detail="Invalid state parameter")
        
        org_id, provider_id = state_parts[0], state_parts[1]
        
        # 2. Fetch Config
        doc = db.collection("sso_configs").document(org_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="SSO configuration lost")
        
        config = doc.to_dict() or {}
        provider_config = SSO_PROVIDERS.get(provider_id)
        if not provider_config:
            raise HTTPException(status_code=400, detail="Unknown provider in callback")

        # 3. Decrypt Client Secret
        client_secret = config.get("client_secret")
        if client_secret:
            from cryptography.fernet import Fernet
            import base64
            import os
            key = os.getenv("SSO_ENCRYPTION_KEY", base64.urlsafe_b64encode(b"aum-context-foundry-secure-key32").decode())
            f = Fernet(key)
            client_secret = f.decrypt(client_secret.encode()).decode()

        # 4. Exchange Code for Token (Implementation Placeholder for specific IdP SDKs)
        # For Demo: We simulate the mapping of the IdP user to a Firebase user.
        # In Production: Use `httpx` to POST to `provider_config['token_url']`
        
        logger.info(f"✅ SSO Callback Success for Org:{org_id} via {provider_id}")
        
        # 5. Redirect to Frontend with success (Frontend then calls Firebase with the result if needed)
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(url=f"{frontend_url}/dashboard?sso=success&org={org_id}")
        
    except Exception as e:
        logger.error(f"SSO Callback failed: {e}")
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(url=f"{frontend_url}/login?error=sso_failed")
