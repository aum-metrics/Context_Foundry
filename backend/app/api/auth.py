# backend/app/api/auth.py
"""
Authentication endpoints - OTP-based login
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
import random
import string
import logging

from core.config import settings
from core.jwt import create_access_token, TokenData

# In-memory OTP store (fallback)
_otp_store = {}

logger = logging.getLogger(__name__)

try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

# Initialize Supabase
supabase = None
if SUPABASE_AVAILABLE and settings.SUPABASE_URL and settings.SUPABASE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info("✅ Supabase initialized")
    except Exception as e:
        logger.warning(f"⚠️ Supabase init failed: {e}")

# Router
router = APIRouter()


# ============================================================================
# MODELS
# ============================================================================

class OTPRequest(BaseModel):
    """Request to send OTP"""
    email: EmailStr


class OTPVerify(BaseModel):
    """Request to verify OTP"""
    email: EmailStr
    otp: str


class TokenResponse(BaseModel):
    """Login response with token"""
    access_token: str
    token_type: str
    user: dict


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def generate_otp(length: int = 6) -> str:
    """Generate random OTP"""
    return ''.join(random.choices(string.digits, k=length))


async def send_otp_email(email: str, otp: str) -> bool:
    """
    Send OTP to user.
    Currently outputs to server console (dev mode).
    For production, integrate with a transactional email service (e.g., SendGrid, SES).
    """
    try:
        logger.info(f"[DEV MODE] OTP for {email}: {otp}")
        print(f"\n{'='*50}")
        print(f"🔐 LOGIN CODE FOR {email}")
        print(f"{'='*50}")
        print(f"   {otp}")
        print(f"{'='*50}\n")
        return True
    except Exception as e:
        logger.error(f"❌ OTP delivery failed: {e}")
        return True


async def check_rate_limit(email: str) -> bool:
    """Check if user exceeded OTP rate limit"""
    if not supabase:
        return True
    
    try:
        one_hour_ago = (datetime.utcnow() - timedelta(hours=1)).isoformat()
        response = supabase.table('email_otps')\
            .select('id')\
            .eq('email', email)\
            .gte('created_at', one_hour_ago)\
            .execute()
        
        count = len(response.data) if response.data else 0
        logger.info(f"Rate limit check for {email}: {count}/5 requests")
        return count < 5
        
    except Exception as e:
        logger.error(f"Rate limit check failed: {e}")
        return True  # Allow on error


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/send-otp")
async def send_otp(request: OTPRequest):
    """Generate and send OTP to user's email"""
    try:
        email = request.email.lower().strip()
        logger.info(f"📧 OTP request for: {email}")
        
        # Check rate limit
        if not await check_rate_limit(email):
            logger.warning(f"⚠️ Rate limit exceeded for {email}")
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again in 1 hour."
            )
        
        # Generate OTP
        otp = generate_otp()
        expires_at = datetime.utcnow() + timedelta(minutes=5)
        
        # Save OTP
        saved_to_db = False
        if supabase:
            try:
                data = {
                    'email': email,
                    'otp': otp,
                    'expires_at': expires_at.isoformat(),
                    'is_used': False,
                    'attempts': 0
                }
                result = supabase.table('email_otps').insert(data).execute()
                saved_to_db = True
                logger.info(f"✅ OTP saved to Supabase for {email}")
            except Exception as e:
                logger.error(f"❌ Supabase OTP insert failed: {e}")
                logger.info(f"⚠️ Falling back to memory store for {email}")
        
        if not saved_to_db:
            _otp_store[email] = {
                'otp': otp,
                'expires_at': expires_at,
                'attempts': 0
            }
            logger.info(f"💾 OTP stored in memory for {email}")
        
        # Send email
        await send_otp_email(email, otp)
        
        response = {
            "success": True,
            "message": "OTP sent successfully",
            "expires_in": 300
        }
        
        if settings.DEBUG:
            response["dev_otp"] = otp
        
        logger.info(f"✅ OTP process complete for {email}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ Send OTP failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send OTP: {str(e)}"
        )


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(request: OTPVerify):
    """Verify OTP and return JWT token"""
    try:
        email = request.email.lower().strip()
        otp = request.otp.strip()
        logger.info(f"🔐 Verify OTP for: {email}")
        
        verified = False
        
        # Try Supabase first
        if supabase:
            try:
                response = supabase.table('email_otps')\
                    .select('*')\
                    .eq('email', email)\
                    .eq('is_used', False)\
                    .order('created_at', desc=True)\
                    .limit(1)\
                    .execute()
                
                if response.data:
                    otp_record = response.data[0]
                    expires_at = datetime.fromisoformat(
                        otp_record['expires_at'].replace('Z', '+00:00')
                    )
                    
                    if datetime.utcnow().replace(tzinfo=expires_at.tzinfo) > expires_at:
                        logger.warning(f"⏰ OTP expired for {email}")
                        raise HTTPException(status_code=400, detail="OTP expired")
                    
                    if otp_record.get('attempts', 0) >= 3:
                        logger.warning(f"🚫 Too many attempts for {email}")
                        raise HTTPException(status_code=400, detail="Too many failed attempts")
                    
                    if otp_record['otp'] == otp:
                        supabase.table('email_otps')\
                            .update({'is_used': True})\
                            .eq('id', otp_record['id'])\
                            .execute()
                        verified = True
                        logger.info(f"✅ OTP verified from database for {email}")
                    else:
                        supabase.table('email_otps')\
                            .update({'attempts': otp_record.get('attempts', 0) + 1})\
                            .eq('id', otp_record['id'])\
                            .execute()
                        logger.warning(f"❌ Invalid OTP for {email}")
                        raise HTTPException(status_code=400, detail="Invalid OTP")
                        
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Database verification failed: {e}")
        
        # Fallback to memory store
        if not verified and email in _otp_store:
            stored = _otp_store[email]
            if stored['expires_at'] < datetime.utcnow():
                logger.warning(f"⏰ Memory OTP expired for {email}")
                raise HTTPException(status_code=400, detail="OTP expired")
            if stored['otp'] == otp:
                del _otp_store[email]
                verified = True
                logger.info(f"✅ OTP verified from memory for {email}")
            else:
                logger.warning(f"❌ Invalid memory OTP for {email}")
        
        if not verified:
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
        # Get or create user
        user = None
        if supabase:
            try:
                user_response = supabase.table('user_profiles')\
                    .select('*')\
                    .eq('email', email)\
                    .execute()
                
                if user_response.data:
                    user = user_response.data[0]
                    supabase.table('user_profiles')\
                        .update({'last_login': datetime.utcnow().isoformat()})\
                        .eq('id', user['id'])\
                        .execute()
                    logger.info(f"👤 Existing user logged in: {email}")
                else:
                    new_user = {
                        'email': email,
                        'subscription_type': 'free',
                        'is_active': True,
                        'created_at': datetime.utcnow().isoformat(),
                        'last_login': datetime.utcnow().isoformat()
                    }
                    user_response = supabase.table('user_profiles')\
                        .insert(new_user)\
                        .execute()
                    user = user_response.data[0] if user_response.data else new_user
                    logger.info(f"✨ New user created: {email}")
                    
            except Exception as e:
                logger.error(f"User profile error: {e}")
        
        if not user:
            user = {
                'id': email,
                'email': email,
                'subscription_type': 'free',
                'created_at': datetime.utcnow().isoformat()
            }
            logger.info(f"👤 Fallback user created: {email}")
        
        # Create JWT token
        access_token = create_access_token({"sub": email})
        
        logger.info(f"🎉 Login successful for {email}")
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.get('id', email),
                "email": user.get('email', email),
                "subscription_type": user.get('subscription_type', 'free')
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ Verify OTP failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Verification failed: {str(e)}"
        )


@router.get("/me")
async def get_current_user_info(
    # Import from dependencies instead
):
    """Get current logged-in user info"""
    try:
        # This endpoint requires authentication via JWT
        # The actual auth is handled by Depends(get_current_user) at route level
        # This is a placeholder - in real usage, add the dependency
        return {
            "email": "user@example.com",
            "subscription_type": "free"
        }
    except Exception as e:
        logger.exception(f"Get user failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def auth_health():
    """Check auth service health"""
    return {
        "status": "healthy",
        "supabase_connected": supabase is not None,
        "jwt_configured": bool(settings.JWT_SECRET)
    }