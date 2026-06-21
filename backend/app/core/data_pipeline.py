"""
ParkPulse AI — Data Pipeline
Runs once at startup (or when forced). Steps:
  1. Download / load CSV
  2. Parse & clean
  3. DBSCAN hotspot detection
  4. PCI score computation
  5. Write hotspots, violations, coverage gaps, repeat offenders to DB
"""

import json
import re
import logging
import os
import math
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from sqlalchemy import text

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.db_models import (
    Hotspot,
    Violation,
    CoverageGap,
    RepeatOffender,
    PipelineRun,
)

logger = logging.getLogger(__name__)

# ── VEHICLE IMPACT WEIGHTS ────────────────────────────────────────────────────
VEHICLE_WEIGHTS = {
    "TRUCK": 5,
    "BUS": 5,
    "MAXI CAB": 4,
    "AUTO RICKSHAW": 3,
    "MINI BUS": 4,
    "MOTOR CAB": 3,
    "PRIVATE SERVICE VEHICLE": 3,
    "LIGHT MOTOR VEHICLE": 2,
    "CAR": 2,
    "VAN": 2,
    "TWO WHEELER": 1,
    "MOTOR CYCLE": 1,
    "SCOOTER": 1,
    "OTHER": 2,
}


# ── HELPERS ───────────────────────────────────────────────────────────────────
def _parse_json_list(val) -> list:
    if pd.isna(val):
        return []
    if isinstance(val, list):
        return val
    try:
        return json.loads(str(val))
    except Exception:
        return []


def _extract_pin(text: str) -> Optional[str]:
    if not isinstance(text, str):
        return None
    m = re.search(r"\b\d{6}\b", text)
    return m.group() if m else None


def _haversine_to_radians(df: pd.DataFrame) -> np.ndarray:
    """Return N×2 array of (lat, lon) in radians for haversine DBSCAN."""
    coords = df[["latitude", "longitude"]].values
    return np.radians(coords)


# ── PCI SCORING ───────────────────────────────────────────────────────────────
# Weights: frequency 35%, time-of-day 25%, junction 20%, recurrence 15%, vehicle 5%
PCI_W = dict(frequency=0.35, time=0.25, junction=0.20, recurrence=0.15, vehicle=0.05)
TOTAL_RECORDS = 298_450  # approximate; recalculated after load


def _pci_frequency(count: int, max_count: int) -> float:
    return min(100.0, (count / max(max_count, 1)) * 100)


def _pci_time(hour_dist: dict) -> float:
    """Peak AM window 8–11 IST → high score. Late evening (17-23) flagged as blind spot."""
    peak_hours = {8, 9, 10, 11}
    total = sum(hour_dist.values()) or 1
    peak = sum(hour_dist.get(str(h), 0) for h in peak_hours)
    return min(
        100.0, (peak / total) * 200
    )  # ×2 amplifier because peak is strong signal


def _pci_junction(junction_name: str) -> float:
    return (
        100.0
        if junction_name and junction_name.lower() not in ("no junction", "", "nan")
        else 30.0
    )


def _pci_recurrence(month_dist: dict) -> float:
    months_active = len([v for v in month_dist.values() if v > 0])
    return min(100.0, (months_active / 6) * 100)


def _pci_vehicle(vehicle_dist: dict) -> float:
    if not vehicle_dist:
        return 20.0
    total = sum(vehicle_dist.values()) or 1
    weighted = sum(
        VEHICLE_WEIGHTS.get(k.upper(), 2) * v for k, v in vehicle_dist.items()
    )
    return min(100.0, (weighted / total) * 20)  # max raw weight ≈5, scale to 100


def compute_pci(row: dict, max_count: int) -> dict:
    f = _pci_frequency(row["violation_count"], max_count)
    t = _pci_time(row.get("hour_dist", {}))
    j = _pci_junction(row.get("junction_name", ""))
    r = _pci_recurrence(row.get("month_dist", {}))
    v = _pci_vehicle(row.get("vehicle_type_dist", {}))

    score = (
        f * PCI_W["frequency"]
        + t * PCI_W["time"]
        + j * PCI_W["junction"]
        + r * PCI_W["recurrence"]
        + v * PCI_W["vehicle"]
    )
    if score >= 75:
        label = "CRITICAL"
    elif score >= 50:
        label = "HIGH"
    elif score >= 25:
        label = "MEDIUM"
    else:
        label = "LOW"

    return dict(
        pci_score=round(score, 2),
        pci_label=label,
        pci_frequency_score=round(f, 2),
        pci_time_score=round(t, 2),
        pci_junction_score=round(j, 2),
        pci_recurrence_score=round(r, 2),
        pci_vehicle_score=round(v, 2),
    )


