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
            
            if cred_path and Path(cred_path).exists():
                cred = credentials.Certificate(cred_path)
                app = firebase_admin.initialize_app(cred)
                logger.info("✅ Firebase Admin SDK initialized with service account.")
            else:
                app = firebase_admin.initialize_app()
                logger.info("✅ Firebase Admin SDK initialized with default credentials.")
        
        db = firestore.client()
        return db

    except Exception as e:
        logger.warning(f"⚠️  Firebase not available (non-fatal): {e}")
        db = None
        return None

# Initialize on import — but never crash
initialize_firebase()
