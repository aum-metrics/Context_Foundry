# backend/app/api/workspaces.py
"""
WORKSPACE MANAGEMENT
Team-centric collaborative workspaces for data analysis
Core of the "Figma for Data" experience
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request, Query
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
import logging
import secrets
import os
import json
import firebase_admin
import asyncio

from core.config import settings
from core.firebase_config import db
from core.security import get_auth_context, get_current_user, verify_user_org_access
from api.audit import log_audit_event
from google.cloud import firestore
from core.email_sender import send_invite_email

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/health")
async def workspaces_health():
    """
    Public health probe for workspace subsystem.
    Does not require auth; safe to expose for uptime checks.
    """
    if db:
        return {"status": "healthy"}
    return {"status": "degraded"}


def _demo_mode_enabled() -> bool:
    return settings.ENV == "development" and getattr(settings, "ALLOW_MOCK_AUTH", False)


def _humanize_org_name(raw_name: str) -> str:
    cleaned = (raw_name or "").strip().replace(".", " ").replace("_", " ").replace("-", " ")
    return " ".join(part.capitalize() for part in cleaned.split() if part)


def _extract_manifest_entity_name(manifest_data: Dict[str, Any]) -> Optional[str]:
    data = manifest_data or {}
    schema = data.get("schemaData") or {}
    metadata = data.get("metadata") or {}
    
    # Priority 1: Explicit schema name
    candidate = schema.get("name")
    if isinstance(candidate, str) and candidate.strip():
        return candidate.strip()
    
    # Priority 2: Inferred name from LLM extraction
    inferred = metadata.get("inferred_name")
    if isinstance(inferred, str) and inferred.strip():
        return inferred.strip()
        
    # Priority 3: Document Title
    title = metadata.get("title")
    if isinstance(title, str) and title.strip():
        return title.strip()
        
    return None


def _is_placeholder_org_name(name: Optional[str]) -> bool:
    normalized = (name or "").strip().lower()
    return normalized in {"", "unnamed organization", "your company"}


async def _get_manifest_doc(org_id: str, version: str = "latest"):
    org_ref = db.collection("organizations").document(org_id)
    if version == "latest":
        return await asyncio.to_thread(org_ref.collection("manifests").document("latest").get)
    return await asyncio.to_thread(org_ref.collection("manifests").document(version).get)


def _serialize_timestamp(value: Any) -> Optional[str]:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value if isinstance(value, str) else None


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

class RenameWorkspaceRequest(BaseModel):
    name: str

@router.patch("/{org_id}/rename")
async def rename_organization(
    org_id: str,
    request: RenameWorkspaceRequest,
    auth: dict = Depends(get_auth_context)
):
    """
    Manually overrides the organization's display name.
    """
    uid = auth.get("uid")
    if not verify_user_org_access(uid, org_id):
        raise HTTPException(status_code=403, detail="Unauthorized")

    try:
        await asyncio.to_thread(
            db.collection("organizations").document(org_id).update,
            {
                "name": request.name.strip(),
                "updatedAt": datetime.now(timezone.utc)
            }
        )
        log_audit_event(org_id=org_id, actor_id=uid, event_type="org_rename", metadata={"new_name": request.name})
        return {"status": "success", "name": request.name}
    except Exception as e:
        logger.error(f"Rename failed for {org_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to rename organization")

@router.post("/provision")
async def provision_organization(
    current_user: dict = Depends(get_current_user),
    request: Optional[ProvisionOrgRequest] = None,
):
    """
    Called by the frontend immediately after Firebase authenticates a new user.
    """
    uid = current_user.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid session")

    email = (request.email if request else None) or current_user.get("email", f"{uid}@unknown.com")
    requested_name = (request.name if request else None) or current_user.get("name")
    name = (requested_name or _humanize_org_name(email.split("@")[0]) or "Unnamed Organization").strip()
    
    if not db:
        raise HTTPException(status_code=500, detail="Database unconfigured")
        
    try:
        user_ref = db.collection("users").document(uid)
        user_doc = await asyncio.to_thread(user_ref.get)
        
        if user_doc.exists:
            user_data = user_doc.to_dict() or {}
            org_id = user_data.get("orgId")
            if not org_id:
                logger.warning(f"Provisioning repair: user {uid} exists without orgId. Re-provisioning.")
            else:
                org_ref = db.collection("organizations").document(org_id)
                org_snap = await asyncio.to_thread(org_ref.get)
                if org_snap.exists:
                    return {"status": "existing", "orgId": org_id, "message": "User already provisioned."}
                # Repair path: org missing but user points to it
                logger.warning(f"Provisioning repair: org {org_id} missing for user {uid}. Recreating org.")
                org_payload = {
                    "id": org_id,
                    "name": (user_data.get("orgName") or name).strip(),
                    "activeSeats": 1,
                    "subscription": {
                        "planId": "explorer", "status": "active", "simsThisCycle": 0, "maxSimulations": 1,
                        "activatedAt": datetime.now(timezone.utc).isoformat(), "currentPeriodStart": datetime.now(timezone.utc),
                        "lastUsageResetAt": datetime.now(timezone.utc),
                    },
                    "apiKeys": {"openai": "internal_platform_managed", "gemini": "internal_platform_managed", "anthropic": "internal_platform_managed"},
                    "createdAt": datetime.now(timezone.utc)
                }
                await asyncio.to_thread(org_ref.set, org_payload)
                return {"status": "repaired", "orgId": org_id, "message": "Organization recreated for existing user."}
            
        # Check for invites (blocking stream converted to list)
        invited_users = list(await asyncio.to_thread(db.collection("users").where("email", "==", email).where("status", "==", "invited_pending_auth").limit(1).stream))
        if invited_users:
            placeholder_doc = invited_users[0]
            org_id = placeholder_doc.to_dict().get("orgId")
            role = placeholder_doc.to_dict().get("role", "member")
            
            # Atomic cleanup
            batch = db.batch()
            batch.set(user_ref, {"uid": uid, "email": email, "orgId": org_id, "role": role, "joinedAt": datetime.now(timezone.utc).isoformat()})
            batch.delete(placeholder_doc.reference)
            
            invite_id = placeholder_doc.id.replace("invited_", "")
            invite_ref = db.collection("organizations").document(org_id).collection("pendingInvites").document(invite_id)
            batch.update(invite_ref, {"status": "accepted", "acceptedAt": datetime.now(timezone.utc).isoformat(), "acceptedByUid": uid})
            
            await asyncio.to_thread(batch.commit)
            log_audit_event(org_id=org_id, actor_id=uid, event_type="member_joined", resource_id=email, metadata={"auto_accepted": True})
            return {"status": "joined_existing", "orgId": org_id, "message": "Joined organization from invitation."}
            
        # New Provisioning
        new_org_id = f"org_{int(datetime.now(timezone.utc).timestamp())}_{secrets.token_urlsafe(6)}"
        org_payload = {
            "id": new_org_id, "name": name, "activeSeats": 1,
            "subscription": {
                "planId": "explorer", "status": "active", "simsThisCycle": 0, "maxSimulations": 1,
                "activatedAt": datetime.now(timezone.utc).isoformat(), "currentPeriodStart": datetime.now(timezone.utc),
                "lastUsageResetAt": datetime.now(timezone.utc),
            },
            "apiKeys": {"openai": "internal_platform_managed", "gemini": "internal_platform_managed", "anthropic": "internal_platform_managed"},
            "createdAt": datetime.now(timezone.utc)
        }
        user_payload = {"uid": uid, "email": email, "orgId": new_org_id, "role": "admin"}

        @firestore.transactional
        def _txn(transaction, u_ref, o_ref):
            # 1. Check for user existence again inside transaction to prevent race conditions
            u_snap = u_ref.get(transaction=transaction)
            if u_snap.exists:
                return {"status": "existing", "orgId": u_snap.to_dict().get("orgId")}
            
            # 2. Atomic Provisioning
            transaction.set(o_ref, org_payload)
            transaction.set(u_ref, user_payload)
            return {"status": "provisioned", "orgId": new_org_id, "message": "Onboarding complete."}

        org_ref = db.collection("organizations").document(new_org_id)
        # 🛡️ FIX: run_transaction callback must only take 'transaction'
        # We use a wrapper to pass additional refs
        async def _run_txn_safely():
            return db.run_transaction(lambda t: _txn(t, user_ref, org_ref))
            
        result = await asyncio.to_thread(db.run_transaction, lambda t: _txn(t, user_ref, org_ref))

        if result["status"] == "provisioned":
             log_audit_event(org_id=new_org_id, actor_id=uid, event_type="organization_provisioned", resource_id=new_org_id)
        
        return result
    except Exception as e:
        logger.error(f"Provisioning fail: {e}")
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
    if not user_email: raise HTTPException(status_code=401)
    workspace_id = f"ws_{secrets.token_urlsafe(16)}"
    workspace = {
        "workspace_id": workspace_id, "name": request.name, "description": request.description or "",
        "owner_email": user_email, "organization_id": request.organization_id, "is_public": request.is_public,
        "created_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat(),
        "member_count": 1, "last_activity": datetime.now(timezone.utc).isoformat()
    }
    if db:
        try:
            batch = db.batch()
            batch.set(db.collection("workspaces").document(workspace_id), {**workspace, "members": [user_email]})
            batch.set(db.collection("workspaces").document(workspace_id).collection("members").document(user_email.replace("@", "_at_")), {
                "user_email": user_email, "role": "owner", "joined_at": datetime.now(timezone.utc).isoformat()
            })
            await asyncio.to_thread(batch.commit)
        except Exception as e:
            logger.error(f"Workspace creation DB fail: {e}")
            raise HTTPException(status_code=500)
    log_audit_event(org_id=request.organization_id or "user", actor_id=user_email, event_type="workspace_created", resource_id=workspace_id)
    return {"success": True, "workspace": workspace}

@router.get("/list")
async def list_workspaces(current_user: dict = Depends(get_auth_context)):
    user_email = current_user.get("email")
    user_workspaces = []
    if db:
        try:
            docs = await asyncio.to_thread(lambda: list(db.collection("workspaces").where("members", "array_contains", user_email).stream()))
            user_workspaces = [d.to_dict() for d in docs]
        except Exception: pass
    user_workspaces.sort(key=lambda x: x.get("last_activity", ""), reverse=True)
    return {"success": True, "workspaces": user_workspaces}

@router.get("/{workspace_id}")
async def get_workspace(workspace_id: str, auth: dict = Depends(get_auth_context)):
    email = auth.get("email")
    if not db: raise HTTPException(status_code=500)
    doc = await asyncio.to_thread(db.collection("workspaces").document(workspace_id).get)
    if not doc.exists: raise HTTPException(status_code=404)
    ws = doc.to_dict() or {}
    members = ws.get("members", [])
    if not ws.get("is_public") and email not in members: raise HTTPException(status_code=403)
    return {"success": True, "workspace": ws}

@router.post("/invite")
async def invite_member(request: InviteMemberRequest, auth: dict = Depends(get_auth_context)):
    email = auth.get("email")
    if not db: raise HTTPException(status_code=500)
    ws_doc = await asyncio.to_thread(db.collection("workspaces").document(request.workspace_id).get)
    if not ws_doc.exists: raise HTTPException(status_code=404)
    ws = ws_doc.to_dict() or {}
    if email != ws["owner_email"]: raise HTTPException(status_code=403)
    
    current_members = ws.get("members", [])
    if request.email in current_members: raise HTTPException(status_code=400, detail="Already a member")
    current_members.append(request.email)
    
    batch = db.batch()
    batch.update(ws_doc.reference, {"members": current_members, "member_count": len(current_members), "updated_at": datetime.now(timezone.utc).isoformat()})
    batch.set(ws_doc.reference.collection("members").document(request.email.replace("@", "_at_")), {
        "user_email": request.email, "role": request.role, "invited_by": email, "joined_at": datetime.now(timezone.utc).isoformat()
    })
    await asyncio.to_thread(batch.commit)
    return {"success": True, "member_count": len(current_members)}

@router.get("/{org_id}/members")
async def list_org_members(org_id: str, auth: dict = Depends(get_auth_context)):
    if not verify_user_org_access(auth["uid"], org_id): raise HTTPException(status_code=403)
    if not db: raise HTTPException(status_code=503)
    members = []
    # Using thread-safe list conversion for streams
    users = await asyncio.to_thread(lambda: list(db.collection("users").where("orgId", "==", org_id).stream()))
    for doc in users:
        d = doc.to_dict()
        members.append({"uid": doc.id, "email": d.get("email"), "role": d.get("role"), "status": d.get("status", "active")})
    invites = await asyncio.to_thread(lambda: list(db.collection("organizations").document(org_id).collection("pendingInvites").where("status", "==", "pending").stream()))
    for doc in invites:
        d = doc.to_dict()
        members.append({"uid": f"pending_{doc.id}", "email": d.get("email"), "role": d.get("role"), "status": "pending"})
    return {"members": members}

@router.post("/{org_id}/members")
async def add_org_member(org_id: str, request: dict, bg: BackgroundTasks, auth: dict = Depends(get_auth_context)):
    if not verify_user_org_access(auth["uid"], org_id): raise HTTPException(status_code=403)
    if auth.get("role") != "admin": raise HTTPException(status_code=403)
    if not db: raise HTTPException(status_code=503)

    email = request.get("email")
    if not email: raise HTTPException(status_code=400)
    
    org_doc = await asyncio.to_thread(db.collection("organizations").document(org_id).get)
    if not org_doc.exists: raise HTTPException(status_code=404)
    org_data = org_doc.to_dict() or {}
    plan = org_data.get("subscription", {}).get("planId", "explorer")
    seat_limits = {"explorer": 1, "growth": 5, "scale": 25, "enterprise": 100}
    if org_data.get("activeSeats", 0) >= seat_limits.get(plan, 1): raise HTTPException(status_code=403, detail="Seat limit reached")

    batch = db.batch()
    invite_ref = db.collection("organizations").document(org_id).collection("pendingInvites").document()
    batch.set(invite_ref, {"email": email, "role": request.get("role", "member"), "invitedBy": auth["uid"], "invitedAt": datetime.now(timezone.utc).isoformat(), "status": "pending"})
    batch.set(db.collection("users").document(f"invited_{invite_ref.id}"), {"uid": f"invited_{invite_ref.id}", "email": email, "orgId": org_id, "role": "member", "status": "invited_pending_auth"})
    batch.update(org_doc.reference, {"activeSeats": firestore.Increment(1)})
    await asyncio.to_thread(batch.commit)
    
    invite_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/invite/{org_id}?inviteId={invite_ref.id}"
    bg.add_task(send_invite_email, org_id, email, invite_url, auth.get("email", "Admin"), org_data.get("name", "Workspace"))
    return {"success": True, "inviteId": invite_ref.id}

@router.delete("/{org_id}/invites/{invite_id}")
async def revoke_org_invite(org_id: str, invite_id: str, auth: dict = Depends(get_auth_context)):
    if auth.get("role") != "admin" or not verify_user_org_access(auth["uid"], org_id): raise HTTPException(status_code=403)
    invite_ref = db.collection("organizations").document(org_id).collection("pendingInvites").document(invite_id)
    invite_doc = await asyncio.to_thread(invite_ref.get)
    if not invite_doc.exists or invite_doc.to_dict().get("status") != "pending": raise HTTPException(status_code=404)
    
    batch = db.batch()
    batch.update(invite_ref, {"status": "revoked"})
    batch.update(db.collection("organizations").document(org_id), {"activeSeats": firestore.Increment(-1)})
    batch.delete(db.collection("users").document(f"invited_{invite_id}"))
    await asyncio.to_thread(batch.commit)
    return {"success": True}

@router.post("/{org_id}/accept-invite")
async def accept_org_invite(org_id: str, request: dict, auth: dict = Depends(get_auth_context)):
    uid, email = auth["uid"], auth["email"]
    invite_ref = db.collection("organizations").document(org_id).collection("pendingInvites").document(request.get("inviteId"))
    invite_doc = await asyncio.to_thread(invite_ref.get)
    if not invite_doc.exists or invite_doc.to_dict().get("status") != "pending" or invite_doc.to_dict().get("email") != email:
        raise HTTPException(status_code=400, detail="Invalid invite")
    
    batch = db.batch()
    batch.set(db.collection("users").document(uid), {"uid": uid, "email": email, "orgId": org_id, "role": invite_doc.to_dict().get("role", "member"), "joinedAt": datetime.now(timezone.utc).isoformat()}, merge=True)
    batch.update(invite_ref, {"status": "accepted", "acceptedAt": datetime.now(timezone.utc).isoformat()})
    await asyncio.to_thread(batch.commit)
    return {"success": True}

@router.get("/{org_id}/profile")
async def get_org_profile(org_id: str, version: str = Query("latest"), auth: dict = Depends(get_auth_context)):
    if not verify_user_org_access(auth.get("uid"), org_id): raise HTTPException(status_code=403)
    if org_id == "demo_org_id" and _demo_mode_enabled():
        return {"id": "demo_org_id", "name": "Sight Spectrum", "activeSeats": 1, "status": "active"}

    org_doc = await asyncio.to_thread(db.collection("organizations").document(org_id).get)
    if not org_doc.exists: raise HTTPException(status_code=404)
    data = org_doc.to_dict() or {}
    data.pop("apiKeys", None)
    return {"id": org_id, "name": data.get("name"), "activeSeats": data.get("activeSeats", 0), "subscriptionTier": data.get("subscription", {}).get("planId", "explorer")}

@router.get("/{org_id}/manifest-data")
async def get_manifest_data(org_id: str, version: str = Query("latest"), auth: dict = Depends(get_auth_context)):
    if not verify_user_org_access(auth.get("uid"), org_id): raise HTTPException(status_code=403)
    manifest_doc = await _get_manifest_doc(org_id, version)
    if not manifest_doc.exists: raise HTTPException(status_code=404)
    data = manifest_doc.to_dict() or {}
    data.pop("apiKeys", None)
    return {
        "orgId": org_id,
        "content": data.get("content", ""),
        "version": data.get("version", version),
        "schemaData": data.get("schemaData", {}),
        "sourceUrl": data.get("sourceUrl") or (data.get("metadata") or {}).get("source_url"),
        "industryTaxonomy": data.get("industryTaxonomy"),
        "industryTags": data.get("industryTags", []),
        "name": _extract_manifest_entity_name(data),
        "createdAt": _serialize_timestamp(data.get("createdAt")),
    }

@router.get("/{org_id}/contexts")
async def list_manifest_contexts(org_id: str, auth: dict = Depends(get_auth_context)):
    if not verify_user_org_access(auth.get("uid"), org_id): raise HTTPException(status_code=403)
    if not db: raise HTTPException(status_code=503)

    org_ref = db.collection("organizations").document(org_id)
    latest_version = None
    try:
        latest_doc = await asyncio.to_thread(org_ref.collection("manifests").document("latest").get)
        if latest_doc.exists:
            latest_version = (latest_doc.to_dict() or {}).get("version")
    except Exception:
        latest_version = None

    try:
        docs = await asyncio.to_thread(lambda: list(
            org_ref.collection("manifests")
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
            .limit(50)
            .stream()
        ))
    except Exception as e:
        logger.error(f"Failed to list contexts for org {org_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to load contexts")

    contexts = []
    for doc in docs:
        if doc.id == "latest":
            continue
        payload = doc.to_dict() or {}
        version = payload.get("version") or doc.id
        contexts.append({
            "id": doc.id,
            "version": version,
            "name": _extract_manifest_entity_name(payload) or _humanize_org_name(payload.get("metadata", {}).get("title", "")) or "Untitled Context",
            "sourceUrl": payload.get("sourceUrl") or (payload.get("metadata") or {}).get("source_url"),
            "createdAt": _serialize_timestamp(payload.get("createdAt")),
            "isLatest": bool(latest_version and version == latest_version),
        })

    return {"contexts": contexts}

@router.get("/{org_id}/manifest")
async def get_public_manifest(org_id: str, version: str = Query("latest")):
    # Public route for llms.txt
    if org_id == "demo_org_id" and _demo_mode_enabled():
         from fastapi.responses import PlainTextResponse
         return PlainTextResponse(content="# Sight Spectrum Manifest")
    allow_public = str(os.getenv("ALLOW_PUBLIC_LLM_MANIFEST", "")).lower() in {"1", "true", "yes"}
    org_public = False
    if db:
        try:
            org_doc = await asyncio.to_thread(db.collection("organizations").document(org_id).get)
            if org_doc.exists:
                org_data = org_doc.to_dict() or {}
                org_public = bool(org_data.get("publicManifest") or org_data.get("llmsPublic"))
        except Exception:
            org_public = False

    if not (allow_public or org_public):
        raise HTTPException(status_code=404, detail="Not found")
    manifest_doc = await _get_manifest_doc(org_id, version)
    if manifest_doc.exists:
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(content=manifest_doc.to_dict().get("content", ""))
    raise HTTPException(status_code=404)

@router.post("/llms-rate-limit")
async def check_llms_rate_limit(request: Request):
    data = await request.json()
    ip = data.get("ip", "unknown")
    if ip == "unknown": return {"allowed": True}
    rl_ref = db.collection("rate_limits").document(f"llms_{ip.replace('.', '_')}")
    
    @firestore.transactional
    def _rl_txn(transaction, ref):
        snap = ref.get(transaction=transaction)
        now = int(datetime.now(timezone.utc).timestamp() * 1000)
        if snap.exists and snap.to_dict().get("resetAt", 0) > now:
            if snap.to_dict().get("count", 0) >= 100: return False
            transaction.update(ref, {"count": firestore.Increment(1)})
        else:
            transaction.set(ref, {"count": 1, "resetAt": now + 900000})
        return True

    allowed = await asyncio.to_thread(_rl_txn, db.transaction(), rl_ref)
    if not allowed: raise HTTPException(status_code=429)
    return {"allowed": True}