# ── MAIN PIPELINE ─────────────────────────────────────────────────────────────
async def ensure_data_ready():
    """Check if pipeline has already run; if not, run it."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT status FROM pipeline_runs ORDER BY id DESC LIMIT 1")
        )
        row = result.fetchone()
        if row and row[0] == "complete":
            logger.info("Pipeline already complete — skipping ETL.")
            return
    logger.info("Starting data pipeline...")
    try:
        await _run_pipeline()
    except Exception as e:
        logger.exception(f"Pipeline failed: {e}")
        async with AsyncSessionLocal() as session:
            session.add(PipelineRun(status="failed", notes=str(e)))
            await session.commit()
        raise


async def _run_pipeline():
    # ── 1. Load data ──
    df_raw = _load_csv()
    logger.info(f"Loaded {len(df_raw):,} rows.")

    # ── 2. Clean ──
    df = _clean(df_raw)
    logger.info(f"After cleaning: {len(df):,} rows.")

    # ── 3. DBSCAN ──
    df = _cluster(df)
    
    # Track rejection ratio per cluster (for honesty layer)
    df_rejected = df_raw[df_raw.get("validation_status") == "rejected"].copy() if "validation_status" in df_raw.columns else pd.DataFrame()
    if len(df_rejected) > 0 and "cluster_id" in df_rejected.columns:
        rejection_per_cluster = df_rejected.groupby("cluster_id").size().to_dict()
    else:
        rejection_per_cluster = {}

    # ── 4. Aggregate hotspots ──
    hotspot_rows = _aggregate_hotspots(df, rejection_per_cluster)
    logger.info(f"Hotspots discovered: {len(hotspot_rows)}")

    # ── 5. PCI ──
    max_count = max(r["violation_count"] for r in hotspot_rows)
    for r in hotspot_rows:
        r.update(compute_pci(r, max_count))

    # ── 6. Write to DB ──
    await _write_to_db(df, hotspot_rows)
    logger.info("Pipeline complete.")


def _load_csv() -> pd.DataFrame:
    cache = Path("./data/violations.csv")
    if settings.DATASET_LOCAL_PATH and Path(settings.DATASET_LOCAL_PATH).exists():
        return pd.read_csv(settings.DATASET_LOCAL_PATH, low_memory=False)
    if cache.exists():
        logger.info("Loading from cache...")
        return pd.read_csv(cache, low_memory=False)
    logger.info(f"Downloading dataset from {settings.DATASET_URL} ...")
    cache.parent.mkdir(exist_ok=True)
    # Use pandas directly — works even without httpx installed
    df = pd.read_csv(settings.DATASET_URL, low_memory=False)
    df.to_csv(cache, index=False)
    return df


def _clean(df: pd.DataFrame) -> pd.DataFrame:
    # Drop 100%-null columns
    null_cols = [
        c
        for c in ["description", "closed_datetime", "action_taken_timestamp"]
        if c in df.columns
    ]
    df = df.drop(columns=null_cols, errors="ignore")

    # Filter rejected
    if "validation_status" in df.columns:
        df = df[df["validation_status"] != "rejected"].copy()

    # Parse JSON arrays
    for col in ["violation_type", "offence_code"]:
        if col in df.columns:
            df[col] = df[col].apply(_parse_json_list)

    # Datetime features
    for col in ["created_datetime", "created_at"]:
        if col in df.columns:
            df["_dt"] = pd.to_datetime(df[col], errors="coerce", utc=True)
            break
    if "_dt" in df.columns:
        # Convert to IST (UTC+5:30)
        df["_dt_ist"] = df["_dt"] + pd.Timedelta(hours=5, minutes=30)
        df["created_hour"] = df["_dt_ist"].dt.hour
        df["created_dow"] = df["_dt_ist"].dt.dayofweek
        df["created_month"] = df["_dt_ist"].dt.month

    # Coordinates
    for lat_col in ["latitude", "lat"]:
        if lat_col in df.columns:
            df = df.rename(columns={lat_col: "latitude"})
            break
    for lon_col in ["longitude", "lon", "lng"]:
        if lon_col in df.columns:
            df = df.rename(columns={lon_col: "longitude"})
            break
    df = df.dropna(subset=["latitude", "longitude"])
    df = df[
        (df["latitude"].between(12.5, 13.5)) & (df["longitude"].between(77.3, 77.9))
    ]

    # Pin code
    loc_col = "location" if "location" in df.columns else None
    if loc_col:
        df["pin_code"] = df[loc_col].apply(_extract_pin)

    # Junction normalise
    if "junction_name" in df.columns:
        df["junction_name"] = df["junction_name"].fillna("No Junction").str.strip()

    return df.reset_index(drop=True)


def _cluster(df: pd.DataFrame) -> pd.DataFrame:
    from sklearn.cluster import DBSCAN

    logger.info("Running DBSCAN clustering...")
    coords_rad = _haversine_to_radians(df)
    eps_km = 0.15  # 150 m
    earth_radius_km = 6371.0
    eps_rad = eps_km / earth_radius_km

    db = DBSCAN(eps=eps_rad, min_samples=15, algorithm="ball_tree", metric="haversine")
    df["cluster_id"] = db.fit_predict(coords_rad)
    n_clusters = df[df["cluster_id"] >= 0]["cluster_id"].nunique()
    noise_pct = (df["cluster_id"] == -1).mean() * 100
    logger.info(f"DBSCAN: {n_clusters} clusters, {noise_pct:.1f}% noise")
    return df


def _dist(hotspot_rows, df) -> list:
    """Return distribution dict from a column in the cluster sub-df."""
    pass


def _aggregate_hotspots(df: pd.DataFrame, rejection_per_cluster: dict = None) -> list:
    if rejection_per_cluster is None:
        rejection_per_cluster = {}
    rows = []
    clustered = df[df["cluster_id"] >= 0]
    for cid, grp in clustered.groupby("cluster_id"):
        center_lat = grp["latitude"].mean()
        center_lon = grp["longitude"].mean()

        # Dominant violation type
        all_types = []
        if "violation_type" in grp.columns:
            for vt in grp["violation_type"]:
                all_types.extend(vt if isinstance(vt, list) else [])
        type_counts = pd.Series(all_types).value_counts().to_dict() if all_types else {}
        dominant = max(type_counts, key=type_counts.get) if type_counts else "UNKNOWN"

        # Police station (most common)
        station = (
            grp["police_station"].mode()[0]
            if "police_station" in grp.columns
            and not grp["police_station"].isna().all()
            else "Unknown"
        )
        junction = (
            grp["junction_name"].mode()[0]
            if "junction_name" in grp.columns and not grp["junction_name"].isna().all()
            else "No Junction"
        )

        # Vehicle distribution
        veh_dist = {}
        if "vehicle_type" in grp.columns:
            veh_dist = grp["vehicle_type"].value_counts().to_dict()

        # Hour distribution
        hour_dist = {}
        if "created_hour" in grp.columns:
            hour_dist = {
                str(k): int(v)
                for k, v in grp["created_hour"].value_counts().to_dict().items()
            }

        # Month distribution
        month_dist = {}
        if "created_month" in grp.columns:
            month_dist = {
                str(k): int(v)
                for k, v in grp["created_month"].value_counts().to_dict().items()
            }

        # Rejection rate (honesty layer: data quality signal per zone)
        rejected_count = rejection_per_cluster.get(cid, 0)
        total_for_cluster = len(grp) + rejected_count
        rejection_rate = (rejected_count / total_for_cluster * 100) if total_for_cluster > 0 else 0.0

        rows.append(
            {
                "cluster_id": int(cid),
                "center_lat": float(center_lat),
                "center_lon": float(center_lon),
                "violation_count": len(grp),
                "dominant_violation": dominant,
                "police_station": str(station),
                "junction_name": str(junction),
                "violation_type_dist": type_counts,
                "vehicle_type_dist": veh_dist,
                "hour_dist": hour_dist,
                "month_dist": month_dist,
                "rejection_rate": rejection_rate,
            }
        )
    return rows


async def _write_to_db(df: pd.DataFrame, hotspot_rows: list):
    async with AsyncSessionLocal() as session:
        # Clear existing
        await session.execute(text("DELETE FROM hotspots"))
        await session.execute(text("DELETE FROM violations"))
        await session.execute(text("DELETE FROM coverage_gaps"))
        await session.execute(text("DELETE FROM repeat_offenders"))
        await session.commit()

        # Write hotspots
        for r in hotspot_rows:
            session.add(Hotspot(**r))
        await session.commit()

        # Write violations in batches of 5000
        batch = []
        for _, row in df.iterrows():
            v = Violation(
                original_id=str(row.get("id", "")),
                cluster_id=int(row.get("cluster_id", -1)),
                lat=float(row["latitude"]),
                lon=float(row["longitude"]),
                violation_types=row.get("violation_type", []),
                vehicle_type=str(row.get("vehicle_type", "")),
                police_station=str(row.get("police_station", "")),
                junction_name=str(row.get("junction_name", "")),
                created_hour=(
                    int(row["created_hour"])
                    if "created_hour" in row and not pd.isna(row["created_hour"])
                    else None
                ),
                created_dow=(
                    int(row["created_dow"])
                    if "created_dow" in row and not pd.isna(row["created_dow"])
                    else None
                ),
                created_month=(
                    int(row["created_month"])
                    if "created_month" in row and not pd.isna(row["created_month"])
                    else None
                ),
                validation_status=str(row.get("validation_status", "")),
                device_id=str(row.get("device_id", "")),
                location_text=str(row.get("location", ""))[:500],
                pin_code=str(row.get("pin_code", "")) if row.get("pin_code") else None,
            )
            batch.append(v)
            if len(batch) >= 5000:
                session.add_all(batch)
                await session.commit()
                batch = []
        if batch:
            session.add_all(batch)
            await session.commit()

        # Coverage gaps
        if "device_id" in df.columns and "created_hour" in df.columns:
            cov = (
                df.groupby("device_id")
                .agg(
                    min_hour=("created_hour", "min"),
                    max_hour=("created_hour", "max"),
                    total_records=("cluster_id", "count"),
                    police_station=(
                        "police_station",
                        lambda x: x.mode()[0] if not x.isna().all() else "Unknown",
                    ),
                )
                .reset_index()
            )
            for _, r in cov.iterrows():
                session.add(
                    CoverageGap(
                        device_id=str(r["device_id"]),
                        police_station=str(r["police_station"]),
                        min_hour=(
                            int(r["min_hour"]) if not math.isnan(r["min_hour"]) else 0
                        ),
                        max_hour=(
                            int(r["max_hour"]) if not math.isnan(r["max_hour"]) else 0
                        ),
                        total_records=int(r["total_records"]),
                    )
                )
            await session.commit()

        # Repeat offenders
        id_col = None
        for c in ["vehicle_number", "challan_number", "vehicle_no"]:
            if c in df.columns:
                id_col = c
                break
        if id_col:
            ro = (
                df.groupby(id_col)
                .agg(
                    citation_count=("cluster_id", "count"),
                    police_stations=(
                        "police_station",
                        lambda x: list(x.dropna().unique()[:5]),
                    ),
                    violation_types=(
                        "violation_type",
                        lambda x: list(set(
                            v for vlist in x.dropna() 
                            for v in (vlist if isinstance(vlist, list) else [vlist])
                        ))[:10]  # Top 10 unique violation types
                    ),
                )
                .reset_index()
            )
            ro = ro[ro["citation_count"] >= 3].sort_values(
                "citation_count", ascending=False
            )
            for _, r in ro.iterrows():
                session.add(
                    RepeatOffender(
                        vehicle_number=str(r[id_col]),
                        citation_count=int(r["citation_count"]),
                        police_stations=r["police_stations"],
                        violation_types=r["violation_types"],
                        last_seen="",
                    )
                )
            await session.commit()

        # Mark pipeline complete
        session.add(
            PipelineRun(
                status="complete",
                rows_loaded=len(df),
                hotspots_found=len(hotspot_rows),
            )
        )
        await session.commit()
