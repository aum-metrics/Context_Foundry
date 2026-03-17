"""
Author: "Sambath Kumar Natarajan"
Date: "26-Dec-2025"
Org: " Start-up/AUM Context Foundry"
Product: "AUM Context Foundry"
Description: AUM Analytics API - Main Application Entry Point
"""

# Ensure ./app is in path (Must happen before imports from app subdirectories)
from pathlib import Path
import sys
app_path = str(Path(__file__).parent)
if app_path not in sys.path:
    sys.path.insert(0, app_path)

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from core.config import settings
from fastapi.responses import JSONResponse
import logging
import os
import asyncio
from logging.handlers import RotatingFileHandler
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# ============================================================================
# LOGGING SETUP
# ============================================================================
from core.logging_config import setup_logging
setup_logging()
logger = logging.getLogger("AUM-API")
logger.info("🚀 Initializing AUM Analytics API...")

# ============================================================================
# APP LIFESPAN
# ============================================================================
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events (Startup and Shutdown)"""
    from core.firebase_config import initialize_firebase
    initialize_firebase()
    
    logger.info("\n" + "="*60)
    logger.info("🚀 AUM ANALYTICS API STARTUP - v2.2.0-hardened")
    logger.info("="*60)
    
    # Check Required Environment Variables & Security Secrets
    required_env = [
        "OPENAI_API_KEY",
        "GEMINI_API_KEY",
        "ANTHROPIC_API_KEY",
        "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET",
        "JWT_SECRET",
        "SSO_ENCRYPTION_KEY",
        "SSO_JWT_SECRET"
    ]
    missing = [s for s in required_env if not os.getenv(s)]
    
    # Check for default secrets in production
    default_secrets = []
    if settings.ENV == "production":
        if settings.JWT_SECRET == "your-secret-key-change-in-production":
            default_secrets.append("JWT_SECRET")
        if settings.SSO_ENCRYPTION_KEY == "aum-sso-encryption-dev-fallback1":
            default_secrets.append("SSO_ENCRYPTION_KEY")
        if settings.SSO_JWT_SECRET == "aum-sso-jwt-intent-dev-fallback1":
            default_secrets.append("SSO_JWT_SECRET")

    if (missing or default_secrets) and settings.ENV == "production":
        if missing:
            logger.critical(f"❌ MISSING MISSION-CRITICAL SECRETS IN PRODUCTION: {', '.join(missing)}")
        if default_secrets:
            logger.critical(f"🚨 CRITICAL SECURITY ALERT: Default secrets detected in production: {', '.join(default_secrets)}")
        
        logger.critical("🛑 APPLICATION SHUTDOWN INITIATED — cannot run prod without all keys and hardened secrets.")
        sys.exit(1)
    elif missing:
        logger.warning(f"⚠️  Missing secrets (degraded mode): {', '.join(missing)}")
        logger.warning("⚠️  Endpoints requiring these keys will return HTTP 503 instead of crashing.")
    
    # Check environment
    logger.info(f"Environment: {settings.ENV}")
    logger.info(f"Debug: {settings.DEBUG}")
    logger.info(f"JWT Configured: {bool(settings.JWT_SECRET)}")
    logger.info(f"Supabase Configured: {bool(settings.SUPABASE_URL)}")
    
    logger.info("\n✅ API Ready on http://0.0.0.0:8000")
    logger.info("📖 Docs on http://0.0.0.0:8000/api/docs")
    
    # Initialize Periodic Background Poller for Stalled Jobs
    logger.info("⚙️ Initializing Periodic Job Recovery Poller (5m interval)")
    # _periodic_job_recovery is defined further down, but will be mapped at runtime
    task = asyncio.create_task(_periodic_job_recovery())
    logger.info("="*60 + "\n")
    
    yield # App runs here
    
    logger.info("🛑 Shutting down AUM Analytics API...")
    task.cancel()

# ============================================================================
# CREATE FASTAPI APP
# ============================================================================

app = FastAPI(
    title=settings.APP_NAME,
    description="Contextual Rigor & AI Search Readiness Infrastructure",
    version="2.7.0-definitive",
    docs_url="/api/docs" if settings.ENV != "production" else None,
    redoc_url="/api/redoc" if settings.ENV != "production" else None,
    lifespan=lifespan,
)

logger.info("✅ FastAPI app created")

# ============================================================================
# RATE LIMITING
# ============================================================================

from core.limiter import limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

logger.info("✅ Global Rate Limiter configured (100/min)")

# Security Middleware
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=settings.TRUSTED_HOSTS
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"]
)

logger.info("✅ Security middleware (CORS & TrustedHost) configured")

# ============================================================================
# GLOBAL EXCEPTION HANDLER
# ============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions with production safety."""
    logger.error(f"❌ Unhandled exception: {type(exc).__name__}: {exc}", exc_info=True)
    
    # Hide internal details in production
    if settings.ENV == "production":
        return JSONResponse(
            status_code=500,
            content={
                "detail": "An internal server error occurred. Our engineers have been notified.",
                "type": "InternalServerError"
            }
        )
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc),
            "type": type(exc).__name__
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Ensure HTTP errors always return JSON."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "type": "HTTPException",
        },
    )

