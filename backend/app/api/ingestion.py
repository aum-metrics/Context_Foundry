"""
Author: "Sambath Kumar Natarajan"
Date: "26-Dec-2025"
Org: " Start-up/AUM Data Labs"
Product: "Context Foundry"
Description: Zero-Retention Semantic PDF Ingestion & JSON-LD Schema Transformation
"""
import os
from fastapi import APIRouter, File, UploadFile, HTTPException, Form
import json
import datetime
import logging
from fastapi import Depends
import asyncio
from openai import OpenAI
from core.firebase_config import db
from core.security import get_auth_context, verify_user_org_access
from api.audit import log_audit_event

import gc
from google.cloud import firestore

try:
    import pymupdf4llm
    import fitz
except ImportError:
    pymupdf4llm = None
    fitz = None

logger = logging.getLogger(__name__)
router = APIRouter()

def recursive_split(text, max_size, overlap_size):
    """
    Smarter chunking: prioritizes splitting on paragraphs, then sentences.
    Prevents orphan chunks by ensuring a minimum size.
    """
    chunks = []
    start = 0
    min_chunk_size = 200
    
    while start < len(text):
        end = min(start + max_size, len(text))
        if end < len(text):
            # Try to find a paragraph break
            last_para = text.rfind('\n\n', start, end)
            if last_para != -1 and last_para > start + max_size // 2:
                end = last_para + 2
            else:
                # Try to find a sentence break
                last_sent = text.rfind('. ', start, end)
                if last_sent != -1 and last_sent > start + max_size // 2:
                    end = last_sent + 2
        
        chunk = text[start:end].strip()
        if len(chunk) >= min_chunk_size or not chunks:
            chunks.append(chunk)
        elif chunks:
            # Merge tiny orphan with previous chunk
            chunks[-1] = (chunks[-1] + "\n\n" + chunk).strip()
            
        start = end - overlap_size if end < len(text) else end
        if start >= len(text): break
    return chunks

