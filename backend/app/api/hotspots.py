"""
ParkPulse AI — /api/hotspots endpoints
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from pydantic import BaseModel

from app.core.database import get_db
from app.models.db_models import Hotspot

router = APIRouter()


class HotspotOut(BaseModel):
    cluster_id: int
    center_lat: float
    center_lon: float
    violation_count: int
    dominant_violation: Optional[str]
    police_station: Optional[str]
    junction_name: Optional[str]
    pci_score: Optional[float]
    pci_label: Optional[str]
    pci_frequency_score: Optional[float]
    pci_time_score: Optional[float]
    pci_junction_score: Optional[float]
    pci_recurrence_score: Optional[float]
    pci_vehicle_score: Optional[float]
    violation_type_dist: Optional[dict]
    vehicle_type_dist: Optional[dict]
    hour_dist: Optional[dict]
    month_dist: Optional[dict]
    rejection_rate: Optional[float]

    class Config:
        from_attributes = True


@router.get("/", response_model=List[HotspotOut])
async def list_hotspots(
    pci_label: Optional[str] = Query(None, description="Filter by label: LOW|MEDIUM|HIGH|CRITICAL"),
    police_station: Optional[str] = None,
    limit: int = Query(500, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """Return all hotspots (or filtered subset)."""
    q = select(Hotspot)
    if pci_label:
        q = q.where(Hotspot.pci_label == pci_label.upper())
    if police_station:
        q = q.where(Hotspot.police_station.ilike(f"%{police_station}%"))
    q = q.order_by(Hotspot.pci_score.desc()).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{cluster_id}", response_model=HotspotOut)
async def get_hotspot(cluster_id: int, db: AsyncSession = Depends(get_db)):
    """Return one hotspot by cluster_id."""
    result = await db.execute(select(Hotspot).where(Hotspot.cluster_id == cluster_id))
    hs = result.scalar_one_or_none()
    if not hs:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Hotspot not found")
    return hs


@router.get("/heatmap/points")
async def heatmap_points(db: AsyncSession = Depends(get_db)):
    """Lightweight lat/lon/weight array for heatmap rendering."""
    result = await db.execute(
        select(Hotspot.center_lat, Hotspot.center_lon, Hotspot.pci_score, Hotspot.violation_count)
        .order_by(Hotspot.pci_score.desc())
    )
    rows = result.all()
    return [
        {"lat": r[0], "lng": r[1], "weight": r[2] or 0, "count": r[3]}
        for r in rows
    ]
