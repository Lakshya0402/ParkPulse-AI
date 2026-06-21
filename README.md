# ParkPulse AI

> AI-driven parking violation hotspot detection and enforcement prioritisation for Bengaluru Traffic Police.

Converts 298,450 historical BTP violation records into a live enforcement-prioritisation dashboard. Answers the question police currently can't: *given limited officers, which exact locations and hours should we patrol today?*

---

## Repository Structure

```
parkpulse/
├── backend/          # FastAPI + DBSCAN + XGBoost
│   ├── app/
│   │   ├── api/          # Route handlers
│   │   ├── core/         # Config, DB, data pipeline
│   │   ├── models/       # SQLAlchemy ORM models
│   │   └── services/     # Enforcement planner logic
│   ├── .env.example
│   ├── requirements.txt
│   └── README.md         # ← Full backend docs
│
└── frontend/         # React + Vite + Mappls Maps
    ├── src/
    │   ├── components/
    │   ├── hooks/
    │   ├── pages/
    │   ├── services/
    │   └── utils/
    ├── .env.example
    ├── package.json
    └── README.md         # ← Full frontend docs
```

---

## 5-Minute Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- A free Mappls API key → [apis.mappls.com/console](https://apis.mappls.com/console/)

### Step 1 — Backend

```bash
cd backend
&& source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: no changes needed for a default SQLite local run
uvicorn app.main:app --reload --port 8000
```

First startup downloads and processes the dataset (~2–5 min). Watch logs for `Pipeline complete.`

### Step 2 — Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env: set VITE_MAPPLS_MAP_SDK_KEY=<your key>
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## The Only Config That Requires Your Attention

| File | Variable | What to put |
|---|---|---|
| `frontend/.env` | `VITE_MAPPLS_MAP_SDK_KEY` | Your Mappls Map SDK key |
| `backend/.env` | nothing | Defaults work out of the box for SQLite |

Everything else — dataset download, DB creation, model training — is automatic.

---

## What Gets Built

| Page | What it shows |
|---|---|
| **City Map** | Full-city heatmap of 298K violations on a live Mappls map. Click any cluster for PCI breakdown. |
| **Analytics** | Hourly patterns, monthly trends, violation types, police station rankings |
| **Hotspot Explorer** | Searchable/filterable list of all ~200 DBSCAN clusters with expandable PCI detail |
| **Risk Prediction** | XGBoost prediction for any cluster + hour (0–15 IST, the covered window) with confidence transparency |
| **Patrol Planner** | Input officer count → ranked patrol zones with officer allocation and patrol windows |
| **Coverage Gaps** | Documents the camera blind spot (16–23 IST) with per-device active-hour data |
| **Watchlist** | Repeat offender vehicle list (up to 55 citations for one vehicle) |

---

## Key Findings from the Real Data

- **200+ clusters** discovered by DBSCAN (eps=150m, min_samples=15) — violations are concentrated, not uniform
- **164,977 WRONG PARKING + 139,050 NO PARKING** — two types dominate
- **Peak: 8–11 AM IST** — 39.4% of all records in a 3-hour window
- **Blind spot: 16–23 IST** — <0.2% of detections despite being prime congestion hours (cameras inactive)
- **Top station: Upparpet** — 34,468 records, 3× the next highest
- **Max repeat offender: 55 citations** in 5 months from one vehicle

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Recharts, Mappls Web Map SDK |
| Backend | FastAPI, SQLAlchemy (async), aiosqlite / PostgreSQL |
| ML | scikit-learn DBSCAN, XGBoost classifier, joblib |
| Data | pandas, numpy, geopandas |
| Maps | Mappls (MapmyIndia) — heatmap + markers + popups |

---

See `backend/README.md` and `frontend/README.md` for full documentation.
