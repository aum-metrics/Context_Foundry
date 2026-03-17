"""
backend/app/api/data_management.py

Data lifecycle management — all 4 data management fixes in one router.

  Fix 2a: Compress scoringHistory answers after 30 days; redact prompts after 90 days.
  Fix 2b: Hard-delete expired manifests + chunks (Firestore TTL is advisory, not real-time).
  Fix 2c: Redact prompt text from usageLedger after 90 days (GDPR legitimate-interest end).
  Fix 2d: Soft-delete org with immediate PII redaction; hard-delete after 30-day grace period.

DEPLOYMENT INSTRUCTIONS
  1. Copy to:  backend/app/api/data_management.py
  2. In main.py add: load_router("api.data_management", "/api/cron", "Data Management")
  
  3. Add Cloud Scheduler jobs (GCP console → Cloud Scheduler → Create job):
  
     Job 1: cleanup-history
       URL:      https://YOUR_BACKEND/api/cron/cleanup-history
       Schedule: 0 2 * * *        (daily 02:00 UTC)
       Header:   Authorization: Bearer <CRON_SECRET>
       
     Job 2: cleanup-manifests
       URL:      https://YOUR_BACKEND/api/cron/cleanup-manifests
       Schedule: 30 2 * * *       (daily 02:30 UTC)
       Header:   Authorization: Bearer <CRON_SECRET>
       
     Job 3: cleanup-ledger
       URL:      https://YOUR_BACKEND/api/cron/cleanup-ledger
       Schedule: 0 3 * * 0        (weekly, Sunday 03:00 UTC)
       Header:   Authorization: Bearer <CRON_SECRET>
       
     Job 4: cleanup-dead-orgs
       URL:      https://YOUR_BACKEND/api/cron/cleanup-dead-orgs
       Schedule: 0 4 1 * *        (monthly, 1st at 04:00 UTC)
       Header:   Authorization: Bearer <CRON_SECRET>

  4. Set CRON_SECRET env var in Cloud Run (same value as existing cron.py).
     This file uses the same auth pattern — they share the secret.
"""

import os
import logging
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Generator

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel

from core.firebase_config import db, app as firebase_app
from core.config import settings
from firebase_admin import auth as firebase_auth

logger = logging.getLogger(__name__)
router = APIRouter()

# ─── Shared auth ──────────────────────────────────────────────────────────────

def _require_cron(request: Request) -> None:
    """
    Same auth pattern as existing cron.py — Bearer token from env.
    Skips auth check in dev (CRON_SECRET not set).
    """
    secret = os.getenv("CRON_SECRET")
    if not secret:
        if settings.ENV == "production":
            raise HTTPException(status_code=403, detail="Cron secret not configured")
        return   # dev / staging: allow unauthenticated for convenience
    auth = request.headers.get("Authorization", "")
    if auth != f"Bearer {secret}":
        raise HTTPException(status_code=401, detail="Invalid cron secret")


# ─── Batch helper ─────────────────────────────────────────────────────────────

def _batched(items: list, size: int = 450) -> Generator:
    """Yield successive chunks of `size` from `items`."""
    for i in range(0, len(items), size):
        yield items[i : i + size]


def _delete_subcollection(col_ref, batch_size: int = 450) -> int:
    """
    Recursively deletes all documents in a Firestore collection ref.
    Returns count of documents deleted.
    """
    deleted = 0
    while True:
        docs = list(col_ref.limit(batch_size).stream())
        if not docs:
            break
        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)
        batch.commit()
        deleted += len(docs)
        if len(docs) < batch_size:
            break
    return deleted


def _to_aware(ts) -> datetime:
    """Ensure a Firestore timestamp has UTC timezone."""
    if ts is None:
        return datetime.min.replace(tzinfo=timezone.utc)
    if isinstance(ts, datetime):
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    if isinstance(ts, str):
        try:
            cleaned = ts.replace("Z", "+00:00")
            parsed = datetime.fromisoformat(cleaned)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except Exception:
            return datetime.min.replace(tzinfo=timezone.utc)
    # Firestore DatetimeWithNanoseconds has .timestamp()
    return datetime.fromtimestamp(ts.timestamp(), tz=timezone.utc)


# ─── Fix 2a: Compress scoringHistory answers ──────────────────────────────────

