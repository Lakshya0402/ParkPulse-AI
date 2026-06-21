"""
ParkPulse AI — Application Settings
All values are read from environment variables / .env file.
"""

import json
from pydantic import field_validator
from pydantic_settings import BaseSettings
from typing import List


_DEFAULT_CORS = ["http://localhost:5173", "http://localhost:3000"]


class Settings(BaseSettings):
    # Dataset
    DATASET_URL: str = (
        "https://uc.hackerearth.com/he-public-ap-south-1/"
        "jan%20to%20may%20police%20violation_anonymized791b166.csv"
    )
    DATASET_LOCAL_PATH: str = ""

    # Database
    DB_MODE: str = "sqlite"  # "sqlite" | "postgres"
    SQLITE_PATH: str = "./parkpulse.db"
    DATABASE_URL: str = "postgresql://parkpulse:parkpulse@localhost:5432/parkpulse_db"

    # Mappls / MapmyIndia
    MAPPLS_CLIENT_ID: str = ""
    MAPPLS_CLIENT_SECRET: str = ""

    # App
    APP_ENV: str = "development"
    # Stored as a plain string to prevent pydantic-settings from attempting
    # json.loads() on comma-separated values before validators run.
    CORS_ORIGINS: str = ""
    LOG_LEVEL: str = "INFO"

    # ML
    MODEL_CACHE_DIR: str = "./model_cache"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS_ORIGINS string into a list of origin URLs."""
        raw = self.CORS_ORIGINS.strip() if self.CORS_ORIGINS else ""
        if not raw:
            return list(_DEFAULT_CORS)
        # Try JSON first (e.g. '["http://localhost:5173"]')
        if raw.startswith("["):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    result = [str(item).strip() for item in parsed if str(item).strip()]
                    return result or list(_DEFAULT_CORS)
            except (ValueError, TypeError):
                pass
        # Fall back to comma-separated
        items = [item.strip() for item in raw.split(",") if item.strip()]
        return items or list(_DEFAULT_CORS)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

