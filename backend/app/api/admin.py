# backend/app/api/admin.py
"""
ADMIN API — Server-side endpoints for the admin dashboard.
Uses Firebase Admin SDK (bypasses Firestore client security rules).
Auth: Verified by X-Admin-Token header matching the admin session cookie value.
"""

from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional
from pydantic import BaseModel
import logging
import os
import secrets

from core.firebase_config import db

logger = logging.getLogger(__name__)
router = APIRouter()

# Admin session token — MUST be set via env var in production; random default prevents guessing
ADMIN_TOKEN = os.getenv("ADMIN_SESSION_SECRET", secrets.token_hex(32))


def verify_admin(request: Request):
    """
    Verify the request comes from an authenticated admin.
    The Next.js proxy forwards the admin cookie value as X-Admin-Token.
    """
    token = request.headers.get("X-Admin-Token", "")
    if token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Admin authentication required")
    return True


@router.get("/orgs")
async def list_organizations(
    request: Request,
    page_size: int = 15,
    offset: int = 0
):
    """
    List all organizations with member counts and simulation counts.
    Uses Admin SDK — bypasses client Firestore rules.
    """
    verify_admin(request)
    
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        orgs_ref = db.collection("organizations")
        all_orgs = orgs_ref.stream()
        
        org_list = []
        for doc in all_orgs:
            data = doc.to_dict() or {}
            org_id = doc.id
            
            # Count members via Admin SDK
            member_count = 0
            admin_email = ""
            try:
                users_stream = db.collection("users").where("orgId", "==", org_id).stream()
                for user_doc in users_stream:
                    member_count += 1
                    user_data = user_doc.to_dict() or {}
                    if user_data.get("role") == "admin" or not admin_email:
                        admin_email = user_data.get("email", "")
            except Exception as e:
                logger.warning(f"Member count failed for {org_id}: {e}")
                member_count = 1
            
            # Count simulations
            sim_count = 0
            try:
                scoring_ref = db.collection("organizations").document(org_id).collection("scoringHistory").stream()
                sim_count = sum(1 for _ in scoring_ref)
            except Exception:
                sim_count = 0

            # Get last payment date
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
                    "openai": "configured" if data.get("apiKeys", {}).get("openai") else "",
                    "gemini": "configured" if data.get("apiKeys", {}).get("gemini") else "",
                    "anthropic": "configured" if data.get("apiKeys", {}).get("anthropic") else "",
                },
                "email": admin_email or data.get("email", ""),
                "lastPayment": last_payment,
            })

        # Simple offset pagination
        total = len(org_list)
        page = org_list[offset:offset + page_size]
        
        return {
            "orgs": page,
            "total": total,
            "hasMore": (offset + page_size) < total,
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
    request: Request,
):
    """
    Update an organization's API key via Admin SDK.
    Replaces direct Firestore client writes from the admin dashboard.
    """
    verify_admin(request)

    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    if request_body.provider not in ("openai", "gemini", "anthropic"):
        raise HTTPException(status_code=400, detail="Invalid provider")

    try:
        db.collection("organizations").document(org_id).update({
            f"apiKeys.{request_body.provider}": request_body.value
        })
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
    request: Request,
    body: AdminPaymentLinkRequest,
):
    """
    Admin-only payment link creation.
    Uses admin token auth instead of Firebase Bearer.
    Proxies to Razorpay directly via Admin SDK.
    """
    verify_admin(request)

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
                "growth": 499900,
                "scale": 1499900,
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
