# backend/app/api/tenant_config.py
# FIX 5 (backend side): Serves per-hostname white-label configuration.
# Stored in Firestore: platform_config/tenant_configs/{hostname}
# Admin can update via the existing admin dashboard or directly in Firestore.
#
# Add to main.py: load_router("api.tenant_config", "/api", "Tenant Config")

from fastapi import APIRouter, Query
from core.firebase_config import db
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

_DEFAULT_CONFIG = {
    "brandName":    "AUM Context Foundry",
    "brandSlug":    "aum",
    "colorPrimary": "#4f46e5",
    "colorAccent":  "#06b6d4",
    "logoUrl":      "",
    "faviconUrl":   "/favicon.svg",
    "supportEmail": "hello@aumcontextfoundry.com",
    "hidePricing":  False,
}

@router.get("/tenant-config")
async def get_tenant_config(hostname: str = Query(..., min_length=3)):
    """
    Returns white-label brand config for a given hostname.
    Falls back to AUM defaults if no config exists.
    Cache-control: 5 minutes — clients should respect this.
    """
    # Sanitise hostname to use as Firestore document ID
    safe_key = hostname.lower().replace(".", "_").replace(":", "_")

    if db:
        try:
            doc = db.collection("platform_config").document("tenant_configs").collection("hosts").document(safe_key).get()
            if doc.exists:
                data = doc.to_dict() or {}
                return {**_DEFAULT_CONFIG, **data}
        except Exception as e:
            logger.warning(f"Tenant config fetch failed for {hostname}: {e}")

    return _DEFAULT_CONFIG