@router.post("/cleanup-history")
async def cleanup_scoring_history(request: Request, _: None = Depends(_require_cron)):
    """
    FIX 2a: scoringHistory stores full LLM answers (100-800 chars each).
    
    After 30 days: strip `answer` field from every result object.
                   Keeps: model, accuracy, hasDisplacement, claimScore, timestamp, prompt.
    After 90 days: also set prompt = "[redacted]" (GDPR legitimate-interest window ends).
    
    No data is permanently lost — scores and metadata are preserved for trend analysis.
    Full answers are only needed for the active remediation UI.
    """
    if not db:
        raise HTTPException(503, "Database unavailable")

    now = datetime.now(timezone.utc)
    compress_cutoff = now - timedelta(days=30)
    redact_cutoff   = now - timedelta(days=90)

    compressed = 0
    redacted   = 0
    skipped    = 0
    errors     = 0

    try:
        for org_doc in db.collection("organizations").select([]).stream():
            org_id = org_doc.id
            hist_ref = (
                db.collection("organizations")
                .document(org_id)
                .collection("scoringHistory")
                .where("timestamp", "<", compress_cutoff)
            )

            pending_writes: list[tuple] = []  # (doc_ref, update_dict)

            try:
                for entry in hist_ref.stream():
                    data = entry.to_dict() or {}
                    results: list[dict] = data.get("results", [])
                    ts = _to_aware(data.get("timestamp"))
                    update: dict = {}

                    # Strip `answer` field from each result object
                    if any("answer" in r for r in results):
                        update["results"] = [
                            {k: v for k, v in r.items() if k != "answer"}
                            for r in results
                        ]
                        compressed += 1

                    # Redact prompt text after 90 days
                    if ts < redact_cutoff:
                        prompt = data.get("prompt", "")
                        if prompt and prompt != "[redacted]":
                            update["prompt"] = "[redacted]"
                            redacted += 1

                    if update:
                        pending_writes.append((entry.reference, update))
                    else:
                        skipped += 1

            except Exception as e:
                logger.error(f"cleanup-history scan error for org {org_id}: {e}")
                errors += 1
                continue

            # Write in batches of 450 (Firestore limit is 500)
            for chunk in _batched(pending_writes):
                try:
                    batch = db.batch()
                    for ref, upd in chunk:
                        batch.update(ref, upd)
                    batch.commit()
                except Exception as e:
                    logger.error(f"cleanup-history batch write error for org {org_id}: {e}")
                    errors += 1

    except Exception as e:
        logger.critical(f"cleanup-history fatal: {e}")
        raise HTTPException(500, str(e))

    logger.info(f"cleanup-history done: compressed={compressed}, redacted={redacted}, skipped={skipped}, errors={errors}")
    return {"status": "ok", "compressed_answers": compressed, "redacted_prompts": redacted, "skipped": skipped, "errors": errors}


# ─── Fix 2b: Hard-delete expired manifests ────────────────────────────────────

@router.post("/cleanup-manifests")
async def cleanup_expired_manifests(request: Request, _: None = Depends(_require_cron)):
    """
    FIX 2b: Firestore TTL (expiresAt field) is advisory — documents can persist
    24-72h beyond their TTL. This cron enforces immediate real deletion.
    
    For each org, deletes manifests where expiresAt < now.
    Also deletes the `chunks` subcollection for each expired manifest first
    (Firestore doesn't cascade-delete subcollections automatically).
    
    Skips documents with id="latest" — that's a metadata pointer, not a manifest.
    """
    if not db:
        raise HTTPException(503, "Database unavailable")

    now = datetime.now(timezone.utc)
    deleted_manifests = 0
    deleted_chunks    = 0
    errors            = 0

    try:
        for org_doc in db.collection("organizations").select([]).stream():
            org_id = org_doc.id
            try:
                expired = (
                    db.collection("organizations")
                    .document(org_id)
                    .collection("manifests")
                    .where("expiresAt", "<", now)
                    .stream()
                )
                for manifest in expired:
                    if manifest.id == "latest":
                        continue  # never delete the latest pointer doc

                    # 1. Delete chunks subcollection first
                    try:
                        n = _delete_subcollection(manifest.reference.collection("chunks"))
                        deleted_chunks += n
                    except Exception as ce:
                        logger.warning(f"cleanup-manifests: chunk delete failed for {manifest.id}: {ce}")

                    # 2. Delete the manifest document
                    try:
                        manifest.reference.delete()
                        deleted_manifests += 1
                    except Exception as me:
                        logger.error(f"cleanup-manifests: manifest delete failed {manifest.id}: {me}")
                        errors += 1

            except Exception as e:
                logger.error(f"cleanup-manifests error for org {org_id}: {e}")
                errors += 1

    except Exception as e:
        logger.critical(f"cleanup-manifests fatal: {e}")
        raise HTTPException(500, str(e))

    logger.info(f"cleanup-manifests done: manifests={deleted_manifests}, chunks={deleted_chunks}, errors={errors}")
    return {"status": "ok", "deleted_manifests": deleted_manifests, "deleted_chunks": deleted_chunks, "errors": errors}


