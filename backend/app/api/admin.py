from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
from core.firebase_config import db, app as firebase_app
from firebase_admin import auth as firebase_auth
from fastapi.security import HTTPBearer
from core.security import security, HTTPAuthorizationCredentials
from api.audit import log_audit_event
import datetime
import logging
import os
from core.model_config import (
    OPENAI_SIMULATION_MODEL,
    GEMINI_SIMULATION_MODEL,
    CLAUDE_SIMULATION_MODEL,
    MODEL_DISPLAY_NAMES,
    API_MODEL_MAPPING,
)

logger = logging.getLogger(__name__)
router = APIRouter()
admin_security = HTTPBearer(auto_error=False)

PLAN_LIMITS = {
    "explorer": {"maxSimulations": 1, "seatLimit": 1},
    "growth": {"maxSimulations": 100, "seatLimit": 5},
    "scale": {"maxSimulations": 500, "seatLimit": 25},
    "enterprise": {"maxSimulations": 2000, "seatLimit": 100},
}


def _load_admin_profile(decoded_token: dict) -> dict:
    """Hydrate admin context with Firestore role/org/tenant info when available."""
    uid = decoded_token.get("uid") or decoded_token.get("user_id")
    role = decoded_token.get("role")
    org_id = decoded_token.get("orgId")
    tenant_slug = decoded_token.get("tenantSlug")

    if db and uid:
        try:
            user_doc = db.collection("users").document(uid).get()
            if not user_doc.exists:
                # 🛡️ SECURITY HARDENING (P0): Role revoked if user doc missing
                raise HTTPException(status_code=403, detail="Admin role revoked or user missing")
            
            user_data = user_doc.to_dict() or {}
            role = user_data.get("role")
            
            # 🛡️ SECURITY HARDENING (P0): Strict role re-check
            if role not in ("admin", "tenant_admin", "super_admin"):
                raise HTTPException(status_code=403, detail="Active admin role required")
                
            org_id = user_data.get("orgId", org_id)
            tenant_slug = user_data.get("tenantSlug", tenant_slug)
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Admin profile lookup failed for {uid}: {e}")
            # If DB is up but read fails, fail-closed for security
            raise HTTPException(status_code=403, detail="Security validation failed")

    is_platform_admin = bool(decoded_token.get("admin")) or role == "super_admin" or org_id == "system_admin_org"
    return {
        **decoded_token,
        "role": role,
        "orgId": org_id,
        "tenantSlug": tenant_slug,
        "isPlatformAdmin": is_platform_admin,
    }


def _admin_scope(admin_user: dict) -> tuple[str, Optional[str]]:
    """
    Returns ("platform"|"tenant"|"org", scope_id) or raises if unauthorized.
    """
    if admin_user.get("isPlatformAdmin"):
        return ("platform", None)
    role = admin_user.get("role")
    if role == "tenant_admin":
        slug = admin_user.get("tenantSlug")
        if not slug:
            raise HTTPException(status_code=403, detail="tenant_admin missing tenantSlug")
        return ("tenant", slug)
    if role == "admin":
        org_id = admin_user.get("orgId")
        if not org_id:
            raise HTTPException(status_code=403, detail="admin missing orgId")
        return ("org", org_id)
    raise HTTPException(status_code=403, detail="Forbidden: Admin access required")


def _require_org_access(admin_user: dict, org_id: str, org_data: Optional[dict] = None) -> None:
    """
    Enforce org-level access for admin/tenant_admin. Platform admin always passes.
    """
    if admin_user.get("isPlatformAdmin"):
        return
    role = admin_user.get("role")
    if role == "tenant_admin":
        if org_data is None and db:
            doc = db.collection("organizations").document(org_id).get()
            org_data = doc.to_dict() if doc.exists else {}
        if admin_user.get("tenantSlug") != (org_data or {}).get("tenantSlug"):
            raise HTTPException(status_code=403, detail="This org belongs to a different tenant")
        return
    if role == "admin":
        if admin_user.get("orgId") != org_id:
            raise HTTPException(status_code=403, detail="This org belongs to a different admin")
        return
    raise HTTPException(status_code=403, detail="Forbidden: Admin access required")


