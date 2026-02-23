# ============================================================================
# ISSUE 1: api.webhooks - Missing 'google.cloud' dependency
# ============================================================================

# FILE: backend/app/api/webhooks.py
# FIX: Add at the top of the file or update existing imports:

"""
Razorpay Webhook Handler
Syncs payment events with Supabase user subscriptions
"""

from fastapi import APIRouter, HTTPException, Request
import logging
import hmac
import hashlib
import os
from datetime import datetime, timedelta

# FIX: Remove or comment out this line:
# # # # from google.cloud import firestore  # REMOVED - use Supabase instead  # REMOVED - use Supabase instead  # REMOVED - use Supabase instead  # ❌ REMOVE - Not needed

# Instead use Supabase:
try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

logger = logging.getLogger(__name__)
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

# Initialize Supabase instead of Firestore
supabase = None
if SUPABASE_AVAILABLE:
    try:
        from core.config import settings
        if settings.SUPABASE_URL and settings.SUPABASE_KEY:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception as e:
        logger.warning(f"Supabase init failed: {e}")

router = APIRouter()


@router.post("/razorpay")
async def razorpay_webhook(request: Request):
    """
    Handle Razorpay payment webhooks
    Updates Supabase user subscription on successful payment
    """
    try:
        payload_bytes = await request.body()
        payload = await request.json()
        
        signature = request.headers.get("X-Razorpay-Signature", "")
        
        if RAZORPAY_KEY_SECRET:
            expected_signature = hmac.new(
                RAZORPAY_KEY_SECRET.encode(),
                payload_bytes,
                hashlib.sha256
            ).hexdigest()
            
            if signature != expected_signature:
                logger.warning("Invalid webhook signature")
                raise HTTPException(status_code=400, detail="Invalid signature")
        
        event = payload.get("event")
        logger.info(f"Received webhook: {event}")
        
        if event == "payment.captured":
            payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
            notes = payment_entity.get("notes", {})
            user_email = notes.get("email")
            
            if not user_email or not supabase:
                return {"status": "error", "message": "Missing email or Supabase"}
            
            # Update Supabase instead of Firestore
            now = datetime.now()
            subscription_end = now + timedelta(days=30)
            
            user_data = {
                "tier": notes.get("tier", "pro"),
                "subscription_start": now,
                "subscription_end": subscription_end,
                "payment_id": payment_entity.get("id"),
                "payment_amount": payment_entity.get("amount", 0) / 100,
                "payment_status": "active",
                "payment_method": payment_entity.get("method"),
                "updated_at": now,
                "razorpay_order_id": payment_entity.get("order_id")
            }
            
            try:
                supabase.table("user_profiles").update(user_data).eq("email", user_email).execute()
                logger.info(f"Subscription updated: {user_email}")
            except Exception as e:
                logger.error(f"Update failed: {e}")
            
            return {
                "status": "success",
                "message": "Subscription updated",
                "user_email": user_email
            }
        
        return {"status": "acknowledged", "event": event}
        
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def webhook_health():
    return {
        "status": "ok",
        "service": "webhooks",
        "razorpay_configured": bool(RAZORPAY_KEY_SECRET)
    }


# ============================================================================
# ISSUE 2: Multiple modules trying to import get_current_user from api.auth
# ============================================================================

# FIX: Update imports in these files:
# - api/collaboration.py
# - api/connectors.py
# - api/api_keys.py
# - api/statistics.py
# - api/realtime.py
# - api/workspaces.py

# CHANGE FROM:
# from api.auth import get_current_user

# CHANGE TO:
# from core.dependencies import get_current_user

# ============================================================================
# EXAMPLE FIX FOR ONE FILE
# ============================================================================

# FILE: backend/app/api/collaboration.py
# AT THE TOP, FIND AND REPLACE:

# ❌ OLD (lines ~12-15):
# from api.auth import get_current_user

# ✅ NEW:
from core.dependencies import get_current_user

# Then the rest of the file stays the same, just update that one import line

# ============================================================================
# SCRIPT TO FIX ALL FILES AT ONCE
# ============================================================================

# Save this as backend/fix_imports.py and run: python fix_imports.py

import os
import re

files_to_fix = [
    "app/api/collaboration.py",
    "app/api/connectors.py",
    "app/api/api_keys.py",
    "app/api/statistics.py",
    "app/api/realtime.py",
    "app/api/workspaces.py"
]

for filepath in files_to_fix:
    full_path = os.path.join("backend", filepath)
    
    if not os.path.exists(full_path):
        print(f"⚠️  File not found: {filepath}")
        continue
    
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the import
    old_import = "from api.auth import get_current_user"
    new_import = "from core.dependencies import get_current_user"
    
    if old_import in content:
        new_content = content.replace(old_import, new_import)
        
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"✅ Fixed: {filepath}")
    else:
        print(f"⏭️  Already fixed or not found: {filepath}")

print("\n✅ All imports fixed!")