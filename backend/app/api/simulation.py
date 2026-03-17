"""
Author: "Sambath Kumar Natarajan"
Date: "26-Dec-2025"
Org: " Start-up/AUM Context Foundry"
Product: "AUM Context Foundry"
Description: Multi-Model Visibility Simulation Engine with Fine-Grained Fact-Checking
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
import os
import json
import logging
import numpy as np
import hashlib
import asyncio
from functools import partial
from fastapi import Depends, BackgroundTasks
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

from core.security import get_auth_context, verify_user_org_access
from openai import OpenAI
from core.firebase_config import db
from fastapi.responses import StreamingResponse
import io
import csv
from core.model_config import (
    OPENAI_CLAIM_MODEL,
    OPENAI_SIMULATION_MODEL,
    GEMINI_SIMULATION_MODEL,
    CLAUDE_SIMULATION_MODEL,
    MODEL_DISPLAY_NAMES,
    OPENAI_SCHEMA_MODEL,
    API_MODEL_MAPPING,
    get_simulation_model_catalog,
)

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
    logger.warning("anthropic not installed, Claude 4.5 Sonnet will be skipped")

from tenacity import retry, stop_after_attempt, wait_exponential

router = APIRouter()


def _demo_mode_enabled() -> bool:
    from core.config import settings
    return settings.ENV == "development" and getattr(settings, "ALLOW_MOCK_AUTH", False)


def _get_org_plan(org_id: str) -> str:
    if not db:
        return "explorer"
    try:
        org_doc = db.collection("organizations").document(org_id).get()
        if not org_doc.exists:
            return "explorer"
        data = org_doc.to_dict() or {}
        return str(data.get("subscription", {}).get("planId", "explorer")).lower()
    except Exception:
        return "explorer"

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


def extract_claims(manifest_content: str, question: str, api_keys: dict, gemini_api_model: Optional[str] = None) -> list:
    """
    Extract enterprise buyer positioning assertions from the Context Document.
    These are the claims a shortlisting AI engine SHOULD make about this company
    when answering the buyer's question — not atomic facts, but competitive proof points.
    """
    openai_key = api_keys.get("openai")
    gemini_key = api_keys.get("gemini")
    
    prompt = (
        "You are preparing a competitive evaluation dossier for an enterprise procurement team. "
        "From the company context below, extract the 5-6 strongest POSITIONING ASSERTIONS that "
        "should appear in an AI model's answer when a buyer asks the following question. "
        "Each assertion should be specific, buyer-relevant, and verifiable from the document. "
        "Focus on: industry expertise, delivery proof, competitive differentiators, "
        "named technology/platform credentials, and client transformation evidence. "
        "Do NOT include generic claims like 'we deliver value'. "
        "Return JSON array of strings under key 'claims'. Short, factual, specific.\n\n"
        f"BUYER QUESTION: {question}"
    )
    
    try:
        if openai_key:
            client = OpenAI(api_key=openai_key)
            resp = client.chat.completions.create(
                messages=[{"role": "system", "content": prompt}, {"role": "user", "content": manifest_content[:6000]}],
                model=OPENAI_CLAIM_MODEL,
                response_format={"type": "json_object"},
                temperature=0,
            )
            result = json.loads(resp.choices[0].message.content or "{}")
        elif gemini_key and GEMINI_AVAILABLE:
            api_model = gemini_api_model or API_MODEL_MAPPING.get(GEMINI_SIMULATION_MODEL, GEMINI_SIMULATION_MODEL)
            client = genai.Client(api_key=gemini_key)
            resp = client.models.generate_content(
                model=api_model,
                contents=[f"{prompt}\n\nDocument:\n{manifest_content[:6000]}"],
                config={'response_mime_type': 'application/json'}
            )
            result = json.loads(resp.text)
        else:
            return []
            
        claims = result.get("claims", result.get("facts", []))
        return claims[:6] if isinstance(claims, list) else []
    except Exception as e:
        logger.error(f"Claim extraction failed: {e}")
        return []


def verify_claims(claims: list, ai_response: str, api_keys: dict, gemini_api_model: Optional[str] = None) -> list:
    """
    Score each enterprise positioning assertion against the AI model's response.
    Measures competitive visibility: did the AI surface this company's proof points
    the way a shortlisting engine should? Not hallucination detection — buyer-displacement scoring.
    """
    if not claims: return []
    openai_key = api_keys.get("openai")
    gemini_key = api_keys.get("gemini")
    
    sys_prompt = """You are scoring an AI engine's response from the perspective of an enterprise procurement committee.

For each POSITIONING ASSERTION below, evaluate whether the AI response:
- "visible": The AI mentions this assertion (explicitly or with equivalent evidence) as a reason to consider this vendor.
- "displaced": The AI credited this strength to a COMPETITOR instead, or positioned a competitor above this company for this assertion.
- "absent": The AI did not mention this company or this assertion at all — the company is invisible for this claim.

