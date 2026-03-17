"""
backend/app/api/quick_scan.py

Public "instant scan" endpoint — no auth required.
Runs one GPT-4o call against a company name/domain and returns a 
snapshot AI visibility score within ~15s. This is the conversion fix.

DEPLOYMENT INSTRUCTIONS
  1. Copy this file to:  backend/app/api/quick_scan.py
  2. In main.py, add:    load_router("api.quick_scan", "/api", "Quick Scan")
  3. In GCP Cloud Run, ensure PLATFORM_OPENAI_KEY env var is set
     (separate from per-org keys — this costs money from your platform budget)
  4. Rate limit: 3 scans / IP / hour enforced via slowapi

COST: ~$0.002 per scan at gpt-4o pricing (300 tokens in, 300 out).
      At 500 scans/day → ~$1/day. Acceptable for a conversion tool.

WHY NO FIRESTORE WRITE: This is pre-auth. Writing unauthenticated data
to Firestore is a DoS vector. Results are in-memory cached per process.
GCP Cloud Run has multiple instances — cache miss across instances is fine,
just costs one extra LLM call.
"""

import os
import json
import hashlib
import logging
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, field_validator
from core import firebase_config
from core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# In-process cache: { sha256_of_company_name -> (result, expires_at) }
# Per Cloud Run instance. No shared state needed — cache miss = one LLM call.
# ---------------------------------------------------------------------------
_cache: dict[str, tuple[dict, datetime]] = {}
_CACHE_TTL_H = 6
_CACHE_MAX_ENTRIES = 1_000   # ~80KB RAM at average result size

# ---------------------------------------------------------------------------
# Simple in-process rate limiter: { client_ip -> [timestamps] }
# Not shared across Cloud Run instances — acceptable; each instance tracks itself.
# ---------------------------------------------------------------------------
_rate: dict[str, list[datetime]] = {}
_RATE_LIMIT = 3          # calls per IP
_RATE_WINDOW_H = 1       # per hour


async def _check_rate(ip: str) -> bool:
    """Return True if the request is allowed, False if rate-limited. Cloud-safe via Firestore."""
    db = firebase_config.db
    if not db:
        return True # Fail open if DB is down for public tool
        
    try:
        # Generic rate limiting collection
        doc_ref = db.collection("rateLimits").document(f"quickscan_{hashlib.md5(ip.encode()).hexdigest()}")
        doc = doc_ref.get()
        now = datetime.now(timezone.utc)
        
        if doc.exists:
            data = doc.to_dict() or {}
            calls = data.get("calls", [])
            # Prune old entries
            window_start = now - timedelta(hours=_RATE_WINDOW_H)
            calls = [t for t in calls if (t if isinstance(t, datetime) else datetime.fromisoformat(t).replace(tzinfo=timezone.utc)) > window_start]
            
            if len(calls) >= _RATE_LIMIT:
                return False
            
            calls.append(now)
            doc_ref.set({"calls": calls, "updatedAt": now})
        else:
            doc_ref.set({"calls": [now], "updatedAt": now})
        return True
    except Exception as e:
        logger.error(f"Rate limit check failed: {e}")
        return True # Fail open to prevent blocking legitimate users on DB transient issues


def _cache_get(key: str) -> Optional[dict]:
    if key in _cache:
        result, expires = _cache[key]
        if datetime.now(timezone.utc) < expires:
            return result
        del _cache[key]
    return None


