"""
ParkPulse AI — /api/analytics endpoints
Dashboard summary cards and charts.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.core.database import get_db
from app.models.db_models import Hotspot, Violation, PipelineRun

router = APIRouter()


@router.get("/summary")
async def summary(db: AsyncSession = Depends(get_db)):
    """Top-level KPIs for the dashboard header cards."""
    total_violations = (
        await db.execute(select(func.count()).select_from(Violation))
    ).scalar()
    total_hotspots = (
        await db.execute(select(func.count()).select_from(Hotspot))
    ).scalar()
    critical = (
        await db.execute(
            select(func.count())
            .select_from(Hotspot)
            .where(Hotspot.pci_label == "CRITICAL")
        )
    ).scalar()
    high = (
        await db.execute(
            select(func.count()).select_from(Hotspot).where(Hotspot.pci_label == "HIGH")
        )
    ).scalar()
    avg_pci = (await db.execute(select(func.avg(Hotspot.pci_score)))).scalar()

    run = (
        await db.execute(select(PipelineRun).order_by(PipelineRun.id.desc()).limit(1))
    ).scalar_one_or_none()

    return {
        "total_violations": total_violations or 0,
        "total_hotspots": total_hotspots or 0,
        "critical_zones": critical or 0,
        "high_zones": high or 0,
        "avg_pci": round(float(avg_pci or 0), 1),
        "last_updated": run.ran_at.isoformat() if run and run.ran_at else None,
        "data_coverage": "Nov 2023 – Apr 2024",
    }


@router.get("/violation-types")
async def violation_types(db: AsyncSession = Depends(get_db)):
    """Top violation types across the entire dataset."""
    result = await db.execute(select(Hotspot.violation_type_dist))
    merged = {}
    for (dist,) in result.all():
        if dist:
            for k, v in dist.items():
                merged[k] = merged.get(k, 0) + v
    sorted_types = sorted(merged.items(), key=lambda x: -x[1])[:15]
    return [{"type": k, "count": v} for k, v in sorted_types]


@router.get("/by-police-station")
async def by_police_station(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            Hotspot.police_station,
            func.sum(Hotspot.violation_count).label("total"),
            func.count(Hotspot.id).label("hotspots"),
            func.avg(Hotspot.pci_score).label("avg_pci"),
        )
        .group_by(Hotspot.police_station)
        .order_by(func.sum(Hotspot.violation_count).desc())
        .limit(20)
    )
    return [
        {
            "station": r[0],
            "total_violations": int(r[1] or 0),
            "hotspot_count": int(r[2] or 0),
            "avg_pci": round(float(r[3] or 0), 1),
        }
        for r in result.all()
    ]


@router.get("/hourly-distribution")
async def hourly_distribution(db: AsyncSession = Depends(get_db)):
    """Aggregate hourly counts across all hotspots."""
    result = await db.execute(select(Hotspot.hour_dist))
    merged = {str(h): 0 for h in range(24)}
    for (dist,) in result.all():
        if dist:
            for k, v in dist.items():
                merged[str(k)] = merged.get(str(k), 0) + v

    def _normalize_hour_key(key):
        try:
            return int(float(key))
        except (TypeError, ValueError):
            return 0

    return [
        {"hour": int(float(k)), "count": v}
        for k, v in sorted(merged.items(), key=lambda x: _normalize_hour_key(x[0]))
    ]


@router.get("/monthly-trend")
async def monthly_trend(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Hotspot.month_dist))
    merged = {}
    for (dist,) in result.all():
        if dist:
            for k, v in dist.items():
                merged[str(k)] = merged.get(str(k), 0) + v
    months = {
        1: "Jan",
        2: "Feb",
        3: "Mar",
        4: "Apr",
        5: "May",
        6: "Jun",
        7: "Jul",
        8: "Aug",
        9: "Sep",
        10: "Oct",
        11: "Nov",
        12: "Dec",
    }

    def _normalize_month_key(key):
        try:
            return int(float(key))
        except (TypeError, ValueError):
            return 0

    return [
        {"month": months.get(int(float(k)), k), "month_num": int(float(k)), "count": v}
        for k, v in sorted(merged.items(), key=lambda x: _normalize_month_key(x[0]))
    ]


@router.get("/pci-distribution")
async def pci_distribution(db: AsyncSession = Depends(get_db)):
    """Return count of hotspots by PCI label (LOW/MEDIUM/HIGH/CRITICAL)."""
    from sqlalchemy import func

    result = await db.execute(
        select(Hotspot.pci_label, func.count(Hotspot.id).label("count"))
        .group_by(Hotspot.pci_label)
        .order_by(Hotspot.pci_label)
    )
    return [
        {"label": row[0] or "UNKNOWN", "count": int(row[1] or 0)}
        for row in result.all()
    ]