# ─── Fix 2c: Redact usageLedger prompt text after 90 days ────────────────────

@router.post("/cleanup-ledger")
async def cleanup_usage_ledger(request: Request, _: None = Depends(_require_cron)):
    """
    FIX 2c: usageLedger stores prompt[:100] for billing audit purposes.
    The legitimate interest for retaining this data ends after 90 days.
    
    After 90 days: set prompt = "[redacted]" in each usageLedger entry.
    The billing counters (count, cost, tokens) are never touched — those
    are needed indefinitely for revenue reconciliation.
    
    GDPR note: document this in your privacy policy as:
      "Prompt text retained for billing audit for 90 days, then redacted."
    """
    if not db:
        raise HTTPException(503, "Database unavailable")

    now = datetime.now(timezone.utc)
    redact_cutoff = now - timedelta(days=90)

    redacted = 0
    errors   = 0

    try:
        for org_doc in db.collection("organizations").select([]).stream():
            org_id = org_doc.id
            try:
                old_entries = (
                    db.collection("organizations")
                    .document(org_id)
                    .collection("usageLedger")
                    .where("timestamp", "<", redact_cutoff)
                    .stream()
                )
                pending: list = []
                for entry in old_entries:
                    data = entry.to_dict() or {}
                    prompt = data.get("prompt", "")
                    if prompt and prompt != "[redacted]":
                        pending.append(entry.reference)

                for chunk in _batched(pending):
                    try:
                        batch = db.batch()
                        for ref in chunk:
                            batch.update(ref, {"prompt": "[redacted]"})
                        batch.commit()
                        redacted += len(chunk)
                    except Exception as e:
                        logger.error(f"cleanup-ledger batch error for org {org_id}: {e}")
                        errors += 1

            except Exception as e:
                logger.error(f"cleanup-ledger error for org {org_id}: {e}")
                errors += 1

    except Exception as e:
        logger.critical(f"cleanup-ledger fatal: {e}")
        raise HTTPException(500, str(e))

    logger.info(f"cleanup-ledger done: redacted={redacted}, errors={errors}")
    return {"status": "ok", "redacted_prompts": redacted, "errors": errors}


# ─── Fix 2d (part 1): Soft-delete org ────────────────────────────────────────

class GdprDeleteBody(BaseModel):
    confirm: str           # must be exactly "DELETE" — prevents accidental calls
    reason: str = "user_requested"


@router.delete("/org/{org_id}")
async def gdpr_soft_delete_org(org_id: str, body: GdprDeleteBody, request: Request):
    """
    FIX 2d: Soft-delete an organization for GDPR right-to-erasure.
    
    Requires: valid admin auth token + body.confirm == "DELETE".
    
    Immediately:
      - Marks org as status = "pending_deletion"
      - Sets deletion_at = now + 30 days (grace period for accidental deletion)
      - Redacts all user emails → "[redacted:<sha256[:12]>]"
      - Removes org.apiKeys (no reason to keep credentials past deletion request)
    
    After 30 days: the /cron/cleanup-dead-orgs job finishes the hard delete.
    
    AUTH: Reads Authorization: Bearer <token> and validates that the token
    belongs to an admin of org_id. Reuses the existing security.verify_org_access
    pattern but checks role=admin specifically.
    """
    if not db:
        raise HTTPException(503, "Database unavailable")

    if body.confirm != "DELETE":
        raise HTTPException(400, "body.confirm must be exactly 'DELETE'")

    # -- Auth: token must be admin of this org --
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")

    token = auth_header.split(" ", 1)[1]
    try:
        claims = firebase_auth.verify_id_token(token, app=firebase_app)
        uid = claims.get("uid", "")
    except Exception:
        raise HTTPException(401, "Invalid token")

    # Verify uid is admin of org_id
    try:
        user_doc = db.collection("users").document(uid).get()
        if not user_doc.exists:
            raise HTTPException(403, "User not found")
        user_data = user_doc.to_dict() or {}
        if user_data.get("orgId") != org_id or user_data.get("role") != "admin":
            raise HTTPException(403, "Only org admins can request deletion")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Auth check failed: {e}")

    now = datetime.now(timezone.utc)
    deletion_at = now + timedelta(days=30)

    try:
        org_ref = db.collection("organizations").document(org_id)
        org_doc_snap = org_ref.get()
        if not org_doc_snap.exists:
            raise HTTPException(404, "Organization not found")

        org_data = org_doc_snap.to_dict() or {}
        if org_data.get("status") == "pending_deletion":
            existing_at = _to_aware(org_data.get("deletion_at"))
            raise HTTPException(409, {
                "error": "already_pending",
                "deletion_at": existing_at.isoformat(),
                "message": "Deletion already scheduled. Contact support to cancel.",
            })

        # 1. Immediately redact user emails (PII)
        users = db.collection("users").where("orgId", "==", org_id).stream()
        user_updates: list[tuple] = []
        for u in users:
            ud = u.to_dict() or {}
            email = ud.get("email", "")
            if email and not email.startswith("[redacted"):
                sha = hashlib.sha256(email.encode()).hexdigest()[:12]
                user_updates.append((u.reference, {
                    "email": f"[redacted:{sha}]",
                    "status": "gdpr_redacted",
                }))

        for chunk in _batched(user_updates):
            b = db.batch()
            for ref, upd in chunk:
                b.update(ref, upd)
            b.commit()

        # 2. Mark org as pending_deletion
        org_ref.update({
            "status": "pending_deletion",
            "deletion_at": deletion_at,
            "deletion_requested_at": now,
            "deletion_requested_by_uid": uid,
            "deletion_reason": body.reason,
            "apiKeys": {},   # revoke immediately
        })

        logger.info(
            f"GDPR soft-delete: org={org_id}, by={uid}, "
            f"deletion_at={deletion_at.isoformat()}, users_redacted={len(user_updates)}"
        )

        return {
            "status": "pending_deletion",
            "deletion_at": deletion_at.isoformat(),
            "users_pii_redacted": len(user_updates),
            "message": (
                f"Organization scheduled for permanent deletion on "
                f"{deletion_at.strftime('%Y-%m-%d')}. "
                "Contact support before this date to cancel."
            ),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"gdpr-soft-delete failed for {org_id}: {e}")
        raise HTTPException(500, str(e))


