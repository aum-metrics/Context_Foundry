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
import hashlib
from fastapi import Depends, BackgroundTasks
from datetime import datetime, timedelta

from core.security import get_current_user, verify_user_org_access
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
    logger.warning("anthropic not installed, Claude 3.5 Haiku will be skipped")

from tenacity import retry, stop_after_attempt, wait_exponential

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


def compute_divergence(api_key: str, manifest_embedding: list, answer: str) -> float:
    """Embedding-based divergence (0 = identical, 1 = divergent)."""
    try:
        if not manifest_embedding:
            return 0.5
            
        client = OpenAI(api_key=api_key)
        answer_resp = client.embeddings.create(input=[answer], model="text-embedding-3-small")
        sim = cosine_sim(
            np.array(manifest_embedding),
            np.array(answer_resp.data[0].embedding)
        )
        return 1.0 - sim
    except Exception as e:
        logger.error(f"Embedding error: {e}")
        return 0.85


# ============================================================================
# MODEL RUNNERS
# ============================================================================

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), reraise=True)
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

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), reraise=True)
def run_gemini(api_key: str, system_prompt: str, user_prompt: str) -> str:
    if not GEMINI_AVAILABLE:
        raise Exception("google-genai not installed")
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents=[f"{system_prompt}\n\nQuestion: {user_prompt}"]
    )
    return response.text or ""

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), reraise=True)
def run_claude(api_key: str, system_prompt: str, user_prompt: str) -> str:
    if not CLAUDE_AVAILABLE:
        raise Exception("anthropic not installed")
    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=1000,
        temperature=0.2,
        system=system_prompt,
        messages=[
            {"role": "user", "content": user_prompt}
        ]
    )
    return response.content[0].text if response.content else ""


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
    manifest_embedding = None
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
                        manifest_embedding = doc_data.get("embedding", [])
            else:
                version_doc = org_ref.collection("manifests").document(request.manifestVersion).get()
                if version_doc.exists:
                    doc_data = version_doc.to_dict()
                    if doc_data:
                        manifest_content = doc_data.get("content", "")
                        manifest_embedding = doc_data.get("embedding", [])
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Firestore error: {e}")

    if not manifest_content:
        manifest_content = f"Default context for organization {request.orgId}. Contact AUM support to upload your Context Document."

    return manifest_content, manifest_embedding, api_keys


def _score_model(model_name: str, runner_fn, runner_key: str, openai_key: str,
                 system_prompt: str, user_prompt: str, manifest_embedding: list,
                 claims: list, eps_div: float) -> dict:
    """Score a single model's response against the manifest."""
    try:
        answer = runner_fn(runner_key, system_prompt, user_prompt)

        # Embedding-based divergence
        if openai_key:
            divergence = compute_divergence(openai_key, manifest_embedding, answer)
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


async def _store_simulation_results(org_id: str, prompt: str, manifest_version: str, results: list, cache_key: str):
    """Background task to store simulation results in cache and persistent scoring history for billing."""
    if not db:
        return
    try:
        # 1. Update Simulation Cache
        db.collection("organizations").document(org_id).collection("simulationCache").document(cache_key).set({
            "results": results,
            "timestamp": datetime.utcnow(),
            "manifestVersion": manifest_version,
            "prompt": prompt
        })
        
        # 2. Record Billing / Scoring History (Atomic billing ledger)
        history_ref = db.collection("organizations").document(org_id).collection("scoringHistory")
        history_ref.add({
            "prompt": prompt,
            "results": [{
                "model": r["model"],
                "accuracy": r["accuracy"],
                "hasHallucination": r["hasHallucination"],
                "claimScore": r.get("claimScore"),
            } for r in results],
            "timestamp": datetime.utcnow(),
            "version": manifest_version,
        })
        logger.info(f"Background: Simulation results for cache key {cache_key} stored successfully.")
    except Exception as e:
        logger.error(f"Failed to store background simulation data: {e}")


