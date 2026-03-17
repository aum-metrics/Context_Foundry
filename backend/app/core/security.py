# backend/app/core/security.py
# FIX 5: verify_user_org_access previously caught all exceptions and returned False,
# but a transient Firestore timeout was indistinguishable from a genuine access denial.
# Now we distinguish: timeout/network errors raise 503 so the caller can retry;
# genuine "user not in this org" returns False (deny). This is still fail-closed
# for auth failures but gives clients a proper retry signal on infrastructure blips.

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
import logging
import hashlib
from datetime import datetime, timezone
from google.api_core.exceptions import ServiceUnavailable, DeadlineExceeded
from core.firebase_config import app as firebase_app
from core.firebase_config import db

logger = logging.getLogger(__name__)
security = HTTPBearer()


def _is_platform_admin(user_data: dict | None) -> bool:
    if not user_data:
        return False
    return user_data.get("role") == "admin" and user_data.get("orgId") == "system_admin_org"


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authentication token")

    from core.config import settings
    allow_mock = getattr(settings, "ALLOW_MOCK_AUTH", False)

    if token in ("mock-dev-token", "mock-demo-token"):
        is_demo = token == "mock-demo-token"
        if is_demo or (settings.ENV == "development" and allow_mock):
            return {
                "uid": "demo_uid" if is_demo else "mock_uid_dev",
                "email": "demo@demo.com" if is_demo else "dev@localhost",
                "orgId": "demo_org_id" if is_demo else "mock-org-123",
                "role": "admin",
            }
        logger.critical(f"🛑 SECURITY BREACH ATTEMPT: {token} used without ALLOW_MOCK_AUTH=True")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature")

    try:
        decoded_token = auth.verify_id_token(token, app=firebase_app)
        if "uid" in decoded_token and "id" not in decoded_token:
            decoded_token["id"] = decoded_token["uid"]
        return decoded_token
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except auth.InvalidIdTokenError as e:
        logger.error(f"Auth Signature Failure: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature")
    except Exception as e:
        logger.error(f"Authentication failure: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error during authentication")


def verify_user_org_access(uid: str, target_org_id: str) -> bool:
    """
    Returns True if the user belongs to the target org.
    FIX 5: Raises HTTPException(503) on Firestore transient errors instead of
    silently returning False. Callers that want to handle 503 explicitly can
    catch HTTPException; everyone else gets a clean 503 to the client.
    """
    from core.config import settings

    # Allow hardcoded bypass for demo/dev
    if uid == "demo_uid" and target_org_id == "demo_org_id":
        return True
    if settings.ENV == "development" and uid in ("mock_uid_dev", "mock-dev-uid") and target_org_id == "mock-org-123":
        return True

    if not db:
        logger.error("🛑 Security Failure: Database connection missing. Access denied.")
        return False

    try:
        user_doc = db.collection("users").document(uid).get()
    except (ServiceUnavailable, DeadlineExceeded) as e:
        # FIX 5: Transient Firestore error — tell the client to retry
        logger.error(f"❌ Firestore transient error during org access check for {uid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Identity service temporarily unavailable. Please retry."
        )
    except Exception as e:
        logger.error(f"❌ Security Critical: Org access verification failed: {e}")
        return False  # Unknown error — fail closed

    if not getattr(user_doc, 'exists', False):
        logger.warning(f"🛡 Access Denied: User {uid} not found")
        return False

    user_data = user_doc.to_dict() or {}
    if user_data.get("orgId") == target_org_id:
        return True
    if _is_platform_admin(user_data):
        logger.info(f"Platform admin {uid} granted delegated access to Org {target_org_id}")
        return True

    logger.warning(f"🛡 Access Denied: User {uid} attempted to access Org {target_org_id}")
    return False


def validate_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    api_key = credentials.credentials
    if not api_key:
        raise HTTPException(status_code=401, detail="API Key missing")

    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    if not db:
        raise HTTPException(status_code=503, detail="Authentication service unavailable")

    try:
        key_doc = db.collection("api_keys").document(key_hash).get()
    except (ServiceUnavailable, DeadlineExceeded):
        raise HTTPException(status_code=503, detail="Authentication service temporarily unavailable")
    except Exception as e:
        logger.error(f"API Key Validation Error: {e}")
        raise HTTPException(status_code=500, detail="Internal error during key validation")

    if not key_doc.exists:
        raise HTTPException(status_code=401, detail="Invalid API Key")

    key_data = key_doc.to_dict() or {}
    if key_data.get("status") != "active":
        raise HTTPException(status_code=403, detail="API Key has been revoked")

    # Fire-and-forget last-used update (don't block on it)
    try:
        key_doc.reference.update({"lastUsedAt": datetime.now(timezone.utc).isoformat()})
    except Exception:
        pass  # Non-critical; do not fail the request

    return {
        "uid": key_data.get("userId"),
        "orgId": key_data.get("orgId"),
        "type": "api_key",
        "name": key_data.get("name"),
    }


def get_auth_context(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials

    if token.startswith("aum_"):
        try:
            return validate_api_key(credentials)
        except HTTPException:
            pass

    try:
        user_info = get_current_user(credentials)
        org_id = user_info.get("orgId")
        role = user_info.get("role", "member")

        if db and user_info.get("uid") not in ("demo_uid", "mock_uid_dev"):
            try:
                user_doc = db.collection("users").document(user_info["uid"]).get()
                if user_doc.exists:
                    ud = user_doc.to_dict() or {}
                    org_id = ud.get("orgId", org_id)
                    role = ud.get("role", role)
            except Exception:
                pass  # Use token-provided values as fallback

        return {
            "uid": user_info["uid"],
            "orgId": org_id,
            "role": role,
            "type": "session",
            "email": user_info.get("email"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth Context Failure: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication (Token or API Key)")
