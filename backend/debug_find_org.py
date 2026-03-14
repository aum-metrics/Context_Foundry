
import os
import firebase_admin
from firebase_admin import credentials, firestore as admin_firestore

def list_collections():
    project_id = "gen-lang-client-0350122978"
    if not firebase_admin._apps:
        # Initialize with specific project ID
        firebase_admin.initialize_app(options={'projectId': project_id})
    
    db = admin_firestore.client()
    print(f"Listing all root collections for project {project_id}:")
    collections = list(db.collections())
    if not collections:
        print("No root collections found.")
    for col in collections:
        print(f" - {col.id}")

if __name__ == "__main__":
    list_collections()
