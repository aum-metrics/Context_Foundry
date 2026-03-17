# backend/app/core/firebase_config.py
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

db = None
app = None

def initialize_firebase():
    """
    Initializes Firebase Admin SDK.
    Returns a Firestore client, or None if credentials are not available.
    """
    global db, app
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        if not firebase_admin._apps:
            cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
            firebase_project_id = os.getenv("FIREBASE_PROJECT_ID", "aumdatalabs-bb691")
            
            if cred_path and Path(cred_path).exists():
                cred = credentials.Certificate(cred_path)
                app = firebase_admin.initialize_app(cred, options={'projectId': firebase_project_id})
                logger.info(f"✅ Firebase Admin SDK initialized with service account for project: {firebase_project_id}")
            else:
                app = firebase_admin.initialize_app(options={'projectId': firebase_project_id})
                logger.info(f"✅ Firebase Admin SDK initialized with default credentials for project: {firebase_project_id}")
        
        db = firestore.client()
        return db

    except Exception as e:
        logger.warning(f"⚠️  Firebase not available (non-fatal): {e}")
        db = None
        return None

# Initialization
initialize_firebase()
