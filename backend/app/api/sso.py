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
import httpx
import secrets
from firebase_admin import auth as firebase_auth
from core.firebase_config import app as firebase_app

from core.config import settings
from core.firebase_config import db
from core.security import get_auth_context
from core.limiter import limiter

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

@router.get("/status/{organization_id}")
async def get_sso_status(organization_id: str, auth: dict = Depends(get_auth_context)):
    """
    Check the current SSO configuration status for an organization.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database connection unavailable")

    from core.security import verify_user_org_access
    uid = auth.get("uid")
    if not verify_user_org_access(uid, organization_id):
        raise HTTPException(status_code=403, detail="Unauthorized")

    try:
        doc = db.collection("sso_configs").document(organization_id).get()
        if not doc.exists:
            return {
                "configured": False,
                "enabled": False,
                "provider": None,
                "is_active": False
            }
        
        config = doc.to_dict() or {}
        is_active = config.get("is_active", False)
        return {
            "configured": True,
            "enabled": is_active,  # Canonical frontend gate
            "provider": config.get("provider"),
            "is_active": is_active   # Legacy/Internal clarity
        }
    except Exception as e:
        logger.error(f"SSO status check failed: {e}")
        return {"configured": False, "enabled": False}


@router.get("/lookup")
@limiter.limit("5/minute")
async def lookup_sso_by_domain(request: Request, domain: str):
    """
    Public endpoint to lookup SSO configuration by email domain.
    Used by login page to resolve orgId.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    if not domain or "@" in domain:
        raise HTTPException(status_code=400, detail="Invalid domain format")

    try:
        # Search for active SSO config with this domain
        query = db.collection("sso_configs").where("domain", "==", domain).limit(1).stream()
        results = list(query)
        
        if not results:
            raise HTTPException(status_code=404, detail="No SSO configuration found for this domain")
        
        config_doc = results[0]
        config_data = config_doc.to_dict()
        
        if not config_data.get("is_active"):
            raise HTTPException(status_code=404, detail="SSO for this domain is currently disabled")

        return {
            "success": True,
            "organization_id": config_doc.id,
            "provider": config_data.get("provider"),
            "provider_name": SSO_PROVIDERS.get(config_data.get("provider"), {}).get("name", "Enterprise IDP")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SSO domain lookup failed: {e}")
        raise HTTPException(status_code=500, detail="Domain lookup failed")

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
            "redirect_uri": f"{settings.FRONTEND_URL}/api/sso/callback",
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

        # 4. Exchange Code for Token
        token_url = provider_config["token_url"].format(
            domain=config.get("domain", ""),
            tenant=config.get("tenant_id", "")
        )
        
        redirect_uri = f"{settings.FRONTEND_URL}/api/sso/callback"
        
        async with httpx.AsyncClient() as client:
            # Token Exchange
            token_resp = await client.post(token_url, data={
                "client_id": config.get("client_id"),
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri
            }, headers={"Accept": "application/json"})
            
            if token_resp.status_code != 200:
                logger.error(f"IdP Token Exchange failed: {token_resp.text}")
                raise HTTPException(status_code=400, detail="IdP Token Exchange failed")
                
            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            
            # 5. Fetch User Info
            userinfo_url = provider_config["userinfo_url"].format(
                domain=config.get("domain", ""),
                tenant=config.get("tenant_id", "")
            )
            
            user_resp = await client.get(userinfo_url, headers={
                "Authorization": f"Bearer {access_token}"
            })
            
            if user_resp.status_code != 200:
                logger.error(f"IdP User Info failed: {user_resp.text}")
                raise HTTPException(status_code=400, detail="IdP User Info failed")
                
            user_data = user_resp.json()
            email = user_data.get("email")
            
            if not email:
                raise HTTPException(status_code=400, detail="SSO provider did not return an email address")

        # 6. Map ID to Firebase User
        try:
            firebase_user = firebase_auth.get_user_by_email(email, app=firebase_app)
            uid = firebase_user.uid
        except firebase_auth.UserNotFoundError:
            firebase_user = firebase_auth.create_user(
                email=email,
                email_verified=True,
                display_name=user_data.get("name", ""),
                app=firebase_app
            )
            uid = firebase_user.uid
            
        # 7. Assure Org Membership
        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()
        if not user_doc.exists:
            user_ref.set({
                "uid": uid,
                "email": email,
                "orgId": org_id,
                "role": "member",
                "joinedAt": datetime.now(timezone.utc).isoformat()
            })
        else:
            current_org = user_doc.to_dict().get("orgId")
            if current_org != org_id:
                logger.warning(f"SSO Warning: User {email} transitioned from org {current_org} to {org_id}")
                user_ref.update({"orgId": org_id})
                
        # 8. Mint Custom Token for Frontend
        custom_token_bytes = firebase_auth.create_custom_token(uid, app=firebase_app)
        custom_token = custom_token_bytes.decode("utf-8")
        
        logger.info(f"✅ SSO Callback Success for Org:{org_id} via {provider_id} (User: {email})")
        
        # 9. Redirect to Frontend with Custom Token
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(url=f"{frontend_url}/sso-callback?token={custom_token}")
        
    except Exception as e:
        logger.error(f"SSO Callback failed: {e}")
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(url=f"{frontend_url}/login?error=sso_failed")