# ============================================================================
# ROUTER LOADER
# ============================================================================

def load_router(module_path: str, prefix: str, tag: str) -> bool:
    """Safely load a router module"""
    logger.info(f"⏳ Attempting to import {module_path}...")
    import sys
    sys.stdout.flush()
    try:
        # Import the module
        parts = module_path.split('.')
        module = __import__(module_path, fromlist=[parts[-1]])
        logger.info(f"⚡ Imported {module_path} successfully. Checking for router...")
        sys.stdout.flush()
        
        # Check for router
        if not hasattr(module, 'router'):
            logger.error(f"❌ No 'router' found in {module_path}")
            return False
        
        # Include router
        app.include_router(module.router, prefix=prefix, tags=[tag])
        logger.info(f"✅ Loaded {tag:30s} -> {prefix}")
        return True
        
    except ImportError as e:
        logger.warning(f"⚠️  Could not import {module_path}: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Failed to load {tag}: {e}")
        return False

# ============================================================================
# LOAD ROUTERS
# ============================================================================

logger.info("\n📡 Loading API routes...")

# load_router("api.auth", "/api/auth", "Authentication") - Deprecated in favor of Firebase Auth

# ============================================================================
# CORE CONTEXT FOUNDRY ENGINES
# ============================================================================
load_router("api.simulation", "/api/simulation", "Visibility Simulation Engine")
load_router("api.ingestion", "/api/ingestion", "Semantic Ingestion")
load_router("api.quick_scan", "/api", "Quick Scan")
load_router("api.batch_analysis", "/api/batch", "Batch Evaluation")

# ============================================================================
# TENANT MANAGEMENT & CONFIG
# ============================================================================
load_router("api.api_keys", "/api/keys", "API Keys")
load_router("api.workspaces", "/api/workspaces", "Workspaces")
load_router("api.sso", "/api/sso", "Enterprise SSO")
load_router("api.tenant_config", "/api", "Tenant Config")

# ============================================================================
# PAYMENTS, CHATBOT & SEO
# ============================================================================
load_router("api.payments", "/api/payments", "Razorpay Payments")
load_router("api.chatbot", "/api/chatbot", "RAG Support Chatbot")
load_router("api.seo", "/api/seo", "SEO/AI Search Readiness Audit")
load_router("api.audit", "/api/audit", "SOC2 Audit Logs")
load_router("api.competitor", "/api/competitor", "Competitor Monitoring")
load_router("api.methods", "/api/methods", "Scoring Methodology")
load_router("api.cron", "/api/cron", "Internal Cron Jobs")
load_router("api.data_management", "/api/cron", "Data Management")

# ============================================================================
# ADMIN DASHBOARD API (Admin SDK — bypasses Firestore client rules)
# ============================================================================
load_router("api.admin", "/api/admin", "Admin Dashboard")


logger.info("📡 Route loading complete\n")

# ============================================================================
# ROOT ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "AUM Analytics API",
        "version": "2.2.0-hardened",
        "status": "operational",
        "docs": "/api/docs",
        "health": "/api/health"
    }


@app.get("/api/health")
async def health_check():
    """Service health status with dependency validation"""
    firestore_status = "unconfigured"
    try:
        from core.firebase_config import db
        if db:
            # Performs a lightweight read to verify connectivity (wrapped in thread to prevent blocking event loop)
            # We use a timeout to ensure the health check doesn't hang indefinitely
            await asyncio.wait_for(
                asyncio.to_thread(db.collection("health_check").document("ping").get),
                timeout=3.0
            )
            firestore_status = "connected"
        else:
            firestore_status = "unavailable"
    except asyncio.TimeoutError:
        logger.error("Health check: Firestore ping timed out")
        firestore_status = "timeout"
    except Exception as e:
        logger.error(f"Health check: Firestore unreachable: {e}")
        firestore_status = "disconnected"

    status = "healthy" if firestore_status == "connected" else "degraded"
    
    return {
        "status": status,
        "service": "aum-api",
        "version": "2.2.0-hardened",
        "dependencies": {
            "firestore": firestore_status
        }
    }

# ============================================================================
# BACKGROUND WORKERS
# ============================================================================


async def _periodic_job_recovery():
    """Perpetual background loop that sweeps for stalled jobs every 5 minutes."""
    from utils.task_queue_recovery import TaskQueueRecovery
    while True:
        try:
            # Wait 5 minutes before the next sweep
            await asyncio.sleep(300) 
            stats = await TaskQueueRecovery.sweep_stalled_jobs()
            if stats.get("stalled", 0) > 0 or stats.get("retried", 0) > 0:
                logger.info(f"♻️ Periodic Recovery: Found {stats['stalled']} stalled. Retried: {stats['retried']}. DLQ: {stats.get('failed_permanent', 0)}.")
        except asyncio.CancelledError:
            logger.info("🛑 Periodic Job Recovery Poller stopped.")
            break
        except Exception as e:
            logger.error(f"⚠️ Periodic Task Recovery failed: {e}")



# ============================================================================
# RUN LOCALLY
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
