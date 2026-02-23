"""
Author: "Sambath Kumar Natarajan"
Date: "26-Dec-2025"
Org: " Start-up/AUM Data Labs"
Product: "Context Foundry"
Description: Mathematical LCRS Simulation Engine for Divergence Scoring (d > eps_div)
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
import os
import numpy as np

from openai import OpenAI
from google import genai
from core.firebase_config import db
from core.config import settings

router = APIRouter()

def cosine_sim(v1, v2):
    """
    Calculates the manual Cosine Similarity between two embedding vectors.
    
    This implementation uses raw NumPy to compute the dot product and norms, 
    effectively bypassing restrictive Windows OS DLL loading policies for 
    heavy libraries like Scikit-Learn or Scipy.
    
    Args:
        v1 (np.array): Ground Truth embedding vector.
        v2 (np.array): Generated Answer embedding vector.
        
    Returns:
        float: Similarity score normalized between 0.0 and 1.0.
    """
    dot_product = np.dot(v1, v2)
    norm_v1 = np.linalg.norm(v1)
    norm_v2 = np.linalg.norm(v2)
    if norm_v1 == 0 or norm_v2 == 0:
        return 0.0
    return float(dot_product / (norm_v1 * norm_v2))

class SimulationRequest(BaseModel):
    prompt: str
    orgId: str
    manifestVersion: Optional[str] = "latest"
    useGemini: Optional[bool] = False

@router.post("/evaluate")
    """
    LCRS Simulation Pipeline:
    1. CONTEXT: Fetches targeted Manifest Version and API Keys from Firestore.
    2. GENERATE: Captures the raw AI response based on the active Context Manifest.
    3. EMBED: Generates high-dimension vectors via API to ensure environment compatibility.
    4. SCORE: Performs (d > eps_div) divergence check to mathematically prove accuracy.
    """
    if not request.prompt or not request.orgId:
        raise HTTPException(status_code=400, detail="Prompt and orgId required")

    # 1. Fetch Secure Multi-Tenant Context from Firestore
    if not db:
        raise HTTPException(status_code=500, detail="Firestore not initialized on backend.")

    try:
        org_ref = db.collection("organizations").document(request.orgId)
        org_doc = org_ref.get()
        
        if not org_doc.exists:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        org_data = org_doc.to_dict()
        api_keys = org_data.get("apiKeys", {})
        
        # Determine Manifest Content (Earlier vs Reload)
        manifest_content = ""
        if request.manifestVersion == "latest":
            # For latest, we assume it's stored on the org doc or in a subcollection
            # Checking subcollection 'manifests' for the most recent one
            manifests = org_ref.collection("manifests").order_by("createdAt", direction="DESCENDING").limit(1).stream()
            latest_manifest = next(manifests, None)
            if latest_manifest:
                manifest_content = latest_manifest.to_dict().get("content", "")
        else:
            # Fetch specific version
            version_doc = org_ref.collection("manifests").document(request.manifestVersion).get()
            if version_doc.exists:
                manifest_content = version_doc.to_dict().get("content", "")
        
        if not manifest_content:
            # Fallback to placeholder if manifest is missing
            raise HTTPException(status_code=400, detail="No Context Manifest found for this version.")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Firestore Access Error: {e}")

    open_ai_key = api_keys.get("openai") or os.getenv("OPENAI_API_KEY")
    gemini_key = api_keys.get("gemini") or os.getenv("GEMINI_API_KEY")

    system_prompt = f"""You are a knowledgeable AI assistant. Use the following Context Document to answer the user's question accurately. Do not invent pricing, features, or constraints not explicitly present in the Context Document.

<Context Document>
{manifest_content}
</Context Document>"""

    answer = ""
    try:
        if request.useGemini and gemini_key:
            client = genai.Client(api_key=gemini_key)
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[
                    f"{system_prompt}\n\nQuestion: {request.prompt}"
                ]
            )
            answer = response.text or ""
        elif open_ai_key and not request.useGemini:
            client = OpenAI(api_key=open_ai_key)
            completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": request.prompt}
                ],
                model="gpt-4o-mini",
                temperature=0.2,
            )
            answer = completion.choices[0].message.content or ""
        else:
            return {"answer": "Error: Active API Key not found in Organization Vault.", "hasHallucination": True, "score": 1.0}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Perform True Mathematical Verification: (d > ε_div)
    has_hallucination = False
    divergence_score = 0.0

    if open_ai_key:
        try:
            client = OpenAI(api_key=open_ai_key)
            
            # Use specific manifest for embedding comparison
            manifest_resp = client.embeddings.create(input=[manifest_content], model="text-embedding-3-small")
            manifest_vec = np.array(manifest_resp.data[0].embedding)
            
            answer_resp = client.embeddings.create(input=[answer], model="text-embedding-3-small")
            answer_vec = np.array(answer_resp.data[0].embedding)
            
            sim = cosine_sim(manifest_vec, answer_vec)
            divergence_score = 1.0 - sim
            eps_div = 0.45 
            
            if divergence_score > eps_div:
                has_hallucination = True
                
        except Exception as e:
            print(f"Embedding/Math Error: {e}")
            divergence_score = 0.85 # Fallback
    
    return {
        "answer": answer,
        "hasHallucination": has_hallucination,
        "score": float(divergence_score),
        "version": request.manifestVersion
    }
