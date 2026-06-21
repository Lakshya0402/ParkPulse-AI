"""
ParkPulse AI — /api/coverage endpoints
Shows camera/device active-hour coverage across the city.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.db_models import CoverageGap

router = APIRouter()


@router.get("/gaps")
async def coverage_gaps(db: AsyncSession = Depends(get_db)):
    """Return per-device coverage ranges."""
    result = await db.execute(
        select(CoverageGap).order_by(CoverageGap.total_records.desc()).limit(200)
    )
    gaps = result.scalars().all()
    return [
        {
            "device_id": g.device_id,
            "police_station": g.police_station,
            "min_hour": g.min_hour,
            "max_hour": g.max_hour,
            "total_records": g.total_records,
            "covered_hours": list(range(g.min_hour or 0, (g.max_hour or 0) + 1)),
        }
        for g in gaps
    ]


@router.get("/summary")
async def coverage_summary(db: AsyncSession = Depends(get_db)):
    """City-wide coverage summary."""
    result = await db.execute(
        select(
            func.min(CoverageGap.min_hour),
            func.max(CoverageGap.max_hour),
            func.count(CoverageGap.device_id),
        )
    )
    row = result.fetchone()
    return {
        "city_min_hour": row[0],
        "city_max_hour": row[1],
        "active_devices": row[2],
        "blind_spot_hours": list(range((row[1] or 14) + 1, 24)),
        "note": "Coverage drops dramatically after ~15:00 IST. Near-zero detections from 17:00–23:00.",
    }
