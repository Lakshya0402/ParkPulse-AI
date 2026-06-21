"""
ParkPulse AI — Enforcement Planner Service
Combines PCI score + violation frequency into ranked patrol recommendations.
"""

from typing import List, Optional
from pydantic import BaseModel


class PatrolZone(BaseModel):
    rank: int
    cluster_id: int
    center_lat: float
    center_lon: float
    police_station: str
    junction_name: str
    pci_score: float
    pci_label: str
    violation_count: int
    recommended_officers: int
    patrol_window_start: int  # IST hour
    patrol_window_end: int
    priority_score: float
    rationale: str


def compute_priority_score(pci: float, violation_count: int, max_count: int) -> float:
    """Combine PCI (70%) and raw frequency (30%) into a 0-100 priority score."""
    freq_norm = min(100.0, (violation_count / max(max_count, 1)) * 100)
    return round(pci * 0.70 + freq_norm * 0.30, 2)


def recommend_officers(priority: float, total_officers: int, total_zones: int) -> int:
    """Allocate officers proportionally; minimum 1 per zone."""
    if total_zones == 0 or total_officers == 0:
        return 1
    base = max(1, int((priority / 100) * total_officers / max(total_zones, 1) * 2))
    return min(base, total_officers)


def build_patrol_plan(
    hotspots: list, officer_count: int, top_n: int = 10
) -> List[PatrolZone]:
    """
    hotspots: list of Hotspot ORM objects
    Returns top_n ranked patrol zones with officer allocation.
    """
    if not hotspots:
        return []

    max_count = max(h.violation_count or 0 for h in hotspots)
    scored = []
    for h in hotspots:
        if not h.pci_score:
            continue
        ps = compute_priority_score(h.pci_score, h.violation_count or 0, max_count)
        scored.append((ps, h))

    scored.sort(key=lambda x: -x[0])
    top = scored[:top_n]

    # Determine best patrol window per zone from hour_dist
    def best_window(hour_dist: Optional[dict]) -> tuple:
        if not hour_dist:
            return (8, 11)
        normalized = {}
        for k, v in hour_dist.items():
            try:
                hour = int(float(k))
            except (TypeError, ValueError):
                continue
            if 0 <= hour < 24:
                normalized[hour] = normalized.get(hour, 0) + v
        if not normalized:
            return (8, 11)
        peak_h = max(normalized, key=normalized.get)
        return (max(0, peak_h - 1), min(15, peak_h + 2))

    total_priority = sum(ps for ps, _ in top) or 1
    result = []
    for rank, (ps, h) in enumerate(top, 1):
        allocated = max(1, round((ps / total_priority) * officer_count))
        w_start, w_end = best_window(h.hour_dist)
        result.append(
            PatrolZone(
                rank=rank,
                cluster_id=h.cluster_id,
                center_lat=h.center_lat,
                center_lon=h.center_lon,
                police_station=h.police_station or "Unknown",
                junction_name=h.junction_name or "No Junction",
                pci_score=h.pci_score,
                pci_label=h.pci_label or "MEDIUM",
                violation_count=h.violation_count or 0,
                recommended_officers=allocated,
                patrol_window_start=w_start,
                patrol_window_end=w_end,
                priority_score=ps,
                rationale=_build_rationale(h, w_start, w_end, allocated),
            )
        )
    return result


def _build_rationale(h, w_start: int, w_end: int, officers: int) -> str:
    parts = []
    if h.pci_label in ("CRITICAL", "HIGH"):
        parts.append(f"{h.pci_label} PCI zone ({h.pci_score:.0f}/100)")
    if h.junction_name and h.junction_name.lower() not in ("no junction", "nan", ""):
        parts.append(f"active junction ({h.junction_name})")
    if h.violation_count and h.violation_count > 500:
        parts.append(f"{h.violation_count:,} recorded violations")
    parts.append(f"peak activity {w_start:02d}:00–{w_end:02d}:00 IST")
    return "; ".join(parts) + f". Deploy {officers} officer(s)."
