import uuid
import logging
from datetime import datetime
from typing import Callable, Any, Dict
from core.firebase_config import db

logger = logging.getLogger(__name__)

class FirestoreTaskQueue:
    """
    A persistent task registry to track and recover background jobs.
    Replaces volatile in-memory BackgroundTasks for enterprise workflows.
    """
    
    @staticmethod
    def register_job(org_id: str, collection: str, job_id: str, payload: Dict[str, Any]):
        """Registers a new job in Firestore with 'queued' status."""
        if not db: return
        try:
            db.collection("organizations").document(org_id).collection(collection).document(job_id).set({
                "status": "queued",
                "createdAt": datetime.utcnow(),
                "payload": payload,
                "workerId": f"worker-{uuid.uuid4().hex[:8]}"
            })
        except Exception as e:
            logger.error(f"Failed to register job {job_id}: {e}")

    @staticmethod
    def update_job(org_id: str, collection: str, job_id: str, status: str, result: Any = None, error: str = None):
        """Updates job status and results."""
        if not db: return
        try:
            update_data = {
                "status": status,
                "updatedAt": datetime.utcnow()
            }
            if status == "completed":
                update_data["completedAt"] = datetime.utcnow()
                update_data["result"] = result
            if error:
                update_data["error"] = error
                
            db.collection("organizations").document(org_id).collection(collection).document(job_id).update(update_data)
        except Exception as e:
            logger.error(f"Failed to update job {job_id}: {e}")

    @staticmethod
    async def run_persistent_task(org_id: str, collection: str, job_id: str, worker_fn: Callable, *args, **kwargs):
        """
        Executes a task and ensures status is updated in Firestore even if it fails.
        """
        FirestoreTaskQueue.update_job(org_id, collection, job_id, "processing")
        try:
            result = await worker_fn(*args, **kwargs)
            FirestoreTaskQueue.update_job(org_id, collection, job_id, "completed", result=result)
            return result
        except Exception as e:
            logger.error(f"Task {job_id} failed in worker: {e}")
            FirestoreTaskQueue.update_job(org_id, collection, job_id, "failed", error=str(e))
            raise e
