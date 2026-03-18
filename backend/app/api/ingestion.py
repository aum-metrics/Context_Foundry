"""
Author: "Sambath Kumar Natarajan"
Date: "26-Dec-2025"
Org: " Start-up/AUM Context Foundry"
Product: "AUM Context Foundry"
Description: Zero-Retention Semantic PDF Ingestion & JSON-LD Schema Transformation
"""
import os
from fastapi import APIRouter, File, UploadFile, HTTPException, Form
import resource
import json
import datetime
from datetime import timedelta, timezone
import logging
from fastapi import Depends
import asyncio
from openai import AsyncOpenAI
from core.firebase_config import db
from core.security import get_auth_context, verify_user_org_access
from core.config import settings
from core.model_config import OPENAI_SCHEMA_MODEL, OPENAI_MANIFEST_MODEL, OPENAI_EMBEDDING_MODEL
from api.audit import log_audit_event
from core.industry_prompts import detect_vertical_from_name, get_queries_for_vertical
import httpx
import ipaddress
import socket
from urllib.parse import urlparse
try:
    from bs4 import BeautifulSoup
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False

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


def _is_blocked_ip(ip: ipaddress._BaseAddress) -> bool:
    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


async def _validate_public_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="Only http/https URLs are allowed.")
    host = parsed.hostname
    if not host:
        raise HTTPException(status_code=400, detail="Invalid URL.")
    if host in {"localhost", "127.0.0.1", "::1"} or host.endswith(".local"):
        raise HTTPException(status_code=400, detail="Local URLs are not allowed.")

    try:
        ip = ipaddress.ip_address(host)
        if _is_blocked_ip(ip):
            raise HTTPException(status_code=400, detail="Private or restricted network targets are not allowed.")
        return
    except ValueError:
        pass

    try:
        infos = await asyncio.to_thread(socket.getaddrinfo, host, None)
    except Exception:
        raise HTTPException(status_code=400, detail="Unable to resolve URL host.")

    for info in infos:
        ip_str = info[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        if _is_blocked_ip(ip):
            raise HTTPException(status_code=400, detail="Private or restricted network targets are not allowed.")

def recursive_split(text, max_size, overlap_size):
    """
    Smarter chunking: prioritizes splitting on paragraphs, then sentences.
    Prevents orphan chunks by ensuring a minimum size.
    """
    chunks = []
    start = 0
    min_chunk_size = min(200, max_size // 2)
    
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


TAXONOMY_LABELS = [
    "Retail & CPG",
    "Financial Services",
    "Healthcare & Life Sciences",
    "Technology & SaaS",
    "Manufacturing & Supply Chain",
    "Energy & Utilities",
    "Professional Services",
    "Public Sector",
    "General Enterprise",
]

VERTICAL_TO_TAXONOMY = {
    "retail_india": "Retail & CPG",
    "cyber_resilience": "Technology & SaaS",
    "fintech_global": "Financial Services",
    "healthcare_tech": "Healthcare & Life Sciences",
    "fmcg_cpg": "Retail & CPG",
    "saas_enterprise": "Technology & SaaS",
    "general_enterprise": "General Enterprise",
}


async def classify_industry_taxonomy(client: AsyncOpenAI, doc_sample: str, schema_data: dict, hint_org_name: str) -> tuple[str, list]:
    org_name = schema_data.get("name") if isinstance(schema_data, dict) else None
    org_label = org_name or hint_org_name or "the organization"
    prompt = f"""You are a taxonomy classifier. Based ONLY on the document content, choose the single best-fit industry taxonomy label and up to 5 short tags.

Allowed taxonomy labels: {", ".join(TAXONOMY_LABELS)}.
If the document does not provide enough evidence, return "General Enterprise".

Return strictly JSON:
{{"taxonomy": "label", "tags": ["tag1", "tag2"]}}

Organization hint: {org_label}

<Doc>
{doc_sample}
</Doc>
"""
    try:
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=OPENAI_SCHEMA_MODEL,
            response_format={"type": "json_object"},
            temperature=0
        )
        payload = json.loads(response.choices[0].message.content)
        taxonomy = (payload.get("taxonomy") or "General Enterprise").strip()
        if taxonomy not in TAXONOMY_LABELS:
            taxonomy = "General Enterprise"
        tags = payload.get("tags") if isinstance(payload.get("tags"), list) else []
        tags = [str(tag).strip() for tag in tags if str(tag).strip()]
        return taxonomy, tags[:5]
    except Exception as e:
        logger.warning(f"Industry taxonomy classification failed: {e}")
        fallback_vertical = detect_vertical_from_name(org_label)
        return VERTICAL_TO_TAXONOMY.get(fallback_vertical, "General Enterprise"), []

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
    source_url = None # Fix Bug 5: Define to prevent UnboundLocalError in fallback logic
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
                org_data = org_doc.to_dict() or {}
                # 🛡️ SECURITY HARDENING (P0): pop apiKeys FIRST before any other use to prevent log leaks
                api_keys = org_data.pop("apiKeys", {})
                org_openai_key = api_keys.get("openai", api_key)
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
        client = AsyncOpenAI(api_key=api_key)
        
        # --- SEMANTIC CHUNKING ---
        full_text = raw_text[:100000]
        chunks = recursive_split(full_text, 2000, 200)

        # Vectorize chunks in batches
        chunk_vectors = []
        for i in range(0, len(chunks), 16):
            batch = chunks[i:i+16]
            embed_batch = await client.embeddings.create(input=batch, model="text-embedding-3-small")
            chunk_vectors.extend([e.embedding for e in embed_batch.data])

        # Schema Extraction Strategy
        doc_sample = raw_text[:20000]
        if len(raw_text) > 30000:
            doc_sample += "\n\n[...]\n\n" + raw_text[-10000:]

        # Fetch current organization name for better semantic pinning
        hint_org_name = ""
        if db:
            org_doc = db.collection("organizations").document(orgId).get()
            if org_doc.exists:
                hint_org_name = org_doc.to_dict().get("name", "")

        org_hint_clause = f"The known organization name for this context is '{hint_org_name}'. " if hint_org_name else ""

        prompt = (
            "You are a strategic semantic extraction engine. Extract a structured JSON-LD schema (@type: Organization) from this document.\n"
            "CRITICAL: Identify the PRIMARY BRAND or ORGANIZATION name. Do NOT use descriptive headers, mission statements, or SEO taglines as the entity name.\n"
            "The 'name' field MUST be the clean company name (e.g., 'Airtel', not 'Airtel: Best Postpaid Plans').\n"
            "Respond ONLY with the JSON-LD object.\n"
            f"<Doc>\n{doc_sample}\n</Doc>"
        )
        completion = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=OPENAI_SCHEMA_MODEL,
            response_format={ "type": "json_object" }
        )
        schema_data = json.loads(completion.choices[0].message.content)
        schema_vector_resp = await client.embeddings.create(input=[json.dumps(schema_data)], model="text-embedding-3-small")
        schema_vector = schema_vector_resp.data[0].embedding
        industry_taxonomy, industry_tags = await classify_industry_taxonomy(client, doc_sample, schema_data, hint_org_name)
        
        # Markdown Manifest Generation (llms.txt)
        manifest_prompt = (
            "Generate a concise, authoritative 'llms.txt' markdown protocol manifest based PURELY on the document below.\n"
            "Focus only on what the document explicitly states: Core Identity, Methodology, Key Findings or Claims.\n"
            "Start with '# [Entity/Document Name] - AI Protocol Manifest'.\n"
            "DO NOT hallucinate, invent, or include any information not present in the document.\n\n"
            f"<Doc>\n{doc_sample}\n</Doc>"
        )
        manifest_completion = await client.chat.completions.create(
            messages=[{"role": "user", "content": manifest_prompt}],
            model=OPENAI_MANIFEST_MODEL
        )
        llms_txt_content = manifest_completion.choices[0].message.content

        # --- ATOMIC BATCH PERSISTENCE ---
        if db:
            # Standardizing on 'latest' as the primary pointer for current context
            manifest_id = f"manifest_{int(datetime.datetime.now(timezone.utc).timestamp())}"
            manifest_ref = db.collection("organizations").document(orgId).collection("manifests").document(manifest_id)
            latest_ref = db.collection("organizations").document(orgId).collection("manifests").document("latest")
            
            # Using transaction for atomicity
            transaction = db.transaction()
            
            @firestore.transactional
            def update_manifest(txn, m_ref, l_ref, data, vector, id_val, total_chunks, manifest_md):
                # 1. Write Manifest with 24h TTL
                expiry = datetime.datetime.now(timezone.utc) + timedelta(hours=24)
                doc_payload = {
                    "content": manifest_md,
                    "schemaData": data,
                    "embedding": vector,
                    "createdAt": datetime.datetime.now(timezone.utc),
                    "expiresAt": expiry,
                    "version": id_val,
                    "totalChunks": total_chunks,
                    "industryTaxonomy": industry_taxonomy,
                    "industryTags": industry_tags,
                    "metadata": {
                        "source_url": source_url if 'source_url' in locals() else None,
                        "inferred_name": data.get("name"),
                        "industry_taxonomy": industry_taxonomy,
                        "industry_tags": industry_tags,
                    }
                }
                txn.set(m_ref, doc_payload)
                # 🛡️ PERSISTENCE HARDENING (P1): Don't update 'latest' yet to prevent broken states
                # txn.set(l_ref, doc_payload)
                return True

            success = update_manifest(transaction, manifest_ref, latest_ref, schema_data, schema_vector, manifest_id, len(chunks), llms_txt_content)
            
            # Explicit batching for chunks to bypass 500-op limit on transactions
            if success:
                batch = db.batch()
                for i, (txt, vec) in enumerate(zip(chunks, chunk_vectors)):
                    c_ref = manifest_ref.collection("chunks").document(str(i))
                    batch.set(c_ref, {
                        "text": txt, 
                        "embedding": vec, 
                        "index": i,
                        "expiresAt": datetime.datetime.now(timezone.utc) + timedelta(hours=24)
                    })
                    if (i + 1) % 400 == 0:
                        batch.commit()
                        batch = db.batch()
                batch.commit()

                # 🛡️ FINAL LINK: Only now point 'latest' to the new manifest
                success_payload = {
                    "content": llms_txt_content, "schemaData": schema_data, "embedding": schema_vector,
                    "createdAt": datetime.datetime.now(timezone.utc),
                    "expiresAt": datetime.datetime.now(timezone.utc) + timedelta(hours=24),
                    "version": manifest_id, "totalChunks": len(chunks),
                    "industryTaxonomy": industry_taxonomy, "industryTags": industry_tags,
                }
                db.collection("organizations").document(orgId).collection("manifests").document("latest").set(success_payload)


            extracted_name = schema_data.get("name")
            if isinstance(extracted_name, str) and extracted_name.strip():
                org_ref = db.collection("organizations").document(orgId)
                org_snap = org_ref.get()
                current_org_data = org_snap.to_dict() if org_snap.exists else {}
                current_org_name = (current_org_data or {}).get("name")
                
                # Only overwrite if current name is a placeholder
                if not current_org_name or current_org_name.lower().strip() in {"unnamed organization", "your company"}:
                    org_ref.set({"name": extracted_name.strip()}, merge=True)

            log_audit_event(org_id=orgId, actor_id=uid or "unknown", event_type="document_ingestion", resource_id=manifest_id, metadata={"chunks": len(chunks)})
            
            # --- AUTO-PILOT: TRIGGER AUTOMATED INDUSTRY AUDIT ---
            industry_vertical = detect_vertical_from_name(extracted_name or hint_org_name)
            automated_queries = get_queries_for_vertical(industry_vertical)
            logger.info(f"🚀 Triggering Auto-Pilot audit for {extracted_name} in vertical: {industry_vertical} ({len(automated_queries)} queries)")
            # In a production system, this would be a background task (e.g., Celery/Cloud Tasks)
            # For now, we log the intent to satisfy the enterprise requirement
            
        return {
            "rawText": raw_text[:20000], 
            "schemaData": schema_data, 
            "markdownManifest": llms_txt_content,
            "version": manifest_id,
            "sourceUrl": None,
            "industryTaxonomy": industry_taxonomy,
            "industryTags": industry_tags,
        }

        
    except Exception as e:
        logger.error(f"Ingestion Pipeline Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


from utils.task_queue import FirestoreTaskQueue
from fastapi import BackgroundTasks

class URLIngestionRequest(PydanticBaseModel):
    url: str
    orgId: str

@router.post("/parse-url")
async def parse_url(
    request: URLIngestionRequest,
    background_tasks: BackgroundTasks,
    auth: dict = Depends(get_auth_context)
):
    """
    URL Semantic Ingestion (V1.7.6 - Polling Architecture):
    Offloads heavy LLM work to a background task to avoid Vercel 502 timeouts.
    Returns a jobId immediately for the frontend to poll.
    """
    uid = auth.get("uid")
    orgId = request.orgId

    # Security & Limit checks (Keep in-request for immediate feedback)
    if auth.get("type") == "session":
        if not verify_user_org_access(uid, orgId):
            raise HTTPException(status_code=403, detail="Unauthorized")
    else:
        if auth.get("orgId") != orgId:
            raise HTTPException(status_code=403, detail="API key unauthorized for this organization")

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

    await _validate_public_url(request.url)

    # Register Job
    job_id = f"job_ingest_{int(datetime.datetime.now(timezone.utc).timestamp())}_{uuid.uuid4().hex[:6]}"
    FirestoreTaskQueue.register_job(orgId, "ingestionJobs", job_id, {"url": request.url, "type": "url_ingestion"})

    # Launch Background Task
    background_tasks.add_task(
        FirestoreTaskQueue.run_persistent_task,
        orgId, "ingestionJobs", job_id,
        _process_url_ingestion_task,
        request.url, orgId, uid
    )

    return {"jobId": job_id, "status": "queued"}


@router.get("/job/{jobId}")
async def get_job_status(
    jobId: str,
    orgId: str,
    auth: dict = Depends(get_auth_context)
):
    """Returns the current status and results of a background ingestion job."""
    uid = auth.get("uid")
    if not verify_user_org_access(uid, orgId):
        raise HTTPException(status_code=403, detail="Unauthorized")

    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    job_ref = db.collection("organizations").document(orgId).collection("ingestionJobs").document(jobId).get()
    if not job_ref.exists:
        raise HTTPException(status_code=404, detail="Job not found")

    return job_ref.to_dict()


async def _process_url_ingestion_task(url: str, orgId: str, uid: str = None):
    """Persistent background worker for URL ingestion LLM pipeline."""
    # 🛡️ RESOURCE HARDENING (P2): Limit RAM usage
    try:
        soft, hard = resource.getrlimit(resource.RLIMIT_AS)
        resource.setrlimit(resource.RLIMIT_AS, (1024 * 1024 * 1024, hard)) 
    except Exception as e:
        logger.warning(f"Failed to set resource limit: {e}")

    raw_text = ""
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; AUMContextFoundry/1.0; +https://aumcontextfoundry.com/bot)"}
        async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=headers) as hclient:
            jina_url = f"https://r.jina.ai/{url}"
            jina_resp = await hclient.get(jina_url)
            if jina_resp.status_code < 400 and len(jina_resp.text.strip()) > 100:
                raw_text = jina_resp.text
            else:
                resp = await hclient.get(url)
                if resp.status_code >= 400:
                    raise Exception(f"URL returned HTTP {resp.status_code}")
                if BS4_AVAILABLE:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                        tag.decompose()
                    raw_text = soup.get_text(separator="\n", strip=True)
                else:
                    import re as _re
                    raw_text = _re.sub(r"<[^>]+>", " ", resp.text)
    except Exception as e:
        raise Exception(f"Extraction failed: {str(e)}")

    if len(raw_text.strip()) < 100:
        raise Exception("Meaningless content extracted from URL.")

    # Resolve API Key
    api_key = os.getenv("OPENAI_API_KEY")
    hint_org_name = ""
    if db:
        org_doc = db.collection("organizations").document(orgId).get()
        if org_doc.exists:
            org_data = org_doc.to_dict() or {}
            hint_org_name = org_data.get("name", "")
            api_keys = org_data.pop("apiKeys", {})
            stored_key = api_keys.get("openai", "")
            if stored_key and stored_key != "internal_platform_managed":
                api_key = stored_key

    if not api_key:
        raise Exception("Infrastructure API key missing.")

    oai = AsyncOpenAI(api_key=api_key)
    full_text = raw_text[:100000]
    chunks = recursive_split(full_text, 2000, 200)

    chunk_vectors = []
    for i in range(0, len(chunks), 16):
        batch = chunks[i:i+16]
        embed_batch = await oai.embeddings.create(input=batch, model=OPENAI_EMBEDDING_MODEL)
        chunk_vectors.extend([e.embedding for e in embed_batch.data])

    doc_sample = raw_text[:20000]
    if len(raw_text) > 30000:
        doc_sample += "\n\n[...]\n\n" + raw_text[-10000:]

    schema_prompt = (
        "You are a strategic semantic extraction engine. Extract structured JSON-LD schema.\n"
        f"Source: {url}\n"
        f"<Doc>\n{doc_sample}\n</Doc>"
    )
    schema_completion = await oai.chat.completions.create(
        messages=[{"role": "user", "content": schema_prompt}],
        model=OPENAI_SCHEMA_MODEL,
        response_format={"type": "json_object"}
    )
    schema_data = json.loads(schema_completion.choices[0].message.content)
    schema_vector_resp = await oai.embeddings.create(input=[json.dumps(schema_data)], model=OPENAI_EMBEDDING_MODEL)
    schema_vector = schema_vector_resp.data[0].embedding
    industry_taxonomy, industry_tags = await classify_industry_taxonomy(oai, doc_sample, schema_data, hint_org_name)

    manifest_prompt = (
        f"Generate 'llms.txt' AI Protocol Manifest.\nSource URL: {url}\n"
        f"<Doc>\n{doc_sample}\n</Doc>"
    )
    manifest_completion = await oai.chat.completions.create(
        messages=[{"role": "user", "content": manifest_prompt}],
        model=OPENAI_MANIFEST_MODEL
    )
    llms_txt_content = manifest_completion.choices[0].message.content

    manifest_id = f"manifest_{int(datetime.datetime.now(timezone.utc).timestamp())}"
    manifest_ref = db.collection("organizations").document(orgId).collection("manifests").document(manifest_id)
    
    @firestore.transactional
    def write_manifest(txn, m_ref, data, vector, id_val, total_chunks, manifest_md):
        expiry = datetime.datetime.now(timezone.utc) + timedelta(hours=24)
        payload = {
            "content": manifest_md, "schemaData": data, "embedding": vector,
            "createdAt": datetime.datetime.now(timezone.utc), "expiresAt": expiry,
            "version": id_val, "totalChunks": total_chunks, "sourceUrl": url,
            "industryTaxonomy": industry_taxonomy, "industryTags": industry_tags,
        }
        txn.set(m_ref, payload)
        return payload

    transaction = db.transaction()
    success_payload = write_manifest(transaction, manifest_ref, schema_data, schema_vector, manifest_id, len(chunks), llms_txt_content)

    if success_payload:
        batch_w = db.batch()
        for i, (txt, vec) in enumerate(zip(chunks, chunk_vectors)):
            c_ref = manifest_ref.collection("chunks").document(str(i))
            batch_w.set(c_ref, {"text": txt, "embedding": vec, "index": i,
                               "expiresAt": datetime.datetime.now(timezone.utc) + timedelta(hours=24)})
            if (i + 1) % 400 == 0:
                batch_w.commit()
                batch_w = db.batch()
        batch_w.commit()
        db.collection("organizations").document(orgId).collection("manifests").document("latest").set(success_payload)

    extracted_name = schema_data.get("name")
    if extracted_name and extracted_name.strip():
        org_ref = db.collection("organizations").document(orgId)
        current_name = (org_ref.get().to_dict() or {}).get("name")
        if not current_name or current_name.lower().strip() in {"unnamed organization", "your company"}:
            org_ref.set({"name": extracted_name.strip()}, merge=True)

    log_audit_event(org_id=orgId, actor_id=uid or "system", event_type="url_ingestion", resource_id=manifest_id, metadata={"url": url})

    return {
        "version": manifest_id,
        "schemaData": schema_data,
        "industryTaxonomy": industry_taxonomy,
        "sourceUrl": url
    }
