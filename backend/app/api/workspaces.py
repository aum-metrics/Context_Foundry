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
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except:
    SUPABASE_AVAILABLE = False

from core.config import settings
from core.dependencies import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize Supabase
supabase: Optional[Client] = None
if settings.SUPABASE_URL and settings.SUPABASE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Supabase: {e}")

# In-memory storage (should be in database)
workspaces: Dict[str, Dict[str, Any]] = {}
workspace_members: Dict[str, List[str]] = {}  # workspace_id -> [user_emails]

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
    
    # Store workspace
    workspaces[workspace_id] = workspace
    workspace_members[workspace_id] = [user_email]
    
    # Save to database
    if supabase:
        try:
            supabase.table("workspaces").insert({
                **workspace,
                "members": [user_email]
            }).execute()
            
            # Add owner as member
            supabase.table("workspace_members").insert({
                "workspace_id": workspace_id,
                "user_email": user_email,
                "role": "owner",
                "joined_at": datetime.utcnow().isoformat()
            }).execute()
        except Exception as e:
            logger.error(f"Failed to save workspace: {e}")
    
    logger.info(f"✅ Workspace created: {workspace_id} by {user_email}")
    
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
    
    # Get user's workspaces
    user_workspaces = [
        ws for ws_id, ws in workspaces.items()
        if user_email in workspace_members.get(ws_id, [])
    ]
    
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
    
    if workspace_id not in workspaces:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    workspace = workspaces[workspace_id]
    
    # Check access
    if not workspace.get("is_public") and user_email not in workspace_members.get(workspace_id, []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get members
    members = workspace_members.get(workspace_id, [])
    
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
    
    if workspace_id not in workspaces:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    workspace = workspaces[workspace_id]
    
    # Check if user is owner or admin
    if user_email != workspace["owner_email"]:
        raise HTTPException(status_code=403, detail="Only workspace owner can invite members")
    
    # Enforce Hard Limit: Max 25 seats per organization
    current_members = workspace_members.get(workspace_id, [])
    if len(current_members) >= 25:
        raise HTTPException(status_code=403, detail="Maximum limit of 25 seats per organization reached. Contact support to negotiate an Enterprise custom limit.")

    # Check if already a member
    if request.email in current_members:
        raise HTTPException(status_code=400, detail="User is already a member")
    
    # Add member
    if workspace_id not in workspace_members:
        workspace_members[workspace_id] = []
    
    workspace_members[workspace_id].append(request.email)
    workspace["member_count"] = len(workspace_members[workspace_id])
    workspace["updated_at"] = datetime.utcnow().isoformat()
    
    # Save to database
    if supabase:
        try:
            supabase.table("workspace_members").insert({
                "workspace_id": workspace_id,
                "user_email": request.email,
                "role": request.role,
                "invited_by": user_email,
                "joined_at": datetime.utcnow().isoformat()
            }).execute()
            
            # Update member count
            supabase.table("workspaces").update({
                "member_count": workspace["member_count"],
                "updated_at": workspace["updated_at"]
            }).eq("workspace_id", workspace_id).execute()
        except Exception as e:
            logger.error(f"Failed to add member: {e}")
    
    logger.info(f"✅ User invited to workspace: {request.email} -> {workspace_id}")
    
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
    
    if workspace_id not in workspaces:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    workspace = workspaces[workspace_id]
    
    # Check if user is owner
    if user_email != workspace["owner_email"]:
        raise HTTPException(status_code=403, detail="Only workspace owner can remove members")
    
    # Can't remove owner
    if email == workspace["owner_email"]:
        raise HTTPException(status_code=400, detail="Cannot remove workspace owner")
    
    # Remove member
    if workspace_id in workspace_members and email in workspace_members[workspace_id]:
        workspace_members[workspace_id].remove(email)
        workspace["member_count"] = len(workspace_members[workspace_id])
        workspace["updated_at"] = datetime.utcnow().isoformat()
        
        # Update database
        if supabase:
            try:
                supabase.table("workspace_members").delete().eq(
                    "workspace_id", workspace_id
                ).eq("user_email", email).execute()
                
                supabase.table("workspaces").update({
                    "member_count": workspace["member_count"],
                    "updated_at": workspace["updated_at"]
                }).eq("workspace_id", workspace_id).execute()
            except Exception as e:
                logger.error(f"Failed to remove member: {e}")
        
        logger.info(f"✅ Member removed from workspace: {email} <- {workspace_id}")
        
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
    
    if workspace_id not in workspaces:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    workspace = workspaces[workspace_id]
    
    # Check if user is owner
    if user_email != workspace["owner_email"]:
        raise HTTPException(status_code=403, detail="Only workspace owner can update settings")
    
    # Update fields
    if request.name is not None:
        workspace["name"] = request.name
    if request.description is not None:
        workspace["description"] = request.description
    if request.is_public is not None:
        workspace["is_public"] = request.is_public
    
    workspace["updated_at"] = datetime.utcnow().isoformat()
    
    # Update database
    if supabase:
        try:
            update_data = {
                "updated_at": workspace["updated_at"]
            }
            if request.name is not None:
                update_data["name"] = request.name
            if request.description is not None:
                update_data["description"] = request.description
            if request.is_public is not None:
                update_data["is_public"] = request.is_public
            
            supabase.table("workspaces").update(update_data).eq(
                "workspace_id", workspace_id
            ).execute()
        except Exception as e:
            logger.error(f"Failed to update workspace: {e}")
    
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
    
    if workspace_id not in workspaces:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    workspace = workspaces[workspace_id]
    
    # Check if user is owner
    if user_email != workspace["owner_email"]:
        raise HTTPException(status_code=403, detail="Only workspace owner can delete")
    
    # Delete workspace
    del workspaces[workspace_id]
    if workspace_id in workspace_members:
        del workspace_members[workspace_id]
    
    # Delete from database
    if supabase:
        try:
            supabase.table("workspaces").delete().eq("workspace_id", workspace_id).execute()
            supabase.table("workspace_members").delete().eq("workspace_id", workspace_id).execute()
        except Exception as e:
            logger.error(f"Failed to delete workspace: {e}")
    
    logger.info(f"✅ Workspace deleted: {workspace_id}")
    
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
    
    if workspace_id not in workspaces:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Check access
    if user_email not in workspace_members.get(workspace_id, []):
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
        "active_workspaces": len(workspaces),
        "total_members": sum(len(members) for members in workspace_members.values()),
        "features": [
            "workspace_management",
            "team_collaboration",
            "member_invitations",
            "role_based_access",
            "activity_tracking"
        ]
    }