Return JSON: {"results": [{"claim": "...", "verdict": "visible|displaced|absent", "detail": "brief evidence from the AI response"}]}"""

    try:
        if openai_key:
            client = OpenAI(api_key=openai_key)
            resp = client.chat.completions.create(
                messages=[{"role": "system", "content": sys_prompt}, 
                          {"role": "user", "content": f"POSITIONING ASSERTIONS:\n{json.dumps(claims)}\n\nAI RESPONSE:\n{ai_response}"}],
                model=OPENAI_CLAIM_MODEL,
                response_format={"type": "json_object"},
                temperature=0,
            )
            result = json.loads(resp.choices[0].message.content or "{}")
        elif gemini_key and GEMINI_AVAILABLE:
            api_model = gemini_api_model or API_MODEL_MAPPING.get(GEMINI_SIMULATION_MODEL, GEMINI_SIMULATION_MODEL)
            client = genai.Client(api_key=gemini_key)
            resp = client.models.generate_content(
                model=api_model,
                contents=[f"{sys_prompt}\n\nPOSITIONING ASSERTIONS:\n{json.dumps(claims)}\n\nAI RESPONSE:\n{ai_response}"],
                config={'response_mime_type': 'application/json'}
            )
            result = json.loads(resp.text)
        else:
            return []
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
def run_openai(api_key: str, system_prompt: str, user_prompt: str, api_model: Optional[str] = None) -> str:
    api_model = api_model or API_MODEL_MAPPING.get(OPENAI_SIMULATION_MODEL, OPENAI_SIMULATION_MODEL)
    client = OpenAI(api_key=api_key)
    completion = client.chat.completions.create(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        model=api_model,
        temperature=0.2,
    )
    return completion.choices[0].message.content or ""

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), reraise=True)
def run_gemini(api_key: str, system_prompt: str, user_prompt: str, api_model: Optional[str] = None) -> str:
    if not GEMINI_AVAILABLE:
        raise Exception("google-genai not installed")
    api_model = api_model or API_MODEL_MAPPING.get(GEMINI_SIMULATION_MODEL, GEMINI_SIMULATION_MODEL)
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=api_model,
        contents=[f"{system_prompt}\n\nQuestion: {user_prompt}"]
    )
    return response.text or ""

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), reraise=True)
def run_claude(api_key: str, system_prompt: str, user_prompt: str, api_model: Optional[str] = None) -> str:
    if not CLAUDE_AVAILABLE:
        raise Exception("anthropic not installed")
    api_model = api_model or API_MODEL_MAPPING.get(CLAUDE_SIMULATION_MODEL, CLAUDE_SIMULATION_MODEL)
    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=api_model,
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


def _coerce_datetime(value: object) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            cleaned = value.replace("Z", "+00:00")
            parsed = datetime.fromisoformat(cleaned)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except Exception:
            return None
    return None


def _resolve_manifest_version(org_id: str, version: str) -> str:
    if version != "latest" or not db:
        return version
    try:
        latest_doc = db.collection("organizations").document(org_id).collection("manifests").document("latest").get()
        if latest_doc.exists:
            latest_data = latest_doc.to_dict() or {}
            candidate = latest_data.get("version")
            if candidate and candidate != "latest":
                return candidate
    except Exception as e:
        logger.warning(f"Manifest resolution failed for latest pointer: {e}")

    try:
        manifests = db.collection("organizations").document(org_id).collection("manifests") \
            .order_by("createdAt", direction="DESCENDING").limit(1).stream()
        newest = next(manifests, None)
        if newest:
            return newest.id
    except Exception as e:
        logger.warning(f"Manifest resolution fallback failed: {e}")

    return "latest"


def _resolve_cycle_start(subscription: dict) -> datetime:
    now = datetime.now(timezone.utc)
    current_start = _coerce_datetime(subscription.get("currentPeriodStart"))
    activated_at = _coerce_datetime(subscription.get("activatedAt"))
    reset_at = _coerce_datetime(subscription.get("lastUsageResetAt"))
    base = current_start or activated_at or now
    if reset_at and reset_at > base:
        return reset_at
    return base


def _count_usage_since(org_id: str, cycle_start: datetime) -> int:
    if not db:
        return 0
    usage_ref = db.collection("organizations").document(org_id).collection("usageLedger")
    query = usage_ref.where("timestamp", ">=", cycle_start)
    try:
        count_snapshot = query.count().get()
        if count_snapshot:
            return int(count_snapshot[0].value)
    except Exception:
        pass
    try:
        return len(list(query.stream()))
    except Exception:
        return 0


# ============================================================================
# MULTI-MODEL EVALUATION ENDPOINT
# ============================================================================

def _fetch_manifest_and_keys(request: SimulationRequest):
    """Fetch context manifest and API keys from Firestore."""
    manifest_content = ""
    manifest_embedding = None
    api_keys: Dict[str, str] = {}
    resolved_version = request.manifestVersion

    from core.config import settings
    is_dev = settings.ENV in ["development", "testing"]

    if db:
        try:
            org_ref = db.collection("organizations").document(request.orgId)
            org_doc = org_ref.get()
            if not org_doc.exists:
                if not is_dev:
                    raise HTTPException(status_code=404, detail="Organization not found")
                else:
                    logger.info(f"🧪 Dev-mode: Org {request.orgId} not found, using mock keys.")
            else:
                org_data = org_doc.to_dict() or {}
                api_keys = org_data.get("apiKeys", {})
                # 🛡️ SECURITY HARDENING (P0): Redact apiKeys from org_data before potential downstream use
                org_data.pop("apiKeys", None)

            # FETCH MANIFEST (Latest or Versioned)
            doc_data = None
            if request.manifestVersion == "latest":
                manifests = org_ref.collection("manifests").order_by("createdAt", direction="DESCENDING").limit(1).stream()
                latest = next(manifests, None)
                if latest:
                    doc_data = latest.to_dict()
                    resolved_version = latest.id
            else:
                version_doc = org_ref.collection("manifests").document(request.manifestVersion).get()
                if version_doc.exists:
                    doc_data = version_doc.to_dict()
                    resolved_version = version_doc.id

            if doc_data:
                manifest_content = doc_data.get("content", "")
                manifest_embedding = doc_data.get("embedding", [])
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Firestore manifest retrieval error: {e}")

    # Fallback for dev mode or missing content
    if not manifest_content:
        if is_dev:
            logger.info("🧪 Dev-mode: Providing mock manifest content")
            manifest_content = f"Mock manifest content for {request.orgId}. Simulated corporate Ground Truth."
            manifest_embedding = [0.1] * 1536
        else:
            manifest_content = "Default context placeholder. Please upload a Context Document."

    return manifest_content, manifest_embedding, api_keys, resolved_version


def _score_model(model_name: str, runner_fn, runner_key: str, api_keys: dict,
                 system_prompt: str, user_prompt: str, manifest_embedding: list,
                 claims: list, eps_div: float, gemini_api_model: Optional[str] = None) -> dict:
    """Score a single model's response against the manifest."""
    
    # 🛡️ NORMALIZATION HARDENING: Ensure frontier display names are used in metadata
    normalized_name = model_name.strip()
    raw_name = normalized_name.lower()
    if normalized_name == raw_name:
        normalized_name = MODEL_DISPLAY_NAMES.get(raw_name, normalized_name)
        # Legacy normalization (handles older IDs without pinning to deprecated names)
        if raw_name.startswith("gpt-4o"):
            normalized_name = "GPT-4o"
        elif "gemini" in raw_name and "flash" in raw_name:
            normalized_name = "Gemini 3 Flash"
        elif "claude" in raw_name and ("sonnet" in raw_name or "haiku" in raw_name):
            normalized_name = "Claude 4.5 Sonnet"

    try:
        from core.config import settings
        if settings.ENV in ["development", "testing"] and not runner_key:
            logger.info(f"🧪 Dev-mode: Simulated response for {model_name}")
            import random
            accuracy = round(random.uniform(75, 98), 1)
            return {
                "model": normalized_name,
                "answer": f"This is a simulated response from {normalized_name} for the prompt: '{user_prompt}'. In a real environment, this would be generated using your API keys.",
                "accuracy": accuracy,
                "hasHallucination": accuracy < 80,
                "claimResults": [{"claim": "Mock Claim 1", "verdict": "supported", "detail": "Simulated verification"}],
                "claimScore": "1/1 claims supported",
            }

        answer = runner_fn(runner_key, system_prompt, user_prompt)

        openai_key = api_keys.get("openai")
        
        # Embedding-based divergence (measures how closely the AI answer relates to the Context)
        if openai_key:
            divergence = compute_divergence(openai_key, manifest_embedding, answer)
        else:
            divergence = 0.5

        # === ENTERPRISE BUYER POSITIONING SCORE ===
        # Measures: how visibly did the AI engine surface this company as a shortlistable vendor?
        claim_results = []
        claim_score = None
        visible = 0
        displaced = 0
        total = 0
        
        if claims:
            claim_results = verify_claims(claims, answer, api_keys, gemini_api_model=gemini_api_model)
            visible = sum(1 for c in claim_results if c.get("verdict") == "visible")
            displaced = sum(1 for c in claim_results if c.get("verdict") == "displaced")
            absent = sum(1 for c in claim_results if c.get("verdict") == "absent")
            total = len(claim_results)
            # Weighted positioning score: visible=1.0, absent=0.3 (not catastrophic), displaced=0.0
            weighted_visible = visible + (absent * 0.3)
            claim_score = f"{visible}/{total} assertions visible to enterprise buyers"

        # Visibility Score blend: 40% semantic proximity, 60% positioning visibility
        if total > 0:
            positioning_rate = weighted_visible / total
            semantic_accuracy = max(0.0, 1.0 - divergence)
            blended = (0.4 * semantic_accuracy) + (0.6 * positioning_rate)
            accuracy = round(blended * 100, 1)
            
            # Visibility Score status mapping (enterprise framing)
            if accuracy > 85: status = "strong_presence"
            elif accuracy > 65: status = "partial_presence"
            else: status = "displaced"
            
            # Displacement detection: company is being bypassed in buyer shortlists
            # Triggered when competitors are recommended in place of us (displaced > 0)
            # OR when fewer than 40% of key positioning assertions appear
            has_drift = (displaced > 0) or (positioning_rate < 0.4)
        else:
            accuracy = round(max(0.0, 1.0 - divergence) * 100, 1)
            status = "strong_presence" if accuracy > 75 else "displaced"
            has_drift = accuracy < 40

        return {
            "model": normalized_name,
            "answer": answer,
            "accuracy": accuracy,
            "status": status,
            # hasDisplacement: true when competitor is recommended instead of us,
            # or when fewer than 40% of key positioning assertions appear in the answer.
            # NOT a hallucination — the model may be stating facts accurately but about a rival.
            "hasDisplacement": has_drift,
            "hasHallucination": has_drift,  # kept for backward-compatibility with existing Firestore history records
            "claimResults": claim_results,
            "claimScore": claim_score,
            "metrics": {
                "semantic_divergence": round(divergence, 3),
                "claim_recall": round(visible/total, 3) if total > 0 else 1.0
            }
        }
    except Exception as e:
        return {
            "model": normalized_name,
            "answer": "",
            "accuracy": 0,
            "hasDisplacement": True,
            "hasHallucination": True,  # backward-compat
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
            "timestamp": datetime.now(timezone.utc),
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
            "timestamp": datetime.now(timezone.utc),
            "version": manifest_version,
        })
        logger.info(f"Background: Simulation results for cache key {cache_key} stored successfully.")
    except Exception as e:
        logger.error(f"Failed to store background simulation data: {e}")



