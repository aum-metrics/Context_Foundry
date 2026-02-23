"""
Author: "Sambath Kumar Natarajan"
Date: "26-Dec-2025"
Org: " Start-up/AUM Data Labs"
Product: "Context Foundry"
Description: AUM Analytics API - Main Application Entry Point
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import sys
import os
from pathlib import Path
from logging.handlers import RotatingFileHandler

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

log_format = "%(asctime)s | %(name)s | %(levelname)s | %(message)s"

logging.basicConfig(
    level=logging.INFO,
    format=log_format,
    handlers=[
        logging.StreamHandler(sys.stdout),
        RotatingFileHandler(
            "app.log",
            maxBytes=1024 * 1024,
            backupCount=2,
            encoding='utf-8'
        )
    ]
)

logger = logging.getLogger("AUM-API")
logger.info("🚀 Initializing AUM Analytics API...")

# ============================================================================
# CREATE FASTAPI APP
# ============================================================================

app = FastAPI(
    title="AUM Analytics API",
    description="Intelligent data analytics platform with business intelligence",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

logger.info("✅ FastAPI app created")

# ============================================================================
# CORS CONFIGURATION
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "https://aumdatalabs.com",
        "https://www.aumdatalabs.com",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

logger.info("✅ CORS middleware configured")

# ============================================================================
# GLOBAL EXCEPTION HANDLER
# ============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions"""
    logger.error(f"❌ Unhandled exception: {type(exc).__name__}: {exc}", exc_info=True)
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
load_router("api.query", "/api/query", "Query Engine")
load_router("api.webhooks", "/api/webhooks", "Webhooks")
load_router("api.collaboration", "/api/collaboration", "Collaboration")
load_router("api.connectors", "/api/connectors", "Data Connectors")
load_router("api.api_keys", "/api/keys", "API Keys")
load_router("api.statistics", "/api/statistics", "Statistics")
load_router("api.export", "/api/export", "Export")
load_router("api.realtime", "/api/realtime", "Real-Time")
load_router("api.workspaces", "/api/workspaces", "Workspaces")
load_router("api.sso", "/api/sso", "Enterprise SSO")

logger.info("📡 Route loading complete\n")

# ============================================================================
# ROOT ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "AUM Analytics API",
        "version": "2.0.0",
        "status": "operational",
        "docs": "/api/docs",
        "health": "/api/health"
    }


@app.get("/api/health")
async def health_check():
    """Service health status"""
    return {
        "status": "healthy",
        "service": "aum-api",
        "version": "2.0.0"
    }

# ============================================================================
# LIFECYCLE EVENTS
# ============================================================================

@app.on_event("startup")
async def on_startup():
    """Application startup"""
    logger.info("\n" + "="*60)
    logger.info("🚀 AUM ANALYTICS API STARTUP")
    logger.info("="*60)
    
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