"""
Task Queue Recovery Worker.

A sweep-based recovery system that detects stalled/failed background jobs
and optionally retries them. Designed to run as part of app startup or as
a periodic scheduler (eg via APScheduler or cron).

Usage:
  # At startup (recovers jobs stuck from previous crash):
  await TaskQueueRecovery.sweep_stalled_jobs()

  # Or schedule periodically:
  scheduler.add_job(TaskQueueRecovery.sweep_stalled_jobs, 'interval', minutes=5)
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Callable, Dict, Any
from core.firebase_config import db

logger = logging.getLogger(__name__)


class TaskQueueRecovery:
    """
    Sweeps Firestore for stalled/failed jobs and either retries or marks them as abandoned.
    """

    # Jobs stuck in "processing" or "queued" for longer than this are considered stalled
    STALE_THRESHOLD_MINUTES = 30
    MAX_RETRIES = 3

    # Collections that contain background job sub-collections (P1 Fix: align with worker collections)
    JOB_COLLECTIONS = ["batchJobs", "seoJobs"]

    @staticmethod
    async def sweep_stalled_jobs(
        retry_fn: Optional[Callable] = None,
    ) -> Dict[str, Any]:
        """
        Sweep all org job collections for stalled/failed jobs.
        
        Args:
            retry_fn: Optional async callable(org_id, collection, job_id, payload) 
                       to re-execute the job. If None, stalled jobs are marked 'abandoned'.
        
        Returns:
            Summary of recovery actions taken.
        """
        if not db:
            logger.warning("TaskQueueRecovery: Firestore unavailable, skipping sweep.")
            return {"status": "skipped", "reason": "db_unavailable"}

        stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=TaskQueueRecovery.STALE_THRESHOLD_MINUTES)
        stats = {"scanned": 0, "stalled": 0, "retried": 0, "abandoned": 0, "failed_permanent": 0}

        try:
            # Iterate all organizations
            orgs = db.collection("organizations").select([]).stream()
            
            for org_doc in orgs:
                org_id = org_doc.id

                for job_collection in TaskQueueRecovery.JOB_COLLECTIONS:
                    try:
                        # Find jobs in "processing" or "queued" state
                        jobs_ref = (
                            db.collection("organizations")
                            .document(org_id)
                            .collection(job_collection)
                        )

                        # Check processing jobs (may be stalled from crashed worker)
                        for status in ["processing", "queued"]:
                            stalled_jobs = (
                                jobs_ref
                                .where("status", "==", status)
                                .stream()
                            )

                            for job_doc in stalled_jobs:
                                stats["scanned"] += 1
                                job_data = job_doc.to_dict() or {}
                                job_id = job_doc.id

                                # Check if job is actually stale
                                created_at = job_data.get("createdAt")
                                updated_at = job_data.get("updatedAt")
                                check_time = updated_at or created_at

                                if check_time and hasattr(check_time, 'timestamp'):
                                    # Firestore timestamp -> datetime
                                    if check_time.timestamp() > stale_cutoff.timestamp():
                                        continue  # Not stale yet

                                stats["stalled"] += 1
                                retry_count = job_data.get("retryCount", 0)

                                if retry_count >= TaskQueueRecovery.MAX_RETRIES:
                                    # Max retries exceeded — move to Dead Letter Queue
                                    dlq_ref = db.collection("organizations").document(org_id).collection("dead_letter_queue").document(job_id)
                                    dlq_ref.set({
                                        "jobCollection": job_collection,
                                        "originalData": job_data,
                                        "failedAt": datetime.now(timezone.utc),
                                        "error": f"Exceeded max retries ({TaskQueueRecovery.MAX_RETRIES})",
                                        "status": "dead_letter"
                                    })
                                    # Delete from primary queue 
                                    job_doc.reference.delete()
                                    stats["failed_permanent"] += 1
                                    logger.warning(
                                        f"Job {job_id} in {org_id}/{job_collection} permanently failed "
                                        f"and moved to DLQ."
                                    )
                                elif retry_fn:
                                    # Attempt retry
                                    try:
                                        job_doc.reference.update({
                                            "status": "retrying",
                                            "retryCount": retry_count + 1,
                                            "updatedAt": datetime.now(timezone.utc),
                                        })
                                        payload = job_data.get("payload", {})
                                        await retry_fn(org_id, job_collection, job_id, payload)
                                        stats["retried"] += 1
                                        logger.info(f"Retried job {job_id} in {org_id}/{job_collection}")
                                    except Exception as e:
                                        job_doc.reference.update({
                                            "status": "failed",
                                            "error": str(e),
                                            "updatedAt": datetime.now(timezone.utc),
                                        })
                                        logger.error(f"Retry failed for {job_id}: {e}")
                                else:
                                    # No retry function — mark as abandoned
                                    job_doc.reference.update({
                                        "status": "abandoned",
                                        "updatedAt": datetime.now(timezone.utc),
                                        "error": "Stale job detected during recovery sweep; no retry handler registered",
                                    })
                                    stats["abandoned"] += 1

                        # Also find "failed" jobs eligible for retry
                        failed_jobs = jobs_ref.where("status", "==", "failed").stream()
                        for job_doc in failed_jobs:
                            stats["scanned"] += 1
                            job_data = job_doc.to_dict() or {}
                            retry_count = job_data.get("retryCount", 0)
                            job_id = job_doc.id

                            if retry_count < TaskQueueRecovery.MAX_RETRIES and retry_fn:
                                try:
                                    job_doc.reference.update({
                                        "status": "retrying",
                                        "retryCount": retry_count + 1,
                                        "updatedAt": datetime.now(timezone.utc),
                                    })
                                    payload = job_data.get("payload", {})
                                    await retry_fn(org_id, job_collection, job_id, payload)
                                    stats["retried"] += 1
                                except Exception as e:
                                    job_doc.reference.update({
                                        "status": "failed",
                                        "error": str(e),
                                        "updatedAt": datetime.now(timezone.utc),
                                    })
                            elif retry_count >= TaskQueueRecovery.MAX_RETRIES:
                                # Max retries exceeded — move to Dead Letter Queue
                                dlq_ref = db.collection("organizations").document(org_id).collection("dead_letter_queue").document(job_id)
                                dlq_ref.set({
                                    "jobCollection": job_collection,
                                    "originalData": job_data,
                                    "failedAt": datetime.now(timezone.utc),
                                    "error": f"Exceeded max retries ({TaskQueueRecovery.MAX_RETRIES})",
                                    "status": "dead_letter"
                                })
                                job_doc.reference.delete()
                                stats["failed_permanent"] += 1

                    except Exception as e:
                        logger.error(f"Sweep error for {org_id}/{job_collection}: {e}")

        except Exception as e:
            logger.error(f"TaskQueueRecovery sweep failed: {e}")
            return {"status": "error", "error": str(e), **stats}

        logger.info(
            f"TaskQueueRecovery sweep complete: "
            f"scanned={stats['scanned']}, stalled={stats['stalled']}, "
            f"retried={stats['retried']}, abandoned={stats['abandoned']}, "
            f"dlq_items={stats['failed_permanent']}"
        )
        return {"status": "completed", **stats}
