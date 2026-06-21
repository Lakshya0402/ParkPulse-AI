"""
ParkPulse AI — FastAPI Application Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.database import init_db
from app.core.data_pipeline import ensure_data_ready
from app.api import hotspots, analytics, predict, coverage, offenders, planner

logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialise DB and run data pipeline if needed."""
    logger.info("🚀 ParkPulse AI starting up...")
    await init_db()
    await ensure_data_ready()
    logger.info("✅ Ready.")
    yield
    logger.info("👋 Shutting down.")


app = FastAPI(
    title="ParkPulse AI",
    description="Parking violation hotspot detection & enforcement prioritisation for Bengaluru Traffic Police",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(hotspots.router, prefix="/api/hotspots", tags=["Hotspots"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(predict.router, prefix="/api/predict", tags=["Prediction"])
app.include_router(coverage.router, prefix="/api/coverage", tags=["Coverage"])
app.include_router(offenders.router, prefix="/api/offenders", tags=["Offenders"])
app.include_router(planner.router, prefix="/api/planner", tags=["Planner"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
