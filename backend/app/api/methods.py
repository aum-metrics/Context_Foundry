"""
Author: "Sambath Kumar Natarajan"
Date: "02-Mar-2026"
Org: "Start-up/AUM Context Foundry"
Product: "AUM Context Foundry"
Description: Public Transparency API - Methodology and Math for Visibility Scoring.
"""

from fastapi import APIRouter
from typing import Dict, Any
from core.firebase_config import db
from core.model_config import (
    OPENAI_SIMULATION_MODEL,
    GEMINI_SIMULATION_MODEL,
    CLAUDE_SIMULATION_MODEL,
    MODEL_DISPLAY_NAMES,
    API_MODEL_MAPPING,
    get_runtime_model_catalog,
)

router = APIRouter()


def _default_model_catalog():
    return [
        {
            "provider": "openai",
            "displayName": MODEL_DISPLAY_NAMES.get(OPENAI_SIMULATION_MODEL, "GPT-4o"),
            "productLabel": OPENAI_SIMULATION_MODEL,
            "apiModelId": API_MODEL_MAPPING.get(OPENAI_SIMULATION_MODEL, OPENAI_SIMULATION_MODEL),
            "enabled": True,
            "order": 1,
        },
        {
            "provider": "gemini",
            "displayName": MODEL_DISPLAY_NAMES.get(GEMINI_SIMULATION_MODEL, "Gemini 3 Flash"),
            "productLabel": GEMINI_SIMULATION_MODEL,
            "apiModelId": API_MODEL_MAPPING.get(GEMINI_SIMULATION_MODEL, GEMINI_SIMULATION_MODEL),
            "enabled": True,
            "order": 2,
        },
        {
            "provider": "anthropic",
            "displayName": MODEL_DISPLAY_NAMES.get(CLAUDE_SIMULATION_MODEL, "Claude 4.5 Sonnet"),
            "productLabel": CLAUDE_SIMULATION_MODEL,
            "apiModelId": API_MODEL_MAPPING.get(CLAUDE_SIMULATION_MODEL, CLAUDE_SIMULATION_MODEL),
            "enabled": True,
            "order": 3,
        },
    ]

@router.get("/")
async def get_methodology():
    """
    Returns the formal methodology for the Visibility Score.
    Ensures transparency and auditability for enterprise customers.
    """
    return {
        "score_name": "Visibility Score",
        "acronym": "VS",
        "version": "1.2.0",
        "philosophy": "An auditable engineering heuristic that blends semantic alignment with deterministic claim verification.",
        "formula": "Visibility Score = (0.4 * (1 - Dc)) + (0.6 * (Cs / Ct))",
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
            "Deterministic scoring for auditability",
            "Zero-retention ingestion pipeline",
            "Explicit prompt + model traceability"
        ]
    }


@router.get("/model-catalog")
async def get_model_catalog():
    return get_runtime_model_catalog()
