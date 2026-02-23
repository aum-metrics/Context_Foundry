# backend/app/api/storytelling.py
# Author: Sambath Kumar Natarajan
# Company: AUM Data Labs
# Purpose of this code: AI-powered data storytelling generation.

from fastapi import APIRouter
from pydantic import BaseModel
from services.storytelling import DataStoryteller

router = APIRouter()
storyteller = DataStoryteller()

class StoryRequest(BaseModel):
    domain: str
    insights: list
    data_summary: dict

@router.post("/storytelling/generate-story")
async def generate_story(req: StoryRequest):
    story = storyteller.generate_complete_story(
        domain=req.domain,
        insights=req.insights,
        data_summary=req.data_summary
    )
    
    return {
        "success": True,
        "story": story,
        "insights_used": req.insights
    }