class SuggestPromptsRequest(BaseModel):
    orgId: str
    manifestSnippet: Optional[str] = None

@router.post("/suggest-prompts")
async def suggest_prompts(request: SuggestPromptsRequest, auth: dict = Depends(get_auth_context)):
    """
    Generates 4 context-aware simulation test prompts grounded in the org's manifest.
    """
    if auth.get("type") == "session":
        if not verify_user_org_access(auth["uid"], request.orgId):
            raise HTTPException(status_code=403, detail="Unauthorized")
    else:
        if auth.get("orgId") != request.orgId:
            raise HTTPException(status_code=403, detail="Unauthorized")

    api_key = os.getenv("OPENAI_API_KEY")
    org_name = "the company"
    manifest_content = request.manifestSnippet or ""

    if db:
        try:
            org_doc = db.collection("organizations").document(request.orgId).get()
            if org_doc.exists:
                org_data = org_doc.to_dict() or {}
                org_name = org_data.get("name", org_name)
                key = org_data.get("apiKeys", {}).get("openai", None)
                if key and key != "internal_platform_managed":
                    api_key = key
                elif key == "internal_platform_managed":
                    api_key = os.getenv("OPENAI_API_KEY")

            if not manifest_content:
                manifest_doc = db.collection("organizations").document(request.orgId) \
                                 .collection("manifests").document("latest").get()
                if manifest_doc.exists:
                    manifest_content = (manifest_doc.to_dict() or {}).get("content", "")[:2000]
        except Exception as e:
            logger.warning(f"Could not fetch org data for suggest-prompts: {e}")

    # Fallback prompts — intentionally generic so they work for any industry/company.
    # The LLM path below generates context-specific prompts when a manifest is available.
    fallback = [
        f"Which companies are leading AI-driven enterprise transformation in the market, and how does {org_name} compare?",
        f"What are the key criteria enterprise buyers use to shortlist partners like {org_name}?",
        f"How does {org_name} differentiate from other established players in its category?",
        f"What specific outcomes and proof points does {org_name} offer that enterprise buyers care about most?",
    ]

    if not api_key or not manifest_content:
        return {"prompts": fallback}

    try:
        client = OpenAI(api_key=api_key)
        prompt = f"""You are helping test how well AI models know the company '{org_name}'.
Based on the following business context, generate exactly 4 specific, factual test questions that mirror how B2B enterprise buyers compare analytics, consulting, and AI-transformation partners. These should NOT be generic SaaS questions.

<Context>
{manifest_content[:2000]}
</Context>

Rules:
- Each question should probe a specific, real aspect of this company based only on what's in the context above.
- Prioritize enterprise buyer-intent themes: industry expertise, cloud/data modernization, enterprise transformation credibility, competitive differentiation, and partner fit.
- Do NOT ask about pricing unless pricing is explicitly in the context.
- Return ONLY a JSON object: {{"prompts": ["question1", "question2", "question3", "question4"]}}"""

        completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=OPENAI_SCHEMA_MODEL,
            response_format={"type": "json_object"},
            temperature=0.3
        )
        result = json.loads(completion.choices[0].message.content)
        prompts = result.get("prompts", fallback)
        return {"prompts": prompts[:4]}
    except Exception as e:
        logger.warning(f"Suggest-prompts LLM call failed: {e}")
        return {"prompts": fallback}


