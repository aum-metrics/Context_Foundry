# backend/app/api/workspaces.py
"""
WORKSPACE MANAGEMENT
Team-centric collaborative workspaces for data analysis
Core of the "Figma for Data" experience
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
import logging
import secrets
import os

from core.config import settings
from core.firebase_config import db
from core.security import get_auth_context, get_current_user, verify_user_org_access
from api.audit import log_audit_event
from google.cloud import firestore
from utils.email_service import send_invite_email

from core.config import settings
from core.firebase_config import db
from core.security import get_auth_context, get_current_user, verify_user_org_access
from api.audit import log_audit_event
from google.cloud import firestore

router = APIRouter()
logger = logging.getLogger(__name__)

# Supabase has been deprecated. All workspace and member data is stored in Firestore.

# Database-only storage (Firestore)
# In-memory storage removed as per brutal audit hardening

class ProvisionOrgRequest(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None

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

@router.post("/provision")
async def provision_organization(
    current_user: dict = Depends(get_current_user),
    request: Optional[ProvisionOrgRequest] = None,
):
    """
    Called by the frontend immediately after Firebase authenticates a new user.
    Creates the Organization, User record, and automatically provisions 
    infrastructure API keys to achieve Zero-Friction onboarding (No BYOK required).
    Accepts an empty body — email and name are inferred from the Firebase token.
    """
    uid = current_user.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid session")

    # Infer identity from token if not provided in body
    email = (request.email if request else None) or current_user.get("email", f"{uid}@unknown.com")
    name = (request.name if request else None) or current_user.get("name", email.split("@")[0])
        
    if not db:
        raise HTTPException(status_code=500, detail="Database unconfigured")
        
    try:
        # Check if user already exists
        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()
        
        if user_doc.exists:
            user_data = user_doc.to_dict() or {}
            org_id = user_data.get("orgId")
            return {
                "status": "existing",
                "orgId": org_id,
                "message": "User already provisioned."
            }
            
        # Check if they were invited (placeholder user exists)
        invited_users = db.collection("users").where("email", "==", email).where("status", "==", "invited_pending_auth").limit(1).get()
        if invited_users:
            placeholder_doc = invited_users[0]
            placeholder_data = placeholder_doc.to_dict()
            org_id = placeholder_data.get("orgId")
            role = placeholder_data.get("role", "member")
            placeholder_uid = placeholder_doc.id
            
            # Auto-accept: create actual user doc, delete placeholder
            user_payload = {
                "uid": uid,
                "email": email,
                "orgId": org_id,
                "role": role,
                "joinedAt": datetime.now(timezone.utc).isoformat()
            }
            user_ref.set(user_payload)
            placeholder_doc.reference.delete()
            
            # Mark the actual invite doc as accepted
            invite_id = placeholder_uid.replace("invited_", "")
            invite_ref = db.collection("organizations").document(org_id).collection("pendingInvites").document(invite_id)
            if invite_ref.get().exists:
                 invite_ref.update({"status": "accepted", "acceptedAt": datetime.now(timezone.utc).isoformat(), "acceptedByUid": uid})
            
            log_audit_event(
                org_id=org_id,
                actor_id=uid,
                event_type="member_joined",
                resource_id=email,
                metadata={"inviteId": invite_id, "auto_accepted": True}
            )
            
            return {
                "status": "joined_existing",
                "orgId": org_id,
                "message": "Automatically joined organization from pending invitation."
            }
            
        # Generates a new Organization ID
        new_org_id = f"org_{int(datetime.now(timezone.utc).timestamp())}_{secrets.token_urlsafe(6)}"
        
        # Mints the B2B Gateway API Key for this new tenant
        b2b_api_key = f"aum_{secrets.token_urlsafe(32)}"
        hashed_key = __import__("hashlib").sha256(b2b_api_key.encode()).hexdigest()
        
        # We auto-provision the internal inference keys from the Master Environment
        # so the user can immediately use the Simulator without bringing their own keys.
        org_payload = {
            "id": new_org_id,
            "name": name,
            "activeSeats": 1,
            "subscription": {
                "planId": "explorer",
                "status": "active",
                "simsThisCycle": 0,
                "maxSimulations": 3, # Explorer default
                "currentPeriodStart": datetime.now(timezone.utc),
                "currentPeriodEnd": datetime.now(timezone.utc)
            },
            "apiKeys": {
                # These are NOT the user's B2B key. 
                # These instruct the backend to use the Platform's Master Keys for this tenant.
                "openai": "internal_platform_managed",
                "gemini": "internal_platform_managed",
                "anthropic": "internal_platform_managed"
            },
            "createdAt": datetime.now(timezone.utc)
        }
        
        # 1. Create Organization
        db.collection("organizations").document(new_org_id).set(org_payload)
        
        # 2. Register User
        user_payload = {
            "uid": uid,
            "email": email,
            "orgId": new_org_id,
            "role": "admin"
        }
        user_ref.set(user_payload)
        
        # 3. Store the hashed B2B Gateway key for external API-based licensing
        db.collection("api_keys").document(hashed_key).set({
            "keyHash": hashed_key,
            "orgId": new_org_id,
            "name": "Default B2B Gateway Key",
            "createdAt": datetime.now(timezone.utc),
            "lastUsedAt": None,
            "status": "active"
        })
        
        # Write SOC2 Audit Log
        log_audit_event(
            org_id=new_org_id,
            actor_id=uid,
            event_type="organization_provisioned",
            resource_id=new_org_id,
            metadata={"plan": "explorer"}
        )
        
        return {
            "status": "provisioned",
            "orgId": new_org_id,
            "apiKey": b2b_api_key, # Only returned ONCE
            "message": "Zero-friction onboarding complete."
        }
        
    except Exception as e:
        logger.error(f"Failed to provision org for {uid}: {e}")
        raise HTTPException(status_code=500, detail="Provisioning workflow failed.")

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
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "member_count": 1,
        "analysis_count": 0,
        "last_activity": datetime.now(timezone.utc).isoformat()
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
                "joined_at": datetime.now(timezone.utc).isoformat()
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
async def list_workspaces(current_user: dict = Depends(get_auth_context)):
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

@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    current_user: dict = Depends(get_auth_context)
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
    current_user: dict = Depends(get_auth_context)
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
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
        
        doc.reference.collection("members").document(request.email.replace("@", "_at_")).set({
            "user_email": request.email,
            "role": request.role,
            "invited_by": user_email,
            "joined_at": datetime.now(timezone.utc).isoformat()
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
        "member_count": len(current_members)
    }

@router.get("/{org_id}/members")
async def list_org_members(
    org_id: str,
    current_user: dict = Depends(get_auth_context)
):
    """
    List all members of an organization.
    Returns members from Firestore via Admin SDK (bypasses client security rules).
    """
    uid = current_user.get("uid")
    if not verify_user_org_access(uid, org_id):
        raise HTTPException(status_code=403, detail="Unauthorized")
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        members = []
        users_stream = db.collection("users").where("orgId", "==", org_id).stream()
        for doc in users_stream:
            user_data = doc.to_dict() or {}
            members.append({
                "uid": doc.id,
                "email": user_data.get("email", ""),
                "role": user_data.get("role", "member"),
                "orgId": org_id,
                "status": user_data.get("status", "active")
            })

        # Also fetch pending invitations
        invites_stream = db.collection("organizations").document(org_id).collection("pendingInvites").where("status", "==", "pending").stream()
        for doc in invites_stream:
            invite_data = doc.to_dict() or {}
            members.append({
                "uid": f"pending_{doc.id}",
                "email": invite_data.get("email", ""),
                "role": invite_data.get("role", "member"),
                "orgId": org_id,
                "status": "pending"
            })
        return {"members": members}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{org_id}/members")
async def add_org_member(
    org_id: str,
    request: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_auth_context)
):
    """
    Invite a member to an organization.
    Frontend calls POST /api/workspaces/{orgId}/members.
    Admin SDK write bypasses client Firestore security rules.
    """
    uid = current_user.get("uid")
    user_org_id = current_user.get("orgId")

    # 🛡️ SECURITY HARDENING (P1): Verify inviter belongs to the specific org they are inviting to
    if user_org_id != org_id:
        logger.warning(f"🛡 Cross-tenant attempt: User {uid} (org: {user_org_id}) tried to invite to {org_id}")
        raise HTTPException(status_code=403, detail="Cross-tenant access denied")

    # 🛡️ SECURITY HARDENING (P1): Only admins can invite members
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can invite members")
        
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    invite_email = request.get("email") if isinstance(request, dict) else None
    role = (request.get("role") if isinstance(request, dict) else None) or "member"
    if not invite_email:
        raise HTTPException(status_code=400, detail="email is required")

    # Enforce seat limits from org subscription
    org_doc = db.collection("organizations").document(org_id).get()
    if not org_doc.exists:
        raise HTTPException(status_code=404, detail="Organization not found")
    org_data = org_doc.to_dict() or {}
    # 🛡️ SECURITY HARDENING (P0): Never return apiKeys to the client
    org_data.pop("apiKeys", None)
    plan = org_data.get("subscription", {}).get("planId", "explorer")
    seat_limits = {"explorer": 1, "growth": 5, "scale": 25, "enterprise": 25}
    max_seats = seat_limits.get(plan, 1)
    current_seats = org_data.get("activeSeats", 0)
    if current_seats >= max_seats:
        raise HTTPException(status_code=403, detail=f"Seat limit reached for {plan} plan. Upgrade to add more members.")

    # 1. Atomic Transaction: Create pending invite & placeholder user, increment org seats
    batch = db.batch()
    
    invite_ref = db.collection("organizations").document(org_id).collection("pendingInvites").document()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    batch.set(invite_ref, {
        "email": invite_email,
        "role": role,
        "invitedBy": uid,
        "invitedAt": datetime.now(timezone.utc).isoformat(),
        "expiresAt": expires_at.isoformat(),
        "status": "pending"
    })

    # Optional: Create a placeholder user so they appear in members list immediately 
    # (Matches frontend optimistic UI intent)
    placeholder_uid = f"invited_{invite_ref.id}"
    user_ref = db.collection("users").document(placeholder_uid)
    batch.set(user_ref, {
        "uid": placeholder_uid,
        "email": invite_email,
        "orgId": org_id,
        "role": role,
        "status": "invited_pending_auth"
    })

    # Seat increment is NOW immediate to prevent race condition abuse
    # Seat increment is NOW atomic and concurrent-safe
    from google.cloud import firestore
    org_ref = db.collection("organizations").document(org_id)
    batch.update(org_ref, {"activeSeats": firestore.Increment(1)})

    batch.commit()
    
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    invite_id = invite_ref.id
    invite_url = f"{frontend_url}/invite/{org_id}?inviteId={invite_id}"

    log_audit_event(
        org_id=org_id,
        actor_id=uid,
        event_type="member_invited",
        resource_id=invite_email,
        metadata={"role": role, "placeholder_uid": placeholder_uid, "invite_id": invite_id}
    )

    # Trigger transactional email
    background_tasks.add_task(
        send_invite_email,
        to_email=invite_email,
        invite_url=invite_url,
        org_name=org_data.get("name", "Workspace"),
        inviter_name=current_user.get("email", "A Colleague")
    )

    return {
        "success": True, 
        "message": f"Invitation created for {invite_email}",
        "member": {
            "uid": placeholder_uid,
            "email": invite_email,
            "role": role,
            "orgId": org_id,
            "status": "invited_pending_auth"
        }
    }

@router.post("/{org_id}/invites/{invite_id}/resend")
async def resend_org_invite(
    org_id: str,
    invite_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_auth_context)
):
    """
    Resend an invitation email and reset the expiry.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can resend invites")
        
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    org_doc = db.collection("organizations").document(org_id).get()
    if not org_doc.exists:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    org_data = org_doc.to_dict() or {}
    invite_ref = db.collection("organizations").document(org_id).collection("pendingInvites").document(invite_id)
    invite_doc = invite_ref.get()
    
    if not invite_doc.exists:
        raise HTTPException(status_code=404, detail="Invite not found")
        
    invite_data = invite_doc.to_dict() or {}
    if invite_data.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Invite is no longer pending")

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    invite_ref.update({"expiresAt": expires_at.isoformat()})
    
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    invite_url = f"{frontend_url}/invite/{org_id}?inviteId={invite_id}"
    invite_email = invite_data.get("email")
    
    background_tasks.add_task(
        send_invite_email,
        to_email=invite_email,
        invite_url=invite_url,
        org_name=org_data.get("name", "Workspace"),
        inviter_name=current_user.get("email", "A Colleague")
    )

    log_audit_event(
        org_id=org_id,
        actor_id=current_user.get("uid"),
        event_type="member_invite_resend",
        resource_id=invite_email,
        metadata={"invite_id": invite_id}
    )
    
    return {"success": True, "message": "Invite resent"}

