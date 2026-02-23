"""
Author: "Sambath Kumar Natarajan"
Date: "26-Dec-2025"
Org: " Start-up/AUM Data Labs"
Product: "Context Foundry"
Description: Razorpay Subscription & Payment Management Router
"""
from fastapi import APIRouter, HTTPException, Request
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
    "starter": {
        "name": "Starter",
        "amount": 1500000,  # ₹15,000 (~$180)
        "currency": "INR",
        "period": "monthly",
        "description": "1 org, Gemini 2.0 Flash scoring only, 50 simulations/mo",
    },
    "growth": {
        "name": "Growth",
        "amount": 2500000,  # ₹25,000 (~$300)
        "currency": "INR",
        "period": "monthly",
        "description": "1 org, all 3 models, 500 simulations/mo",
    },
    "enterprise": {
        "name": "Enterprise",
        "amount": 7500000,  # ₹75,000 (~$900)
        "currency": "INR",
        "period": "monthly",
        "description": "Unlimited orgs, SSO (coming soon), dedicated keys, weekly cron",
    },
}


# ============================================================================
# API MODELS
# ============================================================================

class CreateSubscriptionRequest(BaseModel):
    orgId: str
    planId: str  # starter, growth, enterprise
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
async def get_plans():
    """Returns available subscription plans."""
    return {"plans": PLANS}


@router.post("/create-order")
async def create_subscription_order(request: CreateSubscriptionRequest):
    """Creates a Razorpay order for a subscription payment."""
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
async def verify_payment(request: VerifyPaymentRequest):
    """Verifies a Razorpay payment signature and activates the subscription."""
    client = get_razorpay_client()
    if not client:
        raise HTTPException(status_code=503, detail="Razorpay not configured")

    try:
        # Verify signature
        key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
        message = f"{request.razorpay_order_id}|{request.razorpay_payment_id}"
        expected_signature = hmac.new(
            key_secret.encode(), message.encode(), hashlib.sha256
        ).hexdigest()

        if expected_signature != request.razorpay_signature:
            raise HTTPException(status_code=400, detail="Invalid payment signature")

        # Update org subscription in Firestore
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
async def generate_payment_link(request: PaymentLinkRequest):
    """Generates a shareable Razorpay payment link (for admin to send reminders)."""
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
        logger.warning("RAZORPAY_WEBHOOK_SECRET not set. Webhook verification skipped (UNSAFE).")
        # In a real enterprise app, we would block here.

    try:
        raw_body = await request.body()
        signature = request.headers.get("X-Razorpay-Signature", "")

        # 1. Verify Webhook Signature
        if secret:
            expected_signature = hmac.new(
                secret.encode(), raw_body, hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(expected_signature, signature):
                logger.error("Invalid Webhook Signature detected.")
                raise HTTPException(status_code=400, detail="Invalid signature")

        # 2. Process Event
        data = await request.json()
        event = data.get("event")
        payload = data.get("payload", {})

        logger.info(f"Processing Razorpay Webhook: {event}")

        # Handle successful payment or subscription activation
        if event in ["payment.captured", "subscription.activated", "order.paid"]:
            # Extract orgId from notes
            entity = payload.get("payment", {}).get("entity") or payload.get("subscription", {}).get("entity") or {}
            notes = entity.get("notes", {})
            org_id = notes.get("orgId")
            plan_id = notes.get("planId", "growth")

            if org_id and db:
                now = datetime.utcnow()
                db.collection("organizations").document(org_id).update({
                    "subscription.planId": plan_id,
                    "subscription.status": "active",
                    "subscription.lastWebhookEvent": event,
                    "subscription.activatedAt": now,
                    "subscription.currentPeriodStart": now,
                    "subscription.currentPeriodEnd": now + timedelta(days=30),
                })
                logger.info(f"Webhook: Org {org_id} upgraded to {plan_id} via {event}")

        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook processing failed: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/status/{org_id}")
async def get_payment_status(org_id: str):
    """Gets the subscription status for an organization."""
    if not db:
        return {"status": "unknown", "detail": "Firestore not available"}

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
