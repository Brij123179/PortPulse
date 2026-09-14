from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from app.core.database import Base
from app.models.entities import utcnow


class RiskScoreRecord(Base):
    """
    F-203 / F-206 / 05_backend.md §2:
    RiskScore(id, berth_id, hour_window, tier, confidence_low, confidence_high, top_factors[], model_version)
    """
    __tablename__ = "risk_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    berth_id = Column(String(50), nullable=False, index=True)
    hour_offset = Column(Integer, nullable=False) # 1 to 72
    forecast_timestamp = Column(DateTime, nullable=False)
    tier = Column(String(20), nullable=False) # GREEN, AMBER, RED
    occupancy_prob = Column(Float, nullable=False)
    confidence_low = Column(Float, nullable=False)
    confidence_high = Column(Float, nullable=False)
    top_factors_json = Column(Text, nullable=False, default="[]")
    model_version = Column(String(50), nullable=False, default="lgb-v1.0.0")
    created_at = Column(DateTime, default=utcnow)


class AnchorageQueueRecord(Base):
    """F-204: Offshore queue forecast per hour."""
    __tablename__ = "anchorage_forecasts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    hour_offset = Column(Integer, nullable=False)
    forecast_timestamp = Column(DateTime, nullable=False)
    predicted_queue = Column(Integer, nullable=False)
    confidence_low = Column(Integer, nullable=False)
    confidence_high = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=utcnow)
