"""
ParkPulse AI — /api/offenders endpoints
Repeat vehicle offender watchlist.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.db_models import RepeatOffender

router = APIRouter()


@router.get("/")
async def list_offenders(
    min_citations: int = Query(3, ge=1),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RepeatOffender)
        .where(RepeatOffender.citation_count >= min_citations)
        .order_by(RepeatOffender.citation_count.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        {
            "vehicle_number": r.vehicle_number,
            "citation_count": r.citation_count,
            "police_stations": r.police_stations,
            "last_seen": r.last_seen,
        }
        for r in rows
    ]


@router.get("/stats")
async def offender_stats(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import func
    total = (await db.execute(select(func.count()).select_from(RepeatOffender))).scalar()
    heavy = (await db.execute(
        select(func.count()).select_from(RepeatOffender).where(RepeatOffender.citation_count >= 10)
    )).scalar()
    max_row = (await db.execute(
        select(RepeatOffender).order_by(RepeatOffender.citation_count.desc()).limit(1)
    )).scalar_one_or_none()

    return {
        "total_repeat_offenders": total or 0,
        "heavy_offenders_10plus": heavy or 0,
        "most_cited_vehicle": max_row.vehicle_number if max_row else None,
        "most_cited_count": max_row.citation_count if max_row else 0,
    }
