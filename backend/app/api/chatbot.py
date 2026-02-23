# backend/app/api/chatbot.py
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import os
import json
from openai import OpenAI
from typing import List, Dict
import numpy as np
import logging

from core.firebase_config import db
from core.security import get_current_user

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
async def chat_with_manifest(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """
    RAG-enabled Support Chatbot Endpoint.
    Uses Semantic Chunk Retrieval to provide Zero-Amnesia support for massive docs.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Firestore not available")

    # 1. Fetch Organization API Key
    org_ref = db.collection("organizations").document(request.orgId).get()
    if not org_ref.exists:
        raise HTTPException(status_code=404, detail="Organization not found")

    org_data = org_ref.to_dict() or {}
    api_keys = org_data.get("apiKeys", {})
    openai_key = api_keys.get("openai") or os.getenv("OPENAI_API_KEY")

    if not openai_key:
        raise HTTPException(status_code=503, detail="OpenAI API key missing")

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
    latest_manifest_ref = db.collection("organizations").document(request.orgId).collection("manifests").document("latest")
    
    if query_vector:
        try:
            # We fetch all chunks and do memory-speed cosine similarity. 
            # (Firestore native vector search is a safer upgrade later, but Top-K in Python is robust for <100 chunks)
            chunks_ref = latest_manifest_ref.collection("chunks").get()
            
            import numpy as np
            def cosine_sim(v1, v2):
                return float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2)))

            chunk_matches = []
            for doc in chunks_ref:
                data = doc.to_dict()
                sim = cosine_sim(query_vector, data["embedding"])
                chunk_matches.append((sim, data["text"]))
            
            # Sort by similarity descending and pick top 5
            chunk_matches.sort(key=lambda x: x[0], reverse=True)
            relevant_chunks = []
            for m in chunk_matches[:5]:
                relevant_chunks.append(m[1])
            context_text = "\n\n---\n\n".join(relevant_chunks)
        except Exception as e:
            logger.warning(f"Semantic search failed, falling back to summary: {e}")

    # Fallback to general content summary if semantic search yielded nothing
    if not context_text:
        latest_doc = latest_manifest_ref.get()
        if latest_doc.exists:
            context_text = latest_doc.to_dict().get("content", "")[:10000]

    if not context_text:
        context_text = "The organization has not uploaded a Context Document yet. Tell the user to navigate to Organization Settings."

    # 4. Construct the RAG prompt
    system_prompt = f"""You are the AUM Context Engine Support Assistant. 
You provide specific, technical support using the retrieved semantic chunks from the user's Context Moat.

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
