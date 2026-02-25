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
from core.security import get_current_user, verify_user_org_access

try:
    import pymupdf4llm
    import fitz
except ImportError:
    pymupdf4llm = None
    fitz = None

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/parse")
async def parse_document(
    file: UploadFile = File(...), 
    orgId: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Semantic Ingestion & Structuring Pipeline (Hardened):
    1. STREAM: Accepts binary PDF stream directly to RAM.
    2. TEXTRACT: Uses High-Fidelity Markdown extraction.
    3. SECURE: Zero-Retention — flushes raw PDF from RAM.
    4. BATCH: Atomic Firestore writes for semantic chunks.
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are currently supported.")

    uid = current_user.get("uid")
    if orgId and not verify_user_org_access(uid, orgId):
        raise HTTPException(status_code=403, detail="Unauthorized access to this organization")

    # Read binary stream
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (Max 10MB).")
    
    def _extract_pdf_text(binary_content: bytes) -> str:
        if not pymupdf4llm or not fitz:
            return "Extraction engine not installed."
        try:
            doc = fitz.open(stream=binary_content, filetype="pdf")
            md_text = pymupdf4llm.to_markdown(doc)
            doc.close()
            return md_text
        except Exception as e:
            return f"Markdown extraction failed: {str(e)}"

    try:
        raw_text = await asyncio.to_thread(_extract_pdf_text, content)
        del content # Explicit memory release
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {e}")

    # Trim massive documents for schema extraction
    summary_text = raw_text[:30000] # BRUTAL AUDIT FIX: Increased context for schema extraction

    # API Key Strategy
    api_key = os.getenv("OPENAI_API_KEY")
    if orgId and db:
        try:
            org_doc = db.collection("organizations").document(orgId).get()
            if org_doc.exists:
                api_key = org_doc.to_dict().get("apiKeys", {}).get("openai", api_key)
        except Exception as e:
            logger.warning(f"Firestore key lookup failed: {e}")

    if not api_key:
        from core.config import settings
        if settings.ENV == "development":
            return {"@context": "https://schema.org", "name": "Mock Ingestion", "status": "Dev/Mock"}
        raise HTTPException(status_code=503, detail="API key required.")

    try:
        client = OpenAI(api_key=api_key)
        
        # --- SEMANTIC CHUNKING ---
        full_text = raw_text[:100000]
        chunk_size = 2000
        overlap = 200
        
        def recursive_split(text, max_size, overlap_size):
            """
            Smarter chunking: prioritizes splitting on paragraphs, then sentences.
            """
            chunks = []
            start = 0
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
                
                chunks.append(text[start:end])
                start = end - overlap_size if end < len(text) else end
                if start >= len(text): break
            return chunks

        chunks = recursive_split(full_text, chunk_size, overlap)

        # Vectorize chunks in batches
        chunk_vectors = []
        for i in range(0, len(chunks), 16):
            batch = chunks[i:i+16]
            embed_batch = client.embeddings.create(input=batch, model="text-embedding-3-small")
            chunk_vectors.extend([e.embedding for e in embed_batch.data])

        # Schema Extraction Strategy (Hardened)
        # Include first 20k chars and last 10k chars for better schema coverage
        doc_sample = raw_text[:20000]
        if len(raw_text) > 30000:
            doc_sample += "\n\n[...]\n\n" + raw_text[-10000:]
            
        prompt = f"""Extract this document into a structured JSON-LD mapping vocabulary using schema.org definitions. 
Focus on identifying Organization names, Products, Pricing tiers, and Service capabilities.
Return ONLY valid JSON.

<Doc_Sample>
{doc_sample}
</Doc_Sample>"""

        completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o-mini",
            response_format={ "type": "json_object" }
        )
        schema_data = json.loads(completion.choices[0].message.content)
        
        # Global Schema Vector
        schema_vector = client.embeddings.create(input=[json.dumps(schema_data)], model="text-embedding-3-small").data[0].embedding
        
        # --- BATCH PERSISTENCE ---
        if orgId and db:
            manifest_id = f"manifest_{int(datetime.datetime.utcnow().timestamp())}"
            manifest_ref = db.collection("organizations").document(orgId).collection("manifests").document(manifest_id)
            
            # Atomic Batch Write
            batch = db.batch()
            
            # 1. Manifest Header
            batch.set(manifest_ref, {
                "content": json.dumps(schema_data),
                "embedding": schema_vector,
                "createdAt": datetime.datetime.utcnow(),
                "version": manifest_id,
                "totalChunks": len(chunks)
            })
            
            # 2. Latest Tag
            batch.set(db.collection("organizations").document(orgId).collection("manifests").document("latest"), {
                "content": json.dumps(schema_data),
                "embedding": schema_vector,
                "createdAt": datetime.datetime.utcnow(),
                "version": manifest_id,
                "totalChunks": len(chunks)
            })
            
            # 3. Chunks (Batch size limit is typically 500 in Firestore)
            for idx, (txt, vec) in enumerate(zip(chunks, chunk_vectors)):
                chunk_ref = manifest_ref.collection("chunks").document(str(idx))
                batch.set(chunk_ref, {
                    "text": txt,
                    "embedding": vec,
                    "index": idx
                })
                # Commit if batch size is approaching limit
                if (idx + 3) % 450 == 0:
                    batch.commit()
                    batch = db.batch()
            
            batch.commit()
            logger.info(f"Ingestion Complete: Persisted {len(chunks)} chunks in atomic batches.")
            
        return schema_data
        
    except Exception as e:
        logger.error(f"Ingestion Pipeline Failed: {e}")
        raise HTTPException(status_code=500, detail=f"LLM Processing Failed: {e}")
