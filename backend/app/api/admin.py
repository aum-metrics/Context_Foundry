from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Any
from core.firebase_config import db, app as firebase_app
from firebase_admin import auth as firebase_auth
from core.security import security, HTTPAuthorizationCredentials
from api.audit import log_audit_event
import datetime
import logging
import os

logger = logging.getLogger(__name__)
router = APIRouter()

async def verify_admin(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """
    Verify the request comes from an authenticated Firebase user with 'admin' claim.
    Supports standard Bearer token and X-Admin-Token header/cookie fallback.
    """
    token = None
    
    # 1. Check Bearer Token
    if credentials:
        token = credentials.credentials
    
    # 2. Check X-Admin-Token Header
    if not token:
        token = request.headers.get("X-Admin-Token")
    
    # 3. Check X-Admin-Token Cookie
    if not token:
        token = request.cookies.get("X-Admin-Token")
        
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        # Use verify_session_cookie to ensure token was minted by server
        decoded_token = firebase_auth.verify_session_cookie(token, check_revoked=True, app=firebase_app)
        if decoded_token.get("role") == "admin" or decoded_token.get("admin") is True:
            log_audit_event(
                org_id="system_admin",
                actor_id=decoded_token.get("email", "unknown_admin"),
                event_type="admin_session_verified",
                resource_id=decoded_token.get("uid", "unknown_uid"),
                metadata={"action": request.url.path}
            )
            return decoded_token
        
        logger.warning(f"🚫 Unauthorized Admin Access Attempt: {decoded_token.get('email', 'unknown')}")
        raise HTTPException(status_code=403, detail="Forbidden: Admin access required")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        logger.error(f"Admin auth failure: {e}")
        raise HTTPException(status_code=401, detail="Invalid admin session")


@router.post("/mint-session")
async def mint_admin_session(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """
    Exchanges a valid Firebase client ID token for a secure HTTPOnly Session Cookie.
    Used exclusively by the frontend Admin Auth route to harden the session.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing ID token")
        
    id_token = credentials.credentials
    try:
        # Verify the ID token first to ensure it's valid and has admin claims
        decoded_claims = firebase_auth.verify_id_token(id_token, app=firebase_app)
        if decoded_claims.get("role") != "admin" and not decoded_claims.get("admin"):
            raise HTTPException(status_code=403, detail="Forbidden: Admin access required to mint session")
            
        # Create the session cookie (expires in 24 hours)
        expires_in = datetime.timedelta(days=1)
        session_cookie = firebase_auth.create_session_cookie(id_token, expires_in=expires_in, app=firebase_app)
        
        return {"success": True, "session_cookie": session_cookie}
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid ID token provided")
    except Exception as e:
        logger.error(f"Minting session failed: {e}")
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail="Failed to create secure session")

@router.get("/verify-session")
async def verify_admin_session_route(admin_user: dict = Depends(verify_admin)):
    """
    Explicitly check if the current Admin Session Cookie is valid, unrevoked, and has the admin claim.
    """
    return {"success": True, "verified": True, "uid": admin_user.get("uid")}

@router.get("/orgs")
async def list_organizations(
    page_size: int = 15,
    cursor: Optional[str] = None,
    admin_user: dict = Depends(verify_admin)
):
    """
    List organizations with Firestore cursor-based pagination.
    """
    
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    if page_size < 1 or page_size > 50:
        page_size = 15

    try:
        from google.cloud.firestore_v1 import FieldFilter

        orgs_query = db.collection("organizations").order_by("__name__")

        # Cursor-based pagination: start_after the last doc ID from previous page
        if cursor:
            cursor_doc = db.collection("organizations").document(cursor).get()
            if cursor_doc.exists:
                orgs_query = orgs_query.start_after(cursor_doc)

        # Fetch page_size + 1 to determine if there are more pages
        docs = list(orgs_query.limit(page_size + 1).stream())
        has_more = len(docs) > page_size
        page_docs = docs[:page_size]

        org_list = []
        for org_doc in page_docs:
            data = org_doc.to_dict() or {}
            org_id = org_doc.id

            # Fetch member count & admin email (only for this page)
            member_count = 0
            admin_email = ""
            try:
                users_docs = list(
                    db.collection("users")
                    .where(filter=FieldFilter("orgId", "==", org_id))
                    .select(["email", "role"])
                    .stream()
                )
                member_count = len(users_docs)
                for u in users_docs:
                    ud = u.to_dict() or {}
                    if ud.get("role") == "admin" or not admin_email:
                        admin_email = ud.get("email", "")
            except Exception as e:
                logger.warning(f"Member count failed for {org_id}: {e}")
                member_count = 1

            # Simulation count: use select() to fetch only doc IDs (lightweight)
            sim_count = 0
            try:
                sim_docs = list(
                    db.collection("organizations").document(org_id)
                    .collection("scoringHistory")
                    .select([])
                    .limit(1000)
                    .stream()
                )
                sim_count = len(sim_docs)
            except Exception:
                sim_count = 0

            # Last payment date
            last_payment = "N/A"
            activated_at = data.get("subscription", {}).get("activatedAt")
            if activated_at:
                try:
                    if hasattr(activated_at, "isoformat"):
                        last_payment = activated_at.isoformat()[:10]
                    else:
                        last_payment = str(activated_at)[:10]
                except Exception:
                    pass

            org_list.append({
                "id": org_id,
                "name": data.get("name", org_id),
                "plan": data.get("subscription", {}).get("planId", "explorer"),
                "status": data.get("subscription", {}).get("status", "active"),
                "members": member_count,
                "simulations": sim_count,
                "apiKeys": {
                    "openai": "configured" if (data.get("apiKeys") or {}).get("openai") else "",
                    "gemini": "configured" if (data.get("apiKeys") or {}).get("gemini") else "",
                    "anthropic": "configured" if (data.get("apiKeys") or {}).get("anthropic") else "",
                },
                "email": admin_email or data.get("email", ""),
                "lastPayment": last_payment,
            })

        # Return cursor for next page (last doc ID of current page)
        next_cursor = page_docs[-1].id if page_docs and has_more else None

        return {
            "orgs": org_list,
            "hasMore": has_more,
            "nextCursor": next_cursor,
        }
    except Exception as e:
        logger.error(f"Admin org list failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class UpdateApiKeyRequest(BaseModel):
    provider: str  # "openai" | "gemini" | "anthropic"
    value: str


@router.put("/orgs/{org_id}/keys")
async def update_org_api_key(
    org_id: str,
    request_body: UpdateApiKeyRequest,
    admin_user: dict = Depends(verify_admin)
):
    """
    Update an organization's API key via Admin SDK.
    """

    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    if request_body.provider not in ("openai", "gemini", "anthropic"):
        raise HTTPException(status_code=400, detail="Invalid provider")

    try:
        db.collection("organizations").document(org_id).update({
            f"apiKeys.{request_body.provider}": request_body.value
        })
        log_audit_event(
            org_id=org_id,
            actor_id=admin_user.get("email", "admin"),
            event_type="admin_apikey_updated",
            resource_id=request_body.provider,
            metadata={"action": "update_key"}
        )
        return {"success": True, "message": f"{request_body.provider} key updated for {org_id}"}
    except Exception as e:
        logger.error(f"Admin key update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class AdminPaymentLinkRequest(BaseModel):
    orgId: str
    customerEmail: str
    description: str = "AUM Context Foundry - Subscription"
    amount: Optional[int] = None


@router.post("/payment-link")
async def admin_create_payment_link(
    body: AdminPaymentLinkRequest,
    admin_user: dict = Depends(verify_admin)
):
    """
    Admin-only payment link creation.
    """

    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        import razorpay
        key_id = os.getenv("RAZORPAY_KEY_ID")
        key_secret = os.getenv("RAZORPAY_KEY_SECRET")
        if not key_id or not key_secret:
            raise HTTPException(status_code=503, detail="Razorpay not configured")

        client = razorpay.Client(auth=(key_id, key_secret))

        # Determine amount from org plan if not specified
        amount = body.amount
        if not amount:
            PLANS = {
                "growth": 660000,   # ~$79/mo — matches payments.py
                "scale": 2080000,   # ~$249/mo — matches payments.py
            }
            try:
                org_doc = db.collection("organizations").document(body.orgId).get()
                if org_doc.exists:
                    plan_id = (org_doc.to_dict() or {}).get("subscription", {}).get("planId", "growth")
                    amount = PLANS.get(plan_id, PLANS["growth"])
            except Exception:
                pass
            if not amount:
                amount = PLANS["growth"]

        link = client.payment_link.create({
            "amount": amount,
            "currency": "INR",
            "description": body.description,
            "customer": {"email": body.customerEmail},
            "notify": {"email": True},
            "notes": {"orgId": body.orgId},
            "callback_url": os.getenv("PAYMENT_CALLBACK_URL", ""),
            "callback_method": "get",
        })

        # Store link record
        db.collection("organizations").document(body.orgId).collection("payments").add({
            "type": "payment_link",
            "linkId": link.get("id"),
            "shortUrl": link.get("short_url"),
            "amount": amount,
            "status": "sent",
            "customerEmail": body.customerEmail,
            "createdBy": "admin",
        })

        return {
            "linkId": link.get("id"),
            "shortUrl": link.get("short_url"),
            "amount": amount,
            "status": "created",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin payment link creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
