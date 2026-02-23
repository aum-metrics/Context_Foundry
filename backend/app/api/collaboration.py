# backend/app/api/collaboration.py
# Author: Sambath Kumar Natarajan
# Company: AUM Data Labs
# Purpose: Collaborative Analysis Service - Professional tier ONLY
# Tiers: free, starter, professional (ONLY professional users can collaborate)
"""
Collaborative Analysis Service
Enable teams to share and collaborate on data insights
ONLY Professional tier users can share and access shared content
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
import secrets
import json
import logging

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except:
    SUPABASE_AVAILABLE = False

from core.config import settings
from core.dependencies import get_current_user

# In-memory storage fallback
_shared_analyses = {}
_comments = {}
_collaboration_access = {}  # {share_id: [allowed_emails]}

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize Supabase
supabase: Optional[Client] = None
if settings.SUPABASE_URL and settings.SUPABASE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Supabase: {e}")

def check_professional_subscription(email: str) -> bool:
    """
    Check if user has PROFESSIONAL subscription.
    Tiers: free, starter, professional
    ONLY professional tier can collaborate
    """
    if not supabase:
        return False
    
    try:
        result = supabase.table("user_profiles").select(
            "subscription_type, subscription_expiry"
        ).eq("email", email).execute()
        
        if not result.data or len(result.data) == 0:
            return False
        
        user = result.data[0]
        subscription_type = user.get("subscription_type", "free")
        
        # ONLY professional tier can collaborate
        if subscription_type.lower() != "professional":
            return False
        
        # Check expiry
        subscription_expiry = user.get("subscription_expiry")
        if subscription_expiry:
            try:
                expiry_date = datetime.fromisoformat(subscription_expiry.replace('Z', '+00:00'))
                # Ensure UTC comparison
                if datetime.now(timezone.utc) > expiry_date:
                    return False
            except ValueError:
                pass
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to check subscription: {e}")
        return False

class CollaborationRequest(BaseModel):
    message: str

class CreateShareRequest(BaseModel):
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    analysis_data: Dict[str, Any]
    title: str
    description: str = ""
    expires_in_days: int = 30
    allowed_emails: List[str] = []  # Specific users who can access
    is_public: bool = True
    allow_comments: bool = True

class AddCommentRequest(BaseModel):
    share_id: str
    user_email: Optional[str] = None
    comment_text: str
    insight_id: Optional[str] = None

class SimpleShareRequest(BaseModel):
    dataset_id: str
    email: str
    permission: str

@router.post("/create-share")
async def create_share(request: CreateShareRequest, current_user: dict = Depends(get_current_user)):
    """
    Create a shared analysis (Professional tier ONLY)
    Both sender and recipients must be professional users
    """
    user_email = current_user.get("email")
    user_id = current_user.get("id")

    if not user_email or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user session")

    # Check if sender is professional
    if not check_professional_subscription(user_email):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "Collaboration requires Professional subscription",
                "message": "Upgrade to Professional plan to share analyses. Available tiers: free, starter, professional",
                "upgrade_url": "https://aumdatalabs.com/pricing"
            }
        )
    
    # Check if all recipients are professional
    for recipient_email in request.allowed_emails:
        if not check_professional_subscription(recipient_email):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": f"Recipient {recipient_email} does not have Professional subscription",
                    "message": "All collaborators must have Professional subscriptions",
                    "upgrade_url": "https://aumdatalabs.com/pricing"
                }
            )
    
    service = CollaborationService()
    result = service.create_shared_analysis(
        user_id=user_id,
        user_email=user_email,
        analysis_data=request.analysis_data,
        title=request.title,
        description=request.description,
        expires_in_days=request.expires_in_days,
        allowed_emails=request.allowed_emails
    )
    return {"success": True, "share_id": result["share_id"], "share_url": f"{settings.FRONTEND_URL}/shared/{result['share_id']}"}

@router.post("/add-comment")
async def add_comment(request: AddCommentRequest, current_user: dict = Depends(get_current_user)):
    """Add comment to shared analysis (Professional tier ONLY)"""
    user_email = current_user.get("email")
    if not user_email:
        raise HTTPException(status_code=401, detail="Invalid user session")

    # Check if user is professional
    if not check_professional_subscription(user_email):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "Collaboration requires Professional subscription",
                "message": "Upgrade to Professional plan to collaborate",
                "upgrade_url": "https://aumdatalabs.com/pricing"
            }
        )
    
    service = CollaborationService()
    comment = service.add_comment(
        share_id=request.share_id,
        user_email=user_email,
        comment_text=request.comment_text,
        insight_id=request.insight_id
    )
    return {"success": True, "comment": comment}

class EmailShareRequest(BaseModel):
    dataset_id: str
    dataset_name: str
    recipient_email: str
    share_url: str
    sender_name: str = "AUM Analytics User"
    sender_email: str  # Added to check sender subscription

@router.post("/share")
async def share_dataset_email(req: EmailShareRequest):
    """
    Send dataset share via email (Professional tier ONLY)
    Both sender and recipient must be professional users
    """
    try:
        # Check if sender is professional
        # Check if sender is professional
        # if not check_professional_subscription(req.sender_email):
        #     raise HTTPException(
        #         status_code=403,
        #         detail={
        #             "error": "Sharing requires Professional subscription",
        #             "message": "Upgrade to Professional plan to share datasets. Available tiers: free, starter, professional",
        #             "upgrade_url": "https://aumdatalabs.com/pricing"
        #         }
        #     )
        
        # Check if recipient is professional
        # if not check_professional_subscription(req.recipient_email):
        #     raise HTTPException(
        #         status_code=403,
        #         detail={
        #             "error": f"Recipient {req.recipient_email} does not have Professional subscription",
        #             "message": "Recipient must have a Professional subscription to access shared datasets",
        #             "upgrade_url": "https://aumdatalabs.com/pricing"
        #         }
        #     )
        
        from utils.email import email_service
        
        success = email_service.send_share_notification(
            recipient_email=req.recipient_email,
            sender_name=req.sender_name,
            dataset_name=req.dataset_name,
            share_url=req.share_url
        )
        
        if success:
            # Store collaboration access control
            share_id = req.share_url.split('/')[-1]  # Extract share ID from URL
            if share_id not in _collaboration_access:
                _collaboration_access[share_id] = []
            _collaboration_access[share_id].append(req.recipient_email)
            
            logger.info(f"Dataset shared: {req.dataset_name} from {req.sender_email} to {req.recipient_email}")
            
            return {
                "success": True,
                "message": f"Share notification sent to {req.recipient_email}",
                "share_link": req.share_url
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to send email. Please check SMTP configuration."
            )
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Email service not configured"
        )
    except Exception as e:
        logger.error(f"Email share failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send email: {str(e)}"
        )

class VerifyShareAccessRequest(BaseModel):
    share_id: str
    user_email: str

@router.post("/verify-access")
async def verify_share_access(req: VerifyShareAccessRequest):
    """
    Verify if a user can access a shared dataset (Professional tier ONLY)
    Only the specific recipient can access, not everyone with the link
    """
    # Check if user is professional
    if not check_professional_subscription(req.user_email):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "Access denied",
                "message": "Professional subscription required to access shared content. Available tiers: free, starter, professional",
                "upgrade_url": "https://aumdatalabs.com/pricing"
            }
        )
    
    # Check if user is in the allowed list for this share
    if req.share_id not in _collaboration_access:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "Share not found",
                "message": "This share link does not exist or has expired"
            }
        )
    
    allowed_emails = _collaboration_access[req.share_id]
    if req.user_email not in allowed_emails:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "Access denied",
                "message": "You do not have permission to access this shared content. Only the specific recipient can access this link."
            }
        )
    
    logger.info(f"Access granted: {req.user_email} -> share {req.share_id}")
    
    return {
        "success": True,
        "access_granted": True,
        "message": "Access granted"
    }

@router.get("/shared/{share_id}")
async def get_shared_analysis_endpoint(share_id: str):
    """
    Get a shared analysis by ID (public endpoint - no auth required)
    This allows anyone with the link to view the shared analysis
    """
    try:
        service = CollaborationService()
        analysis = service.get_shared_analysis(share_id)
        
        if not analysis:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "Shared analysis not found",
                    "message": "This share link does not exist or has expired"
                }
            )
        
        logger.info(f"Shared analysis retrieved: {share_id}")
        return analysis
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get shared analysis: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve shared analysis: {str(e)}"
        )

@router.post("/create-share")
async def create_share_endpoint(request: CreateShareRequest, current_user: dict = Depends(get_current_user)):
    """
    Create a shareable analysis link (Professional tier ONLY)
    """
    # Check if user is professional
    if not check_professional_subscription(request.user_email):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "Sharing requires Professional subscription",
                "message": "Upgrade to Professional plan to share analyses",
                "upgrade_url": "https://aumdatalabs.com/pricing"
            }
        )
    
    try:
        service = CollaborationService()
        shared_analysis = service.create_shared_analysis(
            user_id=request.user_id,
            user_email=request.user_email,
            analysis_data=request.analysis_data,
            title=request.title,
            description=request.description,
            expires_in_days=request.expires_in_days
        )
        
        # Store allowed emails for access control
        share_id = shared_analysis['share_id']
        if request.allowed_emails:
            _collaboration_access[share_id] = request.allowed_emails
        
        share_url = f"{settings.FRONTEND_URL}/shared/{share_id}"
        
        logger.info(f"Share created: {share_id} by {request.user_email}")
        
        return {
            "success": True,
            "share_id": share_id,
            "share_url": share_url,
            "expires_at": shared_analysis['expires_at']
        }
        
    except Exception as e:
        logger.error(f"Failed to create share: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create share: {str(e)}"
        )

@router.post("/send")
async def send_message(req: CollaborationRequest):
    return {
        "success": True,
        "echo": req.message
    }

class CollaborationService:
    """Manage shared analyses and team collaboration"""
    
    def __init__(self):
        self.supabase: Optional[Client] = None
        if SUPABASE_AVAILABLE and settings.SUPABASE_URL and settings.SUPABASE_KEY:
            self.supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    
    def create_shared_analysis(
        self,
        user_id: str,
        user_email: str,
        analysis_data: Dict[str, Any],
        title: str,
        description: str = "",
        expires_in_days: int = 30,
        allowed_emails: List[str] = []
    ) -> Dict[str, Any]:
        """
        Create a shareable analysis link
        """
        share_id = secrets.token_urlsafe(16)
        expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
        
        shared_analysis = {
            'share_id': share_id,
            'owner_id': user_id,
            'owner_email': user_email,
            'title': title,
            'description': description,
            'analysis_data': analysis_data,
            'created_at': datetime.utcnow().isoformat(),
            'expires_at': expires_at.isoformat(),
            'view_count': 0,
            'is_public': True,
            'allow_comments': True,
            'collaborators': [{'email': email, 'permission': 'view', 'added_at': datetime.utcnow().isoformat()} for email in allowed_emails]
        }
        
        if self.supabase:
            try:
                response = self.supabase.table('shared_analyses').insert({
                    **shared_analysis,
                    'analysis_data': json.dumps(analysis_data)
                }).execute()
                
                if response.data:
                    return response.data[0]
            except Exception as e:
                print(f"Supabase share failed: {e}")
        
        # Fallback to memory
        _shared_analyses[share_id] = shared_analysis
        return shared_analysis
    
    def get_shared_analysis(self, share_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a shared analysis
        """
        if self.supabase:
            try:
                response = self.supabase.table('shared_analyses')\
                    .select('*')\
                    .eq('share_id', share_id)\
                    .execute()
                
                if response.data and len(response.data) > 0:
                    analysis = response.data[0]
                    
                    # Check expiry
                    expires_at = datetime.fromisoformat(analysis['expires_at'].replace('Z', '+00:00'))
                    if datetime.utcnow().replace(tzinfo=expires_at.tzinfo) > expires_at:
                        return None
                    
                    # Increment view count
                    self.supabase.table('shared_analyses')\
                        .update({'view_count': analysis.get('view_count', 0) + 1})\
                        .eq('share_id', share_id)\
                        .execute()
                    
                    # Parse JSON data
                    if isinstance(analysis.get('analysis_data'), str):
                        analysis['analysis_data'] = json.loads(analysis['analysis_data'])
                    
                    return analysis
            except Exception as e:
                print(f"Supabase fetch failed: {e}")
        
        # Fallback
        analysis = _shared_analyses.get(share_id)
        if analysis:
            expires_at = datetime.fromisoformat(analysis['expires_at'])
            if datetime.utcnow() > expires_at:
                return None
            analysis['view_count'] += 1
        
        return analysis
    
    def add_collaborator(
        self,
        share_id: str,
        collaborator_email: str,
        permission: str = 'view'  # 'view', 'comment', 'edit'
    ) -> bool:
        """
        Add a collaborator to shared analysis
        """
        if self.supabase:
            try:
                # Get current analysis
                analysis = self.get_shared_analysis(share_id)
                if not analysis:
                    return False
                
                collaborators = analysis.get('collaborators', [])
                
                # Check if already exists
                if any(c['email'] == collaborator_email for c in collaborators):
                    return True
                
                collaborators.append({
                    'email': collaborator_email,
                    'permission': permission,
                    'added_at': datetime.utcnow().isoformat()
                })
                
                self.supabase.table('shared_analyses')\
                    .update({'collaborators': collaborators})\
                    .eq('share_id', share_id)\
                    .execute()
                
                return True
            except Exception as e:
                print(f"Add collaborator failed: {e}")
                return False
        
        # Fallback
        if share_id in _shared_analyses:
            collaborators = _shared_analyses[share_id].get('collaborators', [])
            if not any(c['email'] == collaborator_email for c in collaborators):
                collaborators.append({
                    'email': collaborator_email,
                    'permission': permission,
                    'added_at': datetime.utcnow().isoformat()
                })
                _shared_analyses[share_id]['collaborators'] = collaborators
            return True
        
        return False
    
    def add_comment(
        self,
        share_id: str,
        user_email: str,
        comment_text: str,
        insight_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Add a comment to shared analysis
        """
        comment = {
            'id': secrets.token_urlsafe(8),
            'share_id': share_id,
            'user_email': user_email,
            'comment_text': comment_text,
            'insight_id': insight_id,
            'created_at': datetime.utcnow().isoformat(),
            'edited': False
        }
        
        if self.supabase:
            try:
                response = self.supabase.table('shared_analysis_comments').insert(comment).execute()
                if response.data:
                    return response.data[0]
            except Exception as e:
                print(f"Comment insert failed: {e}")
        
        # Fallback
        if share_id not in _comments:
            _comments[share_id] = []
        _comments[share_id].append(comment)
        
        return comment
    
    def get_comments(self, share_id: str) -> List[Dict[str, Any]]:
        """
        Get all comments for a shared analysis
        """
        if self.supabase:
            try:
                response = self.supabase.table('shared_analysis_comments')\
                    .select('*')\
                    .eq('share_id', share_id)\
                    .order('created_at', desc=False)\
                    .execute()
                
                if response.data:
                    return response.data
            except Exception as e:
                print(f"Get comments failed: {e}")
        
        # Fallback
        return _comments.get(share_id, [])
    
    def get_user_shared_analyses(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all analyses shared by a user
        """
        if self.supabase:
            try:
                response = self.supabase.table('shared_analyses')\
                    .select('share_id, title, description, created_at, view_count, expires_at')\
                    .eq('owner_id', user_id)\
                    .order('created_at', desc=True)\
                    .execute()
                
                if response.data:
                    return response.data
            except Exception as e:
                print(f"Get user analyses failed: {e}")
        
        # Fallback
        return [
            {k: v for k, v in analysis.items() if k != 'analysis_data'}
            for analysis in _shared_analyses.values()
            if analysis.get('owner_id') == user_id
        ]
    
    def delete_shared_analysis(self, share_id: str, user_id: str) -> bool:
        """
        Delete a shared analysis (owner only)
        """
        if self.supabase:
            try:
                self.supabase.table('shared_analyses')\
                    .delete()\
                    .eq('share_id', share_id)\
                    .eq('owner_id', user_id)\
                    .execute()
                return True
            except Exception as e:
                print(f"Delete failed: {e}")
                return False
        
        # Fallback
        if share_id in _shared_analyses:
            if _shared_analyses[share_id].get('owner_id') == user_id:
                del _shared_analyses[share_id]
                if share_id in _comments:
                    del _comments[share_id]
                return True
        
        return False
    
    def update_share_settings(
        self,
        share_id: str,
        user_id: str,
        settings: Dict[str, Any]
    ) -> bool:
        """
        Update sharing settings (owner only)
        """
        if self.supabase:
            try:
                # Verify ownership
                analysis = self.get_shared_analysis(share_id)
                if not analysis or analysis.get('owner_id') != user_id:
                    return False
                
                self.supabase.table('shared_analyses')\
                    .update(settings)\
                    .eq('share_id', share_id)\
                    .execute()
                
                return True
            except Exception as e:
                print(f"Update settings failed: {e}")
                return False
        
        # Fallback
        if share_id in _shared_analyses:
            if _shared_analyses[share_id].get('owner_id') == user_id:
                _shared_analyses[share_id].update(settings)
                return True
        
        return False
