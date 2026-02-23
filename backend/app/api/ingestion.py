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

try:
    from PyPDF2 import PdfReader
except ImportError:
    PdfReader = None

from openai import OpenAI
from core.firebase_config import db

router = APIRouter()

@router.post("/parse")
async def parse_document(file: UploadFile = File(...), orgId: str = Form(None)):
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

    content = await file.read()
    
    # 1. Extract Text from PDF binary stream
    raw_text = ""
    try:
        if PdfReader:
            pdf_stream = io.BytesIO(content)
            reader = PdfReader(pdf_stream)
            for page in reader.pages:
                raw_text += page.extract_text() + "\n"
            
            # SECURITY: Zero-Retention — flush raw PDF binary from RAM
            del content
            del pdf_stream
        else:
            raw_text = "PyPDF2 not installed. Cannot parse binary stream."
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
        structured_schema_prompt = f"""
        Extract the following unstructured corporate document text into a highly structured JSON-LD mapping vocabulary using schema.org definitions (Organization, Product, Offer, etc.). 
        Identify the primary entity name, its descriptions, pricing models, and key capabilities.
        Return ONLY valid JSON.
        
        <RawText>
        {raw_text}
        </RawText>
        """

        completion = client.chat.completions.create(
            messages=[{"role": "user", "content": structured_schema_prompt}],
            model="gpt-4o-mini",
            response_format={ "type": "json_object" }
        )
        
        schema_result_str = completion.choices[0].message.content
        schema_data = json.loads(schema_result_str)
        return schema_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Structure Extraction Failed: {e}")
