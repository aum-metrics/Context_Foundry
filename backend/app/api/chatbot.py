# backend/app/api/chatbot.py
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import os
import json
from openai import OpenAI
from typing import List, Dict
import numpy as np

from core.firebase_config import db
from core.security import get_auth_context, verify_user_org_access

logger = logging.getLogger(__name__)
router = APIRouter()

class ChatMessage(BaseModel):
    id: str
    text: str
    sender: str
    timestamp: str

class ChatRequest(BaseModel):
    orgId: str
    query: str
    chatHistory: List[ChatMessage] = []

@router.post("/ask")
async def chat_with_manifest(request: ChatRequest, auth: dict = Depends(get_auth_context)):
    """
    RAG-enabled Support Chatbot Endpoint.
    Uses Semantic Chunk Retrieval to provide Zero-Amnesia support for massive docs.
    """
    from core.config import settings
    is_dev = settings.ENV == "development"

    # Security Check
    if auth.get("type") == "session":
        if not verify_user_org_access(auth["uid"], request.orgId):
            raise HTTPException(status_code=403, detail="Unauthorized access to this organization")
    else:
        if auth.get("orgId") != request.orgId:
            raise HTTPException(status_code=403, detail="API key is not authorized for this organization")

    if not db:
        if not is_dev:
            raise HTTPException(status_code=503, detail="Firestore not available")
        else:
            logger.info("🧪 Dev-mode: Firestore not available, using mock responses.")

    # 1. Fetch Organization API Key (Hardened Fallback)
    openai_key = None
    if db:
        try:
            org_ref = db.collection("organizations").document(request.orgId).get()
            if org_ref.exists:
                org_data = org_ref.to_dict() or {}
                # 🛡️ SECURITY HARDENING (P0): Redact apiKeys
                org_data.pop("apiKeys", None)
                openai_key = org_data.get("apiKeys", {}).get("openai")
        except Exception as e:
            logger.error(f"Firestore org lookup failed: {e}")

    # MASTER FALLBACK: Resolve sentinel or use environment key
    if openai_key == "internal_platform_managed" or not openai_key:
        openai_key = os.getenv("OPENAI_API_KEY")

    if not openai_key:
        if is_dev:
            logger.info("🧪 Dev-mode: Providing mock chatbot response")
            return {"response": f"I am the AUM Support Bot (Simulated). I've analyzed your query: '{request.query}'. This is a mock response because no OpenAI API key is configured."}
        raise HTTPException(status_code=402, detail="OpenAI API key missing for this organization")

    client = OpenAI(api_key=openai_key)

    # 2. Vectorize User Query for Semantic Search
    try:
        query_embed_resp = client.embeddings.create(input=[request.query], model="text-embedding-3-small")
        query_vector = query_embed_resp.data[0].embedding
    except Exception as e:
        logger.error(f"Query embedding failed: {e}")
        query_vector = None

    # 3. Retrieve Relevant Chunks (Semantic Top-K Search)
    context_text = ""
    
    if db and query_vector:
        try:
            # BRUTAL FIX: Find the latest manifest ID first
            org_ref = db.collection("organizations").document(request.orgId)
            manifests = org_ref.collection("manifests").order_by("createdAt", direction="DESCENDING").limit(1).stream()
            latest_manifest_doc = next(manifests, None)
            
            if latest_manifest_doc:
                chunks_ref = latest_manifest_doc.reference.collection("chunks").get()
                
                import numpy as np
                def cosine_sim(v1, v2):
                    norm_prod = (np.linalg.norm(v1) * np.linalg.norm(v2))
                    return float(np.dot(v1, v2) / norm_prod) if norm_prod > 0 else 0.0

                chunk_matches = []
                for doc in chunks_ref:
                    data = doc.to_dict()
                    if "embedding" in data and "text" in data:
                        sim = cosine_sim(query_vector, data["embedding"])
                        chunk_matches.append((sim, data["text"]))
                
                # Sort by similarity descending and pick top 5
                chunk_matches.sort(key=lambda x: x[0], reverse=True)
                relevant_chunks = [m[1] for m in chunk_matches[:5]]
                context_text = "\n\n---\n\n".join(relevant_chunks)
        except Exception as e:
            logger.warning(f"Semantic search failed: {e}")

    # Fallback to general content summary if semantic search yielded nothing
    if not context_text and db:
        try:
            org_ref = db.collection("organizations").document(request.orgId)
            manifests = org_ref.collection("manifests").order_by("createdAt", direction="DESCENDING").limit(1).stream()
            latest_doc = next(manifests, None)
            if latest_doc:
                context_text = latest_doc.to_dict().get("content", "")[:10000]
        except Exception as e:
            logger.warning(f"Fallback manifest retrieval failed: {e}")

    if not context_text:
        return {"response": "I cannot answer that because no verified Context Document exists for your organization yet. Please upload your company data in the Ingestion tab first."}

    # 4. Construct the RAG prompt
    system_prompt = f"""You are the AUM Context Engine Support Assistant. 
You provide specific, technical support using the retrieved semantic chunks from the user's AUM Context Foundry.

<Retrieved Context>
{context_text}
</Retrieved Context>

Rules:
1. ONLY answer based on the retrieved context above.
2. If the answer isn't in the context, politely say you don't have that specific data in the current manifest.
3. Use technical Markdown formatting.
4. Be concise and authoritative."""

    messages = [{"role": "system", "content": system_prompt}]
    for msg in list(request.chatHistory)[-4:]:
        role = "assistant" if msg.sender.lower() == "bot" else "user"
        messages.append({"role": role, "content": msg.text})
    messages.append({"role": "user", "content": request.query})

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.3
        )
        return {"response": response.choices[0].message.content}
    except Exception as e:
        logger.error(f"Chatbot RAG Synthesis failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to synthesize answer.")