@router.post("/run")
async def run_simulation(request: SimulationRequest, background_tasks: BackgroundTasks, auth: dict = Depends(get_auth_context), skip_billing: bool = False):
    """
    Main Visibility Simulation Entry Point.
    Orchestrates Claim Extraction, Multi-Model Verification, and Divergence Scoring.
    """
    from core.config import settings
    is_dev = settings.ENV == "development"
    adjudication_note = None
    results = []
    if auth.get("type") == "session":
        if not verify_user_org_access(auth["uid"], request.orgId):
            raise HTTPException(status_code=403, detail="Unauthorized")
    else:
        # API Key / Service Token must match orgId
        if auth.get("orgId") != request.orgId:
            raise HTTPException(status_code=403, detail="Unauthorized")

    if is_dev and auth.get("type") == "session":
        logger.info(f"🧪 Dev-mode: Access granted to {request.orgId} for {auth['uid']}")

    # 🛡️ DEMO MOCKING (P0): Deterministic results for Sight Spectrum
    if request.orgId == "demo_org_id" and _demo_mode_enabled():
        logger.info(f"👤 Serving Mock Simulation for Demo Account: {request.prompt}")
        
        # Predefined enterprise-style responses to showcase brand drift
        mock_responses = {
            "How does SightSpectrum compare with Accenture, Tiger Analytics, Fractal, and Mu Sigma for enterprise AI and analytics transformation?": [
                {"model": "GPT-4o", "accuracy": 62.4, "hasHallucination": False, "claimScore": "3/5 claims supported", "answer": "SightSpectrum is credible for focused enterprise analytics delivery, but larger firms such as Accenture and Fractal appear stronger on transformation-scale proof and operating-model depth."},
                {"model": "Claude 4.5 Sonnet", "accuracy": 94.2, "hasHallucination": False, "claimScore": "5/5 claims supported", "answer": "SightSpectrum differentiates through domain-led analytics delivery in healthcare, manufacturing, and logistics, though it needs clearer enterprise transformation language to outrank large consulting competitors."},
                {"model": "Gemini 3 Flash", "accuracy": 58.1, "hasHallucination": False, "claimScore": "3/5 claims supported", "answer": "SightSpectrum appears specialized and credible, but the public narrative is thinner than the broad enterprise transformation messaging used by larger competitors."}
            ],
            "Which firms are strongest in Databricks, Snowflake, and Google Cloud data modernization, and how does SightSpectrum compare?": [
                {"model": "GPT-4o", "accuracy": 78.0, "hasHallucination": False, "claimScore": "4/5 claims supported", "answer": "SightSpectrum is competitive in cloud and data modernization, though the public proof is not as explicit as larger firms that lead with named Databricks, Snowflake, and Google Cloud programs."},
                {"model": "Claude 4.5 Sonnet", "accuracy": 93.0, "hasHallucination": False, "claimScore": "5/5 claims supported", "answer": "SightSpectrum is strongest when buyers want focused analytics modernization rather than broad systems integration. It still needs more explicit partner and platform proof to outrank larger competitors."},
                {"model": "Gemini 3 Flash", "accuracy": 61.0, "hasHallucination": False, "claimScore": "3/5 claims supported", "answer": "SightSpectrum appears credible in data modernization, but its enterprise cloud ecosystem narrative is under-asserted compared with larger analytics consultancies."}
            ],
            "Which vendors have domain expertise in CPG, BFSI, retail, and supply chain analytics, and what evidence supports SightSpectrum?": [
                {"model": "GPT-4o", "accuracy": 86.5, "hasHallucination": False, "claimScore": "5/5", "answer": "SightSpectrum shows evidence of domain-led analytics across manufacturing, healthcare, logistics, and adjacent enterprise sectors, but it needs stronger public proof for retail, CPG, and BFSI breadth."},
                {"model": "Claude 4.5 Sonnet", "accuracy": 95.8, "hasHallucination": False, "claimScore": "5/5", "answer": "SightSpectrum demonstrates credible domain expertise, especially where industry-specific analytics and delivery depth matter more than global transformation scale."},
                {"model": "Gemini 3 Flash", "accuracy": 70.0, "hasHallucination": False, "claimScore": "4/5", "answer": "SightSpectrum appears specialized and domain-aware, but broader vertical proof is still less explicit than what larger consulting competitors publish."}
            ]
        }
        
        # Default fallback for custom demo prompts
        default_results = [
            {"model": "GPT-4o", "accuracy": 58.0, "hasHallucination": False, "claimScore": "3/5", "answer": "This answer is directionally relevant but still misses enough enterprise proof points to demonstrate narrative drift."},
            {"model": "Claude 4.5 Sonnet", "accuracy": 93.0, "hasHallucination": False, "claimScore": "5/5", "answer": "This answer stays closely aligned to the verified enterprise context and its primary claims."},
            {"model": "Gemini 3 Flash", "accuracy": 55.0, "hasHallucination": False, "claimScore": "3/5", "answer": "This answer remains non-fabricated but under-represents key enterprise differentiators from the manifest."}
        ]
        
        results = mock_responses.get(request.prompt, default_results)
        
        return {
            "results": results,
            "version": "latest-demo",
            "prompt": request.prompt,
            "cached": False,
            "demo_mode": True
        }

    # ----- 0. MANIFEST RESOLUTION & CACHE KEYING -----
    resolved_manifest_version = _resolve_manifest_version(request.orgId, request.manifestVersion)

    cache_input = f"{request.orgId}_{request.prompt}_{resolved_manifest_version}".encode('utf-8')
    cache_key = hashlib.sha256(cache_input).hexdigest()
    
    if db:
        try:
            cached_doc = db.collection("organizations").document(request.orgId).collection("simulationCache").document(cache_key).get()
            if cached_doc.exists:
                cached_data = cached_doc.to_dict() or {}
                # Return if not expired (e.g. 24h)
                timestamp = cached_data.get("timestamp")
                if timestamp and (datetime.now(timezone.utc) - timestamp.replace(tzinfo=None)) < timedelta(hours=24):
                    # Check subscription cache validity
                    org_doc_cache = db.collection("organizations").document(request.orgId).get()
                    org_plan_cache = org_doc_cache.to_dict().get("subscription", {}).get("planId", "explorer") if org_doc_cache.exists else "explorer"
                    # Cache policy: Paid plans always serve cache (cost optimization).
                    # Explorer plans only serve cache for the exact same prompt.
                    is_paid_plan = org_plan_cache != "explorer"
                    is_same_prompt = request.prompt == cached_data.get("prompt")
                    cached_results = cached_data.get("results", [])
                    
                    # If upgraded to paid but cache only has 1 model, invalidate cache to run all models
                    if is_paid_plan and len(cached_results) < 3:
                        logger.info(f"Invalidating legacy single-model cache for upgraded {org_plan_cache} org {request.orgId}")
                    elif is_paid_plan or is_same_prompt:
                        logger.info(f"Cache HIT for simulation {cache_key}. Serving redundant request for $0.00.")
                        return {
                            "results": cached_results,
                            "version": cached_data.get("manifestVersion", request.manifestVersion),
                            "prompt": request.prompt,
                            "cached": True
                        }
        except Exception as e:
            logger.warning(f"Cache check failed: {e}")

    # ----- 1. FETCH SUBSCRIPTION & ENFORCE LIMITS -----
    org_plan = "explorer" # default fallback
    org_data = {}
    if db:
        try:
            org_doc = db.collection("organizations").document(request.orgId).get()
            if org_doc.exists:
                org_data = org_doc.to_dict() or {}
                org_plan = org_data.get("subscription", {}).get("planId", "explorer")
        except Exception as e:
            logger.error(f"Failed to fetch org plan: {e}")

    # Enforce Dynamic Limits with Usage Ledger (contention-safe)
    limits = {
        "explorer": 1,
        "growth": 100,
        "scale": 500,
        "enterprise": 2000,
    }
    plan_limit = org_data.get("subscription", {}).get("maxSimulations", limits.get(org_plan, 1))

    if db and not is_dev and not skip_billing:
        org_ref = db.collection("organizations").document(request.orgId)
        subscription = org_data.get("subscription", {})
        cycle_start = _resolve_cycle_start(subscription)
        usage_count = _count_usage_since(request.orgId, cycle_start)

        if usage_count >= plan_limit:
            if org_plan == "explorer":
                raise HTTPException(
                    status_code=402,
                    detail={
                        "code": "EXPLORER_LIMIT_REACHED",
                        "message": "Your free report has been used. Upgrade to Growth to continue monitoring your brand.",
                        "upgrade_url": "/dashboard?upgrade=true"
                    }
                )
            raise HTTPException(
                status_code=402,
                detail=f"{org_plan.capitalize()} plan limit of {plan_limit} simulations reached. Please upgrade."
            )

        try:
            org_ref.collection("usageLedger").document().set({
                "timestamp": datetime.now(timezone.utc),
                "prompt": request.prompt[:100],
                "manifestVersion": resolved_manifest_version,
                "planId": org_plan,
            })
        except Exception as e:
            logger.error(f"Usage ledger write failed: {e}")
            raise HTTPException(status_code=500, detail="Billing verification failed.")

    # 2. FETCH CONTEXT & KEYS 
    manifest_content, manifest_embedding, api_keys, resolved_version_from_fetch = _fetch_manifest_and_keys(request)
    if resolved_version_from_fetch and resolved_version_from_fetch != "latest":
        resolved_manifest_version = resolved_version_from_fetch

    openai_key = api_keys.get("openai")
    gemini_key = api_keys.get("gemini")
    claude_key = api_keys.get("anthropic")

    # In Dev Mode, always fallback to environment keys
    if is_dev:
        openai_key = openai_key or os.getenv("OPENAI_API_KEY")
        gemini_key = gemini_key or os.getenv("GEMINI_API_KEY")
        claude_key = claude_key or os.getenv("ANTHROPIC_API_KEY")
        
    # --- ENTERPRISE AUTO-PROVISIONING & SIGHTSPECTRUM OVERRIDE ---
    # 🛡️ DEMO HARDENING (P0): If this is SightSpectrum or demo, auto-promote to platform-managed keys
    # to ensure zero-friction testing during the actual platform audit.
    if request.orgId == "demo_org_id" and _demo_mode_enabled():
        if not openai_key: openai_key = "internal_platform_managed"
        if not gemini_key: gemini_key = "internal_platform_managed"
        if not claude_key: claude_key = "internal_platform_managed"

    if openai_key == "internal_platform_managed":
        openai_key = os.getenv("OPENAI_API_KEY")
    if gemini_key == "internal_platform_managed":
        gemini_key = os.getenv("GEMINI_API_KEY")
    if claude_key == "internal_platform_managed":
        claude_key = os.getenv("ANTHROPIC_API_KEY")

    if not any([openai_key, gemini_key, claude_key]) and not is_dev:
        # Final safety check: if all are None, try the root environment keys one last time
        openai_key = openai_key or os.getenv("OPENAI_API_KEY")
        gemini_key = gemini_key or os.getenv("GEMINI_API_KEY")
        claude_key = claude_key or os.getenv("ANTHROPIC_API_KEY")

    if not any([openai_key, gemini_key, claude_key]) and not is_dev:
        # If still no keys, it's a 503
        logger.error(f"Simulation Engine Fail-Closed: No keys for org {request.orgId}")
        raise HTTPException(
            status_code=503, 
            detail="Simulation Engine Unavailable. Enterprise API keys not provisioned for this workspace."
        )

    # Override for dev mock mode
    if is_dev:
        if not openai_key:
            logger.info("🧪 Dev-mode: OpenAI key missing, enabling mock scoring")
        if not gemini_key:
            logger.info("🧪 Dev-mode: Gemini key missing, enabling mock scoring")

    # Use the fully resolved provider keys for claim extraction, claim verification,
    # and semantic scoring. The org record may contain placeholders like
    # `internal_platform_managed`, which are valid for routing but invalid for direct API use.
    effective_api_keys = {
        "openai": openai_key,
        "gemini": gemini_key,
        "anthropic": claude_key,
    }

    model_catalog = get_simulation_model_catalog()
    openai_meta = model_catalog.get("openai", {})
    gemini_meta = model_catalog.get("gemini", {})
    claude_meta = model_catalog.get("anthropic", {})

    openai_display = openai_meta.get("displayName", MODEL_DISPLAY_NAMES.get(OPENAI_SIMULATION_MODEL, "GPT-4o"))
    gemini_display = gemini_meta.get("displayName", MODEL_DISPLAY_NAMES.get(GEMINI_SIMULATION_MODEL, "Gemini 3 Flash"))
    claude_display = claude_meta.get("displayName", MODEL_DISPLAY_NAMES.get(CLAUDE_SIMULATION_MODEL, "Claude 4.5 Sonnet"))

    openai_api_model = openai_meta.get("apiModelId", API_MODEL_MAPPING.get(OPENAI_SIMULATION_MODEL, OPENAI_SIMULATION_MODEL))
    gemini_api_model = gemini_meta.get("apiModelId", API_MODEL_MAPPING.get(GEMINI_SIMULATION_MODEL, GEMINI_SIMULATION_MODEL))
    claude_api_model = claude_meta.get("apiModelId", API_MODEL_MAPPING.get(CLAUDE_SIMULATION_MODEL, CLAUDE_SIMULATION_MODEL))

    openai_enabled = openai_meta.get("enabled", True)
    gemini_enabled = gemini_meta.get("enabled", True)
    claude_enabled = claude_meta.get("enabled", True)

    # --- PHASE 7: DEEP CONTEXT RETRIEVAL ---
    if openai_key and db:
        try:
            client = OpenAI(api_key=openai_key)
            q_embed = client.embeddings.create(input=[request.prompt], model="text-embedding-3-small").data[0].embedding
            
            manifest_version = resolved_manifest_version

            # --- PHASE 8: NATIVE VECTOR SEARCH (O(log N)) ---
            # REQUIRES: Firestore Vector Index on 'embedding' field
            top_chunks = []
            try:
                from google.cloud.firestore_v1.vector import Vector
                from google.cloud.firestore_v1.base_vector_query import DistanceMeasure

                collection_ref = db.collection("organizations").document(request.orgId) \
                                   .collection("manifests").document(manifest_version) \
                                   .collection("chunks")

                vector_query = collection_ref.find_nearest(
                    vector_field="embedding",
                    query_vector=Vector(q_embed),
                    distance_measure=DistanceMeasure.COSINE,
                    limit=5
                )
                
                top_chunks = [doc.to_dict().get("text", "") for doc in vector_query.get()]
                if top_chunks:
                    logger.info(f"Simulation Retrieval: Native Vector Search pulled {len(top_chunks)} chunks.")
            except Exception as e:
                logger.warning(f"Native Vector Search failed (Index might be building): {e}")
                # FALLBACK: O(N) Scan (Safe for small manifests/demos, prevents 500 error)
                try:
                    chunks_ref = db.collection("organizations").document(request.orgId) \
                                   .collection("manifests").document(manifest_version) \
                                   .collection("chunks").limit(50).get()
                    
                    matches = []
                    for doc in chunks_ref:
                        c_data = doc.to_dict()
                        if "embedding" in c_data:
                            matches.append((cosine_sim(q_embed, c_data["embedding"]), c_data["text"]))
                    
                    matches.sort(key=lambda x: x[0], reverse=True)
                    top_chunks = [m[1] for m in matches[:5]]
                    if top_chunks:
                        logger.info(f"Retrieved {len(top_chunks)} chunks via O(N) list-scan fallback.")
                except Exception as fe:
                    logger.error(f"Fallback search also failed: {fe}")

            if top_chunks:
                manifest_content = "\n\n---\n\n".join(top_chunks)
                if openai_key:
                    try:
                        manifest_embedding = client.embeddings.create(
                            input=[manifest_content[:8000]],
                            model="text-embedding-3-small"
                        ).data[0].embedding
                    except Exception as embed_err:
                        logger.warning(f"Simulation context re-embedding failed: {embed_err}")
            elif not is_dev and not manifest_content:
                # If no chunks found and no fallback content, it's a manifest issue
                raise HTTPException(status_code=500, detail="Context retrieval failed. Please re-ingest your manifest.")
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Simulation semantic retrieval failed: {e}")

    # Enforce Model Gating
    if org_plan == "explorer":
        # Explorer users only get one model (OpenAI)
        gemini_key = None
        claude_key = None
        if not openai_enabled:
            raise HTTPException(
                status_code=503,
                detail="Simulation Engine Unavailable. No enabled OpenAI model for Explorer plan."
            )

    # === ENTERPRISE BUYER SIMULATION SYSTEM PROMPT ===
    # The AI model represents an enterprise procurement advisor answering vendor evaluation questions.
    # It answers naturally from its training data — we then score how well the company surfaces
    # as a shortlisted, recommended vendor in the AI's response.
    system_prompt = f"""You are an expert enterprise technology and analytics advisor helping a procurement committee evaluate vendors for a large-scale transformation initiative.

PRIMARY ROLE: Answer the buyer's question based on your knowledge. Do not simply repeat the document below — use it as supplemental grounding to ensure you mention the company accurately when relevant.

SUPPLEMENTAL GROUNDING (confidential — do not quote directly):
---
{manifest_content[:4000]}
---

ANSWER GUIDELINES:
- Respond as a neutral, credible advisor — enterprise buyers ask you for vendor shortlists, comparisons, and proof.
- When the company in the grounding context is relevant to the question, mention it by name along with specific, evidence-backed strengths.
- Structure your answer to reflect how AI search engines answer enterprise vendor queries: rankings, notable differentiators, and realistic trade-offs.
- Do NOT fabricate facts. Keep the answer authoritative, specific, and 150-250 words."""

    eps_div = 0.45
    claims = []
    # Hardened Claim Extraction with multi-provider fallback
    claims = extract_claims(manifest_content, request.prompt, effective_api_keys, gemini_api_model=gemini_api_model)

    # --- PARALLEL INFERENCE & SCORING ---
    async def _run_and_score(model_name: str, runner_fn, key: str):
        return await asyncio.to_thread(
            _score_model,
            model_name, runner_fn, key, effective_api_keys,
            system_prompt, request.prompt, manifest_embedding, claims, eps_div, gemini_api_model
        )

    tasks = []
    
    if not is_dev:
        if not GEMINI_AVAILABLE or not CLAUDE_AVAILABLE:
            raise HTTPException(
                status_code=500, 
                detail="Multi-model simulation requires google-genai and anthropic packages. They are missing in this production environment."
            )

    openai_runner = partial(run_openai, api_model=openai_api_model)
    gemini_runner = partial(run_gemini, api_model=gemini_api_model)
    claude_runner = partial(run_claude, api_model=claude_api_model)

    if (openai_key or is_dev) and openai_enabled:
        tasks.append(_run_and_score(openai_display, openai_runner, openai_key))
    if (gemini_key or is_dev) and gemini_enabled:
        tasks.append(_run_and_score(gemini_display, gemini_runner, gemini_key))
    if (claude_key or is_dev) and claude_enabled:
        tasks.append(_run_and_score(claude_display, claude_runner, claude_key))

    if not tasks:
        raise HTTPException(
            status_code=503,
            detail="Simulation Engine Unavailable. No enabled models are configured."
        )

    # --- PHASE 10: MULTI-MODEL ADJUDICATION ---
    adjudication_note = None
    results = await asyncio.gather(*tasks)
    
    # === COMPETITIVE RANKING ADJUDICATION (B2B Enterprise Mode) ===
    # Triggered when models diverge by >20% — determines which model gives the most useful
    # enterprise buyer guidance, not just which matched the manifest most closely.
    if len(results) > 1 and openai_key:
        try:
            accuracies = [r["accuracy"] for r in results if r.get("accuracy") is not None]
            if accuracies and (max(accuracies) - min(accuracies) > 20):
                logger.info("⚖️ Competitive divergence detected. Initializing Buyer-Intent Adjudication...")
                adjudication_prompt = f"""You are a senior enterprise procurement consultant reviewing how three AI engines responded to an enterprise buyer query.

BUYER QUERY: "{request.prompt}"

GROUND TRUTH CONTEXT (the company being evaluated):
{manifest_content[:2000]}

AI ENGINE RESPONSES:
{json.dumps([{{r['model']: r['answer']}} for r in results])}

YOUR TASK:
1. Identify which AI engine's response most credibly positions the company-in-context as a shortlistable vendor for an enterprise buyer asking this question.
2. Note if any engine failed to mention the company, positioned a competitor more strongly, or gave a response a buyer would NOT act on.
3. Write a concise "Competitive Verdict" a VP of Procurement would trust.

Return JSON: {{"master_verdict": "concise competitive verdict", "winner": "model name", "audit_notes": "which competitors were ranked above or instead, and why"}}"""

                client = OpenAI(api_key=openai_key)
                adj_resp = client.chat.completions.create(
                    model=OPENAI_SCHEMA_MODEL,
                    messages=[{"role": "system", "content": adjudication_prompt}],
                    response_format={"type": "json_object"},
                    temperature=0
                )
                adjudication_note = json.loads(adj_resp.choices[0].message.content)
        except Exception as e:
            logger.error(f"Adjudication failed: {e}")


    # ----- 5. ATOMIC BILLING & CACHE UPDATE (Background) -----
    if db:
        background_tasks.add_task(_store_simulation_results, request.orgId, request.prompt, resolved_manifest_version, results, cache_key)
        import random
        if random.random() < 0.1:
            background_tasks.add_task(_cleanup_expired_cache, request.orgId)

    locked_models = []
    if org_plan == "explorer":
        if gemini_enabled:
            locked_models.append(gemini_display)
        if claude_enabled:
            locked_models.append(claude_display)

    return {
        "results": results,
        "adjudication": adjudication_note,
        "lockedModels": locked_models,
        "version": resolved_manifest_version,
        "prompt": request.prompt,
        "claimsExtracted": len(claims),
        "cached": False,
        "transparency_footprint": {
            "standards": [
                "Deterministic scoring for auditability",
                "Zero-retention ingestion pipeline",
                "Prompt + model traceability"
            ],
            "verification_method": "AI Visibility 60/40 Visibility Score v1.2.0",
            "models_audited": [r["model"] for r in results],
            "parameters": {
                "temperature": 0.0,
                "top_p": 1.0,
                "extraction_mode": "deterministic"
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    }

async def _cleanup_expired_cache(org_id: str):
    """Purges simulation cache entries older than 7 days to keep storage lean."""
    if not db:
        return
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
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

# ============================================================================
# B2B EXTERNAL API LICENSING PIPELINE
# ============================================================================

from fastapi import Request
from core.limiter import limiter

@router.post("/v1/run")
@limiter.limit("100/minute") # Strict 100/min B2B API gateway limiting
async def run_simulation_api_v1(request: Request, bg_tasks: BackgroundTasks, sim_request: SimulationRequest, auth: dict = Depends(get_auth_context)):
    """
    Public-facing B2B API. Identical to `/run` but enforces strict IP/Token rate limiting 
    specifically designed to prevent DDOS overages for Enterprise API Integrators.
    Requires an `aum_...` prefix Bearer token generated via the Provisioning Engine.
    """
    if auth.get("type") != "api_key":
        raise HTTPException(status_code=403, detail="This endpoint is restricted to B2B API Key licensing only. Use /api/simulation/run for UI sessions.")
    
    # Description: Multi-Model Visibility Simulation Engine with Fine-Grained Fact-Checking
    # The Visibility Score engine naturally inherits the atomic billing transactional locking from `run_simulation`
    return await run_simulation(sim_request, bg_tasks, auth)


@router.get("/export/{orgId}")
async def export_scoring_history(orgId: str, auth: dict = Depends(get_auth_context)):
    """
    Export the Visibility Score history for an organization as a verifiable CSV.
    Allows enterprises to audit the 60/40 blend mathematics independently.
    """
    if auth.get("type") == "session" and not verify_user_org_access(auth["uid"], orgId):
        raise HTTPException(status_code=403, detail="Unauthorized access to this organization")

    org_plan = _get_org_plan(orgId)
    if org_plan not in ["growth", "scale", "enterprise"]:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "FEATURE_REQUIRES_GROWTH",
                "message": "CSV audit export is available on Growth, Scale, and Enterprise plans."
            }
        )
        
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    try:
        history_ref = db.collection("organizations").document(orgId).collection("scoringHistory").order_by("timestamp", direction="DESCENDING").limit(1000).get()
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # CSV Headers
        writer.writerow([
            "Timestamp", "Manifest Version", "Prompt", "Model", 
            "Visibility Score %", "Displacement Detected", "Claim Verification Score"
        ])
        
        for doc in history_ref:
            data = doc.to_dict()
            timestamp = data.get("timestamp", "")
            if hasattr(timestamp, "isoformat"):
                timestamp = timestamp.isoformat()
            
            prompt = data.get("prompt", "")
            version = data.get("version", "latest")
            
            # Write a row for each model's result in the simulation run
            for result in data.get("results", []):
                writer.writerow([
                    timestamp,
                    version,
                    prompt,
                    result.get("model", ""),
                    result.get("accuracy", 0.0),
                    "Yes" if (result.get("hasDisplacement") or result.get("hasHallucination")) else "No",
                    result.get("claimScore", "N/A")
                ])
                
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=visibility_audit_{orgId}.csv"}
        )
        
    except Exception as e:
        logger.error(f"Failed to export scoring history: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate CSV export")


