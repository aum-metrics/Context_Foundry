# Author: "Sambath Kumar Natarajan"
# Date: "26-Dec-2025"
# Org: " Start-up/AUM Data Labs"
# Product: "Context Foundry"
# Description: Security dependencies for FastAPI to validate Firebase ID Tokens

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
import logging
import hashlib
from datetime import datetime
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
    
    # Firebase ID Token verification
    try:
        # Verify the ID token using the Firebase Admin SDK.
        decoded_token = auth.verify_id_token(token, app=firebase_app)
        if "uid" in decoded_token and "id" not in decoded_token:
            decoded_token["id"] = decoded_token["uid"]
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
    # BRUTAL AUDIT FIX: Fail-Closed logic.
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

def validate_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Validates an AUM Platform API Key.
    Keys are hashed and verified against the Firestore 'api_keys' collection.
    """
    api_key = credentials.credentials
    if not api_key:
        raise HTTPException(status_code=401, detail="API Key missing")

    # Hash the key to look it up (O(1))
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()

    if not db:
        raise HTTPException(status_code=503, detail="Authentication service unavailable")

    try:
        key_doc = db.collection("api_keys").document(key_hash).get()
        if not key_doc.exists:
            # Fallback check: could it be a raw Firebase token? (The unified dependency handles this)
            raise HTTPException(status_code=401, detail="Invalid API Key")

        key_data = key_doc.to_dict() or {}
        if key_data.get("status") != "active":
            raise HTTPException(status_code=403, detail="API Key has been revoked")

        # Update last used timestamp (async fire-and-forget style)
        key_doc.reference.update({"lastUsedAt": datetime.utcnow().isoformat()})

        return {
            "uid": key_data.get("userId"),
            "orgId": key_data.get("orgId"),
            "type": "api_key",
            "name": key_data.get("name")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"API Key Validation Error: {e}")
        raise HTTPException(status_code=500, detail="Internal error during key validation")

def get_auth_context(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Unified Authentication Dependency.
    Accepts EITHER a Firebase ID Token OR an AUM API Key.
    Returns an 'AuthContext' dictionary.
    """
    token = credentials.credentials
    
    # 1. Try API Key Validation (AUM Keys start with "aum_")
    if token.startswith("aum_"):
        try:
            return validate_api_key(credentials)
        except HTTPException:
            pass # Try Firebase next

    # 2. Try Firebase ID Token
    try:
        user_info = get_current_user(credentials)
        # Fetch the orgId for this user
        org_id = None
        if db:
            user_doc = db.collection("users").document(user_info["uid"]).get()
            if user_doc.exists:
                org_id = user_doc.to_dict().get("orgId")
        
        return {
            "uid": user_info["uid"],
            "orgId": org_id,
            "type": "session",
            "email": user_info.get("email")
        }
    except Exception as e:
        logger.error(f"Auth Context Failure: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication (Token or API Key)")

import hashlib
from datetime import datetime
