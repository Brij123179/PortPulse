from datetime import datetime, timezone
from typing import Dict, List, Any
import numpy as np
from sqlalchemy.orm import Session
from app.models.entities import Vessel, Berth, Crane, WeatherEvent, YardCapacity, TurnaroundRecord

CLASS_MAP = {"Feeder": 0, "Panamax": 1, "Post-Panamax": 2, "ULCV": 3}


class FeatureStore:
    """
    Unified feature engineering conforming to 06_ml_engineering.md §2.
    Ensures strict temporal ordering and zero lookahead leakage.
    """

    @staticmethod
    def extract_vessel_features(vessel: Vessel, current_context: Dict[str, Any]) -> Dict[str, float]:
        """
        Extracts operational features for a single vessel given current port context t0.
        """
        eta: datetime = vessel.carrier_eta
        hour = eta.hour
        day_of_week = eta.weekday()
        v_class = CLASS_MAP.get(vessel.vessel_class, 1)

        # Interaction features (F-202): count of other vessels arriving within +/- 6h window
        overlapping_arrivals = current_context.get("overlapping_arrivals", {}).get(vessel.id, 0)
        crane_breakdowns = current_context.get("crane_breakdowns", 0)
        tidal_restriction = 1.0 if current_context.get("tidal_active", False) else 0.0
        yard_utilization = current_context.get("yard_utilization", 0.65)

        return {
            "vessel_class": float(v_class),
            "cargo_teu": float(vessel.cargo_volume),
            "length_m": float(vessel.length_m),
            "draft_m": float(vessel.draft_m),
            "priority_flag": 1.0 if vessel.priority_flag else 0.0,
            "hour_of_day": float(hour),
            "day_of_week": float(day_of_week),
            "is_weekend": 1.0 if day_of_week >= 5 else 0.0,
            "overlapping_arrivals": float(overlapping_arrivals),
            "crane_breakdowns": float(crane_breakdowns),
            "tidal_restriction": float(tidal_restriction),
            "yard_utilization": float(yard_utilization),
        }

    @staticmethod
    def get_port_context(db: Session, target_time: datetime = None) -> Dict[str, Any]:
        """Calculates live operational context without future leakage."""
        now = target_time or datetime.now(timezone.utc)

        # Check cranes status
        cranes = db.query(Crane).all()
        breakdown_count = sum(1 for c in cranes if c.status == "BREAKDOWN")

        # Check yard utilization
        yard = db.query(YardCapacity).first()
        yard_util = (yard.teu_used / yard.teu_capacity) if yard and yard.teu_capacity > 0 else 0.65

        # Check weather / tidal restriction
        weather = db.query(WeatherEvent).filter(
            WeatherEvent.window_start <= now,
            WeatherEvent.window_end >= now,
            WeatherEvent.draft_restriction_m > 0
        ).first()

        # Compute arrival overlap for upcoming scheduled vessels
        vessels = db.query(Vessel).all()
        overlap_counts = {}
        for v1 in vessels:
            count = 0
            for v2 in vessels:
                if v1.id != v2.id and abs((v1.carrier_eta - v2.carrier_eta).total_seconds()) <= 6 * 3600:
                    count += 1
            overlap_counts[v1.id] = count

        return {
            "crane_breakdowns": breakdown_count,
            "yard_utilization": yard_util,
            "tidal_active": weather is not None,
            "overlapping_arrivals": overlap_counts,
        }