@router.get("/history/{org_id}")
async def get_simulation_history(org_id: str, auth: dict = Depends(get_auth_context)):
    """
    Fetch the historical simulation results for the dashboard.
    Intercepts demo_org_id to serve a fixed high-fidelity dataset.
    """
    if auth.get("type") == "session" and not verify_user_org_access(auth["uid"], org_id):
        raise HTTPException(status_code=403, detail="Unauthorized")

    org_plan = _get_org_plan(org_id)

    # 🛡️ DEMO MOCKING (P0): Fixed historical data for Sight Spectrum
    if org_id == "demo_org_id" and _demo_mode_enabled():
        history = [
            {
                "prompt": "How does SightSpectrum compare with Accenture, Tiger Analytics, Fractal, and Mu Sigma for enterprise AI and analytics transformation?",
                "results": [
                    {"model": "GPT-4o", "accuracy": 62.4, "hasHallucination": False},
                    {"model": "Claude 4.5 Sonnet", "accuracy": 94.2, "hasHallucination": False},
                    {"model": "Gemini 3 Flash", "accuracy": 58.1, "hasHallucination": False}
                ],
                "timestamp": datetime.now(timezone.utc) - timedelta(days=2),
                "version": "v1_baseline"
            },
            {
                "prompt": "Which firms are strongest in Databricks, Snowflake, and Google Cloud data modernization, and how does SightSpectrum compare?",
                "results": [
                    {"model": "GPT-4o", "accuracy": 78.0, "hasHallucination": False},
                    {"model": "Claude 4.5 Sonnet", "accuracy": 93.0, "hasHallucination": False},
                    {"model": "Gemini 3 Flash", "accuracy": 61.0, "hasHallucination": False}
                ],
                "timestamp": datetime.now(timezone.utc) - timedelta(days=1),
                "version": "latest-demo"
            },
            {
                "prompt": "Which vendors have domain expertise in CPG, BFSI, retail, and supply chain analytics, and what evidence supports SightSpectrum?",
                "results": [
                    {"model": "GPT-4o", "accuracy": 86.5, "hasHallucination": False},
                    {"model": "Claude 4.5 Sonnet", "accuracy": 95.8, "hasHallucination": False},
                    {"model": "Gemini 3 Flash", "accuracy": 70.0, "hasHallucination": False}
                ],
                "timestamp": datetime.now(timezone.utc) - timedelta(hours=4),
                "version": "latest-demo"
            }
        ]
        # Convert timestamps to ISO format for JSON serialization
        for entry in history:
            entry["timestamp"] = entry["timestamp"].isoformat()
        if org_plan == "explorer":
            return {"history": history[:1]}
        return {"history": history}

    # Standard Firestore retrieval
    if not db:
        return {"history": []}

    try:
        history_limit = 1 if org_plan == "explorer" else 50
        history_stream = db.collection("organizations").document(org_id) \
                           .collection("scoringHistory") \
                           .order_by("timestamp", direction="DESCENDING") \
                           .limit(history_limit) \
                           .stream()
        
        history = []
        for doc in history_stream:
            data = doc.to_dict()
            if "timestamp" in data and hasattr(data["timestamp"], "isoformat"):
                data["timestamp"] = data["timestamp"].isoformat()
            history.append(data)
            
        return {"history": history}
    except Exception as e:
        logger.error(f"Failed to fetch simulation history: {e}")
        return {"history": []}
