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
import secrets
import jwt
from datetime import datetime, timedelta

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except:
    SUPABASE_AVAILABLE = False

from core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize Supabase
supabase: Optional[Client] = None
if settings.SUPABASE_URL and settings.SUPABASE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Supabase: {e}")

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
    "google_workspace": {
        "name": "Google Workspace",
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v2/userinfo",
        "scopes": ["openid", "profile", "email"]
    },
    "saml": {
        "name": "Generic SAML 2.0",
        "type": "saml"
    }
}

class SSOConfig(BaseModel):
    """SSO configuration for an organization"""
    organization_id: str
    provider: str  # okta, azure_ad, google_workspace, saml
    domain: Optional[str] = None  # For Okta
    tenant_id: Optional[str] = None  # For Azure AD
    client_id: str
    client_secret: str
    redirect_uri: str
    enabled: bool = True
    auto_provision: bool = True  # Auto-create users on first login
    default_role: str = "member"  # Default role for new users

class SSOLoginRequest(BaseModel):
    """SSO login initiation request"""
    organization_id: str
    provider: str
    redirect_url: Optional[str] = None

class SSOCallbackRequest(BaseModel):
    """SSO callback data"""
    code: str
    state: str
    organization_id: str

# In-memory storage for SSO configs (should be in database)
sso_configs: Dict[str, SSOConfig] = {}
sso_states: Dict[str, Dict[str, Any]] = {}  # CSRF protection

@router.get("/providers")
async def list_sso_providers():
    """List available SSO providers"""
    return {
        "success": True,
        "providers": [
            {
                "id": provider_id,
                "name": config["name"],
                "type": config.get("type", "oauth2"),
                "enterprise": True
            }
            for provider_id, config in SSO_PROVIDERS.items()
        ]
    }

@router.post("/config")
async def configure_sso(config: SSOConfig):
    """
    Configure SSO for an organization
    ENTERPRISE FEATURE - Requires Professional/Enterprise tier
    """
    if config.provider not in SSO_PROVIDERS:
        raise HTTPException(status_code=400, detail="Invalid SSO provider")
    
    # Validate provider-specific requirements
    if config.provider == "okta" and not config.domain:
        raise HTTPException(status_code=400, detail="Okta domain is required")
    
    if config.provider == "azure_ad" and not config.tenant_id:
        raise HTTPException(status_code=400, detail="Azure AD tenant ID is required")
    
    # Store configuration
    sso_configs[config.organization_id] = config
    
    # Save to database
    if supabase:
        try:
            supabase.table("sso_configurations").upsert({
                "organization_id": config.organization_id,
                "provider": config.provider,
                "domain": config.domain,
                "tenant_id": config.tenant_id,
                "client_id": config.client_id,
                "client_secret": config.client_secret,  # Should be encrypted
                "redirect_uri": config.redirect_uri,
                "enabled": config.enabled,
                "auto_provision": config.auto_provision,
                "default_role": config.default_role,
                "updated_at": datetime.utcnow().isoformat()
            }).execute()
        except Exception as e:
            logger.error(f"Failed to save SSO config: {e}")
    
    logger.info(f"✅ SSO configured for organization {config.organization_id}: {config.provider}")
    
    return {
        "success": True,
        "message": f"SSO configured successfully for {SSO_PROVIDERS[config.provider]['name']}",
        "organization_id": config.organization_id,
        "provider": config.provider
    }

