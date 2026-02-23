"""
Author: "Sambath Kumar Natarajan"
Date: "26-Dec-2025"
Org: " Start-up/AUM Data Labs"
Product: "Context Foundry"
Description: Multi-Model LCRS Simulation Engine with Fine-Grained Fact-Checking
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
import os
import json
import numpy as np
import logging

from openai import OpenAI
from core.firebase_config import db

logger = logging.getLogger(__name__)

# Try importing optional providers
try:
    from google import genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

try:
    import anthropic
    CLAUDE_AVAILABLE = True
except ImportError:
    CLAUDE_AVAILABLE = False

router = APIRouter()

# ============================================================================
# MATH ENGINE
# ============================================================================

def cosine_sim(v1, v2):
    """Cosine similarity between two embedding vectors."""
    dot_product = np.dot(v1, v2)
    norm_v1 = np.linalg.norm(v1)
    norm_v2 = np.linalg.norm(v2)
    if norm_v1 == 0 or norm_v2 == 0:
        return 0.0
    return float(dot_product / (norm_v1 * norm_v2))


def extract_claims(api_key: str, manifest_content: str) -> list:
    """
    Extract verifiable factual claims from the Context Document.
    Returns a list of specific claims that can be individually verified.
    """
    try:
        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            messages=[{
                "role": "system",
                "content": "Extract specific verifiable claims from this document. Return JSON array of strings. Each claim should be a single factual statement (e.g., pricing, features, capabilities). Max 10 claims."
            }, {
                "role": "user",
                "content": manifest_content[:5000]
            }],
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            temperature=0,
        )
        result = json.loads(resp.choices[0].message.content or "{}")
        claims = result.get("claims", result.get("facts", []))
        if isinstance(claims, list):
            return claims[:10]
        return []
    except Exception as e:
        logger.error(f"Claim extraction failed: {e}")
        return []


def verify_claims(api_key: str, claims: list, ai_response: str) -> list:
    """
    Verify each extracted claim against the AI response.
    Returns a list of {claim, verdict, explanation} objects.
    """
    if not claims:
        return []
    try:
        client = OpenAI(api_key=api_key)
        claims_text = "\n".join(f"{i+1}. {c}" for i, c in enumerate(claims))
        resp = client.chat.completions.create(
            messages=[{
                "role": "system",
                "content": """Compare each claim against the AI response. For each claim, determine:
- "supported": The AI response correctly states this fact
- "contradicted": The AI response states something different
- "not_mentioned": The AI response doesn't address this fact

Return JSON: {"results": [{"claim": "...", "verdict": "supported|contradicted|not_mentioned", "detail": "brief explanation"}]}"""
            }, {
                "role": "user",
                "content": f"CLAIMS:\n{claims_text}\n\nAI RESPONSE:\n{ai_response}"
            }],
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            temperature=0,
        )
        result = json.loads(resp.choices[0].message.content or "{}")
        return result.get("results", [])
    except Exception as e:
        logger.error(f"Claim verification failed: {e}")
        return []


def compute_divergence(api_key: str, manifest_content: str, answer: str) -> float:
    """Embedding-based divergence (0 = identical, 1 = divergent)."""
    try:
        client = OpenAI(api_key=api_key)
        manifest_resp = client.embeddings.create(input=[manifest_content[:8000]], model="text-embedding-3-small")
        answer_resp = client.embeddings.create(input=[answer], model="text-embedding-3-small")
        sim = cosine_sim(
            np.array(manifest_resp.data[0].embedding),
            np.array(answer_resp.data[0].embedding)
        )
        return 1.0 - sim
    except Exception as e:
        logger.error(f"Embedding error: {e}")
        return 0.85


# ============================================================================
# MODEL RUNNERS
# ============================================================================

def run_openai(api_key: str, system_prompt: str, user_prompt: str) -> str:
    client = OpenAI(api_key=api_key)
    completion = client.chat.completions.create(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        model="gpt-4o-mini",
        temperature=0.2,
    )
    return completion.choices[0].message.content or ""


def run_gemini(api_key: str, system_prompt: str, user_prompt: str) -> str:
    if not GEMINI_AVAILABLE:
        raise Exception("google-genai not installed")
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents=[f"{system_prompt}\n\nQuestion: {user_prompt}"]
    )
    return response.text or ""


def run_claude(api_key: str, system_prompt: str, user_prompt: str) -> str:
    if not CLAUDE_AVAILABLE:
        raise Exception("anthropic not installed")
    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-3-5-haiku-latest",
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}]
    )
    return message.content[0].text or ""


# ============================================================================
# API MODELS
# ============================================================================

class SimulationRequest(BaseModel):
    prompt: str
    orgId: str
    manifestVersion: Optional[str] = "latest"

class ClaimResult(BaseModel):
    claim: str
    verdict: str  # supported, contradicted, not_mentioned
    detail: Optional[str] = None

class ModelResult(BaseModel):
    model: str
    answer: str
    accuracy: float
    hasHallucination: bool
    claimResults: Optional[List[dict]] = None
    claimScore: Optional[str] = None  # e.g. "7/10 claims supported"
    error: Optional[str] = None


# ============================================================================
# MULTI-MODEL EVALUATION ENDPOINT
# ============================================================================

def _fetch_manifest_and_keys(request: SimulationRequest):
    """Fetch context manifest and API keys from Firestore."""
    manifest_content = ""
    api_keys: Dict[str, str] = {}

    if db:
        try:
            org_ref = db.collection("organizations").document(request.orgId)
            org_doc = org_ref.get()
            if not org_doc.exists:
                raise HTTPException(status_code=404, detail="Organization not found")

            org_data = org_doc.to_dict() or {}
            api_keys = org_data.get("apiKeys", {})

            if request.manifestVersion == "latest":
                manifests = org_ref.collection("manifests").order_by("createdAt", direction="DESCENDING").limit(1).stream()
                latest = next(manifests, None)
                if latest is not None:
                    doc_data = latest.to_dict()
                    if doc_data:
                        manifest_content = doc_data.get("content", "")
            else:
                version_doc = org_ref.collection("manifests").document(request.manifestVersion).get()
                if version_doc.exists:
                    doc_data = version_doc.to_dict()
                    if doc_data:
                        manifest_content = doc_data.get("content", "")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Firestore error: {e}")

    if not manifest_content:
        manifest_content = f"Default context for organization {request.orgId}. Contact AUM support to upload your Context Document."

    return manifest_content, api_keys


def _score_model(model_name: str, runner_fn, runner_key: str, openai_key: str,
                 system_prompt: str, user_prompt: str, manifest_content: str,
                 claims: list, eps_div: float) -> dict:
    """Score a single model's response against the manifest."""
    try:
        answer = runner_fn(runner_key, system_prompt, user_prompt)

        # Embedding-based divergence
        if openai_key:
            divergence = compute_divergence(openai_key, manifest_content, answer)
        else:
            divergence = 0.5

        # Fine-grained claim verification
        claim_results = []
        claim_score = None
        if openai_key and claims:
            claim_results = verify_claims(openai_key, claims, answer)
            supported = sum(1 for c in claim_results if c.get("verdict") == "supported")
            total = len(claim_results)
            claim_score = f"{supported}/{total} claims supported"

            # Blend: 40% embedding, 60% claim accuracy (claims are more trustworthy)
            if total > 0:
                claim_accuracy = supported / total
                blended = (0.4 * (1.0 - divergence)) + (0.6 * claim_accuracy)
                accuracy = round(blended * 100, 1)
                has_hallucination = accuracy < 55 or any(c.get("verdict") == "contradicted" for c in claim_results)
            else:
                accuracy = round((1.0 - divergence) * 100, 1)
                has_hallucination = divergence > eps_div
        else:
            accuracy = round((1.0 - divergence) * 100, 1)
            has_hallucination = divergence > eps_div

        return {
            "model": model_name,
            "answer": answer,
            "accuracy": accuracy,
            "hasHallucination": has_hallucination,
            "claimResults": claim_results,
            "claimScore": claim_score,
        }
    except Exception as e:
        return {
            "model": model_name,
            "answer": "",
            "accuracy": 0,
            "hasHallucination": True,
            "error": str(e),
        }