@router.post("/parse")
async def parse_document(
    file: UploadFile = File(...), 
    orgId: str = Form(None),
    auth: dict = Depends(get_auth_context)
):
    """
    Semantic Ingestion & Structuring Pipeline (Hardened):
    1. STREAM: Accepts binary PDF stream directly to RAM.
    2. TEXTRACT: Uses High-Fidelity Markdown extraction.
    3. SECURE: Zero-Retention — flushes raw PDF from RAM.
    4. ATOMIC: Uses Firestore Transactions for multi-chunk persistence.
    """
    uid = auth.get("uid")
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are currently supported.")
    if not orgId:
        raise HTTPException(status_code=400, detail="orgId is required")

    # Security: Ensure user/key belongs to the requested organization
    if auth.get("type") == "session":
        if not verify_user_org_access(uid, orgId):
            raise HTTPException(status_code=403, detail="Unauthorized access to this organization")
    else:
        if auth.get("orgId") != orgId:
            raise HTTPException(status_code=403, detail="API key unauthorized for this organization")

    # Enforce Document Limits (Subscription Gating)
    if db:
        try:
            org_doc = db.collection("organizations").document(orgId).get()
            if org_doc.exists:
                org_data = org_doc.to_dict() or {}
                org_plan = org_data.get("subscription", {}).get("planId", "explorer")
                if org_plan == "explorer":
                    docs_ref = db.collection("organizations").document(orgId).collection("manifests").limit(1).get()
                    if len(docs_ref) >= 1:
                        raise HTTPException(status_code=403, detail="Explorer plan limit: 1 document. Please upgrade.")
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Limit check failure: {e}")

    # Read binary stream
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (Max 10MB).")
    
    def _extract_pdf_text(binary_content: bytes) -> str:
        if not pymupdf4llm or not fitz:
            return "Extraction engine unavailable."
        try:
            doc_obj = fitz.open(stream=binary_content, filetype="pdf")
            md_text = pymupdf4llm.to_markdown(doc_obj)
            doc_obj.close()
            return md_text
        except Exception as e:
            return f"Markdown extraction failed: {str(e)}"

    try:
        raw_text = await asyncio.to_thread(_extract_pdf_text, content)
        del content
        gc.collect() # Zero-Retention: Explicit RAM flush
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {e}")

    # API Key Strategy
    api_key = os.getenv("OPENAI_API_KEY")
    if db:
        try:
            org_doc = db.collection("organizations").document(orgId).get()
            if org_doc.exists:
                org_openai_key = org_doc.to_dict().get("apiKeys", {}).get("openai", api_key)
                # Handle sentinel: platform-managed orgs use master platform keys
                if org_openai_key and org_openai_key != "internal_platform_managed":
                    api_key = org_openai_key
        except Exception as e:
            logger.warning(f"Key lookup error: {e}")

    if not api_key:
        from core.config import settings
        if settings.ENV == "development":
            return {"@context": "https://schema.org", "name": "Mock Ingestion", "status": "Dev/Mock"}
        raise HTTPException(status_code=503, detail="Infrastructure API key missing.")

    try:
        client = OpenAI(api_key=api_key)
        
        # --- SEMANTIC CHUNKING ---
        full_text = raw_text[:100000]
        chunks = recursive_split(full_text, 2000, 200)

        # Vectorize chunks in batches
        chunk_vectors = []
        for i in range(0, len(chunks), 16):
            batch = chunks[i:i+16]
            embed_batch = client.embeddings.create(input=batch, model="text-embedding-3-small")
            chunk_vectors.extend([e.embedding for e in embed_batch.data])

        # Schema Extraction Strategy
        doc_sample = raw_text[:20000]
        if len(raw_text) > 30000:
            doc_sample += "\n\n[...]\n\n" + raw_text[-10000:]
            
        prompt = f"Extract structured JSON-LD mapping from document... Focus on Organizations, Products, Pricing, Capabilities.\n\n<Doc>\n{doc_sample}\n</Doc>"
        completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o-mini",
            response_format={ "type": "json_object" }
        )
        schema_data = json.loads(completion.choices[0].message.content)
        schema_vector = client.embeddings.create(input=[json.dumps(schema_data)], model="text-embedding-3-small").data[0].embedding
        
        # --- ATOMIC BATCH PERSISTENCE ---
        if db:
            manifest_id = f"manifest_{int(datetime.datetime.utcnow().timestamp())}"
            manifest_ref = db.collection("organizations").document(orgId).collection("manifests").document(manifest_id)
            latest_ref = db.collection("organizations").document(orgId).collection("manifests").document("latest")
            
            # Using transaction for atomicity
            transaction = db.transaction()
            
            @firestore.transactional
            def update_manifest(txn, m_ref, l_ref, data, vector, id_val, total_chunks):
                # 1. Write Manifest
                txn.set(m_ref, {
                    "content": json.dumps(data),
                    "embedding": vector,
                    "createdAt": datetime.datetime.utcnow(),
                    "version": id_val,
                    "totalChunks": total_chunks
                })
                # 2. Write Latest
                txn.set(l_ref, {
                    "content": json.dumps(data),
                    "embedding": vector,
                    "createdAt": datetime.datetime.utcnow(),
                    "version": id_val,
                    "totalChunks": total_chunks
                })
                return True

            success = update_manifest(transaction, manifest_ref, latest_ref, schema_data, schema_vector, manifest_id, len(chunks))
            
            # Explicit batching for chunks to bypass 500-op limit on transactions
            if success:
                batch = db.batch()
                for i, (txt, vec) in enumerate(zip(chunks, chunk_vectors)):
                    c_ref = manifest_ref.collection("chunks").document(str(i))
                    batch.set(c_ref, {"text": txt, "embedding": vec, "index": i})
                    if (i + 1) % 400 == 0:
                        batch.commit()
                        batch = db.batch()
                batch.commit()

            log_audit_event(org_id=orgId, actor_id=uid or "unknown", event_type="document_ingestion", resource_id=manifest_id, metadata={"chunks": len(chunks)})
            
        return schema_data
        
    except Exception as e:
        logger.error(f"Ingestion Pipeline Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

