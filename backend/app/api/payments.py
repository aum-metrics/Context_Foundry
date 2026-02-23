# backend/app/api/payments.py
"""
Payment processing and subscription management
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import razorpay
import logging
import uuid
import os
from datetime import datetime, timedelta
from requests.auth import HTTPBasicAuth
import requests

try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

from core.config import settings

# ============================================================================
# CONFIGURATION
# ============================================================================

logger = logging.getLogger(__name__)

# Pricing plans
PRICING_PLANS = {
    "starter": {
        "name": "Starter Plan",
        "amount_inr": 4999,
        "billing_cycle": "monthly",
        "features": ["1 Domain Unlock", "Basic Analytics"],
        "description": "Perfect for getting started"
    },
    "professional": {
        "name": "Professional Plan",
        "amount_inr": 14999,
        "billing_cycle": "monthly",
        "features": ["All Domains", "Advanced Analytics", "API Access", "Team Collaboration"],
        "description": "For power users and teams"
    }
}

# Supabase
supabase = None
if SUPABASE_AVAILABLE and settings.SUPABASE_URL and settings.SUPABASE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info("✅ Supabase initialized for payments")
    except Exception as e:
        logger.warning(f"⚠️ Supabase init failed: {e}")

# Razorpay
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")

razorpay_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    try:
        razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        logger.info("✅ Razorpay client initialized")
    except Exception as e:
        logger.warning(f"⚠️ Razorpay init failed: {e}")
else:
    logger.warning("⚠️ Razorpay keys not configured - payments disabled")

# Router
router = APIRouter()


# ============================================================================
# MODELS
# ============================================================================

class CreateOrderRequest(BaseModel):
    """Request to create payment order"""
    user_email: str
    plan_id: str  # 'starter', 'professional'
    domain: Optional[str] = None  # Required for starter tier


class CheckPaymentStatusRequest(BaseModel):
    """Request to check payment status"""
    order_id: str
    user_email: str


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def update_user_subscription(
    email: str,
    order_id: str,
    plan_id: str = "professional",
    domain: Optional[str] = None
) -> bool:
    """
    Update user subscription after successful payment
    """
    try:
        logger.info(f"[INFO] Updating subscription for {email}, plan={plan_id}")
        
        if not supabase:
            logger.error("[ERROR] Supabase not available")
            return False
        
        now = datetime.utcnow()
        expiry = now + timedelta(days=30)
        
        update_data = {
            "subscription_type": plan_id,
            "subscription_status": "active",
            "subscription_start": now.isoformat(),
            "subscription_expiry": expiry.isoformat(),
            "last_updated": now.isoformat()
        }
        
        # Handle domain access
        if plan_id == "professional":
            update_data["unlocked_domains"] = []
            update_data["current_domain"] = None
            update_data["domain_rotation_date"] = None
        elif plan_id == "starter" and domain:
            update_data["unlocked_domains"] = [domain]
            update_data["current_domain"] = domain
            update_data["domain_rotation_date"] = (now + timedelta(days=30)).isoformat()
        
        # Update user profile
        result = supabase.table("user_profiles")\
            .update(update_data)\
            .eq("email", email)\
            .execute()
        
        if result.data:
            logger.info(f"✅ Subscription updated for {email}")
            return True
        else:
            logger.warning(f"⚠️ User not found: {email}")
            return False
            
    except Exception as e:
        logger.error(f"[ERROR] Failed to update subscription: {e}")
        return False


def store_transaction(order_id: str, payment_id: str, amount: int, method: str) -> bool:
    """
    Store transaction record in database
    Amount is in paise
    """
    try:
        logger.info(f"[INFO] Storing transaction: {order_id} / {payment_id}")
        
        if not supabase:
            logger.error("[ERROR] Supabase not available")
            return False
        
        amount_inr = amount / 100
        
        transaction_data = {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "amount": amount_inr,
            "payment_status": "paid",
            "payment_method": method,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("transactions").insert(transaction_data).execute()
        
        if result.data:
            logger.info(f"✅ Transaction stored")
            return True
        else:
            logger.warning(f"⚠️ Failed to store transaction")
            return False
            
    except Exception as e:
        logger.error(f"[ERROR] Failed to store transaction: {e}")
        return False


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/create-order")
async def create_order(req: CreateOrderRequest):
    """Create Razorpay payment order"""
    try:
        logger.info(f"[INFO] Creating order for {req.user_email}, plan={req.plan_id}")
        
        # Validate plan
        if req.plan_id not in PRICING_PLANS:
            raise HTTPException(status_code=400, detail=f"Invalid plan: {req.plan_id}")
        
        # Validate domain for starter
        if req.plan_id == "starter":
            if not req.domain:
                raise HTTPException(
                    status_code=400,
                    detail="Domain selection required for starter plan"
                )
            allowed_domains = [
                "ecommerce", "manufacturing", "healthcare", "retail", "finance",
                "automotive", "education", "logistics", "marketing", "real_estate",
                "technology", "energy", "media", "travel", "agriculture"
            ]
            if req.domain not in allowed_domains:
                raise HTTPException(status_code=400, detail=f"Invalid domain: {req.domain}")
        
        plan = PRICING_PLANS[req.plan_id]
        amount = plan["amount_inr"]
        
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Invalid amount")
        
        # Check if Razorpay configured
        if not razorpay_client:
            logger.warning("[WARNING] Razorpay not configured - returning test order")
            return {
                "success": True,
                "order_id": f"test_order_{uuid.uuid4().hex[:10]}",
                "qr_url": "https://via.placeholder.com/300x300.png?text=Test+QR+Code",
                "amount": amount,
                "plan_name": plan["name"],
                "billing_cycle": plan["billing_cycle"],
                "currency": "INR",
                "razorpay_key": "test_key",
                "test_mode": True,
                "message": "Test mode - no actual payment required"
            }
        
        # Amount in paise for Razorpay
        amount_paise = int(amount * 100)
        receipt_id = f"rcpt_{uuid.uuid4().hex[:10]}"
        
        # Create Razorpay order
        order_notes = {
            "plan_id": req.plan_id,
            "user_email": req.user_email
        }
        if req.domain:
            order_notes["domain"] = req.domain
        
        order = razorpay_client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt_id,
            "payment_capture": 1,
            "notes": order_notes
        })
        
        order_id = order["id"]
        
        # Create UPI QR code
        qr_payload = {
            "type": "upi_qr",
            "name": f"Payment for {req.plan_id}",
            "usage": "single_use",
            "fixed_amount": True,
            "payment_amount": amount_paise,
            "description": f"{req.plan_id} subscription",
            "notes": {
                "order_id": order_id,
                "email": req.user_email
            }
        }
        
        qr_response = requests.post(
            "https://api.razorpay.com/v1/payments/qr_codes",
            json=qr_payload,
            auth=HTTPBasicAuth(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)
        )
        
        if qr_response.status_code >= 400:
            logger.error(f"[ERROR] QR Generation Failed: {qr_response.text}")
            raise HTTPException(status_code=500, detail="Failed to generate UPI QR code")
        
        qr_json = qr_response.json()
        qr_url = qr_json.get("image_url")
        
        if not qr_url:
            raise HTTPException(status_code=500, detail="QR code URL missing")
        
        logger.info(f"✅ Order created: {order_id}")
        
        return {
            "success": True,
            "order_id": order_id,
            "qr_url": qr_url,
            "amount": amount,
            "plan_name": plan["name"],
            "billing_cycle": plan["billing_cycle"],
            "currency": "INR",
            "razorpay_key": RAZORPAY_KEY_ID
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ERROR] Failed to create order: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")


@router.post("/check-status")
async def check_status(req: CheckPaymentStatusRequest):
    """Check payment status and update subscription"""
    try:
        logger.info(f"[INFO] Checking payment status for order={req.order_id}")
        
        if not razorpay_client:
            logger.warning("[WARNING] Test mode - simulating successful payment")
            return {
                "is_paid": True,
                "payment_id": f"test_pay_{uuid.uuid4().hex[:10]}",
                "order_id": req.order_id,
                "test_mode": True
            }
        
        # Fetch payments for order
        payments = razorpay_client.order.payments(req.order_id)
        
        if "items" not in payments:
            return {"is_paid": False}
        
        payment_items = payments["items"]
        
        # Check for successful payment
        for p in payment_items:
            if p["status"] == "captured":
                logger.info(f"✅ Payment successful: {p['id']}")
                
                # Extract plan and domain from order notes
                order_details = razorpay_client.order.fetch(req.order_id)
                notes = order_details.get("notes", {})
                plan_id = notes.get("plan_id", "professional")
                domain = notes.get("domain", None)
                
                # Update subscription
                update_user_subscription(
                    email=req.user_email,
                    order_id=req.order_id,
                    plan_id=plan_id,
                    domain=domain
                )
                
                # Store transaction
                store_transaction(
                    req.order_id,
                    p["id"],
                    p["amount"],
                    p.get("method", "unknown")
                )
                
                return {
                    "is_paid": True,
                    "payment_id": p["id"],
                    "order_id": req.order_id
                }
        
        return {"is_paid": False}
        
    except Exception as e:
        logger.error(f"[ERROR] Payment status check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check status: {str(e)}")


@router.get("/subscription/{user_id}")
async def get_subscription_status(user_id: str):
    """Get user subscription status"""
    try:
        if not supabase:
            return {
                "status": "error",
                "message": "Database not available"
            }
        
        response = supabase.table("user_profiles")\
            .select("*")\
            .eq("email", user_id)\
            .execute()
        
        if response.data:
            user = response.data[0]
            return {
                "status": "success",
                "subscription_type": user.get("subscription_type", "free"),
                "subscription_status": user.get("subscription_status", "inactive"),
                "subscription_expiry": user.get("subscription_expiry"),
                "unlocked_domains": user.get("unlocked_domains", []),
                "current_domain": user.get("current_domain")
            }
        
        return {
            "status": "success",
            "subscription_type": "free",
            "subscription_status": "active"
        }
        
    except Exception as e:
        logger.error(f"[ERROR] Failed to get subscription status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/plans")
async def get_plans():
    """Get available pricing plans"""
    return {
        "success": True,
        "plans": PRICING_PLANS
    }


@router.get("/health")
async def health():
    """Check payment service health"""
    return {
        "status": "ok",
        "razorpay_configured": razorpay_client is not None,
        "razorpay_key_present": bool(RAZORPAY_KEY_ID),
        "supabase_connected": supabase is not None,
        "message": "Payments service operational",
        "test_mode": razorpay_client is None
    }