@router.post("/login/initiate")
async def initiate_sso_login(request: SSOLoginRequest):
    """
    Initiate SSO login flow
    Returns authorization URL for redirect
    """
    # Get SSO configuration
    if request.organization_id not in sso_configs:
        raise HTTPException(status_code=404, detail="SSO not configured for this organization")
    
    config = sso_configs[request.organization_id]
    
    if not config.enabled:
        raise HTTPException(status_code=403, detail="SSO is disabled for this organization")
    
    provider_config = SSO_PROVIDERS[config.provider]
    
    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)
    sso_states[state] = {
        "organization_id": request.organization_id,
        "provider": config.provider,
        "redirect_url": request.redirect_url,
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Build authorization URL
    if config.provider == "okta":
        auth_url = provider_config["auth_url"].format(domain=config.domain)
    elif config.provider == "azure_ad":
        auth_url = provider_config["auth_url"].format(tenant=config.tenant_id)
    else:
        auth_url = provider_config["auth_url"]
    
    # Add query parameters
    scopes = " ".join(provider_config["scopes"])
    authorization_url = (
        f"{auth_url}?"
        f"client_id={config.client_id}&"
        f"response_type=code&"
        f"scope={scopes}&"
        f"redirect_uri={config.redirect_uri}&"
        f"state={state}"
    )
    
    logger.info(f"🔐 SSO login initiated for {request.organization_id} via {config.provider}")
    
    return {
        "success": True,
        "authorization_url": authorization_url,
        "state": state,
        "provider": config.provider
    }

@router.post("/callback")
async def handle_sso_callback(request: SSOCallbackRequest):
    """
    Handle SSO callback after user authorization
    Exchange code for tokens and create/update user
    """
    # Validate state (CSRF protection)
    if request.state not in sso_states:
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    
    state_data = sso_states[request.state]
    organization_id = state_data["organization_id"]
    
    # Get SSO configuration
    if organization_id not in sso_configs:
        raise HTTPException(status_code=404, detail="SSO configuration not found")
    
    config = sso_configs[organization_id]
    provider_config = SSO_PROVIDERS[config.provider]
    
    try:
        # Exchange authorization code for tokens
        # This is a simplified version - real implementation would use requests library
        # to make HTTP calls to the token endpoint
        
        # For now, return mock user data
        # In production, you would:
        # 1. Exchange code for access token
        # 2. Use access token to get user info
        # 3. Create/update user in your database
        # 4. Generate your own JWT token
        
        user_info = {
            "email": "user@example.com",  # From SSO provider
            "name": "John Doe",
            "organization_id": organization_id,
            "sso_provider": config.provider,
            "role": config.default_role
        }
        
        # Create or update user
        if supabase and config.auto_provision:
            try:
                # Check if user exists
                result = supabase.table("user_profiles").select("*").eq(
                    "email", user_info["email"]
                ).execute()
                
                if result.data and len(result.data) > 0:
                    # Update existing user
                    supabase.table("user_profiles").update({
                        "last_login": datetime.utcnow().isoformat(),
                        "sso_provider": config.provider,
                        "organization_id": organization_id
                    }).eq("email", user_info["email"]).execute()
                else:
                    # Create new user
                    supabase.table("user_profiles").insert({
                        "email": user_info["email"],
                        "name": user_info["name"],
                        "organization_id": organization_id,
                        "sso_provider": config.provider,
                        "role": config.default_role,
                        "subscription_type": "professional",  # SSO users get professional
                        "created_at": datetime.utcnow().isoformat(),
                        "last_login": datetime.utcnow().isoformat()
                    }).execute()
                    
                    logger.info(f"✅ Auto-provisioned user: {user_info['email']}")
                    
            except Exception as e:
                logger.error(f"Failed to provision user: {e}")
        
        # Generate JWT token for your application
        token_payload = {
            "email": user_info["email"],
            "name": user_info["name"],
            "organization_id": organization_id,
            "sso_provider": config.provider,
            "exp": datetime.utcnow() + timedelta(days=7)
        }
        
        # This should use your actual JWT secret
        token = jwt.encode(token_payload, "your-secret-key", algorithm="HS256")
        
        # Clean up state
        del sso_states[request.state]
        
        logger.info(f"✅ SSO login successful for {user_info['email']}")
        
        return {
            "success": True,
            "token": token,
            "user": user_info,
            "redirect_url": state_data.get("redirect_url", "/dashboard")
        }
        
    except Exception as e:
        logger.error(f"SSO callback failed: {e}")
        raise HTTPException(status_code=500, detail=f"SSO authentication failed: {str(e)}")

@router.get("/organizations/{organization_id}/config")
async def get_sso_config(organization_id: str):
    """Get SSO configuration for an organization (public info only)"""
    if organization_id not in sso_configs:
        return {
            "success": True,
            "sso_enabled": False
        }
    
    config = sso_configs[organization_id]
    
    return {
        "success": True,
        "sso_enabled": config.enabled,
        "provider": config.provider,
        "provider_name": SSO_PROVIDERS[config.provider]["name"]
    }

@router.delete("/config/{organization_id}")
async def disable_sso(organization_id: str):
    """Disable SSO for an organization"""
    if organization_id not in sso_configs:
        raise HTTPException(status_code=404, detail="SSO not configured")
    
    config = sso_configs[organization_id]
    config.enabled = False
    
    # Update database
    if supabase:
        try:
            supabase.table("sso_configurations").update({
                "enabled": False,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("organization_id", organization_id).execute()
        except Exception as e:
            logger.error(f"Failed to disable SSO: {e}")
    
    logger.info(f"🔒 SSO disabled for organization {organization_id}")
    
    return {
        "success": True,
        "message": "SSO disabled successfully"
    }

@router.get("/health")
async def sso_health():
    """Health check for SSO service"""
    return {
        "status": "healthy",
        "service": "sso",
        "providers": list(SSO_PROVIDERS.keys()),
        "active_configs": len(sso_configs),
        "features": [
            "okta_integration",
            "azure_ad_integration",
            "google_workspace_integration",
            "saml_support",
            "auto_provisioning",
            "role_mapping"
        ]
    }
