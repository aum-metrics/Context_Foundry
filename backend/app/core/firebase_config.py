# backend/app/core/firebase_config.py
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Internal state
_db = None
_app = None

def get_firebase_app():
    global _app
    if _app is not None:
        return _app
    
    try:
        import firebase_admin
        from firebase_admin import credentials
        
        if not firebase_admin._apps:
            cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
            firebase_project_id = os.getenv("FIREBASE_PROJECT_ID", "aumdatalabs-bb691")
            
            if cred_path and Path(cred_path).exists():
                cred = credentials.Certificate(cred_path)
                _app = firebase_admin.initialize_app(cred, options={'projectId': firebase_project_id})
                logger.info(f"✅ Firebase initialized (SA) project: {firebase_project_id}")
            else:
                _app = firebase_admin.initialize_app(options={'projectId': firebase_project_id})
                logger.info(f"✅ Firebase initialized (Default) project: {firebase_project_id}")
        else:
            _app = firebase_admin.get_app()
        return _app
    except Exception as e:
        logger.warning(f"⚠️ Firebase app init error: {e}")
        return None

def get_firestore_client():
    global _db
    if _db is not None:
        return _db
    
    app = get_firebase_app()
    if not app:
        return None
        
    try:
        from firebase_admin import firestore
        _db = firestore.client()
        return _db
    except Exception as e:
        logger.warning(f"⚠️ Firestore client init error: {e}")
        return None

def initialize_firebase():
    """Compatibility wrapper for legacy calls."""
    return get_firestore_client()

# Eager initialization on module load (ensures db is available for exports)
get_firestore_client()

# Export 'db' and 'app' as the initialized instances
db = _db
app = _app
