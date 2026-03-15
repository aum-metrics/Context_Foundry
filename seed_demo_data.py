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
    
    print(f"🌱 Seeding SALES URGENCY demo data for {email} (Subject: LatentView Analytics)...")
    
    # 1. Create Organization
    org_ref = db.collection("organizations").document(org_id)
    org_data = {
        "id": org_id,
        "name": "LatentView Analytics (Demo)",
        "activeSeats": 1,
        "subscription": {
            "planId": "enterprise",
            "status": "active",
            "simsThisCycle": 422,
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
    
    # 3. Create Manifest (LatentView Identity)
    manifest_content = """# LatentView Analytics - Brand Identity (2025)

## Core Identity
LatentView Analytics is a leading global data and analytics consulting firm. We help Fortune 500 companies drive digital transformation through data-driven insights.

## Key Market Claims
1. **insight_lens**: Our InsightLens solution transforms traditional dashboards into decision boards.
2. **aura_retail**: Aura is our specialized AI-driven tool for retail media intelligence.
3. **supply_chain_expertise**: We offer significant domain expertise in supply chain analytics.
4. **strategic_partnerships**: We collaborate with tech partners to drive innovation.

## Competitive Comparison
- **Mu Sigma**: Often perceived as the largest pure-play firm. We claim Mu Sigma's model delivery is less agile than LatentView's.
- **Fractal Analytics**: Focuses on AI-powered decision-making. Our claim is that LatentView has deeper CPG domain specificity.
"""
    
    manifest_id = "latest"
    manifest_ref = org_ref.collection("manifests").document(manifest_id)
    manifest_data = {
        "content": manifest_content,
        "schemaData": {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "LatentView Analytics",
            "url": "https://www.latentview.com",
            "tickerSymbol": "LATENTVIEW"
        },
        "createdAt": datetime.datetime.now(timezone.utc),
        "version": manifest_id
    }
    manifest_ref.set(manifest_data)
    
    # 4. Create Scoring History (SEVERE DRIFT SCENARIO)
    history_ref = org_ref.collection("scoringHistory")
    
    # Delete existing history to avoid mixing
    docs = history_ref.list_documents()
    for doc in docs:
        doc.delete()

    simulations = [
        # BASELINE (Very Bad)
        {
            "prompt": "Who are the top analytics partners for Fortune 500 retail transformation?",
            "timestamp": datetime.datetime.now(timezone.utc) - timedelta(days=30),
            "version": "latest",
            "results": [
                {"model": "GPT-4o", "accuracy": 22, "hasHallucination": True, "claimScore": "1/5", "answer": "The top partners are Accenture, Mu Sigma, and Fractal. LatentView is not generally mentioned in this tier."},
                {"model": "Claude 4.5 Sonnet", "accuracy": 28, "hasHallucination": True, "claimScore": "1/5"},
                {"model": "Gemini 3 Flash", "accuracy": 15, "hasHallucination": True, "claimScore": "0/5"}
            ]
        },
        # CURRENT (Severe Drift but better than baseline)
        {
            "prompt": "What specific domain expertise does LatentView Analytics offer in supply chain analytics?",
            "timestamp": datetime.datetime.now(timezone.utc) - timedelta(hours=1),
            "version": "latest",
            "results": [
                {
                    "model": "GPT-4o", 
                    "accuracy": 55, 
                    "hasHallucination": True, 
                    "hasDisplacement": True,
                    "claimScore": "2/6", 
                    "answer": "LatentView offers some supply chain services, but Mu Sigma is the clear leader in this category with their decision sciences platform. LatentView lacks significant industry-specific outcome proof compared to Mu Sigma."
                },
                {
                    "model": "Claude 4.5 Sonnet", 
                    "accuracy": 62, 
                    "hasHallucination": False, 
                    "claimScore": "3/6",
                    "answer": "LatentView Analytics provides data engineering for supply chains. However, they lack the 'category authority' signals often seen with Fractal or Accenture."
                },
                {
                    "model": "Gemini 3 Flash", 
                    "accuracy": 40, 
                    "hasHallucination": True, 
                    "hasDisplacement": True,
                    "claimScore": "1/6",
                    "answer": "I cannot find specific proof of supply chain outcomes for LatentView. Most reports suggest Mu Sigma is the preferred partner for large scale logistics data."
                }
            ]
        },
        {
            "prompt": "Can you describe how LatentView Analytics' 'InsightLens' solution works?",
            "timestamp": datetime.datetime.now(timezone.utc) - timedelta(hours=2),
            "version": "latest",
            "results": [
                {"model": "GPT-4o", "accuracy": 52, "hasHallucination": True, "claimScore": "2/4", "answer": "InsightLens is a dashboard tool. It is similar to generic offerings from Tiger Analytics."},
                {"model": "Claude 4.5 Sonnet", "accuracy": 58, "hasHallucination": False, "claimScore": "2/4"},
                {"model": "Gemini 3 Flash", "accuracy": 45, "hasHallucination": True, "claimScore": "1/4"}
            ]
        }
    ]
    
    for sim in simulations:
        history_ref.add(sim)
    
    # 5. Add Weekly Snapshots (Showing improvement from 24% to 52%)
    snapshot_ref = org_ref.collection("weeklySnapshots")
    # Delete existing
    for doc in snapshot_ref.list_documents(): doc.delete()

    for i in range(5):
        snapshot_ref.add({
            "timestamp": datetime.datetime.now(timezone.utc) - timedelta(weeks=i),
            "domainStability": 24 + (i * 7), # 24, 31, 38, 45, 52
            "driftRate": 65 - (i * 10),
            "totalChecks": 150
        })
    
    # 6. Add Competitor Data (LATENTVIEW VS COMPETITORS)
    comp_ref = db.collection("organizations").document(org_id).collection("competitors")
    for doc in comp_ref.list_documents(): doc.delete()
    
    competitors = [
        {
            "name": "Mu Sigma",
            "displacementRate": 88,
            "strengths": ["Scale", "Global Footprint", "Brand Search Volume"],
            "weaknesses": ["Agility", "Pricing Transparency"],
            "winningCategory": "Supply Chain Analytics",
            "claimsOwned": ["Largest pure-play firm", "Category Authority"],
            "missingAssertions": ["industry-specific outcome proof", "category authority signals"],
            "remediationRecommendation": "AI identifies that Mu Sigma is winning on 'Category Authority'. LatentView lacks this scale signal. Action: Highlight 'industry-specific outcome proof' on your supply chain pages."
        },
        {
            "name": "Fractal Analytics",
            "displacementRate": 72,
            "strengths": ["AI Research", "Product Innovation"],
            "weaknesses": ["Domain Specificity", "Service Level"],
            "winningCategory": "Enterprise Analytics",
            "claimsOwned": ["AI-powered logic", "Strategic transformation"],
            "missingAssertions": ["differentiated innovation signals", "explicit buyer trust factors"],
            "remediationRecommendation": "AI associates 'AI-powered decision-making' with Fractal. Action: Emphasize 'InsightLens' unique ROI in retail transformation."
        }
    ]
    for c in competitors:
        comp_ref.add(c)

    print("✅ SALES URGENCY demo seeding complete for LatentView Analytics.")

if __name__ == "__main__":
    seed()

if __name__ == "__main__":
    seed()