def _serialize_datetime(value: Any) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _coerce_datetime(value: Any) -> Optional[datetime.datetime]:
    if not value:
        return None
    if isinstance(value, datetime.datetime):
        return value if value.tzinfo else value.replace(tzinfo=datetime.timezone.utc)
    if isinstance(value, str):
        try:
            cleaned = value.replace("Z", "+00:00")
            parsed = datetime.datetime.fromisoformat(cleaned)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=datetime.timezone.utc)
        except Exception:
            return None
    return None


def _resolve_usage_cycle_start(subscription: Dict[str, Any]) -> datetime.datetime:
    now = datetime.datetime.now(datetime.timezone.utc)
    current_start = _coerce_datetime(subscription.get("currentPeriodStart"))
    activated_at = _coerce_datetime(subscription.get("activatedAt"))
    reset_at = _coerce_datetime(subscription.get("lastUsageResetAt"))
    base = current_start or activated_at or now
    if reset_at and reset_at > base:
        return reset_at
    return base


def _count_usage_since(org_id: str, cycle_start: datetime.datetime) -> int:
    from core.utils import count_usage_since as unified_count
    return unified_count(db, org_id, cycle_start)


def _default_model_catalog() -> List[Dict[str, Any]]:
    return [
        {
            "provider": "openai",
            "slot": "simulation",
            "displayName": MODEL_DISPLAY_NAMES.get(OPENAI_SIMULATION_MODEL, "GPT-4o"),
            "productLabel": OPENAI_SIMULATION_MODEL,
            "apiModelId": API_MODEL_MAPPING.get(OPENAI_SIMULATION_MODEL, OPENAI_SIMULATION_MODEL),
            "enabled": True,
            "order": 1,
        },
        {
            "provider": "gemini",
            "slot": "simulation",
            "displayName": MODEL_DISPLAY_NAMES.get(GEMINI_SIMULATION_MODEL, "Gemini 3 Flash"),
            "productLabel": GEMINI_SIMULATION_MODEL,
            "apiModelId": API_MODEL_MAPPING.get(GEMINI_SIMULATION_MODEL, GEMINI_SIMULATION_MODEL),
            "enabled": True,
            "order": 2,
        },
        {
            "provider": "anthropic",
            "slot": "simulation",
            "displayName": MODEL_DISPLAY_NAMES.get(CLAUDE_SIMULATION_MODEL, "Claude 4.5 Sonnet"),
            "productLabel": CLAUDE_SIMULATION_MODEL,
            "apiModelId": API_MODEL_MAPPING.get(CLAUDE_SIMULATION_MODEL, CLAUDE_SIMULATION_MODEL),
            "enabled": True,
            "order": 3,
        },
    ]


def _get_runtime_model_catalog() -> Dict[str, Any]:
    payload = {
        "models": _default_model_catalog(),
        "source": "code_default",
        "updatedAt": None,
        "updatedBy": None,
    }
    if not db:
        return payload

    try:
        doc = db.collection("platform_config").document("model_catalog").get()
        if doc.exists:
            data = doc.to_dict() or {}
            models = data.get("models")
            if isinstance(models, list) and models:
                payload["models"] = sorted(models, key=lambda item: item.get("order", 999))
                payload["source"] = "firestore"
                payload["updatedAt"] = _serialize_datetime(data.get("updatedAt"))
                payload["updatedBy"] = data.get("updatedBy")
    except Exception as e:
        logger.warning(f"Failed to load Firestore model catalog, falling back to code defaults: {e}")

    return payload