@router.post("/run")
async def evaluate_simulation(
    request: SimulationRequest, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Evaluates a user prompt against the Organization's context manifest using multi-model checks.
    1. Fetches org Context Manifest + API keys from Firestore.
    2. Extracts verifiable claims from the manifest.
    3. Runs prompt across GPT-4, Gemini, Claude.
    4. Scores each response via embedding divergence + per-claim verification.
    5. Returns blended accuracy (40% embedding, 60% fact-checking).
    """
    if not request.prompt or not request.orgId:
        raise HTTPException(status_code=400, detail="Prompt and orgId required")

    uid = current_user.get("uid")
    if not verify_user_org_access(uid, request.orgId):
        raise HTTPException(status_code=403, detail="Unauthorized access to this organization")

    # ----- 0. MD5 HASH CACHE CHECK (Zero-Burn Optimization) -----
    cache_input = f"{request.prompt}_{request.manifestVersion}".encode('utf-8')
    cache_key = hashlib.md5(cache_input).hexdigest()
    
    if db:
        try:
            cached_doc = db.collection("organizations").document(request.orgId).collection("simulationCache").document(cache_key).get()
            if cached_doc.exists:
                cached_data = cached_doc.to_dict() or {}
                # Return if not expired (e.g. 24h)
                timestamp = cached_data.get("timestamp")
                if timestamp and (datetime.utcnow() - timestamp.replace(tzinfo=None)) < timedelta(hours=24):
                    logger.info(f"Cache HIT for simulation {cache_key}. Serving redundant request for $0.00.")
                    return {
                        "results": cached_data.get("results", []),
                        "version": request.manifestVersion,
                        "prompt": request.prompt,
                        "cached": True
                    }
        except Exception as e:
            logger.warning(f"Cache check failed: {e}")

    # ----- 1. FETCH SUBSCRIPTION & ENFORCE LIMITS -----
    org_plan = "growth" # default fallback
    org_data = {}
    if db:
        try:
            org_doc = db.collection("organizations").document(request.orgId).get()
            if org_doc.exists:
                org_data = org_doc.to_dict() or {}
                org_plan = org_data.get("subscription", {}).get("planId", "starter")
        except Exception as e:
            logger.error(f"Failed to fetch org plan: {e}")

    # Count usage (this billing cycle)
    sims_this_cycle = 0
    if db:
        try:
            from datetime import datetime, timedelta
            
            # Default to 1st of month calendar fallback
            period_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            # Try to fetch true prorated cycle start from subscription
            sub_data = org_data.get("subscription", {})
            start_ts = sub_data.get("currentPeriodStart")
            if start_ts:
                # Handle possible Firestore DatetimeWithNanoseconds vs standard Python datetime
                period_start = start_ts
                
            hist_query = db.collection("organizations").document(request.orgId)\
                .collection("scoringHistory")\
                .where("timestamp", ">=", period_start)
            
            count_query = hist_query.count()
            count_result = count_query.get()
            sims_this_cycle = count_result[0][0].value
        except Exception as e:
            logger.error(f"Failed to fetch usage: {e}")

    # Enforce Limits
    if org_plan == "starter" and sims_this_cycle >= 50:
        raise HTTPException(status_code=402, detail="Starter plan limit of 50 simulations per billing cycle reached. Please upgrade.")
    if org_plan == "growth" and sims_this_cycle >= 500:
        raise HTTPException(status_code=402, detail="Growth plan limit of 500 simulations per billing cycle reached. Please upgrade to Enterprise.")

    # ----- 2. FETCH CONTEXT & KEYS -----
    # Fetch global metadata first
    manifest_content, manifest_embedding, api_keys = _fetch_manifest_and_keys(request)

    openai_key = api_keys.get("openai") or os.getenv("OPENAI_API_KEY")
    gemini_key = api_keys.get("gemini") or os.getenv("GEMINI_API_KEY")
    claude_key = api_keys.get("anthropic") or os.getenv("ANTHROPIC_API_KEY")

    # --- PHASE 7: DEEP CONTEXT RETRIEVAL ---
    # Perform semantic search to pull specific context for this simulation prompt
    if openai_key and db:
        try:
            client = OpenAI(api_key=openai_key)
            q_embed = client.embeddings.create(input=[request.prompt], model="text-embedding-3-small").data[0].embedding
            
            # Search chunks in the specified manifest version
            manifest_version = request.manifestVersion
            if manifest_version == "latest":
                # Get the true latest ID
                latest_ref = db.collection("organizations").document(request.orgId).collection("manifests").document("latest").get()
                if latest_ref.exists:
                    manifest_version = latest_ref.to_dict().get("version", "latest")

            chunks_ref = db.collection("organizations").document(request.orgId) \
                           .collection("manifests").document(manifest_version) \
                           .collection("chunks").get()
            
            import numpy as np
            def cosine_sim(v1, v2):
                return float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2)))

            matches = []
            for doc in chunks_ref:
                c_data = doc.to_dict()
                matches.append((cosine_sim(q_embed, c_data["embedding"]), c_data["text"]))
            
            matches.sort(key=lambda x: x[0], reverse=True)
            top_chunks = [m[1] for m in matches[:5]]
            if top_chunks:
                manifest_content = "\n\n---\n\n".join(top_chunks)
                logger.info(f"Simulation Retrieval: Pulled {len(top_chunks)} chunks for semantic context.")
        except Exception as e:
            logger.warning(f"Simulation semantic retrieval failed: {e}")

    # Enforce Model Gating (Starter gets Gemini ONLY)
    if org_plan == "starter":
        openai_key = None
        claude_key = None

    system_prompt = f"""You are a knowledgeable AI assistant. Use the following retrieved Context Document fragments to answer the user's question accurately.
    
<Retrieved Context>
{manifest_content}
</Retrieved Context>"""

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
            system_prompt, request.prompt, manifest_embedding, claims, eps_div
        ))

    # --- Gemini ---
    if gemini_key and GEMINI_AVAILABLE:
        results.append(_score_model(
            "Gemini 2.0 Flash", run_gemini, gemini_key, openai_key or "",
            system_prompt, request.prompt, manifest_embedding, claims, eps_div
        ))

    # --- Claude ---
    if claude_key and CLAUDE_AVAILABLE:
        results.append(_score_model(
            "Claude 3.5 Haiku", run_claude, claude_key, openai_key or "",
            system_prompt, request.prompt, manifest_embedding, claims, eps_div
        ))

    if not results:
        raise HTTPException(status_code=503, detail="No API keys configured. Contact AUM support.")

    # ----- 5. ATOMIC BILLING & CACHE UPDATE (Background) -----
    background_tasks.add_task(
        _store_simulation_results, 
        request.orgId, 
        request.prompt, 
        request.manifestVersion, 
        results, 
        cache_key
    )

    # --- PHASE 7: OPERATIONAL CLEANUP ---
    background_tasks.add_task(_cleanup_expired_cache, request.orgId)

    locked_models = []
    if org_plan == "starter":
        locked_models = ["GPT-4o Mini", "Claude 3.5 Haiku"]

    return {
        "results": results,
        "lockedModels": locked_models,
        "version": request.manifestVersion,
        "prompt": request.prompt,
        "claimsExtracted": len(claims),
        "cached": False
    }
async def _cleanup_expired_cache(org_id: str):
    """Purges simulation cache entries older than 7 days to keep storage lean."""
    if not db:
        return
    try:
        cutoff = datetime.utcnow() - timedelta(days=7)
        expired = db.collection("organizations").document(org_id) \
                    .collection("simulationCache") \
                    .where("timestamp", "<", cutoff) \
                    .limit(20) \
                    .get()
        
        batch = db.batch()
        for doc in expired:
            batch.delete(doc.reference)
        
        if len(expired) > 0:
            batch.commit()
            logger.info(f"Cleanup: Purged {len(expired)} expired cache entries for {org_id}")
    except Exception as e:
        logger.error(f"Cache cleanup failed: {e}")
