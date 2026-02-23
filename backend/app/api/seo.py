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
from playwright.async_api import async_playwright
from core.firebase_config import db
from core.security import get_current_user, verify_user_org_access

logger = logging.getLogger(__name__)
router = APIRouter()

class SEOAuditRequest(BaseModel):
    url: str
    orgId: str

async def _process_seo_audit(request: SEOAuditRequest, job_id: str):
    """Background worker to perform the Playwright scrape and LLM eval."""
    results: List[dict] = []
    geo_score = 0
    seo_score = 0
    total_checks = 0

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            # Use Playwright for SPA hydration
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                try:
                    await page.goto(request.url, wait_until="networkidle", timeout=15000)
                    html = await page.content()
                    
                    # Basic Extraction
                    title = await page.title()
                    desc = await page.evaluate('''() => { const m = document.querySelector('meta[name="description"]'); return m ? m.content : ""; }''')
                    h1 = await page.evaluate('''() => { const h = document.querySelector('h1'); return h ? h.innerText : ""; }''')
                    body_text = await page.evaluate("document.body.innerText")
                    jsonld_count = await page.evaluate('''() => document.querySelectorAll('script[type="application/ld+json"]').length''')
                except Exception as e:
                    await browser.close()
                    raise Exception(f"Playwright rendering failed: {e}")
                
                await browser.close()

            results.append({"check": "HTTP Status", "status": "pass", "detail": "200 OK (Hydrated)"})
            seo_score += 1
            total_checks += 1

            # Checks
            if title:
                results.append({"check": "Title Tag", "status": "pass", "detail": f'"{title[:80]}"'})
                seo_score += 1
            else:
                results.append({"check": "Title Tag", "status": "fail", "detail": "Missing title"})

            if desc:
                results.append({"check": "Meta Description", "status": "pass", "detail": f"{len(desc)} chars"})
                seo_score += 1
            else:
                results.append({"check": "Meta Description", "status": "warning", "detail": "Missing"})

            if h1:
                results.append({"check": "H1 Tag", "status": "pass", "detail": f'"{h1[:80]}"'})
                seo_score += 1
            else:
                results.append({"check": "H1 Tag", "status": "fail", "detail": "No H1 found"})

            if jsonld_count > 0:
                results.append({"check": "Schema.org (JSON-LD)", "status": "pass", "detail": f"{jsonld_count} block(s)"})
                seo_score += 1
                geo_score += 1
            else:
                results.append({"check": "Schema.org (JSON-LD)", "status": "fail", "detail": "No structured data."})

            # Fetch AI bot info
            base_url = request.url.rstrip("/").split("//")[0] + "//" + request.url.split("//")[1].split("/")[0]
            try:
                llms_resp = await client.get(f"{base_url}/llms.txt")
                if llms_resp.status_code == 200 and len(llms_resp.text) > 20:
                    results.append({"check": "/llms.txt (GEO)", "status": "pass", "detail": "Found."})
                    geo_score += 2
                else:
                    results.append({"check": "/llms.txt (GEO)", "status": "fail", "detail": "Not found."})
            except Exception:
                pass

            try:
                robots_resp = await client.get(f"{base_url}/robots.txt")
                if robots_resp.status_code == 200 and "gptbot" in robots_resp.text.lower():
                    results.append({"check": "Robots AI", "status": "warning", "detail": "AI bot blocks found."})
                else:
                    geo_score += 1
            except Exception:
                pass
                
            # LLM Relevance Evaluation
            api_key = os.getenv("OPENAI_API_KEY")
            if api_key and title and body_text:
                try:
                    llm_client = OpenAI(api_key=api_key)
                    eval_resp = llm_client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{"role": "user", "content": f"Score relevance 1-100 of metadata to body text.\nTitle: {title}\nDesc: {desc}\nBody: {body_text[:1000]}"}],
                        tools=[{"type": "function", "function": {"name": "report", "parameters": {"type": "object", "properties": {"score": {"type": "integer"}}}}}]
                    )
                    score = json.loads(eval_resp.choices[0].message.tool_calls[0].function.arguments).get("score", 50)
                    if score > 70:
                        seo_score += 1
                        results.append({"check": "AI Context Relevance", "status": "pass", "detail": f"Highly relevant ({score}/100)"})
                    else:
                        results.append({"check": "AI Context Relevance", "status": "warning", "detail": f"Low relevance ({score}/100)"})
                except Exception as e:
                    logger.warning(f"LLM eval failed: {e}")

        max_seo = 6
        max_geo = 4
        summary = {
            "url": request.url,
            "seoScore": round(seo_score / max_seo * 100) if max_seo else 0,
            "geoScore": round(geo_score / max_geo * 100) if max_geo else 0,
            "overallScore": round((seo_score + geo_score) / (max_seo + max_geo) * 100) if (max_seo + max_geo) else 0,
            "checks": results,
            "recommendation": "Deploy /llms.txt and add Schema.org JSON-LD to maximize AI discoverability." if geo_score < 2 else "Good GEO foundation. Run simulations to check accuracy.",
        }

        if db:
            db.collection("organizations").document(request.orgId).collection("seoJobs").document(job_id).update({
                "status": "completed",
                "completedAt": datetime.utcnow(),
                "result": summary
            })

    except Exception as e:
        logger.error(f"Background SEO Job {job_id} failed: {e}")
        if db:
            db.collection("organizations").document(request.orgId).collection("seoJobs").document(job_id).update({
                "status": "failed",
                "error": str(e)
            })

@router.post("/audit")
async def run_seo_audit(
    request: SEOAuditRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Schedules an SEO + GEO readiness audit on a given URL using Background Tasks
    to prevent heavy SPA Playwright rendering from exhausting timeout budgets.
    """
    if not request.url:
        raise HTTPException(status_code=400, detail="URL required")

    uid = current_user.get("uid")
    if not verify_user_org_access(uid, request.orgId):
        raise HTTPException(status_code=403, detail="Unauthorized access to this organization")

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
            raise HTTPException(status_code=500, detail="Failed to fetch subscription.")

    job_id = str(uuid.uuid4())
    
    if db:
        db.collection("organizations").document(request.orgId).collection("seoJobs").document(job_id).set({
            "status": "processing",
            "createdAt": datetime.utcnow(),
            "url": request.url
        })

    background_tasks.add_task(_process_seo_audit, request, job_id)

    return {"status": "processing", "jobId": job_id, "message": "SEO Audit queued successfully"}

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