async def verify_admin(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(admin_security)
):
    """
    Verify the request comes from an authenticated Firebase user with 'admin' claim.
    Supports standard Bearer token and X-Admin-Token header/cookie fallback.
    """
    token = None
    
    # 1. Check Bearer Token
    if credentials:
        token = credentials.credentials
    
    # 2. Check X-Admin-Token Header
    if not token:
        token = request.headers.get("X-Admin-Token")
    
    # 3. Check X-Admin-Token Cookie
    if not token:
        token = request.cookies.get("X-Admin-Token")
        
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        # Use verify_session_cookie to ensure token was minted by server
        decoded_token = firebase_auth.verify_session_cookie(token, check_revoked=True)
        admin_profile = _load_admin_profile(decoded_token)
        role = admin_profile.get("role")
        if admin_profile.get("isPlatformAdmin") or role in {"tenant_admin", "admin"}:
            actor_id = admin_profile.get("email") or f"uid:{admin_profile.get('uid', 'unknown_uid')}"
            log_audit_event(
                org_id="system_admin",
                actor_id=actor_id,
                event_type="admin_session_verified",
                resource_id=admin_profile.get("uid", "unknown_uid"),
                metadata={"action": request.url.path, "role": role}
            )
            return admin_profile

        logger.warning(f"🚫 Unauthorized Admin Access Attempt: {admin_profile.get('email', 'unknown')}")
        raise HTTPException(status_code=403, detail="Forbidden: Admin access required")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        logger.error(f"Admin auth failure: {e}")
        raise HTTPException(status_code=401, detail="Invalid admin session")


