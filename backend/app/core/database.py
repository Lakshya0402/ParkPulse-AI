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


def _build_url() -> str:
    if settings.DB_MODE == "sqlite":
        return f"sqlite+aiosqlite:///{settings.SQLITE_PATH}"
    # Postgres: convert sync URL to async
    url = settings.DATABASE_URL
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
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
