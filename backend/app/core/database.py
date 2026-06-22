"""
ParkPulse AI — Database initialisation
Uses SQLite (async via aiosqlite) by default.
Switch to PostgreSQL by setting DB_MODE=postgres in .env.
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


def _build_url():
    url = settings.DATABASE_URL

    if url.startswith("sqlite"):
        return url

    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://")

    return url


engine = create_async_engine(_build_url(), echo=False, future=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    from app.models import db_models  # noqa: F401 — registers models

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ensured.")


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