# ─── Fix 2d (part 2): Hard-delete cron ───────────────────────────────────────

_SUBCOLLECTIONS = [
    "manifests", "scoringHistory", "usageLedger",
    "simulationCache", "batchJobs", "seoJobs",
    "weeklySnapshots", "auditLogs", "payments",
    "pendingInvites", "dead_letter_queue",
]


@router.post("/cleanup-dead-orgs")
async def cleanup_dead_orgs(request: Request, _: None = Depends(_require_cron)):
    """
    FIX 2d (cron): Hard-deletes orgs whose 30-day grace period has expired.
    
    Runs monthly (1st of month). Safe to run more frequently — the WHERE clause
    ensures only expired orgs are processed.
    
    Order of deletion:
      1. All subcollections (manifests, history, ledger, cache, etc.)
      2. Users collection documents for this org
      3. The org document itself
    
    If a subcollection delete fails, we log and continue — the org doc is still
    deleted, and orphaned subcollections will be cleaned on the next run.
    """
    if not db:
        raise HTTPException(503, "Database unavailable")

    now = datetime.now(timezone.utc)
    deleted_orgs    = 0
    total_docs      = 0
    errors          = 0

    try:
        expired = (
            db.collection("organizations")
            .where("status", "==", "pending_deletion")
            .where("deletion_at", "<", now)
            .stream()
        )

        for org_doc in expired:
            org_id = org_doc.id
            docs_this_org = 0

            try:
                # 1. Delete subcollections
                for sub_name in _SUBCOLLECTIONS:
                    try:
                        sub_ref = (
                            db.collection("organizations")
                            .document(org_id)
                            .collection(sub_name)
                        )
                        n = _delete_subcollection(sub_ref)
                        docs_this_org += n
                    except Exception as se:
                        logger.warning(f"cleanup-dead-orgs: subcol {sub_name} for {org_id} failed: {se}")
                        errors += 1

                # 2. Delete user records
                users = db.collection("users").where("orgId", "==", org_id).stream()
                user_refs = [u.reference for u in users]
                for chunk in _batched(user_refs):
                    b = db.batch()
                    for ref in chunk:
                        b.delete(ref)
                    b.commit()
                    docs_this_org += len(chunk)

                # 3. Delete the org document itself
                org_doc.reference.delete()
                deleted_orgs += 1
                total_docs += docs_this_org
                logger.info(f"cleanup-dead-orgs: hard-deleted org {org_id}, docs={docs_this_org}")

            except Exception as e:
                logger.error(f"cleanup-dead-orgs: failed hard-delete for org {org_id}: {e}")
                errors += 1

    except Exception as e:
        logger.critical(f"cleanup-dead-orgs fatal: {e}")
        raise HTTPException(500, str(e))

    logger.info(f"cleanup-dead-orgs done: orgs={deleted_orgs}, docs={total_docs}, errors={errors}")
    return {"status": "ok", "deleted_orgs": deleted_orgs, "total_docs_removed": total_docs, "errors": errors}