@router.post("/mint-session")
async def mint_admin_session(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """
    Exchanges a valid Firebase client ID token for a secure HTTPOnly Session Cookie.
    Used exclusively by the frontend Admin Auth route to harden the session.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing ID token")
        
    id_token = credentials.credentials
    try:
        # Verify the ID token first to ensure it's valid and has admin claims
        decoded_claims = firebase_auth.verify_id_token(id_token, app=firebase_app)
        admin_profile = _load_admin_profile(decoded_claims)
        role = admin_profile.get("role")
        is_platform_admin = admin_profile.get("isPlatformAdmin")

        if not (is_platform_admin or role == "tenant_admin"):
            raise HTTPException(status_code=403, detail="Forbidden: Admin access required to mint session")

        # Create the session cookie (expires in 24 hours)
        expires_in = datetime.timedelta(days=1)
        session_cookie = firebase_auth.create_session_cookie(id_token, expires_in=expires_in, app=firebase_app)

        return {"success": True, "session_cookie": session_cookie}
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid ID token provided")
    except Exception as e:
        logger.error(f"Minting session failed: {e}")
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail="Failed to create secure session")

@router.get("/verify-session")
async def verify_admin_session_route(admin_user: dict = Depends(verify_admin)):
    """
    Explicitly check if the current Admin Session Cookie is valid, unrevoked, and has the admin claim.
    """
    return {
        "success": True,
        "verified": True,
        "uid": admin_user.get("uid"),
        "role": admin_user.get("role"),
        "orgId": admin_user.get("orgId"),
        "tenantSlug": admin_user.get("tenantSlug"),
        "isPlatformAdmin": admin_user.get("isPlatformAdmin", False),
    }


@router.get("/model-config")
async def get_model_config(admin_user: dict = Depends(verify_admin)):
    return _get_runtime_model_catalog()

@router.get("/orgs")
async def list_organizations(
    page_size: int = 15,
    cursor: Optional[str] = None,
    admin_user: dict = Depends(verify_admin)
):
    """
    List organizations with Firestore cursor-based pagination.
    """
    
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    if page_size < 1 or page_size > 50:
        page_size = 15

    try:
        from google.cloud.firestore_v1 import FieldFilter

        scope, scope_id = _admin_scope(admin_user)
        orgs_query = db.collection("organizations")

        if scope == "platform":
            orgs_query = orgs_query.order_by("__name__")
            # Cursor-based pagination: start_after the last doc ID from previous page
            if cursor:
                cursor_doc = db.collection("organizations").document(cursor).get()
                if cursor_doc.exists:
                    orgs_query = orgs_query.start_after(cursor_doc)
            # Fetch page_size + 1 to determine if there are more pages
            docs = list(orgs_query.limit(page_size + 1).stream())
            has_more = len(docs) > page_size
            page_docs = docs[:page_size]
        elif scope == "tenant":
            orgs_query = orgs_query.where("tenantSlug", "==", scope_id)
            docs = list(orgs_query.stream())
            has_more = False
            page_docs = docs
        else:  # scope == "org"
            org_doc = db.collection("organizations").document(scope_id).get()
            page_docs = [org_doc] if org_doc.exists else []
            has_more = False

        org_list = []
        for org_doc in page_docs:
            data = org_doc.to_dict() or {}
            org_id = org_doc.id

            # Fetch member count & admin email (only for this page)
            member_count = 0
            admin_email = ""
            try:
                users_docs = list(
                    db.collection("users")
                    .where(filter=FieldFilter("orgId", "==", org_id))
                    .select(["email", "role"])
                    .stream()
                )
                member_count = len(users_docs)
                for u in users_docs:
                    ud = u.to_dict() or {}
                    if ud.get("role") == "admin" or not admin_email:
                        admin_email = ud.get("email", "")
            except Exception as e:
                logger.warning(f"Member count failed for {org_id}: {e}")
                member_count = 1

            # Simulation count: use select() to fetch only doc IDs (lightweight)
            sim_count = 0
            try:
                sim_docs = list(
                    db.collection("organizations").document(org_id)
                    .collection("scoringHistory")
                    .select([])
                    .limit(1000)
                    .stream()
                )
                sim_count = len(sim_docs)
            except Exception:
                sim_count = 0

            # Last payment date
            last_payment = "N/A"
            activated_at = data.get("subscription", {}).get("activatedAt")
            if activated_at:
                try:
                    if hasattr(activated_at, "isoformat"):
                        last_payment = activated_at.isoformat()[:10]
                    else:
                        last_payment = str(activated_at)[:10]
                except Exception:
                    pass

            org_list.append({
                "id": org_id,
                "name": data.get("name", org_id),
                "plan": data.get("subscription", {}).get("planId", "explorer"),
                "status": data.get("subscription", {}).get("status", "active"),
                "members": member_count,
                "seatLimit": PLAN_LIMITS.get(data.get("subscription", {}).get("planId", "explorer"), PLAN_LIMITS["explorer"]).get("seatLimit", 1),
                "pendingInvites": len(list(
                    db.collection("organizations").document(org_id).collection("pendingInvites")
                    .where(filter=FieldFilter("status", "==", "pending"))
                    .limit(100)
                    .stream()
                )),
                "simulations": sim_count,
                "apiKeys": {
                    "openai": "configured" if (data.get("apiKeys") or {}).get("openai") else "",
                    "gemini": "configured" if (data.get("apiKeys") or {}).get("gemini") else "",
                    "anthropic": "configured" if (data.get("apiKeys") or {}).get("anthropic") else "",
                },
                "email": admin_email or data.get("email", ""),
                "lastPayment": last_payment,
            })

        # Return cursor for next page (last doc ID of current page)
        next_cursor = page_docs[-1].id if page_docs and has_more else None

        return {
            "orgs": org_list,
            "hasMore": has_more,
            "nextCursor": next_cursor,
            "scope": scope,
        }
    except Exception as e:
        logger.error(f"Admin org list failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class UpdateApiKeyRequest(BaseModel):
    provider: str  # "openai" | "gemini" | "anthropic"
    value: str


class AdminModelConfigItem(BaseModel):
    provider: str
    slot: str = "simulation"
    displayName: str
    productLabel: str
    apiModelId: str
    enabled: bool = True
    order: int = 0


class UpdateModelConfigRequest(BaseModel):
    models: List[AdminModelConfigItem]


class UpdateSubscriptionRequest(BaseModel):
    planId: Optional[str] = None
    status: Optional[str] = None
    maxSimulations: Optional[int] = Field(default=None, ge=0)
    billingPeriod: Optional[str] = None
    activeSeats: Optional[int] = Field(default=None, ge=0)
    currentPeriodEnd: Optional[str] = None
    trialEndsAt: Optional[str] = None
    resetUsage: bool = False
    notes: Optional[str] = None


@router.put("/orgs/{org_id}/keys")
async def update_org_api_key(
    org_id: str,
    request_body: UpdateApiKeyRequest,
    admin_user: dict = Depends(verify_admin)
):
    """
    Update an organization's API key via Admin SDK.
    """

    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    if request_body.provider not in ("openai", "gemini", "anthropic"):
        raise HTTPException(status_code=400, detail="Invalid provider")

    try:
        _require_org_access(admin_user, org_id)
        db.collection("organizations").document(org_id).update({
            f"apiKeys.{request_body.provider}": request_body.value
        })
        actor_id = admin_user.get("email") or f"uid:{admin_user.get('uid', 'admin')}"
        log_audit_event(
            org_id=org_id,
            actor_id=actor_id,
            event_type="admin_apikey_updated",
            resource_id=request_body.provider,
            metadata={"action": "update_key"}
        )
        return {"success": True, "message": f"{request_body.provider} key updated for {org_id}"}
    except Exception as e:
        logger.error(f"Admin key update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/model-config")
async def update_model_config(
    request_body: UpdateModelConfigRequest,
    admin_user: dict = Depends(verify_admin)
):
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if not admin_user.get("isPlatformAdmin"):
        raise HTTPException(status_code=403, detail="Only platform admins can update model config")

    if len(request_body.models) == 0:
        raise HTTPException(status_code=400, detail="At least one model config entry is required")

    allowed_providers = {"openai", "gemini", "anthropic"}
    normalized_models = []
    for item in request_body.models:
        if item.provider not in allowed_providers:
            raise HTTPException(status_code=400, detail=f"Unsupported provider: {item.provider}")
        normalized_models.append(item.model_dump())

    payload = {
        "models": normalized_models,
        "updatedAt": datetime.datetime.now(datetime.timezone.utc),
        "updatedBy": admin_user.get("email", "unknown_admin"),
    }

    try:
        db.collection("platform_config").document("model_catalog").set(payload)
        actor_id = admin_user.get("email") or f"uid:{admin_user.get('uid', 'admin')}"
        log_audit_event(
            org_id="system_admin",
            actor_id=actor_id,
            event_type="admin_model_config_updated",
            resource_id="model_catalog",
            metadata={"modelCount": len(normalized_models)}
        )
        return {"success": True, **_get_runtime_model_catalog()}
    except Exception as e:
        logger.error(f"Admin model config update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orgs/{org_id}/details")
async def get_org_details(org_id: str, admin_user: dict = Depends(verify_admin)):
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        org_doc = db.collection("organizations").document(org_id).get()
        if not org_doc.exists:
            raise HTTPException(status_code=404, detail="Organization not found")

        data = org_doc.to_dict() or {}
        _require_org_access(admin_user, org_id, data)
        subscription = data.get("subscription", {})
        plan_id = subscription.get("planId", "explorer")
        usage_cycle_start = _resolve_usage_cycle_start(subscription)
        usage_count = _count_usage_since(org_id, usage_cycle_start)
        limits = PLAN_LIMITS.get(plan_id, PLAN_LIMITS["explorer"])

        users_docs = list(db.collection("users").where("orgId", "==", org_id).stream())
        users = []
        for user_doc in users_docs:
            user_data = user_doc.to_dict() or {}
            users.append({
                "uid": user_doc.id,
                "email": user_data.get("email", ""),
                "role": user_data.get("role", "member"),
                "joinedAt": _serialize_datetime(user_data.get("joinedAt")),
                "status": user_data.get("status", "active"),
            })

        invites_docs = list(
            db.collection("organizations").document(org_id).collection("pendingInvites")
            .where("status", "==", "pending").stream()
        )
        invites = []
        for invite_doc in invites_docs:
            invite_data = invite_doc.to_dict() or {}
            invites.append({
                "id": invite_doc.id,
                "email": invite_data.get("email", ""),
                "role": invite_data.get("role", "member"),
                "status": invite_data.get("status", "pending"),
                "invitedAt": _serialize_datetime(invite_data.get("invitedAt")),
            })

        payment_docs = list(
            db.collection("organizations").document(org_id).collection("payments")
            .order_by("createdAt", direction="DESCENDING").limit(10).stream()
        )
        payments = []
        for payment_doc in payment_docs:
            payment_data = payment_doc.to_dict() or {}
            payments.append({
                "id": payment_doc.id,
                "status": payment_data.get("status", ""),
                "planId": payment_data.get("planId", ""),
                "amount": payment_data.get("amount", 0),
                "customerEmail": payment_data.get("customerEmail", ""),
                "createdAt": _serialize_datetime(payment_data.get("createdAt")),
                "shortUrl": payment_data.get("shortUrl"),
            })

        sim_count = len(
            list(db.collection("organizations").document(org_id).collection("scoringHistory").select([]).limit(1000).stream())
        )

        active_seats = data.get("activeSeats", len(users))
        seat_limit = limits.get("seatLimit", max(active_seats, 1))

        return {
            "id": org_id,
            "name": data.get("name", org_id),
            "subscription": {
                "planId": plan_id,
                "status": subscription.get("status", "active"),
                "billingPeriod": subscription.get("billingPeriod", "monthly"),
                "maxSimulations": subscription.get("maxSimulations", limits.get("maxSimulations", 1)),
                "simsThisCycle": usage_count,
                "currentPeriodStart": _serialize_datetime(subscription.get("currentPeriodStart")),
                "currentPeriodEnd": _serialize_datetime(subscription.get("currentPeriodEnd")),
                "activatedAt": _serialize_datetime(subscription.get("activatedAt")),
                "trialEndsAt": _serialize_datetime(subscription.get("trialEndsAt")),
            },
            "seats": {
                "active": active_seats,
                "limit": seat_limit,
                "pendingInvites": len(invites),
            },
            "users": users,
            "pendingInvites": invites,
            "payments": payments,
            "simulations": sim_count,
            "createdAt": _serialize_datetime(data.get("createdAt")),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin org detail fetch failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/orgs/{org_id}/subscription")
async def update_org_subscription(
    org_id: str,
    request_body: UpdateSubscriptionRequest,
    admin_user: dict = Depends(verify_admin)
):
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        org_ref = db.collection("organizations").document(org_id)
        org_doc = org_ref.get()
        if not org_doc.exists:
            raise HTTPException(status_code=404, detail="Organization not found")

        current = org_doc.to_dict() or {}
        _require_org_access(admin_user, org_id, current)
        current_sub = current.get("subscription", {})
        next_plan = request_body.planId or current_sub.get("planId", "explorer")
        plan_limits = PLAN_LIMITS.get(next_plan, PLAN_LIMITS["explorer"])

        updates: Dict[str, Any] = {}
        if request_body.planId:
            updates["subscription.planId"] = request_body.planId
        if request_body.status:
            updates["subscription.status"] = request_body.status
        if request_body.billingPeriod:
            updates["subscription.billingPeriod"] = request_body.billingPeriod
        updates["subscription.maxSimulations"] = request_body.maxSimulations if request_body.maxSimulations is not None else current_sub.get("maxSimulations", plan_limits["maxSimulations"])
        if request_body.activeSeats is not None:
            updates["activeSeats"] = request_body.activeSeats
        if request_body.resetUsage:
            updates["subscription.simsThisCycle"] = 0
            updates["subscription.lastUsageResetAt"] = datetime.datetime.now(datetime.timezone.utc)
        if request_body.currentPeriodEnd:
            updates["subscription.currentPeriodEnd"] = request_body.currentPeriodEnd
        if request_body.trialEndsAt is not None:
            updates["subscription.trialEndsAt"] = request_body.trialEndsAt
        if request_body.planId and "subscription.currentPeriodStart" not in updates:
            updates["subscription.currentPeriodStart"] = datetime.datetime.now(datetime.timezone.utc)
        if request_body.notes:
            updates["adminNotes.subscription"] = request_body.notes

        org_ref.update(updates)
        actor_id = admin_user.get("email") or f"uid:{admin_user.get('uid', 'admin')}"
        log_audit_event(
            org_id=org_id,
            actor_id=actor_id,
            event_type="admin_subscription_updated",
            resource_id=org_id,
            metadata=request_body.model_dump()
        )
        return {"success": True, "message": "Subscription updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin subscription update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class AdminPaymentLinkRequest(BaseModel):
    orgId: str
    customerEmail: str
    description: str = "AUM Context Foundry - Subscription"
    amount: Optional[int] = None


class ProvisionTenantRequest(BaseModel):
    tenant_slug: str
    org_name: str
    admin_uid: str
    tenant_config: dict


@router.post("/payment-link")
async def admin_create_payment_link(
    body: AdminPaymentLinkRequest,
    admin_user: dict = Depends(verify_admin)
):
    """
    Admin-only payment link creation.
    """

    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        _require_org_access(admin_user, body.orgId)
        import razorpay
        key_id = os.getenv("RAZORPAY_KEY_ID")
        key_secret = os.getenv("RAZORPAY_KEY_SECRET")
        if not key_id or not key_secret:
            raise HTTPException(status_code=503, detail="Razorpay not configured")

        client = razorpay.Client(auth=(key_id, key_secret))

        # Determine amount from org plan if not specified
        amount = body.amount
        if not amount:
            PLANS = {
                "growth": 649900,   # ₹6,499/mo — matches payments.py
                "scale": 2099900,   # ₹20,999/mo — matches payments.py
            }
            try:
                org_doc = db.collection("organizations").document(body.orgId).get()
                if org_doc.exists:
                    plan_id = (org_doc.to_dict() or {}).get("subscription", {}).get("planId", "growth")
                    amount = PLANS.get(plan_id, PLANS["growth"])
            except Exception:
                pass
            if not amount:
                amount = PLANS["growth"]

        link = client.payment_link.create({
            "amount": amount,
            "currency": "INR",
            "description": body.description,
            "customer": {"email": body.customerEmail},
            "notify": {"email": True},
            "notes": {"orgId": body.orgId},
            "callback_url": os.getenv("PAYMENT_CALLBACK_URL", ""),
            "callback_method": "get",
        })

        # Store link record
        db.collection("organizations").document(body.orgId).collection("payments").add({
            "type": "payment_link",
            "linkId": link.get("id"),
            "shortUrl": link.get("short_url"),
            "amount": amount,
            "status": "sent",
            "customerEmail": body.customerEmail,
            "createdBy": "admin",
        })

        return {
            "linkId": link.get("id"),
            "shortUrl": link.get("short_url"),
            "amount": amount,
            "status": "created",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin payment link creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/provision-tenant")
async def provision_white_label_tenant(
    body: ProvisionTenantRequest,
    admin_user: dict = Depends(verify_admin)
):
    """
    Platform-only: provisions a new white-label tenant org and assigns a tenant_admin.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if not admin_user.get("isPlatformAdmin"):
        raise HTTPException(status_code=403, detail="Only platform admins can provision tenants")

    slug = body.tenant_slug.strip().lower().replace(" ", "_")
    if not slug or len(slug) > 40:
        raise HTTPException(status_code=400, detail="tenant_slug must be 1-40 lowercase chars")

    existing = (
        db.collection("organizations")
        .where("tenantSlug", "==", slug)
        .limit(1)
        .stream()
    )
    if list(existing):
        raise HTTPException(status_code=409, detail=f"Tenant slug '{slug}' already in use")

    import uuid
    now = datetime.datetime.now(datetime.timezone.utc)
    org_id = f"tenant_{slug}_{uuid.uuid4().hex[:8]}"

    plan_limits = PLAN_LIMITS.get("scale", PLAN_LIMITS["scale"])

    db.collection("organizations").document(org_id).set({
        "name": body.org_name,
        "tenantSlug": slug,
        "status": "active",
        "subscription": {
            "planId": "scale",
            "status": "active",
            "maxSimulations": plan_limits["maxSimulations"],
            "currentPeriodStart": now,
        },
        "tenantConfig": body.tenant_config,
        "createdAt": now,
        "createdBy": admin_user.get("uid"),
    })

    db.collection("users").document(body.admin_uid).set({
        "role": "tenant_admin",
        "tenantSlug": slug,
        "orgId": org_id,
    }, merge=True)

    logger.info(f"Provisioned tenant: slug={slug}, org={org_id}, admin={body.admin_uid}")
    return {"status": "ok", "org_id": org_id, "tenant_slug": slug, "admin_uid": body.admin_uid}