@router.post("/evaluate")
async def evaluate_simulation(request: SimulationRequest):
    """
    Multi-Model LCRS Simulation with Fine-Grained Fact-Checking:
    1. Fetches org Context Manifest + API keys from Firestore.
    2. Extracts verifiable claims from the manifest.
    3. Runs prompt across GPT-4, Gemini, Claude.
    4. Scores each response via embedding divergence + per-claim verification.
    5. Returns blended accuracy (40% embedding, 60% fact-checking).
    """
    if not request.prompt or not request.orgId:
        raise HTTPException(status_code=400, detail="Prompt and orgId required")

    manifest_content, api_keys = _fetch_manifest_and_keys(request)

    openai_key = api_keys.get("openai") or os.getenv("OPENAI_API_KEY")
    gemini_key = api_keys.get("gemini") or os.getenv("GEMINI_API_KEY")
    claude_key = api_keys.get("anthropic") or os.getenv("ANTHROPIC_API_KEY")

    system_prompt = f"""You are a knowledgeable AI assistant. Use the following Context Document to answer the user's question accurately. Do not invent pricing, features, or constraints not explicitly present in the Context Document.

<Context Document>
{manifest_content}
</Context Document>"""

    eps_div = 0.45

    # Extract verifiable claims from manifest (once, shared across models)
    claims = []
    if openai_key:
        claims = extract_claims(openai_key, manifest_content)

    results = []

    # --- OpenAI ---
    if openai_key:
        results.append(_score_model(
            "GPT-4o Mini", run_openai, openai_key, openai_key,
            system_prompt, request.prompt, manifest_content, claims, eps_div
        ))

    # --- Gemini ---
    if gemini_key and GEMINI_AVAILABLE:
        results.append(_score_model(
            "Gemini 2.0 Flash", run_gemini, gemini_key, openai_key or "",
            system_prompt, request.prompt, manifest_content, claims, eps_div
        ))

    # --- Claude ---
    if claude_key and CLAUDE_AVAILABLE:
        results.append(_score_model(
            "Claude 3.5 Haiku", run_claude, claude_key, openai_key or "",
            system_prompt, request.prompt, manifest_content, claims, eps_div
        ))

    if not results:
        raise HTTPException(status_code=503, detail="No API keys configured. Contact AUM support.")

    # Store results in Firestore for SoM historical tracking
    if db:
        try:
            from datetime import datetime
            history_ref = db.collection("organizations").document(request.orgId).collection("scoringHistory")
            history_ref.add({
                "prompt": request.prompt,
                "results": [{
                    "model": r["model"],
                    "accuracy": r["accuracy"],
                    "hasHallucination": r["hasHallucination"],
                    "claimScore": r.get("claimScore"),
                } for r in results],
                "timestamp": datetime.utcnow(),
                "version": request.manifestVersion,
            })
        except Exception as e:
            logger.warning(f"Failed to store scoring history: {e}")

    return {
        "results": results,
        "version": request.manifestVersion,
        "prompt": request.prompt,
        "claimsExtracted": len(claims),
    }
