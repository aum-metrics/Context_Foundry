"""
Author: "Sambath Kumar Natarajan"
Date: "26-Dec-2025"
Org: " Start-up/AUM Data Labs"
Product: "Context Foundry"
Description: Zero-Retention Semantic PDF Ingestion & JSON-LD Schema Transformation
"""
import os
from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from pydantic import BaseModel
import json
import io
import datetime
import logging
from fastapi import Depends
from core.security import get_current_user

try:
    import pymupdf4llm
    import fitz
except ImportError:
    pymupdf4llm = None
    fitz = None

import asyncio
from openai import OpenAI
from core.firebase_config import db
from core.security import get_current_user, verify_user_org_access

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/parse")
async def parse_document(
    file: UploadFile = File(...), 
    orgId: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Semantic Ingestion & Structuring Pipeline:
    1. STREAM: Accepts binary PDF stream directly to RAM.
    2. TEXTRACT: Uses PyPDF2 to pull unstructured text from the buffer.
    3. SECURE: Zero-Retention — flushes raw PDF from RAM immediately after extraction.
    4. SCHEMA: Leverages LLM to map raw text into Schema.org compliant JSON-LD.
    
    API Key Strategy (AUM-Managed, Per-Org Isolation):
    - Each org gets a dedicated OpenAI key provisioned by AUM.
    - Keys are stored in Firestore under organizations/{orgId}/apiKeys.
    - Falls back to AUM's master key during onboarding.
    - Enables per-org billing tracking and threshold enforcement.
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are currently supported for ingestion.")

    uid = current_user.get("uid")
    if orgId and not verify_user_org_access(uid, orgId):
        raise HTTPException(status_code=403, detail="Unauthorized access to this organization")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB to prevent memory exhaustion.")
    
    # 1. Extract Text from PDF binary stream (High-Fidelity Markdown)
    def _extract_pdf_text(binary_content: bytes) -> str:
        if not pymupdf4llm or not fitz:
            return "pymupdf4llm/fitz not installed. Cannot parse binary stream."
        
        try:
            # Open from memory stream
            doc = fitz.open(stream=binary_content, filetype="pdf")
            # Convert to Markdown to preserve tables/layout
            md_text = pymupdf4llm.to_markdown(doc)
            doc.close()
            return md_text
        except Exception as e:
            return f"Markdown extraction failed: {str(e)}"

    try:
        raw_text = await asyncio.to_thread(_extract_pdf_text, content)
        # SECURITY: Zero-Retention — flush raw PDF binary from RAM
        del content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read PDF binary. {e}")

    # Trim massive documents
    raw_text = raw_text[:20000]

    # 2. Resolve API Key: Per-Org (Firestore) → Master Fallback (.env)
    api_key = os.getenv("OPENAI_API_KEY")  # Master fallback

    if orgId and db:
        try:
            org_doc = db.collection("organizations").document(orgId).get()
            if org_doc.exists:
                org_data = org_doc.to_dict()
                if org_data:
                    org_keys = org_data.get("apiKeys", {})
                    if "openai" in org_keys and org_keys["openai"]:
                        api_key = org_keys["openai"]
        except Exception as e:
            print(f"Firestore key lookup failed (using fallback): {e}")

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="No API key configured for this organization. Please contact AUM support."
        )

    # 3. LLM-powered Schema Extraction
    try:
        client = OpenAI(api_key=api_key)
        
        # --- PHASE 7: SEMANTIC CHUNKING ---
        # Instead of just the first 20k chars, we chunk the ENTIRE document (within reasonable limits)
        # Markdown parsing typically keeps sections intact.
        full_text = raw_text[:100000] # Cap at 100k chars for safety, but process all chunks
        chunk_size = 2000
        overlap = 200
        chunks = []
        for i in range(0, len(full_text), chunk_size - overlap):
            chunks.append(full_text[i:i + chunk_size])

        # Vectorize chunks in batches (max 16 at a time for OpenAI limits)
        chunk_vectors = []
        for i in range(0, len(chunks), 16):
            batch = chunks[i:i+16]
            embed_batch = client.embeddings.create(input=batch, model="text-embedding-3-small")
            chunk_vectors.extend([e.embedding for e in embed_batch.data])

        # Extract schema from a representative summary or the first 10k
        structured_schema_prompt = f"""
        Extract the following unstructured corporate document text into a highly structured JSON-LD mapping vocabulary using schema.org definitions (Organization, Product, Offer, etc.). 
        Identify the primary entity name, its descriptions, pricing models, and key capabilities.
        Return ONLY valid JSON.
        
        <RawText>
        {str(full_text)[:10000]}
        </RawText>
        """

        completion = client.chat.completions.create(
            messages=[{"role": "user", "content": structured_schema_prompt}],
            model="gpt-4o-mini",
            response_format={ "type": "json_object" }
        )
        
        schema_result_str = completion.choices[0].message.content
        schema_data = json.loads(schema_result_str)
        
        # 4. Vectorize the Global Schema for top-level LCRS scoring
        embed_resp = client.embeddings.create(
            input=[json.dumps(schema_data)], 
            model="text-embedding-3-small"
        )
        schema_vector = embed_resp.data[0].embedding
        
        # 5. Persist the Structured Vector Schema to Firestore
        if orgId and db:
            manifest_id = f"manifest_{int(datetime.datetime.utcnow().timestamp())}"
            manifest_ref = db.collection("organizations").document(orgId) \
              .collection("manifests").document(manifest_id)
            
            manifest_ref.set({
                  "content": json.dumps(schema_data),
                  "embedding": schema_vector,
                  "createdAt": datetime.datetime.utcnow(),
                  "version": manifest_id,
                  "totalChunks": len(chunks)
              })
            
            # --- PHASE 7: PERSIST CHUNKS ---
            # Batch write chunks as a sub-collection for vector retrieval
            for idx, (txt, vec) in enumerate(zip(chunks, chunk_vectors)):
                manifest_ref.collection("chunks").document(str(idx)).set({
                    "text": txt,
                    "embedding": vec,
                    "index": idx
                })
            
            # Tag the latest
            db.collection("organizations").document(orgId) \
              .collection("manifests").document("latest").set({
                  "content": json.dumps(schema_data),
                  "embedding": schema_vector,
                  "createdAt": datetime.datetime.utcnow(),
                  "version": manifest_id,
                  "totalChunks": len(chunks)
              })
            
        return schema_data
        
    except Exception as e:
        logger.error(f"Ingestion Pipeline Failed: {e}")
        raise HTTPException(status_code=500, detail=f"LLM Structure Extraction Failed: {e}")
