# ParkPulse AI — Frontend

React + Vite frontend for the ParkPulse AI platform. Renders Mappls (MapmyIndia) maps, interactive charts, and all seven pages of the enforcement intelligence dashboard.

---

## Requirements

- Node.js 18+
- npm 9+
- A **Mappls API key** (free tier covers everything needed — get one at [apis.mappls.com/console](https://apis.mappls.com/console/))
- The backend running at `http://localhost:8000` (see `backend/README.md`)

---

## Quick Start

### 1. Enter the frontend directory

```bash
cd parkpulse/frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `VITE_MAPPLS_MAP_SDK_KEY` | **Yes** | Your Mappls Map SDK key (from apis.mappls.com/console) |
| `VITE_MAPPLS_REST_KEY` | optional | For Mappls REST API calls (geocoding, etc.) |
| `VITE_API_BASE_URL` | optional | Backend URL (default: `http://localhost:8000`) |

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Getting a Mappls API Key

1. Go to [https://apis.mappls.com/console/](https://apis.mappls.com/console/)
2. Sign up / log in
3. Create a new project
4. Under **Map SDK**, copy the **Map SDK Key** → paste as `VITE_MAPPLS_MAP_SDK_KEY`
5. Optionally copy the **REST API Key** → paste as `VITE_MAPPLS_REST_KEY`

The free tier is sufficient for local development and hackathon demos.

---

## How the Mappls SDK is Loaded

The Mappls Web Map SDK is loaded **dynamically at runtime** by `src/hooks/useMapplsLoader.js`. It injects a `<script>` tag pointing to:

```
https://apis.mappls.com/advancedmaps/v1/{YOUR_KEY}/map_load?v=1.5&plugins=heatmap
```

This means:
- No API key is ever hardcoded or committed
- The key comes entirely from your `.env` file via `VITE_MAPPLS_MAP_SDK_KEY`
- If the key is missing or invalid, the map shows an error with a link to the Mappls console

The map component (`src/components/map/MapContainer.jsx`) uses:
- `window.mappls.Map` — base map
- `window.mappls.HeatmapLayer` — violation density heatmap
- `window.mappls.Marker` — individual hotspot markers with popups

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | City Intelligence Map | Full-city heatmap + marker overlay. Click any marker for PCI detail panel. Toggle heatmap/markers independently. |
| `/analytics` | Analytics | Charts: hourly pattern, monthly trend, violation types, police station breakdown, PCI distribution. |
| `/hotspots` | Hotspot Explorer | Searchable, filterable table of all hotspots. Expand any row for PCI component breakdown and violation type distribution. |
| `/predict` | Risk Prediction | XGBoost prediction for a selected cluster + hour + day. Displays probability for LOW/MEDIUM/HIGH with the number of supporting records for honesty transparency. |
| `/planner` | Patrol Planner | AI-generated officer deployment plan. Input officer count → ranked patrol zones with recommended officers per zone and patrol time windows. |
| `/coverage` | Coverage Gaps | 24-hour coverage heat-bar + per-device active hour ranges. Highlights the documented evening blind spot (16–23 IST). |
| `/offenders` | Watchlist | Repeat vehicle offender list. Filter by minimum citations. Shows citation count, stations, and top offender callout. |

---

## Project Structure

```
src/
├── components/
│   ├── common/
│   │   ├── UI.jsx          # Spinner, ErrorBanner, StatCard, Badge, etc.
│   │   └── Sidebar.jsx     # Navigation sidebar
│   └── map/
│       └── MapContainer.jsx  # Mappls map wrapper (heatmap + markers)
├── hooks/
│   ├── useFetch.js         # Generic async data fetching hook
│   └── useMapplsLoader.js  # Dynamic Mappls SDK script loader
├── pages/
│   ├── CityMapPage.jsx
│   ├── AnalyticsPage.jsx
│   ├── HotspotExplorerPage.jsx
│   ├── PredictPage.jsx
│   ├── PlannerPage.jsx
│   ├── CoveragePage.jsx
│   └── OffendersPage.jsx
├── services/
│   └── api.js              # All Axios API calls to the backend
├── utils/
│   └── helpers.js          # pciColor, fmtN, hourLabel, trunc
├── App.jsx                 # Routes
├── main.jsx                # Entry point
└── index.css               # Tailwind + global styles
```

---

## Build for Production

```bash
npm run build
```

Output goes to `dist/`. Deploy to Vercel, Netlify, or any static host:

```bash
# Vercel
npx vercel --prod

# Or just serve locally
npm run preview
```

For Vercel, set the same environment variables in the Vercel project dashboard (Settings → Environment Variables).

---

## Design System

The UI uses a dark, data-dense aesthetic appropriate for a police operations dashboard:

- **Background**: `#0d1117` (near-black)
- **Surface**: `#161b22` (card backgrounds)
- **Accent**: `#f97316` (traffic orange — deliberate choice for enforcement context)
- **Risk colours**: Critical `#ef4444` / High `#f97316` / Medium `#eab308` / Low `#22c55e`
- **Fonts**: Space Grotesk (display), Inter (body), JetBrains Mono (data/code)

---

## Troubleshooting

**Map doesn't load / shows error:**
- Check `VITE_MAPPLS_MAP_SDK_KEY` is set in `frontend/.env`
- Verify the key is valid at [apis.mappls.com/console](https://apis.mappls.com/console/)
- Check browser console for network errors on the SDK script URL

**Charts show no data / API errors:**
- Ensure the backend is running at the URL in `VITE_API_BASE_URL`
- Backend may still be running the pipeline on first startup (takes 2–5 minutes) — check backend logs
- Visit `http://localhost:8000/api/health` to confirm the backend is up

**Prediction page shows no hotspots:**
- Wait for the backend pipeline to complete (check logs for "Pipeline complete")
- Try reloading the page once the backend logs show it's ready
