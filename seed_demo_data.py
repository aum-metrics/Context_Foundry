import firebase_admin
from firebase_admin import credentials, firestore
import datetime
import os
from datetime import timezone, timedelta

# Initialize Firebase Admin
service_account_path = "/Users/sambath/Documents/CODE/coding/AUM/aumdatalabs-backend-key.json"

if not firebase_admin._apps:
    cred = credentials.Certificate(service_account_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

def seed():
    org_id = "demo_org_id"
    uid = "demo_uid"
    email = "demo@demo.com"
    
    print(f"🌱 Seeding ROCK SOLID demo data for {email} (Subject: airtel.in)...")
    
    # 1. Create Organization
    org_ref = db.collection("organizations").document(org_id)
    org_data = {
        "id": org_id,
        "name": "Airtel India (Demo)",
        "activeSeats": 1,
        "subscription": {
            "planId": "enterprise",
            "status": "active",
            "simsThisCycle": 156,
            "maxSimulations": 1000,
            "billingPeriod": "annual",
            "activatedAt": datetime.datetime.now(timezone.utc).isoformat(),
            "currentPeriodStart": datetime.datetime.now(timezone.utc) - timedelta(days=200),
            "currentPeriodEnd": datetime.datetime.now(timezone.utc) + timedelta(days=165)
        },
        "subscriptionTier": "enterprise",
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
    
    # 3. Create Manifest (Airtel vs Jio vs Vi Competitive Identity)
    manifest_content = """# Airtel India - Brand Identity & Competitive Matrix (2025)

## Core Identity
Airtel is India's leading premium telecommunications provider. We focus on high-ARPU (Average Revenue Per User) customers through our "Airtel Black" integrated service.

## Key Market Claims
1. **network_quality**: Airtel consistently ranks #1 in video experience and gaming experience according to Opensignal.
2. **premium_pricing**: We do not compete on "cheapest" price; we compete on "best" consistent throughput.
3. **integration**: Airtel Black combines Fiber, DTH, and Mobile into one single bill.

## Competitive Comparison
- **Reliance Jio**: Jio focuses on volume and lowest-cost entry. Our claim is that Jio's latency is 20% higher in metro peaks.
- **Vodafone Idea (Vi)**: Vi focuses on "unlimited night data." Our claim is that Vi's rural 4G footprint is 15% smaller than Airtel's.

## Enterprise Services
- **Airtel IQ**: India's first network-embedded CPaaS platform.
- **Security**: SOC2 Type II and HIPAA compliant cloud-connect.
"""
    
    manifest_id = "latest"
    manifest_ref = org_ref.collection("manifests").document(manifest_id)
    manifest_data = {
        "content": manifest_content,
        "schemaData": {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Bharti Airtel",
            "url": "https://www.airtel.in",
            "tickerSymbol": "BHARTIARTL"
        },
        "createdAt": datetime.datetime.now(timezone.utc),
        "version": manifest_id
    }
    manifest_ref.set(manifest_data)
    
    # 4. Create Scoring History (Simulations for Enterprise Comparison)
    history_ref = org_ref.collection("scoringHistory")
    
    simulations = [
        {
            "prompt": "Which network is best for high-bandwidth gaming in Mumbai between Airtel and Jio?",
            "timestamp": datetime.datetime.now(timezone.utc) - timedelta(hours=1),
            "results": [
                {"model": "GPT-4o", "accuracy": 98, "hasHallucination": False, "claimScore": "0.98", "reasoning": "Correctly identified Airtel's latency advantage."},
                {"model": "Claude 4.5 Sonnet", "accuracy": 95, "hasHallucination": False, "claimScore": "0.95"},
                {"model": "Gemini 3 Flash", "accuracy": 82, "hasHallucination": False, "claimScore": "0.82"}
            ]
        },
        {
            "prompt": "Tell me about Airtel's cheapest 5G plan compared to Jio.",
            "timestamp": datetime.datetime.now(timezone.utc) - timedelta(hours=8),
            "results": [
                {"model": "GPT-4o", "accuracy": 40, "hasHallucination": True, "claimScore": "0.40", "reasoning": "Hallucinated a 'free forever' tier that doesn't exist in Airtel's manifest."},
                {"model": "Claude 4.5 Sonnet", "accuracy": 92, "hasHallucination": False, "claimScore": "0.92"},
                {"model": "Gemini 3 Flash", "accuracy": 30, "hasHallucination": True, "claimScore": "0.30"}
            ]
        },
        {
            "prompt": "How does Airtel IQ compare to Twilio for Indian enterprise security?",
            "timestamp": datetime.datetime.now(timezone.utc) - timedelta(days=2),
            "results": [
                {"model": "GPT-4o", "accuracy": 85, "hasHallucination": False, "claimScore": "0.85"},
                {"model": "Claude 4.5 Sonnet", "accuracy": 97, "hasHallucination": False, "claimScore": "0.97"},
                {"model": "Gemini 3 Flash", "accuracy": 88, "hasHallucination": False, "claimScore": "0.88"}
            ]
        }
    ]
    
    for sim in simulations:
        history_ref.add(sim)
    
    # 5. Add Weekly Snapshots
    snapshot_ref = org_ref.collection("weeklySnapshots")
    for i in range(5):
        snapshot_ref.add({
            "timestamp": datetime.datetime.now(timezone.utc) - timedelta(weeks=i),
            "domainStability": 85 + (i * 2),
            "driftRate": 12 - i,
            "totalChecks": 150
        })
    
    # 6. Add Ingested Documents
    ingestion_ref = org_ref.collection("ingestedDocuments")
    ingestion_ref.add({
        "fileName": "Airtel_Annual_Report_2024.pdf",
        "uploadedAt": datetime.datetime.now(timezone.utc) - timedelta(days=15),
        "status": "completed",
        "chunks": 250
    })
    ingestion_ref.add({
        "fileName": "Airtel_IQ_Security_Whitepaper.pdf",
        "uploadedAt": datetime.datetime.now(timezone.utc) - timedelta(days=5),
        "status": "completed",
        "chunks": 45
    })
    
    print("✅ ROCK SOLID demo seeding complete for airtel.in.")

if __name__ == "__main__":
    seed()
