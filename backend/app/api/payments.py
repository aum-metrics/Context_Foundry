"""
Author: "Sambath Kumar Natarajan"
Date: "26-Dec-2025"
Org: " Start-up/AUM Data Labs"
Product: "AUM Context Foundry"
Description: Razorpay Subscription & Payment Management Router
"""
from core.security import get_current_user, verify_user_org_access
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
import os
import logging
import hmac
import hashlib
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)
router = APIRouter()

try:
    import razorpay
    RAZORPAY_AVAILABLE = True
except ImportError:
    RAZORPAY_AVAILABLE = False
    logger.warning("razorpay SDK not installed")

from core.firebase_config import db


# ============================================================================
# RAZORPAY CLIENT
# ============================================================================

def get_razorpay_client():
    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    if not key_id or not key_secret:
        return None
    if not RAZORPAY_AVAILABLE:
        return None
    return razorpay.Client(auth=(key_id, key_secret))


# ============================================================================
# PLAN DEFINITIONS
# ============================================================================

PLANS = {
    "explorer": {
        "name": "Explorer",
        "amount": 0,
        "currency": "INR",
        "period": "monthly",
        "description": "3 simulations/mo, 1 document ingestion, basic ASoV score",
    },
    "growth": {
        "name": "Growth",
        "amount": 660000,  # ~$79/mo
        "currency": "INR",
        "period": "monthly",
        "description": "All 3 models, 100 simulations/mo, /llms.txt deploy",
    },
    "scale": {
        "name": "Scale",
        "amount": 2080000,  # ~$249/mo
        "currency": "INR",
        "period": "monthly",
        "description": "500 simulations/mo, priority queue, batch domain analysis",
    },
}


# ============================================================================
# API MODELS
# ============================================================================

class CreateSubscriptionRequest(BaseModel):
    orgId: str
    planId: str  # explorer, growth, scale
    customerEmail: str
    customerName: Optional[str] = None

class PaymentLinkRequest(BaseModel):
    orgId: str
    amount: Optional[int] = None  # Override amount in paise, else uses plan default
    description: Optional[str] = "AUM Context Foundry Subscription"
    customerEmail: str

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    orgId: str


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/plans")
async def get_plans(auth: dict = Depends(get_current_user)):
    """Returns available subscription plans."""
    return {"plans": PLANS}