@router.delete("/{org_id}/invites/{invite_id}")
async def revoke_org_invite(
    org_id: str,
    invite_id: str,
    current_user: dict = Depends(get_auth_context)
):
    """
    Revoke an active invite and decrement reserved seat.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can revoke invites")
        
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    invite_ref = db.collection("organizations").document(org_id).collection("pendingInvites").document(invite_id)
    invite_doc = invite_ref.get()
    
    if not invite_doc.exists:
        raise HTTPException(status_code=404, detail="Invite not found")
        
    invite_data = invite_doc.to_dict() or {}
    if invite_data.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Invite is no longer pending")

    batch = db.batch()
    # 1. Update invite status
    batch.update(invite_ref, {"status": "revoked"})
    
    # 2. Free up the seat
    from google.cloud import firestore
    org_ref = db.collection("organizations").document(org_id)
    batch.update(org_ref, {"activeSeats": firestore.Increment(-1)})
    
    # 3. Clean up placeholder user
    placeholder_uid = f"invited_{invite_id}"
    user_ref = db.collection("users").document(placeholder_uid)
    batch.delete(user_ref)
    
    batch.commit()
    
    log_audit_event(
        org_id=org_id,
        actor_id=current_user.get("uid"),
        event_type="member_invite_revoked",
        resource_id=invite_data.get("email"),
        metadata={"invite_id": invite_id}
    )
    
    return {"success": True, "message": "Invite revoked"}


@router.post("/{org_id}/accept-invite")
async def accept_org_invite(
    org_id: str,
    request: dict,
    current_user: dict = Depends(get_auth_context)
):
    """
    Accept an invitation to join an organization.
    Converts pendingInvite to active user and increments activeSeats.
    """
    uid = current_user.get("uid")
    email = current_user.get("email")
    invite_id = request.get("inviteId")

    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    # 1. Verify invitation exists and is pending for this user's email
    invite_ref = db.collection("organizations").document(org_id).collection("pendingInvites").document(invite_id)
    invite_doc = invite_ref.get()
    
    if not invite_doc.exists:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    invite_data = invite_doc.to_dict() or {}
    if invite_data.get("status") != "pending" or invite_data.get("email") != email:
        raise HTTPException(status_code=400, detail="Invalid or mismatching invitation")

    expires_at_str = invite_data.get("expiresAt")
    if expires_at_str:
        expires_at = datetime.fromisoformat(expires_at_str)
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=400, detail="This invitation has expired")

    # 2. Atomic Transaction: Update user, mark invite complete, increment seats
    batch = db.batch()
    
    # Update user record
    user_ref = db.collection("users").document(uid)
    batch.set(user_ref, {
        "uid": uid,
        "email": email,
        "orgId": org_id,
        "role": invite_data.get("role", "member"),
        "joinedAt": datetime.now(timezone.utc).isoformat()
    }, merge=True)
    
    # Mark invite as accepted
    batch.update(invite_ref, {"status": "accepted", "acceptedAt": datetime.now(timezone.utc).isoformat()})
    
    # 🛡️ SEAT INVARIANT (P1): We already incremented seat during invite-create 
    # to lock the slot. Doing it here again would double-increment.
    # No further increment needed here.
    
    batch.commit()
    
    log_audit_event(
        org_id=org_id,
        actor_id=uid,
        event_type="member_joined",
        resource_id=email,
        metadata={"inviteId": invite_id}
    )

    return {"success": True, "message": "Successfully joined organization"}


@router.delete("/{workspace_id}/members/{email}")
async def remove_member(
    workspace_id: str,
    email: str,
    current_user: dict = Depends(get_auth_context)
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
                "updated_at": datetime.now(timezone.utc).isoformat()
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
    current_user: dict = Depends(get_auth_context)
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
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
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
    current_user: dict = Depends(get_auth_context)
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
    current_user: dict = Depends(get_auth_context)
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
    
    # Fetch activity from Firestore
    activities = []
    try:
        activity_ref = doc_ref.collection("activity").order_by("timestamp", direction="DESCENDING").limit(limit)
        docs = activity_ref.stream()
        for d in docs:
            act_data = d.to_dict()
            act_data["id"] = d.id
            activities.append(act_data)
    except Exception as e:
        logger.error(f"Failed to fetch workspace activity: {e}")
    
    return {
        "success": True,
        "activities": activities,
        "total_count": len(activities)
    }

@router.get("/{org_id}/profile")
async def get_org_profile(
    org_id: str,
    current_user: dict = Depends(get_auth_context)
):
    """
    🛡️ SECURITY HARDENING (P0): Safe Organization Profile.
    Returns a redacted version of the organization document to the frontend.
    Bypasses the direct-doc-read deny rule in firestore.rules.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Verify user belongs to this org
    if current_user.get("orgId") != org_id:
        raise HTTPException(status_code=403, detail="Unauthorized: Cross-tenant access denied")

    try:
        org_doc = db.collection("organizations").document(org_id).get()
        if not org_doc.exists:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        data = org_doc.to_dict() or {}
        
        # Redact highly sensitive fields
        data.pop("apiKeys", None)
        
        return {
            "id": org_id,
            "name": data.get("name", "Unnamed Organization"),
            "activeSeats": data.get("activeSeats", 0),
            "subscriptionTier": data.get("subscription", {}).get("planId", "explorer"),
            "status": data.get("subscription", {}).get("status", "active"),
            "createdAt": data.get("createdAt")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch org profile: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/health")
async def workspaces_health():
    """Health check for workspaces service"""
    return {"status": "healthy", "service": "workspaces"}

# NOTE: /health is now defined BEFORE /{workspace_id} to avoid route shadowing

@router.get("/{org_id}/manifest")
async def get_public_manifest(org_id: str):
    """
    Public endpoint for llms.txt generation.
    Bypasses Firebase client rules to safely serve the organization's verified manifesto.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unconfigured")
        
    try:
        manifest_doc = db.collection("organizations").document(org_id).collection("manifests").document("latest").get()
        if manifest_doc.exists:
            data = manifest_doc.to_dict() or {}
            # 🛡️ Redact any potential keys in manifest metadata
            data.pop("apiKeys", None)
            content = data.get("content")
            if content:
                from fastapi.responses import PlainTextResponse
                return PlainTextResponse(content=content)
                
        raise HTTPException(status_code=404, detail="Manifest not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch public manifest for {org_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
