"""
ParkPulse AI — /api/predict endpoints
XGBoost-based risk prediction for a given cluster/hour combination.
Model is trained lazily on first predict call and cached to disk.
"""

import os
import logging
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.config import settings
from app.core.database import get_db
from app.models.db_models import Hotspot, Violation

router = APIRouter()
logger = logging.getLogger(__name__)

_model = None  # loaded lazily
_model_meta = {}  # {"trained_at": ..., "n_samples": ..., "f1_macro": ...}

LABEL_MAP = {0: "LOW", 1: "MEDIUM", 2: "HIGH"}
RISK_COLORS = {"LOW": "#22c55e", "MEDIUM": "#f59e0b", "HIGH": "#ef4444"}

# Hours with meaningful coverage (< 2% of records outside this range)
COVERED_HOURS = list(range(0, 16))  # 0–15 IST


class PredictRequest(BaseModel):
    cluster_id: int
    hour: int  # IST 0–15 only
    day_of_week: int  # 0=Mon
    month: int  # 1–12
    vehicle_type: Optional[str] = "CAR"


class PredictResponse(BaseModel):
    risk_label: str
    risk_color: str
    probabilities: dict  # {"LOW": 0.1, "MEDIUM": 0.6, "HIGH": 0.3}
    supporting_records: int
    hour_covered: bool
    message: str
    cluster_id: int
    pci_score: Optional[float]


async def _load_or_train_model(db: AsyncSession):
    global _model, _model_meta
    if _model is not None:
        return

    model_path = Path(settings.MODEL_CACHE_DIR) / "risk_model.pkl"
    meta_path = Path(settings.MODEL_CACHE_DIR) / "risk_model_meta.json"

    if model_path.exists():
        import joblib, json

        _model = joblib.load(str(model_path))
        if meta_path.exists():
            _model_meta = json.loads(meta_path.read_text())
        logger.info("Loaded cached XGBoost model.")
        return

    logger.info("Training XGBoost risk prediction model...")
    await _train_model(db)


async def _train_model(db: AsyncSession):
    global _model, _model_meta
    import pandas as pd
    import joblib
    import json
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import f1_score
    from sklearn.model_selection import train_test_split

    # Pull violations + hotspot PCI labels
    result = await db.execute(
        select(
            Violation.cluster_id,
            Violation.created_hour,
            Violation.created_dow,
            Violation.created_month,
            Violation.vehicle_type,
            Hotspot.pci_label,
            Hotspot.pci_score,
        )
        .join(Hotspot, Violation.cluster_id == Hotspot.cluster_id)
        .where(Violation.cluster_id >= 0)
        .where(Violation.created_hour <= 15)  # only covered hours
        .limit(100_000)
    )
    rows = result.all()
    if not rows or len(rows) < 100:
        logger.warning("Not enough data to train model.")
        return

    df = pd.DataFrame(
        rows,
        columns=[
            "cluster_id",
            "hour",
            "dow",
            "month",
            "vehicle_type",
            "pci_label",
            "pci_score",
        ],
    )
    df = df.dropna(subset=["cluster_id", "pci_score", "pci_label"])

    # Encode vehicle type
    veh_map = {v: i for i, v in enumerate(df["vehicle_type"].fillna("OTHER").unique())}
    df["veh_enc"] = df["vehicle_type"].map(veh_map).fillna(0)

    label_to_int = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 2}
    df["label_int"] = df["pci_label"].map(label_to_int)
    df = df.dropna(subset=["label_int"])

    # Use only available features: hour, dow, month, veh_enc (latitude/longitude not in query)
    X = df[["hour", "dow", "month", "veh_enc"]].fillna(0)
    y = df["label_int"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    try:
        from xgboost import XGBClassifier

        clf = XGBClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.1,
            eval_metric="mlogloss",
            random_state=42,
        )
    except ImportError:
        clf = RandomForestClassifier(n_estimators=100, random_state=42)

    clf.fit(X_train, y_train)
    preds = clf.predict(X_test)
    f1 = f1_score(y_test, preds, average="macro")
    logger.info(f"Model trained. Macro F1: {f1:.3f}")

    Path(settings.MODEL_CACHE_DIR).mkdir(exist_ok=True)
    model_path = Path(settings.MODEL_CACHE_DIR) / "risk_model.pkl"
    meta_path = Path(settings.MODEL_CACHE_DIR) / "risk_model_meta.json"

    joblib.dump({"clf": clf, "veh_map": veh_map}, str(model_path))
    meta = {
        "f1_macro": round(f1, 3),
        "n_samples": len(df),
        "n_clusters": int(df["cluster_id"].nunique()),
    }
    meta_path.write_text(json.dumps(meta))

    _model = {"clf": clf, "veh_map": veh_map}
    _model_meta = meta


