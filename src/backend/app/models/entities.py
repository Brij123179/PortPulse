from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Vessel(Base):
    __tablename__ = "vessels"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    vessel_class = Column(String(50), nullable=False)  # Feeder, Panamax, Post-Panamax, Ultra Large Container Vessel (ULCV)
    cargo_volume = Column(Integer, nullable=False)      # TEU count
    carrier_eta = Column(DateTime, nullable=False)
    corrected_eta = Column(DateTime, nullable=True)
    eta_confidence = Column(Float, default=0.90)       # 0.0 to 1.0
    priority_flag = Column(Boolean, default=False)     # True if high priority (perishable/SLA)
    length_m = Column(Float, nullable=False)           # Length overall in meters
    draft_m = Column(Float, nullable=False)            # Operational draft in meters
    status = Column(String(50), default="SCHEDULED", index=True)   # SCHEDULED, ANCHORED, BERTHED, DEPARTED
    assigned_berth_id = Column(String(50), ForeignKey("berths.id"), nullable=True, index=True)

    berth = relationship("Berth", back_populates="vessels")


class Berth(Base):
    __tablename__ = "berths"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    length_m = Column(Float, nullable=False)           # Total berth quay length in meters
    draft_limit_m = Column(Float, nullable=False)      # Maximum permissible draft in meters
    crane_slots = Column(Integer, default=2)           # Max concurrent cranes supported
    contractual_priority_rules = Column(Text, nullable=True)  # JSON or text notes
    status = Column(String(50), default="AVAILABLE", index=True)   # AVAILABLE, OCCUPIED, MAINTENANCE

    vessels = relationship("Vessel", back_populates="berth")
    cranes = relationship("Crane", back_populates="berth", lazy="selectin")


class Crane(Base):
    __tablename__ = "cranes"

    id = Column(String(50), primary_key=True, index=True)
    berth_id = Column(String(50), ForeignKey("berths.id"), nullable=False)
    name = Column(String(100), nullable=False)
    crane_type = Column(String(50), default="STS")     # Ship-to-Shore, Gantry
    status = Column(String(50), default="OPERATIONAL") # OPERATIONAL, MAINTENANCE, BREAKDOWN
    maintenance_windows_json = Column(Text, default="[]")

    berth = relationship("Berth", back_populates="cranes")


class YardCapacity(Base):
    __tablename__ = "yard_capacity"

    id = Column(Integer, primary_key=True, autoincrement=True)
    teu_capacity = Column(Integer, nullable=False, default=50000)
    teu_used = Column(Integer, nullable=False, default=32000)
    reefer_plugs_available = Column(Integer, default=500)
    reefer_plugs_used = Column(Integer, default=320)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class TurnaroundRecord(Base):
    """Historical dwell and delay log for model training (F-103)."""
    __tablename__ = "turnaround_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vessel_id = Column(String(50), nullable=False, index=True)
    vessel_class = Column(String(50), nullable=False, index=True)
    berth_id = Column(String(50), nullable=False, index=True)
    arrival_time = Column(DateTime, nullable=False)
    departure_time = Column(DateTime, nullable=False)
    actual_dwell_hours = Column(Float, nullable=False)
    scheduled_dwell_hours = Column(Float, nullable=False)
    delay_cause = Column(String(100), default="NONE")  # CRANE_OUTAGE, WEATHER, YARD_CONGESTION, NONE
    delay_minutes = Column(Integer, default=0)
    shift_id = Column(String(50), default="SHIFT_A")
    recorded_at = Column(DateTime, default=utcnow)


class WeatherEvent(Base):
    __tablename__ = "weather_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    window_start = Column(DateTime, nullable=False)
    window_end = Column(DateTime, nullable=False)
    severity = Column(String(50), default="MODERATE")  # LOW, MODERATE, HIGH, CRITICAL
    event_type = Column(String(50), default="TIDE_RESTRICTION")  # HIGH_WIND, FOG, TIDE_RESTRICTION
    draft_restriction_m = Column(Float, default=0.0)
    wind_speed_knots = Column(Float, default=15.0)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    role = Column(String(50), nullable=False, default="shift_supervisor")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)


class AuditLogEntry(Base):
    """Append-only audit trail (F-501, cross-cutting)."""
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    correlation_id = Column(String(100), nullable=False, index=True)
    actor = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(String(50), nullable=False)
    payload_snapshot = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utcnow)
