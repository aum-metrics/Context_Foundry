"""
Author: "Sambath Kumar Natarajan"
Date: "26-Dec-2025"
Org: " Start-up/AUM Data Labs"
Product: "Context Foundry"
Description: SEO Integration & Audit Endpoint — basic meta + schema.org checks for GEO+SEO convergence
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import httpx
import re
import logging
from core.firebase_config import db

logger = logging.getLogger(__name__)
router = APIRouter()


class SEOAuditRequest(BaseModel):
    url: str
    orgId: str


class SEOCheckResult(BaseModel):
    check: str
    status: str  # pass, fail, warning
    detail: str


@router.post("/audit")
async def run_seo_audit(request: SEOAuditRequest):
    """
    Runs a basic SEO + GEO readiness audit on a given URL.
    Checks: title, meta description, h1, schema.org, /llms.txt, robots.txt AI directives.
    """
    if not request.url:
        raise HTTPException(status_code=400, detail="URL required")

    # Enforce Plan Limits
    if db:
        try:
            org_doc = db.collection("organizations").document(request.orgId).get()
            if org_doc.exists:
                org_plan = org_doc.to_dict().get("subscription", {}).get("planId", "starter")
                if org_plan == "starter":
                    raise HTTPException(status_code=403, detail="SEO & GEO Readiness Audits require a Growth or Enterprise plan.")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to fetch org plan for SEO audit: {e}")

    results: List[dict] = []
    geo_score = 0
    seo_score = 0
    total_checks = 0

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(request.url)
            html = resp.text
            status_code = resp.status_code

            if status_code != 200:
                results.append({"check": "HTTP Status", "status": "fail", "detail": f"Got {status_code}"})
            else:
                results.append({"check": "HTTP Status", "status": "pass", "detail": "200 OK"})
                seo_score += 1
            total_checks += 1

            # Title tag
            title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
            if title_match and title_match.group(1).strip():
                title = title_match.group(1).strip()
                results.append({"check": "Title Tag", "status": "pass", "detail": f'"{title[:80]}"'})
                seo_score += 1
            else:
                results.append({"check": "Title Tag", "status": "fail", "detail": "Missing or empty title tag"})
            total_checks += 1

            # Meta description
            meta_desc = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', html, re.IGNORECASE)
            if meta_desc and meta_desc.group(1).strip():
                desc = meta_desc.group(1).strip()
                if len(desc) < 50:
                    results.append({"check": "Meta Description", "status": "warning", "detail": f"Too short ({len(desc)} chars). Aim for 120-160."})
                else:
                    results.append({"check": "Meta Description", "status": "pass", "detail": f"{len(desc)} chars"})
                    seo_score += 1
            else:
                results.append({"check": "Meta Description", "status": "fail", "detail": "Missing meta description"})
            total_checks += 1

            # H1 tag
            h1_match = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.IGNORECASE | re.DOTALL)
            if h1_match:
                results.append({"check": "H1 Tag", "status": "pass", "detail": f'"{h1_match.group(1).strip()[:80]}"'})
                seo_score += 1
            else:
                results.append({"check": "H1 Tag", "status": "fail", "detail": "No H1 found"})
            total_checks += 1

            # Schema.org / JSON-LD
            jsonld = re.findall(r'<script\s+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.IGNORECASE | re.DOTALL)
            if jsonld:
                results.append({"check": "Schema.org (JSON-LD)", "status": "pass", "detail": f"{len(jsonld)} structured data block(s) found"})
                seo_score += 1
                geo_score += 1
            else:
                results.append({"check": "Schema.org (JSON-LD)", "status": "fail", "detail": "No structured data. AI models rely heavily on this."})
            total_checks += 1

            # Check for /llms.txt
            base_url = request.url.rstrip("/").split("//")[0] + "//" + request.url.split("//")[1].split("/")[0]
            try:
                llms_resp = await client.get(f"{base_url}/llms.txt")
                if llms_resp.status_code == 200 and len(llms_resp.text) > 20:
                    results.append({"check": "/llms.txt (GEO)", "status": "pass", "detail": f"Found ({len(llms_resp.text)} bytes). AI agents can discover your brand."})
                    geo_score += 2  # Worth more
                else:
                    results.append({"check": "/llms.txt (GEO)", "status": "fail", "detail": "Not found. Deploy via AUM Agent Manifest to let AI agents discover you."})
            except Exception:
                results.append({"check": "/llms.txt (GEO)", "status": "fail", "detail": "Not reachable"})
            total_checks += 1

            # Check robots.txt for AI bot directives
            try:
                robots_resp = await client.get(f"{base_url}/robots.txt")
                if robots_resp.status_code == 200:
                    robots_text = robots_resp.text.lower()
                    ai_blocked = any(bot in robots_text for bot in ["gptbot", "chatgpt", "claudebot", "googleother", "anthropic"])
                    if ai_blocked:
                        results.append({"check": "Robots.txt AI Access", "status": "warning", "detail": "AI bot directives found. Some AI crawlers may be blocked."})
                    else:
                        results.append({"check": "Robots.txt AI Access", "status": "pass", "detail": "No AI bot blocks detected"})
                        geo_score += 1
                else:
                    results.append({"check": "Robots.txt AI Access", "status": "warning", "detail": "No robots.txt found"})
            except Exception:
                results.append({"check": "Robots.txt AI Access", "status": "warning", "detail": "Could not check"})
            total_checks += 1

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail=f"Timeout fetching {request.url}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit failed: {e}")

    max_seo = 5
    max_geo = 4
    return {
        "url": request.url,
        "seoScore": round(seo_score / max_seo * 100),
        "geoScore": round(geo_score / max_geo * 100),
        "overallScore": round((seo_score + geo_score) / (max_seo + max_geo) * 100),
        "checks": results,
        "recommendation": "Deploy /llms.txt and add Schema.org JSON-LD to maximize AI discoverability." if geo_score < 2 else "Good GEO foundation. Run simulations to check accuracy.",
    }