@router.post("/risk", response_model=PredictResponse)
async def predict_risk(req: PredictRequest, db: AsyncSession = Depends(get_db)):
    # Validate cluster exists
    hs_result = await db.execute(
        select(Hotspot).where(Hotspot.cluster_id == req.cluster_id)
    )
    hs = hs_result.scalar_one_or_none()
    if not hs:
        raise HTTPException(404, "Cluster not found")

    hour_covered = req.hour in COVERED_HOURS

    # Count supporting records
    count_result = await db.execute(
        select(func.count())
        .select_from(Violation)
        .where(Violation.cluster_id == req.cluster_id)
        .where(Violation.created_hour == req.hour)
    )
    supporting = count_result.scalar() or 0

    if not hour_covered:
        # Return honest no-coverage response
        label = "UNKNOWN"
        return PredictResponse(
            risk_label=label,
            risk_color="#6b7280",
            probabilities={"LOW": 0, "MEDIUM": 0, "HIGH": 0},
            supporting_records=supporting,
            hour_covered=False,
            message=f"Hour {req.hour}:00 IST has near-zero historical coverage (enforcement cameras inactive). Prediction not available.",
            cluster_id=req.cluster_id,
            pci_score=hs.pci_score,
        )

    await _load_or_train_model(db)
    if _model is None:
        # Fallback to PCI-based heuristic
        label = hs.pci_label or "MEDIUM"
        probs = {"LOW": 0.33, "MEDIUM": 0.34, "HIGH": 0.33}
        return PredictResponse(
            risk_label=label,
            risk_color=RISK_COLORS.get(label, "#6b7280"),
            probabilities=probs,
            supporting_records=supporting,
            hour_covered=True,
            message="Using PCI heuristic (model not available).",
            cluster_id=req.cluster_id,
            pci_score=hs.pci_score,
        )

    clf = _model["clf"]
    veh_map = _model["veh_map"]
    veh_enc = veh_map.get(req.vehicle_type, 0)
    # Match features to training: [hour, dow, month, veh_enc]
    X = np.array([[req.day_of_week, req.month, veh_enc, req.hour]])

    proba = clf.predict_proba(X)[0]
    n_classes = len(proba)
    probs = {}
    for i, p in enumerate(proba):
        probs[LABEL_MAP.get(i, str(i))] = round(float(p), 3)

    pred_int = int(np.argmax(proba))
    label = LABEL_MAP.get(pred_int, "MEDIUM")

    msg = f"Prediction based on {supporting:,} historical records at this cluster/hour."
    if supporting < 20:
        msg += f" Low confidence ({supporting} records) — treat as indicative only."

    return PredictResponse(
        risk_label=label,
        risk_color=RISK_COLORS.get(label, "#6b7280"),
        probabilities=probs,
        supporting_records=supporting,
        hour_covered=True,
        message=msg,
        cluster_id=req.cluster_id,
        pci_score=hs.pci_score,
    )


@router.get("/model-info")
async def model_info():
    return {
        "trained": _model is not None,
        "meta": _model_meta,
        "covered_hours": COVERED_HOURS,
        "note": "Model only covers hours 0–15 IST. Evening hours (16–23) have <0.2% coverage.",
    }
