# backend/app/api/workspaces.py
"""
WORKSPACE MANAGEMENT
Team-centric collaborative workspaces for data analysis
Core of the "Figma for Data" experience
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
from datetime import datetime
import logging
import secrets

try:
    from supabase import Client, create_client
except ImportError:
    Client = Any

from core.config import settings
from core.firebase_config import db
from core.security import get_current_user
from api.audit import log_audit_event

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize Supabase
supabase: Optional[Client] = None
if settings.SUPABASE_URL and settings.SUPABASE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Supabase: {e}")

# Database-only storage (Firestore)
# In-memory storage removed as per brutal audit hardening

class CreateWorkspaceRequest(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = False
    organization_id: Optional[str] = None

class InviteMemberRequest(BaseModel):
    workspace_id: str
    email: str
    role: str = "member"  # owner, admin, member, viewer

class UpdateWorkspaceRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None

@router.post("/create")
async def create_workspace(
    request: CreateWorkspaceRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new collaborative workspace
    """
    user_email = current_user.get("email")
    if not user_email:
        raise HTTPException(status_code=401, detail="Invalid user session")
    
    # Generate workspace ID
    workspace_id = f"ws_{secrets.token_urlsafe(16)}"
    
    # Create workspace
    workspace = {
        "workspace_id": workspace_id,
        "name": request.name,
        "description": request.description or "",
        "owner_email": user_email,
        "organization_id": request.organization_id,
        "is_public": request.is_public,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "member_count": 1,
        "analysis_count": 0,
        "last_activity": datetime.utcnow().isoformat()
    }
    
    # Store workspace to Firestore
    if db:
        try:
            db.collection("workspaces").document(workspace_id).set({
                **workspace,
                "members": [user_email]
            })
            
            db.collection("workspaces").document(workspace_id).collection("members").document(user_email.replace("@", "_at_")).set({
                "user_email": user_email,
                "role": "owner",
                "joined_at": datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to save workspace to Firestore: {e}")
            raise HTTPException(status_code=500, detail="Database insertion failed")
    
    logger.info(f"✅ Workspace created: {workspace_id} by {user_email}")
    
    # SOC2 Audit Log
    log_audit_event(
        org_id=request.organization_id or "user_level",
        actor_id=user_email,
        event_type="workspace_created",
        resource_id=workspace_id,
        metadata={"name": request.name, "is_public": request.is_public}
    )
    
    return {
        "success": True,
        "workspace": workspace,
        "message": f"Workspace '{request.name}' created successfully"
    }

@router.get("/list")
async def list_workspaces(current_user: dict = Depends(get_current_user)):
    """
    List all workspaces the user has access to
    """
    user_email = current_user.get("email")
    
    user_workspaces = []
    if db:
        try:
            query = db.collection("workspaces").where("members", "array_contains", user_email).stream()
            for doc in query:
                user_workspaces.append(doc.to_dict())
        except Exception as e:
            logger.error(f"Failed to fetch workspaces: {e}")    
    # Sort by last activity
    user_workspaces.sort(key=lambda x: x.get("last_activity", ""), reverse=True)
    
    return {
        "success": True,
        "workspaces": user_workspaces,
        "total_count": len(user_workspaces)
    }

@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get workspace details
    """
    user_email = current_user.get("email")
    
    if not db:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    doc = db.collection("workspaces").document(workspace_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    workspace = doc.to_dict() or {}
    
    # Get members
    members = workspace.get("members", [])
    if not workspace.get("is_public") and user_email not in members:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get member details (simplified)
    member_details = [
        {
            "email": email,
            "role": "owner" if email == workspace["owner_email"] else "member"
        }
        for email in members
    ]
    
    return {
        "success": True,
        "workspace": {
            **workspace,
            "members": member_details,
            "is_member": user_email in members,
            "is_owner": user_email == workspace["owner_email"]
        }
    }

@router.post("/invite")
async def invite_member(
    request: InviteMemberRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Invite a user to a workspace
    """
    user_email = current_user.get("email")
    workspace_id = request.workspace_id
    
    if not db:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    doc = db.collection("workspaces").document(workspace_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    workspace = doc.to_dict() or {}
    
    # Check if user is owner or admin
    if user_email != workspace["owner_email"]:
        raise HTTPException(status_code=403, detail="Only workspace owner can invite members")
    
    # Enforce Seat Limits based on plan
    org_plan = workspace.get("subscription", {}).get("planId", "explorer")
    seat_limits = {
        "explorer": 1,
        "growth": 5,
        "scale": 25,
        "enterprise": 25,
        "professional": 5,
        "starter": 1
    }
    max_seats = seat_limits.get(org_plan, 1)

    current_members = workspace.get("members", [])
    if len(current_members) >= max_seats:
        raise HTTPException(status_code=403, detail=f"Maximum limit of {max_seats} seats for the {org_plan.capitalize()} plan reached. Please upgrade to add more users.")
    if request.email in current_members:
        raise HTTPException(status_code=400, detail="User is already a member")
        
    current_members.append(request.email)
    
    try:
        doc_ref = db.collection("workspaces").document(workspace_id)
        doc.reference.update({
            "members": current_members,
            "member_count": len(current_members),
            "updated_at": datetime.utcnow().isoformat()
        })
        
        doc.reference.collection("members").document(request.email.replace("@", "_at_")).set({
            "user_email": request.email,
            "role": request.role,
            "invited_by": user_email,
            "joined_at": datetime.utcnow().isoformat()
        })
    except Exception as e:
        logger.error(f"Invite error: {e}")
    
    logger.info(f"✅ User invited to workspace: {request.email} -> {workspace_id}")
    
    # SOC2 Audit Log
    log_audit_event(
        org_id=workspace.get("organization_id", "user_level"),
        actor_id=user_email,
        event_type="workspace_member_invited",
        resource_id=workspace_id,
        metadata={"invited_email": request.email, "role": request.role}
    )
    
    return {
        "success": True,
        "message": f"Invitation sent to {request.email}",
        "workspace_id": workspace_id,
        "member_count": workspace["member_count"]
    }

@router.delete("/{workspace_id}/members/{email}")
async def remove_member(
    workspace_id: str,
    email: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Remove a member from workspace
    """
    user_email = current_user.get("email")
    
    if not db:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    doc = db.collection("workspaces").document(workspace_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    workspace = doc.to_dict() or {}
    
    # Check if user is owner
    if user_email != workspace["owner_email"]:
        raise HTTPException(status_code=403, detail="Only workspace owner can remove members")
    
    # Can't remove owner
    if email == workspace["owner_email"]:
        raise HTTPException(status_code=400, detail="Cannot remove workspace owner")
    
    current_members = workspace.get("members", [])
    if email in current_members:
        current_members.remove(email)
        
        try:
            doc.reference.update({
                "members": current_members,
                "member_count": len(current_members),
                "updated_at": datetime.utcnow().isoformat()
            })
            doc.reference.collection("members").document(email.replace("@", "_at_")).delete()
        except Exception as e:
            logger.error(f"Remove member error: {e}")
        
        logger.info(f"✅ Member removed from workspace: {email} <- {workspace_id}")
        
        # SOC2 Audit Log
        log_audit_event(
            org_id=workspace.get("organization_id", "user_level"),
            actor_id=user_email,
            event_type="workspace_member_removed",
            resource_id=workspace_id,
            metadata={"removed_email": email}
        )
        
        return {
            "success": True,
            "message": f"Member {email} removed successfully"
        }
    else:
        raise HTTPException(status_code=404, detail="Member not found in workspace")

@router.put("/{workspace_id}")
async def update_workspace(
    workspace_id: str,
    request: UpdateWorkspaceRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update workspace details
    """
    user_email = current_user.get("email")
    
    if not db:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    doc = db.collection("workspaces").document(workspace_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    workspace = doc.to_dict() or {}
    
    # Check if user is owner
    if user_email != workspace["owner_email"]:
        raise HTTPException(status_code=403, detail="Only workspace owner can update settings")
    
    update_data = {"updated_at": datetime.utcnow().isoformat()}
    if request.name is not None:
        update_data["name"] = request.name
        workspace["name"] = request.name
    if request.description is not None:
        update_data["description"] = request.description
        workspace["description"] = request.description
    if request.is_public is not None:
        update_data["is_public"] = request.is_public
        workspace["is_public"] = request.is_public
        
    try:
        doc.reference.update(update_data)
    except Exception as e:
        logger.error(f"Workspace update failed: {e}")
    
    logger.info(f"✅ Workspace updated: {workspace_id}")
    
    return {
        "success": True,
        "workspace": workspace,
        "message": "Workspace updated successfully"
    }

@router.delete("/{workspace_id}")
async def delete_workspace(
    workspace_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a workspace (owner only)
    """
    user_email = current_user.get("email")
    
    if not db:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    doc = db.collection("workspaces").document(workspace_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    workspace = doc.to_dict() or {}
    
    # Check if user is owner
    if user_email != workspace["owner_email"]:
        raise HTTPException(status_code=403, detail="Only workspace owner can delete")
    
    try:
        doc.reference.delete()
    except Exception as e:
        logger.error(f"Delete workspace failed: {e}")
    
    logger.info(f"✅ Workspace deleted: {workspace_id}")
    
    # SOC2 Audit Log
    log_audit_event(
        org_id=workspace.get("organization_id", "user_level"),
        actor_id=user_email,
        event_type="workspace_deleted",
        resource_id=workspace_id,
        metadata={"name": workspace.get("name")}
    )
    
    return {
        "success": True,
        "message": "Workspace deleted successfully"
    }

@router.get("/{workspace_id}/activity")
async def get_workspace_activity(
    workspace_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Get recent activity in workspace
    """
    user_email = current_user.get("email")
    
    doc_ref = db.collection("workspaces").document(workspace_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Workspace not found")
    workspace = doc.to_dict() or {}
    members = workspace.get("members", [])
    if user_email not in members:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Mock activity data (should come from database)
    activities = [
        {
            "id": "act_1",
            "type": "analysis_created",
            "user": "john@example.com",
            "message": "Created new analysis: Revenue Q4",
            "timestamp": datetime.utcnow().isoformat()
        },
        {
            "id": "act_2",
            "type": "member_joined",
            "user": "sarah@example.com",
            "message": "Joined the workspace",
            "timestamp": datetime.utcnow().isoformat()
        }
    ]
    
    return {
        "success": True,
        "activities": activities[:limit],
        "total_count": len(activities)
    }

@router.get("/health")
async def workspaces_health():
    """Health check for workspaces service"""
    return {
        "status": "healthy",
        "service": "workspaces",
        "active_workspaces": "db_managed",
        "total_members": "db_managed",
        "features": [
            "workspace_management",
            "team_collaboration",
            "member_invitations",
            "role_based_access",
            "activity_tracking"
        ]
    }
