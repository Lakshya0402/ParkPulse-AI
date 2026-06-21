"""
ParkPulse AI — SQLAlchemy ORM Models
"""
from sqlalchemy import Column, Integer, Float, String, JSON, Boolean, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base


class Hotspot(Base):
    __tablename__ = "hotspots"

    id = Column(Integer, primary_key=True, index=True)
    cluster_id = Column(Integer, unique=True, index=True)
    center_lat = Column(Float, nullable=False)
    center_lon = Column(Float, nullable=False)
    violation_count = Column(Integer, default=0)
    dominant_violation = Column(String(200))
    police_station = Column(String(200))
    junction_name = Column(String(200))
    # PCI components
    pci_score = Column(Float, default=0.0)
    pci_label = Column(String(20))          # LOW / MEDIUM / HIGH / CRITICAL
    pci_frequency_score = Column(Float)
    pci_time_score = Column(Float)
    pci_junction_score = Column(Float)
    pci_recurrence_score = Column(Float)
    pci_vehicle_score = Column(Float)
    # Breakdowns (stored as JSON)
    violation_type_dist = Column(JSON)      # {"WRONG PARKING": 120, ...}
    vehicle_type_dist = Column(JSON)
    hour_dist = Column(JSON)
    month_dist = Column(JSON)
    # Validation quality
    rejection_rate = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Violation(Base):
    """Stores every clean (non-rejected) violation record."""
    __tablename__ = "violations"

    id = Column(Integer, primary_key=True, index=True)
    original_id = Column(String(100), index=True)
    cluster_id = Column(Integer, index=True)
    lat = Column(Float)
    lon = Column(Float)
    violation_types = Column(JSON)    # list of strings
    vehicle_type = Column(String(100))
    police_station = Column(String(200))
    junction_name = Column(String(200))
    created_hour = Column(Integer)
    created_dow = Column(Integer)     # 0=Mon
    created_month = Column(Integer)
    validation_status = Column(String(50))
    device_id = Column(String(100))
    location_text = Column(Text)
    pin_code = Column(String(10))


class CoverageGap(Base):
    __tablename__ = "coverage_gaps"

    id = Column(Integer, primary_key=True)
    device_id = Column(String(100))
    police_station = Column(String(200))
    min_hour = Column(Integer)
    max_hour = Column(Integer)
    total_records = Column(Integer)


class RepeatOffender(Base):
    __tablename__ = "repeat_offenders"

    id = Column(Integer, primary_key=True)
    vehicle_number = Column(String(50), index=True)
    citation_count = Column(Integer)
    police_stations = Column(JSON)
    violation_types = Column(JSON)
    last_seen = Column(String(50))


class PipelineRun(Base):
    """Tracks whether the ETL pipeline has completed so we don't re-run."""
    __tablename__ = "pipeline_runs"

    id = Column(Integer, primary_key=True)
    status = Column(String(50))           # "complete" | "running" | "failed"
    rows_loaded = Column(Integer)
    hotspots_found = Column(Integer)
    ran_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text)