@router.post("/create-order")
async def create_subscription_order(request: CreateSubscriptionRequest, auth: dict = Depends(get_current_user)):
    """Creates a Razorpay order for a subscription payment."""
    # Verify user owns the org they're purchasing for
    from core.security import verify_user_org_access
    uid = auth.get("uid")
    if not verify_user_org_access(uid, request.orgId):
        raise HTTPException(status_code=403, detail="Unauthorized: you don't belong to this organization")

    client = get_razorpay_client()
    if not client:
        raise HTTPException(status_code=503, detail="Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env")

    plan = PLANS.get(request.planId)
    if not plan:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {request.planId}. Choose from: {list(PLANS.keys())}")

    try:
        order = client.order.create({
            "amount": plan["amount"],
            "currency": plan["currency"],
            "receipt": f"aum_{request.orgId}_{request.planId}",
            "notes": {
                "orgId": request.orgId,
                "planId": request.planId,
                "customerEmail": request.customerEmail,
            }
        })

        # Store order in Firestore
        if db:
            db.collection("organizations").document(request.orgId).collection("payments").add({
                "orderId": order["id"],
                "planId": request.planId,
                "amount": plan["amount"],
                "currency": plan["currency"],
                "status": "created",
                "customerEmail": request.customerEmail,
                "createdAt": datetime.utcnow(),
            })

        return {
            "orderId": order["id"],
            "amount": plan["amount"],
            "currency": plan["currency"],
            "keyId": os.getenv("RAZORPAY_KEY_ID"),
            "planName": plan["name"],
            "description": plan["description"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Razorpay order creation failed: {e}")


@router.post("/verify")
async def verify_payment(request: VerifyPaymentRequest, auth: dict = Depends(get_current_user)):
    """Verifies a Razorpay payment signature and activates the subscription."""
    uid = auth.get("uid")
    if not verify_user_org_access(uid, request.orgId):
        raise HTTPException(status_code=403, detail="Unauthorized access to this organization")

    client = get_razorpay_client()
    if not client:
        raise HTTPException(status_code=503, detail="Razorpay not configured")

    try:
        # Verify signature
        key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
        message = f"{request.razorpay_order_id}|{request.razorpay_payment_id}"
        expected_signature = hmac.new(
            key_secret.encode(), message.encode(), digestmod=hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected_signature, request.razorpay_signature):
            raise HTTPException(status_code=400, detail="Invalid payment signature")

        # Update org subscription in Firestore
        payments = None
        if db:
            plan_id = "growth"
            try:
                # Find the pending payment record to get the planId
                payments = db.collection("organizations").document(request.orgId).collection("payments").where("orderId", "==", request.razorpay_order_id).get()
                if payments:
                    plan_id = payments[0].to_dict().get("planId", "growth")
            except Exception as e:
                logger.warning(f"Could not fetch planId for order {request.razorpay_order_id}, defaulting to growth: {e}")

            now = datetime.utcnow()
            db.collection("organizations").document(request.orgId).update({
                "subscription.planId": plan_id,
                "subscription.status": "active",
                "subscription.paymentId": request.razorpay_payment_id,
                "subscription.orderId": request.razorpay_order_id,
                "subscription.activatedAt": now,
                "subscription.currentPeriodStart": now,
                "subscription.currentPeriodEnd": now + timedelta(days=30),
            })

            # Update the payment record status
            try:
                if payments:
                    payments[0].reference.update({"status": "paid", "paidAt": now})
            except Exception:
                pass

        return {"status": "verified", "paymentId": request.razorpay_payment_id, "planId": plan_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {e}")


@router.post("/payment-link")
async def generate_payment_link(request: PaymentLinkRequest, auth: dict = Depends(get_current_user)):
    """Generates a shareable Razorpay payment link (for admin to send reminders)."""
    uid = auth.get("uid")
    if not verify_user_org_access(uid, request.orgId):
        raise HTTPException(status_code=403, detail="Unauthorized access to this organization")

    client = get_razorpay_client()
    if not client:
        raise HTTPException(status_code=503, detail="Razorpay not configured")

    # Look up org plan to get amount
    amount = request.amount
    if not amount and db:
        try:
            org_doc = db.collection("organizations").document(request.orgId).get()
            if org_doc.exists:
                org_data = org_doc.to_dict() or {}
                plan_id = org_data.get("subscription", {}).get("planId", "growth")
                plan = PLANS.get(plan_id, PLANS["growth"])
                amount = plan["amount"]
        except Exception:
            pass
    if not amount:
        amount = PLANS["growth"]["amount"]

    try:
        link = client.payment_link.create({
            "amount": amount,
            "currency": "INR",
            "description": request.description,
            "customer": {
                "email": request.customerEmail,
            },
            "notify": {
                "email": True,
            },
            "notes": {
                "orgId": request.orgId,
            },
            "callback_url": os.getenv("PAYMENT_CALLBACK_URL", "https://app.aumdatalabs.com/payment/success"),
            "callback_method": "get",
        })

        # Store link record
        if db:
            db.collection("organizations").document(request.orgId).collection("payments").add({
                "type": "payment_link",
                "linkId": link.get("id"),
                "shortUrl": link.get("short_url"),
                "amount": amount,
                "status": "sent",
                "customerEmail": request.customerEmail,
                "createdAt": datetime.utcnow(),
            })

        return {
            "linkId": link.get("id"),
            "shortUrl": link.get("short_url"),
            "amount": amount,
            "status": "created",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payment link creation failed: {e}")


@router.post("/webhook")
async def razorpay_webhook(request: Request):
    """
    Secure Server-to-Server Webhook handler.
    Ensures that payments are verified even if the user closes their browser.
    """
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    if not secret:
        logger.error("RAZORPAY_WEBHOOK_SECRET not set. Rejecting webhook (fail-closed).")
        raise HTTPException(status_code=503, detail="Webhook verification not configured")

    try:
        raw_body = await request.body()
        signature = request.headers.get("X-Razorpay-Signature", "")

        # 1. Verify Webhook Signature - Strict comparison
        expected_signature = hmac.new(
            secret.encode(), raw_body, digestmod=hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected_signature, signature):
            logger.error(f"🛑 CRITICAL: Invalid Webhook Signature. Body: {raw_body[:100]}... Signature: {signature}")
            raise HTTPException(status_code=400, detail="Invalid signature")

        # 2. Process Event
        data = await request.json()
        event = data.get("event")
        payload = data.get("payload", {})

        logger.info(f"Processing Razorpay Webhook: {event}")

        # Handle successful payment or subscription activation
        if event in ["payment.captured", "subscription.activated", "order.paid"]:
            # Extract orgId and paymentId for idempotency
            entity = payload.get("payment", {}).get("entity") or payload.get("subscription", {}).get("entity") or {}
            notes = entity.get("notes", {})
            org_id = notes.get("orgId")
            plan_id = notes.get("planId", "growth")
            payment_id = entity.get("id")

            if org_id and db:
                import google.cloud.firestore
                @google.cloud.firestore.transactional
                def atomic_activate(transaction, org_ref, p_id, p_plan, evt):
                    snapshot = org_ref.get(transaction=transaction)
                    if not snapshot.exists:
                        return False
                    
                    data = snapshot.to_dict() or {}
                    # Idempotency check: if this specific payment was already processed
                    if data.get("subscription", {}).get("lastPaymentId") == p_id:
                        logger.info(f"♻️ Webhook Idempotency: Payment {p_id} already processed for {org_id}")
                        return True
                    
                    now = datetime.utcnow()
                    transaction.update(org_ref, {
                        "subscription.planId": p_plan,
                        "subscription.status": "active",
                        "subscription.lastWebhookEvent": evt,
                        "subscription.lastPaymentId": p_id,
                        "subscription.activatedAt": now,
                        "subscription.currentPeriodStart": now,
                        "subscription.currentPeriodEnd": now + timedelta(days=30),
                    })
                    return True

                org_ref = db.collection("organizations").document(org_id)
                success = atomic_activate(db.transaction(), org_ref, payment_id, plan_id, event)
                
                if success:
                    logger.info(f"✅ Webhook: Org {org_id} upgraded to {plan_id} via {event}")

        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook processing failed: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/status/{org_id}")
async def get_payment_status(org_id: str, current_user: dict = Depends(get_current_user)):
    """Gets the subscription status for an organization."""
    if not db:
        return {"status": "unknown", "detail": "Firestore not available"}

    uid = current_user.get("uid")
    if not verify_user_org_access(uid, org_id):
        raise HTTPException(status_code=403, detail="Unauthorized access")

    try:
        org_doc = db.collection("organizations").document(org_id).get()
        if not org_doc.exists:
            raise HTTPException(status_code=404, detail="Organization not found")

        org_data = org_doc.to_dict() or {}
        subscription = org_data.get("subscription", {})

        # Get recent payments
        payments = []
        payment_docs = db.collection("organizations").document(org_id).collection("payments").order_by("createdAt", direction="DESCENDING").limit(5).stream()
        for doc in payment_docs:
            payments.append(doc.to_dict())

        return {
            "orgId": org_id,
            "subscription": subscription,
            "recentPayments": payments,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch status: {e}")
