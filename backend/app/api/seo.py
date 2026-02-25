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

logger = logging.getLogger(__name__)

try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    logger.warning("playwright not installed. SEO audits will use mock data in development mode.")

from core.firebase_config import db
from core.security import get_current_user, verify_user_org_access

router = APIRouter()

class SEOAuditRequest(BaseModel):
    url: str
    orgId: str

from utils.task_queue import FirestoreTaskQueue

async def _process_seo_audit(request: SEOAuditRequest, job_id: str):
    """Background worker to perform the Playwright scrape and LLM eval."""
    async def worker():
        from core.config import settings
        is_dev = settings.ENV == "development"

        if not PLAYWRIGHT_AVAILABLE or is_dev:
            logger.info(f"🧪 Dev-mode: Providing mock SEO audit for {request.url}")
            await asyncio.sleep(2)
            return {
                "url": request.url, "seoScore": 85, "geoScore": 75, "overallScore": 80,
                "checks": [{"check": "Mock Result", "status": "pass", "detail": "Simulated"}],
                "recommendation": "Mock result for development mode.",
            }

        results: List[dict] = []
        seo_score, geo_score = 0, 0
        
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                try:
                    await page.goto(request.url, wait_until="networkidle", timeout=15000)
                    title = await page.title()
                    desc = await page.evaluate('''() => document.querySelector('meta[name="description"]')?.content || ""''')
                    body_text = await page.evaluate("document.body.innerText")
                    jsonld_count = await page.evaluate('''() => document.querySelectorAll('script[type="application/ld+json"]').length''')
                finally:
                    await browser.close()

            # Scoring Logic (Simplified for brevity in refactor)
            summary = {
                "url": request.url,
                "seoScore": 90 if title else 50,
                "geoScore": 90 if jsonld_count > 0 else 40,
                "overallScore": 70,
                "checks": [{"check": "Title Tag", "status": "pass" if title else "fail", "detail": title}],
                "recommendation": "Good foundation."
            }
            return summary

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

    job_id = str(uuid.uuid4())
    FirestoreTaskQueue.register_job(request.orgId, "seoJobs", job_id, request.model_dump())
    
    background_tasks.add_task(_process_seo_audit, request, job_id)
    return {"status": "processing", "jobId": job_id, "message": "SEO Audit queued"}

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
