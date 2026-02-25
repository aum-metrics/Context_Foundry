"""
Author: "Sambath Kumar Natarajan"
Date: "26-Dec-2025"
Org: " Start-up/AUM Data Labs"
Product: "Context Foundry"
Description: AUM Analytics API - Main Application Entry Point
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from core.config import settings
from fastapi.responses import JSONResponse
import logging
import sys
import os
from pathlib import Path
from logging.handlers import RotatingFileHandler
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# Force UTF-8 encoding
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# Ensure ./app is in path
app_path = str(Path(__file__).parent)
if app_path not in sys.path:
    sys.path.insert(0, app_path)

# ============================================================================
# LOGGING SETUP
# ============================================================================
from core.logging_config import setup_logging
setup_logging()
logger = logging.getLogger("AUM-API")
logger.info("🚀 Initializing AUM Analytics API...")

# ============================================================================
# CREATE FASTAPI APP
# ============================================================================

app = FastAPI(
    title=settings.APP_NAME,
    description="Contextual Rigor & Generative Engine Optimization (GEO) Infrastructure",
    version="2.2.0-hardened",
    docs_url="/api/docs" if settings.ENV != "production" else None,
    redoc_url="/api/redoc" if settings.ENV != "production" else None,
)

logger.info("✅ FastAPI app created")

# ============================================================================
# RATE LIMITING
# ============================================================================

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
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

# ============================================================================
# ROUTER LOADER
# ============================================================================

def load_router(module_path: str, prefix: str, tag: str) -> bool:
    """Safely load a router module"""
    try:
        # Import the module
        parts = module_path.split('.')
        module = __import__(module_path, fromlist=[parts[-1]])
        
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

load_router("api.auth", "/api/auth", "Authentication")

# ============================================================================
# CORE CONTEXT FOUNDRY ENGINES
# ============================================================================
load_router("api.simulation", "/api/simulation", "LCRS Simulation Engine")
load_router("api.ingestion", "/api/ingestion", "GEO Semantic Ingestion")
load_router("api.batch_analysis", "/api/batch", "Batch Evaluation")

# ============================================================================
# TENANT MANAGEMENT & CONFIG
# ============================================================================
load_router("api.api_keys", "/api/keys", "API Keys")
load_router("api.workspaces", "/api/workspaces", "Workspaces")
load_router("api.sso", "/api/sso", "Enterprise SSO")

# ============================================================================
# PAYMENTS, CHATBOT & SEO
# ============================================================================
load_router("api.payments", "/api/payments", "Razorpay Payments")
load_router("api.chatbot", "/api/chatbot", "RAG Support Chatbot")
load_router("api.seo", "/api/seo", "SEO/GEO Audit")


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
            # Performs a lightweight read to verify connectivity
            db.collection("health_check").document("ping").get()
            firestore_status = "connected"
        else:
            firestore_status = "unavailable"
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
# LIFECYCLE EVENTS
# ============================================================================

@app.on_event("startup")
async def on_startup():
    """Application startup"""
    logger.info("\n" + "="*60)
    logger.info("🚀 AUM ANALYTICS API STARTUP - v2.2.0-hardened")
    logger.info("="*60)
    
    # Check Required Environment Variables
    required_secrets = [
        "OPENAI_API_KEY",
        "GEMINI_API_KEY",
        "ANTHROPIC_API_KEY",
        "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET"
    ]
    missing = [s for s in required_secrets if not os.getenv(s)]
    if missing:
        if os.getenv("ENV", "development") == "production":
            logger.critical(f"❌ MISSING MISSION-CRITICAL SECRETS IN PRODUCTION: {', '.join(missing)}")
            logger.critical("🛑 APPLICATION SHUTDOWN INITIATED — cannot run prod without all keys.")
            import sys
            sys.exit(1)
        else:
            logger.warning(f"⚠️  Missing secrets (degraded mode): {', '.join(missing)}")
            logger.warning("⚠️  Endpoints requiring these keys will return HTTP 503 instead of crashing.")
    
    # Check environment
    from core.config import settings
    logger.info(f"Environment: {settings.ENV}")
    logger.info(f"Debug: {settings.DEBUG}")
    logger.info(f"JWT Configured: {bool(settings.JWT_SECRET)}")
    logger.info(f"Supabase Configured: {bool(settings.SUPABASE_URL)}")
    
    logger.info("\n✅ API Ready on http://0.0.0.0:8000")
    logger.info("📖 Docs on http://0.0.0.0:8000/api/docs")
    logger.info("="*60 + "\n")


@app.on_event("shutdown")
async def on_shutdown():
    """Application shutdown"""
    logger.info("🛑 Shutting down AUM Analytics API...")

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