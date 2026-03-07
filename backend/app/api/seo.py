import httpx
import re
import logging
import json
import os
import uuid
from datetime import datetime
from openai import OpenAI
from fastapi import Depends, APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
import asyncio

logger = logging.getLogger(__name__)

try:
    from bs4 import BeautifulSoup
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False
    logger.warning("beautifulsoup4 not installed. SEO audits will be limited.")

from core.firebase_config import db
from core.security import get_current_user, verify_user_org_access

router = APIRouter()

class SEOAuditRequest(BaseModel):
    url: str
    orgId: str
    manifestVersion: Optional[str] = "latest"


def _normalize_audit_url(url: str) -> str:
    trimmed = (url or "").strip()
    if not trimmed:
        return trimmed
    if re.match(r"^https?://", trimmed, re.IGNORECASE):
        return trimmed
    return f"https://{trimmed}"

from utils.task_queue import FirestoreTaskQueue


async def _process_seo_audit(request: SEOAuditRequest, job_id: str):
    """Background worker: scrape page with httpx + BS4, score SEO/GEO fidelity."""
    async def worker():
        from core.config import settings
        is_dev = settings.ENV == "development"

        results: List[dict] = []
        seo_score, geo_score = 0, 0
        title, description, body_text, jsonld_count = "", "", "", 0
        checks: List[dict] = []

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (compatible; AUMContextFoundry/1.0; +https://aumcontextfoundry.com/bot)",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }
            async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers=headers) as client:
                resp = await client.get(request.url)
                html = resp.text
                status_code = resp.status_code
        except Exception as e:
            logger.error(f"SEO fetch error for {request.url}: {e}")
            return {
                "url": request.url, "seoScore": 0, "geoScore": 0, "overallScore": 0,
                "checks": [{"check": "URL Fetch", "status": "fail", "detail": f"Could not reach {request.url}: {str(e)}"}],
                "recommendation": "The URL could not be reached. Please verify the URL is publicly accessible.",
            }

        # --- PARSE HTML ---
        if BS4_AVAILABLE:
            soup = BeautifulSoup(html, "html.parser")
            title = soup.title.string.strip() if soup.title and soup.title.string else ""
            desc_tag = soup.find("meta", attrs={"name": "description"})
            description = desc_tag["content"].strip() if desc_tag and desc_tag.get("content") else ""
            h1_tags = [h.get_text(strip=True) for h in soup.find_all("h1")]
            h2_tags = [h.get_text(strip=True) for h in soup.find_all("h2")]
            canonical = soup.find("link", rel="canonical")
            canonical_url = canonical["href"] if canonical and canonical.get("href") else ""
            robots_meta = soup.find("meta", attrs={"name": "robots"})
            robots_content = robots_meta["content"].strip() if robots_meta and robots_meta.get("content") else ""
            jsonld_scripts = soup.find_all("script", type="application/ld+json")
            jsonld_count = len(jsonld_scripts)
            jsonld_content = []
            for s in jsonld_scripts:
                try:
                    jsonld_content.append(json.loads(s.string or "{}"))
                except Exception:
                    pass
            body_text = soup.get_text(separator=" ", strip=True)[:3000]
        else:
            # Minimal regex fallback
            title = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
            title = title.group(1).strip() if title else ""
            description = ""
            canonical_url = ""
            robots_content = ""
            h1_tags = re.findall(r"<h1[^>]*>(.*?)</h1>", html, re.S | re.I)
            h2_tags = re.findall(r"<h2[^>]*>(.*?)</h2>", html, re.S | re.I)
            jsonld_count = len(re.findall(r'application/ld\+json', html))
            body_text = re.sub(r"<[^>]+>", " ", html)[:3000]
            jsonld_content = []

        # --- SEO CHECKS ---
        checks.append({
            "check": "Title Tag",
            "status": "pass" if title and 10 < len(title) < 70 else ("warn" if title else "fail"),
            "detail": title or "Missing"
        })
        checks.append({
            "check": "Meta Description",
            "status": "pass" if description and 50 < len(description) < 160 else ("warn" if description else "fail"),
            "detail": description[:120] + "..." if len(description) > 120 else (description or "Missing")
        })
        checks.append({
            "check": "H1 Heading",
            "status": "pass" if len(h1_tags) == 1 else ("warn" if h1_tags else "fail"),
            "detail": h1_tags[0] if h1_tags else f"Found {len(h1_tags)} H1 tags" if h1_tags else "Missing"
        })
        checks.append({
            "check": "Canonical URL",
            "status": "pass" if canonical_url else "warn",
            "detail": canonical_url or "Not set"
        })
        checks.append({
            "check": "Robots Meta",
            "status": "warn" if "noindex" in robots_content.lower() else "pass",
            "detail": robots_content or "Default (index, follow)"
        })
        checks.append({
            "check": "HTTPS",
            "status": "pass" if request.url.startswith("https://") else "fail",
            "detail": "Secure" if request.url.startswith("https://") else "Not HTTPS"
        })
        checks.append({
            "check": "HTTP Status",
            "status": "pass" if status_code == 200 else "fail",
            "detail": f"HTTP {status_code}"
        })

        # --- GEO / JSON-LD CHECKS ---
        checks.append({
            "check": "Schema.org JSON-LD",
            "status": "pass" if jsonld_count > 0 else "fail",
            "detail": f"{jsonld_count} schema block(s) found" if jsonld_count else "No structured data found — AI crawlers rely on this"
        })
        checks.append({
            "check": "AI Crawler Readiness",
            "status": "pass" if jsonld_count > 0 and "noindex" not in robots_content.lower() else "fail",
            "detail": "Structured data present and indexable" if jsonld_count > 0 else "Missing JSON-LD — ChatGPT, Perplexity, Gemini cannot extract verified facts"
        })

        # --- SEO SCORE (simple weighted) ---
        pass_count = sum(1 for c in checks if c["status"] == "pass")
        fail_count = sum(1 for c in checks if c["status"] == "fail")
        seo_score = round((pass_count / len(checks)) * 100)
        geo_score = 90 if jsonld_count > 0 else 20

        # --- LLM-BASED GEO COMPARISON (if org has OpenAI key) ---
        geo_recommendation = ""
        if db:
            try:
                org_doc = db.collection("organizations").document(request.orgId).get()
                if org_doc.exists:
                    org_data = org_doc.to_dict() or {}
                    openai_key = org_data.get("apiKeys", {}).get("openai", os.getenv("OPENAI_API_KEY", ""))
                    if openai_key == "internal_platform_managed":
                        openai_key = os.getenv("OPENAI_API_KEY", "")
                    manifest_doc = db.collection("organizations").document(request.orgId).collection("manifests").document(request.manifestVersion or "latest").get()
                    manifest_content = ""
                    if manifest_doc.exists:
                        manifest_content = (manifest_doc.to_dict() or {}).get("content", "")[:2000]

                    if openai_key and manifest_content:
                        client = OpenAI(api_key=openai_key)
                        geo_prompt = f"""You are an AI SEO/GEO auditor. Compare the page content below against the organization's verified manifest.

Page Title: {title}
Page Body: {body_text[:1500]}
Existing JSON-LD blocks: {jsonld_count}

Org Manifest:
{manifest_content}

Rate GEO (Generative Engine Optimization) fidelity 0-100: how well would AI engines like ChatGPT, Perplexity, Gemini represent this company based only on this page?
Return JSON: {{"geo_score": 0-100, "recommendation": "one sentence improvement tip"}}"""
                        resp = client.chat.completions.create(
                            messages=[{"role": "user", "content": geo_prompt}],
                            model="gpt-4o-mini",
                            response_format={"type": "json_object"},
                            temperature=0
                        )
                        llm_result = json.loads(resp.choices[0].message.content)
                        geo_score = llm_result.get("geo_score", geo_score)
                        geo_recommendation = llm_result.get("recommendation", "")
            except Exception as e:
                logger.warning(f"LLM GEO scoring failed: {e}")

        overall = round((seo_score * 0.5) + (geo_score * 0.5))
        return {
            "url": request.url,
            "seoScore": seo_score,
            "geoScore": geo_score,
            "overallScore": overall,
            "checks": checks,
            "recommendation": geo_recommendation or (
                "Add JSON-LD structured data to dramatically improve AI engine visibility." if jsonld_count == 0
                else "Good foundation. Ensure your AUM manifest is deployed to /llms.txt for AI crawlers."
            ),
        }

    await FirestoreTaskQueue.run_persistent_task(request.orgId, "seoJobs", job_id, worker)


