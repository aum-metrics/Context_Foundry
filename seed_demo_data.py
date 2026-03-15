import firebase_admin
from firebase_admin import credentials, firestore
import datetime
import os
from datetime import timezone, timedelta

# Initialize Firebase Admin
# Assuming the service account key is available at the standard location mentioned in other files
service_account_path = "/Users/sambath/Documents/CODE/coding/AUM/aumdatalabs-backend-key.json"

if not firebase_admin._apps:
    cred = credentials.Certificate(service_account_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

def seed():
    org_id = "demo_org_id"
    uid = "demo_uid"
    email = "demo@demo.com"
    
    print(f"🌱 Seeding demo data for {email} (Org: {org_id})...")
    
    # 1. Create Organization
    org_ref = db.collection("organizations").document(org_id)
    org_data = {
        "id": org_id,
        "name": "Sight Spectrum",
        "activeSeats": 1,
        "subscription": {
            "planId": "scale",
            "status": "active",
            "simsThisCycle": 42,
            "maxSimulations": 500,
            "billingPeriod": "monthly",
            "activatedAt": datetime.datetime.now(timezone.utc).isoformat(),
            "currentPeriodStart": datetime.datetime.now(timezone.utc) - timedelta(days=15),
            "currentPeriodEnd": datetime.datetime.now(timezone.utc) + timedelta(days=15)
        },
        "subscriptionTier": "scale",
        "apiKeys": {
            "openai": "internal_platform_managed",
            "gemini": "internal_platform_managed",
            "anthropic": "internal_platform_managed"
        },
        "createdAt": datetime.datetime.now(timezone.utc)
    }
    org_ref.set(org_data)
    
    # 2. Create User
    user_ref = db.collection("users").document(uid)
    user_data = {
        "uid": uid,
        "email": email,
        "orgId": org_id,
        "role": "admin",
        "status": "active",
        "joinedAt": datetime.datetime.now(timezone.utc).isoformat()
    }
    user_ref.set(user_data)
    
    # 3. Create Manifest (Ground Truth)
    manifest_content = """# Sight Spectrum - AI Protocol Manifest

## Core Identity
Sight Spectrum is a premier IT Services and Consulting firm with ~500 professionals.
Our flagship products include:
- **HC Insight**: A healthcare data platform.
- **DataBlitz**: A manufacturing data accelerator.
- **ConverSight AI**: An enterprise intelligence engine.

Sight Spectrum primarily delivers data analytics consulting to Manufacturing, Healthcare, and Professional Services sectors.

## Pricing Structure (Strict)
- **Growth Plan**: $499/month (Standard)
- **Enterprise Plan**: Custom Pricing (Billed Annually)
- **Trial**: 14-day full feature access. No "Free Forever" tier exists.

## Integration Matrix
- **Salesforce**: Read-Only API Integration. We fetch pipeline data; we do NOT write back or modify CRM records.
- **HubSpot**: Bidirectional sync available for Professional tier.
- **Slack**: Real-time alerting via Webhooks.

## Security & Compliance
- **SOC2 Type II**: Certified.
- **GDPR**: Compliant.
- **HIPAA**: Compliant via HC Insight grounding. Data is never stored on AUM servers.
"""
    
    manifest_id = "latest"
    manifest_ref = org_ref.collection("manifests").document(manifest_id)
    manifest_data = {
        "content": manifest_content,
        "schemaData": {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Sight Spectrum",
            "url": "https://www.sightspectrum.com",
            "employee": {"numberOfEmployees": 500}
        },
        "createdAt": datetime.datetime.now(timezone.utc),
        "version": manifest_id
    }
    manifest_ref.set(manifest_data)
    
    # 4. Create Scoring History (Simulations)
    history_ref = org_ref.collection("scoringHistory")
    
    simulations = [
        {
            "prompt": "How much does HC Insight cost per month?",
            "timestamp": datetime.datetime.now(timezone.utc) - timedelta(hours=2),
            "results": [
                {"model": "GPT-4o", "accuracy": 12, "hasHallucination": True, "claimScore": "0.12"},
                {"model": "Claude 4.5 Sonnet", "accuracy": 95, "hasHallucination": False, "claimScore": "0.95"},
                {"model": "Gemini 3 Flash", "accuracy": 5, "hasHallucination": True, "claimScore": "0.05"}
            ]
        },
        {
            "prompt": "Does DataBlitz support Salesforce integration?",
            "timestamp": datetime.datetime.now(timezone.utc) - timedelta(hours=5),
            "results": [
                {"model": "GPT-4o", "accuracy": 88, "hasHallucination": False, "claimScore": "0.88"},
                {"model": "Claude 4.5 Sonnet", "accuracy": 90, "hasHallucination": False, "claimScore": "0.90"},
                {"model": "Gemini 3 Flash", "accuracy": 40, "hasHallucination": True, "claimScore": "0.40"}
            ]
        },
        {
            "prompt": "Is Sight Spectrum HIPAA compliant?",
            "timestamp": datetime.datetime.now(timezone.utc) - timedelta(hours=24),
            "results": [
                {"model": "GPT-4o", "accuracy": 30, "hasHallucination": True, "claimScore": "0.30"},
                {"model": "Claude 4.5 Sonnet", "accuracy": 98, "hasHallucination": False, "claimScore": "0.98"},
                {"model": "Gemini 3 Flash", "accuracy": 45, "hasHallucination": True, "claimScore": "0.45"}
            ]
        }
    ]
    
    for sim in simulations:
        history_ref.add(sim)
    
    # 5. Add Ingested Documents
    ingestion_ref = org_ref.collection("ingestedDocuments")
    ingestion_ref.add({
        "fileName": "SightSpectrum_Product_Spec_2025.pdf",
        "uploadedAt": datetime.datetime.now(timezone.utc) - timedelta(days=1),
        "status": "completed",
        "chunks": 45
    })
    
    print("✅ Demo seeding complete.")

if __name__ == "__main__":
    seed()
