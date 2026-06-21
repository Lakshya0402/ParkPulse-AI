"""
ParkPulse AI — /api/planner endpoint
Returns AI-generated patrol deployment plan.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.db_models import Hotspot
from app.services.planner import build_patrol_plan

router = APIRouter()


@router.get("/plan")
async def get_plan(
    officers: int = Query(20, ge=1, le=200, description="Total officers available"),
    top_n: int = Query(10, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
):
    """Return ranked enforcement patrol plan for today."""
    result = await db.execute(
        select(Hotspot)
        .where(Hotspot.pci_score != None)
        .order_by(Hotspot.pci_score.desc())
        .limit(top_n * 3)  # over-fetch so planner can score properly
    )
    hotspots = result.scalars().all()
    plan = build_patrol_plan(hotspots, officer_count=officers, top_n=top_n)
    return {
        "total_officers": officers,
        "zones_covered": len(plan),
        "plan": [z.model_dump() for z in plan],
    }