@router.post("/audit")
async def run_seo_audit(
    request: SEOAuditRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    uid = current_user.get("uid")
    if not verify_user_org_access(uid, request.orgId):
        raise HTTPException(status_code=403, detail="Unauthorized")

    request.url = _normalize_audit_url(request.url)

    # Entitlement Check: SEO Audits require Growth or Scale
    if db:
        org_doc = db.collection("organizations").document(request.orgId).get()
        if org_doc.exists:
            plan = org_doc.to_dict().get("subscription", {}).get("planId", "explorer")
            if plan not in ["growth", "scale", "enterprise"]:
                raise HTTPException(status_code=403, detail="SEO audit is available on Growth or Scale plans.")

    job_id = str(uuid.uuid4())
    FirestoreTaskQueue.register_job(request.orgId, "seoJobs", job_id, request.model_dump())

    background_tasks.add_task(_process_seo_audit, request, job_id)
    return {"status": "processing", "jobId": job_id, "message": "SEO Audit queued"}


@router.post("/audit/mock")
async def run_mock_seo_audit(request: SEOAuditRequest, auth: dict = Depends(get_current_user)):
    """Immediate mock response for demo@demo.com"""
    if settings.ENV != "development" or not getattr(settings, "ALLOW_MOCK_AUTH", False):
        raise HTTPException(status_code=404, detail="Mock SEO endpoint disabled")
    if request.orgId != "demo_org_id":
        raise HTTPException(status_code=403, detail="Mock endpoint only for demo org")
    
    return {"status": "completed", "jobId": "demo_job_123", "message": "Audit complete"}


@router.get("/audit/status/{org_id}/{job_id}")
async def get_seo_status(
    org_id: str,
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Returns the status of a scheduled background SEO job."""
    if not db:
        raise HTTPException(status_code=503, detail="Firestore not available")

    uid = current_user.get("uid")

    # 🛡️ DEMO MOCKING (P0): Deterministic SEO metrics for Sight Spectrum
    if org_id == "demo_org_id" and settings.ENV == "development" and getattr(settings, "ALLOW_MOCK_AUTH", False):
        return {
            "status": "completed",
            "jobId": job_id,
            "url": "https://www.sightspectrum.com",
            "seoScore": 82,
            "geoScore": 75,
            "overallScore": 78,
            "checks": [
                {"check": "Title Tag", "status": "pass", "detail": "Sight Spectrum | IT Services & Solutions"},
                {"check": "Meta Description", "status": "warn", "detail": "Meta description is slightly truncated on mobile."},
                {"check": "H1 Heading", "status": "pass", "detail": "Sight Spectrum"},
                {"check": "Schema.org JSON-LD", "status": "pass", "detail": "Valid SoftwareApplication schema found"},
                {"check": "AI Crawler Readiness", "status": "pass", "detail": "llms.txt detected and valid"}
            ],
            "recommendation": "Maintain your manifest at /llms.txt to ensure GPT-4o and Claude 4.5 Sonnet continue indexing your verified identity."
        }

    if not verify_user_org_access(uid, org_id):
        raise HTTPException(status_code=403, detail="Unauthorized access")

    try:
        job_doc = db.collection("organizations").document(org_id).collection("seoJobs").document(job_id).get()
        if not job_doc.exists:
            raise HTTPException(status_code=404, detail="SEO job not found")
        return job_doc.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch SEO job status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