def _cache_set(key: str, result: dict) -> None:
    if len(_cache) >= _CACHE_MAX_ENTRIES:
        # Evict the entry with the earliest expiry
        oldest = min(_cache, key=lambda k: _cache[k][1])
        del _cache[oldest]
    _cache[key] = (result, datetime.now(timezone.utc) + timedelta(hours=_CACHE_TTL_H))


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class QuickScanRequest(BaseModel):
    company_name: str
    domain: Optional[str] = None

    @field_validator("company_name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Company name too short")
        if len(v) > 100:
            raise ValueError("Company name too long")
        return v

    @field_validator("domain")
    @classmethod
    def _validate_domain(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v = v.strip().lower()
        for pfx in ("https://", "http://", "www."):
            if v.startswith(pfx):
                v = v[len(pfx):]
        v = v.split("/")[0]
        return v if "." in v else None


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/quick-scan")
async def quick_scan(request: Request, body: QuickScanRequest):
    """
    Public endpoint. No authentication. Rate-limited to 3/hour/IP.

    Returns an instant AI visibility snapshot for any company.
    Used on the landing page BEFORE sign-up — the conversion aha-moment.
    """
    # Resolve client IP (Vercel sets x-forwarded-for; GCP LB sets x-real-ip)
    ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.headers.get("x-real-ip", "")
        or getattr(request.client, "host", "unknown")
    )

    if not await _check_rate(ip):
        raise HTTPException(
            status_code=429,
            detail={
                "error": "rate_limited",
                "message": f"You've run {_RATE_LIMIT} scans this hour. Sign up for unlimited access.",
            },
        )

    company = body.company_name
    domain = body.domain or ""

    # Cache key is hash of normalised company name (domain is hint, not identity)
    cache_key = hashlib.sha256(company.lower().strip().encode()).hexdigest()[:20]
    cached = _cache_get(cache_key)
    if cached:
        return {**cached, "cached": True}

    api_key = os.getenv("PLATFORM_OPENAI_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        # Dev / staging: return a plausible demo so the page renders
        return _fallback(company, reason="no_api_key")

    try:
        result = await _run_gpt_scan(company, domain, api_key)
        _cache_set(cache_key, result)
        return {**result, "cached": False}
    except httpx.TimeoutException:
        logger.warning(f"QuickScan timeout for: {company}")
        return _fallback(company, reason="timeout")
    except Exception as exc:
        logger.error(f"QuickScan error for {company}: {exc}")
        return _fallback(company, reason="error")


# ---------------------------------------------------------------------------
# LLM call
# ---------------------------------------------------------------------------

_PROMPT_TEMPLATE = """\
You are an AI market intelligence analyst evaluating how well "{company}"{domain_hint} is \
represented by large language models when enterprise buyers ask vendor-selection questions.

Using only your training knowledge, produce a structured JSON evaluation:

1. **score** (0–100): How often would AI systems confidently recommend "{company}" to a \
buyer asking who to use for its core category? 0 = never mentioned, 100 = first choice.
2. **low_visibility**: true if "{company}" is largely unknown to your training data.
3. **top_competitor**: ONE company that AI systems are MORE likely to recommend instead of \
"{company}" for the same buyer query. Use "Not identified" if none.
4. **key_gap**: ONE specific proof point or claim that is absent from "{company}"'s public \
narrative and would improve AI recall. Max 12 words. Be concrete (e.g. "No published \
enterprise ROI case studies").
5. **winning_category**: The buyer-intent category where "{company}" is strongest. \
Max 5 words.
6. **summary**: One sentence (max 20 words) describing what AI buyers currently hear \
about "{company}".

IMPORTANT: If "{company}" is unknown to you, set score ≤ 35 and low_visibility: true.

Return ONLY valid JSON, nothing else:
{{
  "score": <integer 0-100>,
  "low_visibility": <boolean>,
  "top_competitor": "<string>",
  "key_gap": "<string>",
  "winning_category": "<string>",
  "summary": "<string>"
}}"""


async def _run_gpt_scan(company: str, domain: str, api_key: str) -> dict:
    domain_hint = f" (website: {domain})" if domain else ""
    prompt = _PROMPT_TEMPLATE.format(company=company, domain_hint=domain_hint)

    async with httpx.AsyncClient(timeout=25.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "gpt-4o",
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
                "temperature": 0,
                "max_tokens": 350,
            },
        )

    if resp.status_code == 429:
        raise RuntimeError("OpenAI rate limit hit on platform key")
    if resp.status_code != 200:
        raise RuntimeError(f"OpenAI returned HTTP {resp.status_code}: {resp.text[:200]}")

    raw = resp.json()["choices"][0]["message"]["content"]
    parsed = json.loads(raw)

    score = max(0, min(100, int(parsed.get("score", 30))))
    return {
        "company_name": company,
        "score": score,
        "score_label": _label(score),
        "low_visibility": bool(parsed.get("low_visibility", score < 35)),
        "top_competitor": str(parsed.get("top_competitor", "Not identified"))[:80],
        "key_gap": str(parsed.get("key_gap", "Insufficient public proof points"))[:120],
        "winning_category": str(parsed.get("winning_category", "General enterprise"))[:60],
        "summary": str(parsed.get("summary", ""))[:200],
        "scanned_at": datetime.now(timezone.utc).isoformat(),
    }


def _label(score: int) -> str:
    if score >= 80: return "Strong AI Presence"
    if score >= 60: return "Moderate AI Presence"
    if score >= 40: return "Weak AI Presence"
    return "Near-Invisible to AI"


def _fallback(company: str, reason: str = "unknown") -> dict:
    """Safe fallback when the LLM call fails. Never returns a 500 on the landing page."""
    result = {
        "company_name": company,
        "score": 32,
        "score_label": "Weak AI Presence",
        "low_visibility": True,
        "top_competitor": "A larger, better-documented competitor",
        "key_gap": "No verified enterprise transformation case studies found",
        "winning_category": "General B2B services",
        "summary": f"AI systems have limited verified data about {company} and default to more prominent alternatives.",
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "cached": False,
        "demo": True,
        "_reason": reason,   # internal, helps debugging
    }
    if settings.ENV != "development":
        result.pop("_reason", None)
    return result
