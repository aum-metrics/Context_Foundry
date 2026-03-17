# backend/app/core/firebase_config.py
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Internal state
_db = None
_app = None

def initialize_firebase():
    """
    Initializes Firebase Admin SDK.
    """
    global _db, _app
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        if not firebase_admin._apps:
            cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
            firebase_project_id = os.getenv("FIREBASE_PROJECT_ID", "aumdatalabs-bb691")
            
            if cred_path and Path(cred_path).exists():
                cred = credentials.Certificate(cred_path)
                _app = firebase_admin.initialize_app(cred, options={'projectId': firebase_project_id})
                logger.info(f"✅ Firebase Admin SDK initialized with service account for project: {firebase_project_id}")
            else:
                _app = firebase_admin.initialize_app(options={'projectId': firebase_project_id})
                logger.info(f"✅ Firebase Admin SDK initialized with default credentials for project: {firebase_project_id}")
        
        _db = firestore.client()
        return _db

    except Exception as e:
        logger.warning(f"⚠️  Firebase not available (non-fatal): {e}")
        return None

# Eager initialization on module load
initialize_firebase()

# Export 'db' and 'app' for compatibility with other modules
db = _db
app = _app
