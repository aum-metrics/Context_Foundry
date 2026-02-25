# Author: "Sambath Kumar Natarajan"
# Date: "26-Dec-2025"
# Org: " Start-up/AUM Data Labs"
# Product: "Context Foundry"
# Description: Security dependencies for FastAPI to validate Firebase ID Tokens

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
import logging
from core.firebase_config import app as firebase_app
from core.firebase_config import db

logger = logging.getLogger(__name__)

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Validates the Firebase JWT token from the Authorization header.
    Returns the decoded token dictionary (containing uid, email, etc.) if valid.
    """
    token = credentials.credentials
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Dev-mode bypass: accept mock tokens ONLY if explicitly enabled and in development
    from core.config import settings
    allow_mock = getattr(settings, "ALLOW_MOCK_AUTH", False)
    if settings.ENV == "development" and allow_mock and token == "mock-dev-token":
        logger.info("🔓 Dev-mode: accepting mock token (ALLOW_MOCK_AUTH is ON)")
        return {
            "uid": "mock_uid_dev",
            "email": "dev@localhost",
            "name": "Dev User",
        }
    
    try:
        # Verify the ID token using the Firebase Admin SDK.
        decoded_token = auth.verify_id_token(token, app=firebase_app)
        return decoded_token
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token signature",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Authentication failure: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during authentication check",
        )

def verify_user_org_access(uid: str, target_org_id: str) -> bool:
    """
    Verifies that the Firebase user belongs to the requested organization.
    BRUTAL AUDIT FIX: Fail-Closed logic.
    """
    if not db:
        logger.error("🛑 Security Failure: Database connection missing. Access denied.")
        return False 
        
    try:
        user_doc = db.collection("users").document(uid).get()
        if user_doc.exists:
            user_data = user_doc.to_dict() or {}
            if user_data.get("orgId") == target_org_id:
                return True
        
        logger.warning(f"🛡 Access Denied: User {uid} attempted to access Org {target_org_id}")
        return False
    except Exception as e:
        logger.error(f"❌ Security Critical: Org access verification failed: {e}")
        return False # Fail-Closed
