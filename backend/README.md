# ParkPulse AI — Backend

FastAPI backend for the ParkPulse AI parking-violation intelligence platform. Ingests 298K+ Bengaluru Traffic Police records, runs DBSCAN hotspot detection, computes PCI scores, trains an XGBoost risk model, and exposes everything via a typed REST API.

---

## Requirements

- Python 3.10+
- pip

Optional (for PostgreSQL instead of SQLite):
- PostgreSQL 14+ with PostGIS extension

---

## Quick Start

### 1. Clone & enter the backend directory

```bash
cd parkpulse/backend
```

### 2. Create a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `DATASET_URL` | optional | URL to the CSV (default points to the HackerEarth public link) |
| `DATASET_LOCAL_PATH` | optional | Local path if you've already downloaded the CSV |
| `DB_MODE` | optional | `sqlite` (default) or `postgres` |
| `SQLITE_PATH` | optional | SQLite file path (default: `./parkpulse.db`) |
| `DATABASE_URL` | if postgres | PostgreSQL connection string |
| `MAPPLS_CLIENT_ID` | optional | Only needed for server-side Mappls API calls |
| `MAPPLS_CLIENT_SECRET` | optional | Only needed for server-side Mappls API calls |
| `CORS_ORIGINS` | optional | Comma-separated allowed origins |
| `MODEL_CACHE_DIR` | optional | Directory to cache the trained XGBoost model |

### 5. Run the server

```bash
uvicorn app.main:app --reload --port 8000
```

On first startup the server will:
1. Create database tables
2. Download the dataset (or load from local path / cache)
3. Run DBSCAN clustering (~2–5 min for 298K rows)
4. Compute PCI scores
5. Write all data to the database
6. Mark the pipeline as complete (subsequent restarts skip ETL)

The XGBoost model is trained lazily on the first `/api/predict/risk` call (~30 seconds), then cached to `MODEL_CACHE_DIR`.

---

## API Reference

Interactive Swagger docs available at `http://localhost:8000/docs`

### Hotspots

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/hotspots/` | List all hotspots. Filter by `pci_label`, `police_station`. |
| `GET` | `/api/hotspots/{cluster_id}` | Single hotspot detail |
| `GET` | `/api/hotspots/heatmap/points` | Lightweight lat/lng/weight array for map rendering |

### Analytics

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/analytics/summary` | Dashboard KPI cards |
| `GET` | `/api/analytics/violation-types` | Top violation categories |
| `GET` | `/api/analytics/by-police-station` | Breakdown by police station |
| `GET` | `/api/analytics/hourly-distribution` | 24-hour violation counts |
| `GET` | `/api/analytics/monthly-trend` | Month-by-month trend |
| `GET` | `/api/analytics/pci-distribution` | Hotspots by risk label |

### Prediction

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/predict/risk` | Predict risk for a cluster/hour/day combo |
| `GET` | `/api/predict/model-info` | Model training metadata |

**Prediction request body:**
```json
{
  "cluster_id": 42,
  "hour": 9,
  "day_of_week": 0,
  "month": 3,
  "vehicle_type": "CAR"
}
```

Note: Only hours 0–15 IST have meaningful historical coverage. The API returns an explicit `hour_covered: false` and no prediction for hours 16–23.

### Enforcement Planner

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/planner/plan?officers=20&top_n=10` | AI-ranked patrol deployment plan |

### Coverage Gaps

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/coverage/gaps` | Per-device active-hour ranges |
| `GET` | `/api/coverage/summary` | City-wide blind-spot summary |

### Repeat Offenders

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/offenders/?min_citations=5` | Watchlist of repeat vehicles |
| `GET` | `/api/offenders/stats` | Top-level offender statistics |

---

## Architecture

```
CSV (298K rows)
     │
     ▼
Ingestion & Validation Filter (rejects ~17% of records)
     │
     ├──► Feature Engineering (time, junction, pin code, grid-cell)
     │
     ├──► DBSCAN (haversine, eps=150m, min_samples=15) → ~200 clusters
     │
     ├──► PCI Score (5-component weighted formula, deterministic)
     │
     └──► DB Write (SQLite / PostgreSQL)
                    │
                    ▼
             FastAPI serves
          ┌──────────────────────┐
          │  Precomputed reads   │  ← hotspots, analytics, coverage, offenders
          │  (near-instant)      │
          └──────────────────────┘
          ┌──────────────────────┐
          │  Live inference      │  ← /api/predict (XGBoost loaded at startup)
          └──────────────────────┘
```

### PCI Score Formula

```
PCI = 0.35 × Frequency   (violation count vs. max cluster count)
    + 0.25 × Time-of-day (peak AM 8–11 IST weight)
    + 0.20 × Junction    (named junction = 100, no junction = 30)
    + 0.15 × Recurrence  (months with violations / 6)
    + 0.05 × Vehicle     (weighted by vehicle impact on traffic)

Labels: 0–25 = LOW, 25–50 = MEDIUM, 50–75 = HIGH, 75–100 = CRITICAL
```

### Data Notes

- Actual data range: Nov 2023 – Apr 2024 (filename says "Jan to May" — inaccurate)
- Camera-based enforcement active ~00:00–15:00 IST only. Detections after 15:00 represent <0.2% of records — this is an infrastructure gap, not a traffic pattern
- `validation_status == 'rejected'` rows (~17%) are filtered before any computation
- Three columns (`description`, `closed_datetime`, `action_taken_timestamp`) are 100% null and are dropped

---

## Re-running the Pipeline

To force a full re-run (e.g., after updating the dataset):

```bash
# Delete the pipeline_runs record that marks it as complete
sqlite3 parkpulse.db "DELETE FROM pipeline_runs;"
# Then restart the server
uvicorn app.main:app --reload --port 8000
```

Or delete the SQLite file entirely: `rm parkpulse.db`

---

## Production Deployment (Render / Railway / AWS)

1. Set `DB_MODE=postgres` and provide `DATABASE_URL`
2. Run `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Set `DATASET_LOCAL_PATH` to a mounted volume path, or allow the server to download and cache the CSV on first boot
4. The model cache (`MODEL_CACHE_DIR`) should be a persistent volume so the XGBoost model survives restarts

---

## Development Tips

- The pipeline runs once and marks itself complete. Delete `parkpulse.db` (or the `pipeline_runs` table row) to re-run
- Swagger UI at `/docs`, ReDoc at `/redoc`
- All endpoints return JSON; no authentication required (add an API key middleware for production)
