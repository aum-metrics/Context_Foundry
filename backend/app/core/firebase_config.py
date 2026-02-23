# backend/app/core/firebase_config.py
import firebase_admin
from firebase_admin import credentials, firestore
import os
from pathlib import Path

def initialize_firebase():
    """
    Initializes Firebase Admin SDK to allow backend to read from Firestore.
    Uses environment variables for credentials.
    """
    if not firebase_admin._apps:
        # For local development, we look for a service account key or use default credentials
        cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
        
        if cred_path and Path(cred_path).exists():
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            # Fallback to application default credentials (useful for GCP deployment)
            try:
                firebase_admin.initialize_app()
            except Exception as e:
                print(f"⚠️  Firebase initialization failed: {e}")
                # We don't raise here to allow the app to start, 
                # but specific routes will fail if they need Firestore.
                return None
                
    return firestore.client()

# Singleton instance
db = initialize_firebase()
