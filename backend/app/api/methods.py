"""
Author: "Sambath Kumar Natarajan"
Date: "02-Mar-2026"
Org: "Start-up/AUM Data Labs"
Product: "Context Foundry"
Description: Public Transparency API - Methodology and Math for LCRS Scoring.
"""

from fastapi import APIRouter
from typing import Dict, Any

router = APIRouter()

@router.get("/")
async def get_methodology():
    """
    Returns the formal methodology for the Latent Contextual Rigor Score (LCRS).
    Ensures transparency and auditability for enterprise customers.
    """
    return {
        "score_name": "Latent Contextual Rigor Score (LCRS)",
        "acronym": "LCRS",
        "version": "1.2.0",
        "philosophy": "Transition from proprietary magic to auditable science by combining geometric distance and deterministic claim verification.",
        "formula": "LCRS = (0.4 * (1 - Dc)) + (0.6 * (Cs / Ct))",
        "variables": {
            "Dc": {
                "name": "Cosine Distance",
                "description": "Geometric distance between the organization's verified context vector and the AI's generated response vector.",
                "weight": 0.4
            },
            "Cs": {
                "name": "Supported Claims",
                "description": "Count of deterministic factual claims found in the source manifest that were accurately reflected in the AI output (evaluated at temperature=0).",
                "weight": 0.6
            },
            "Ct": {
                "name": "Total Verifiable Claims",
                "description": "The total number of unique verifiable claims extracted from the source manifest for the specific query.",
                "weight": "Denominator"
            }
        },
        "standards": [
            "ISO/IEC 42001 (AI Management System) Alignment",
            "NIST AI Risk Management Framework (RMF) Compatible",
            "Zero-Retention Privacy Compliance"
        ]
    }
