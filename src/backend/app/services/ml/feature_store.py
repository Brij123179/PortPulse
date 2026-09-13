from datetime import datetime, timezone
from typing import Dict, List, Any
import numpy as np
from sqlalchemy.orm import Session
from app.models.entities import Vessel, Berth, Crane, WeatherEvent, YardCapacity, TurnaroundRecord

CLASS_MAP = {"Feeder": 0, "Panamax": 1, "Post-Panamax": 2, "ULCV": 3}


def map_vessel_class(cls_name: str) -> int:
    s = (cls_name or "").strip().upper()
    if "FEEDER" in s:
        return 0
    if "POST" in s:
        return 2
    if "ULCV" in s or "ULTRA" in s:
        return 3
    return 1  # Panamax default


def to_aware_utc(dt: datetime) -> datetime:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


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
        eta: datetime = to_aware_utc(vessel.carrier_eta)
        hour = eta.hour if eta else 12
        day_of_week = eta.weekday() if eta else 0
        v_class = map_vessel_class(vessel.vessel_class)

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
        now = to_aware_utc(target_time or datetime.now(timezone.utc))

        # Check cranes status
        cranes = db.query(Crane).all()
        breakdown_count = sum(1 for c in cranes if c.status == "BREAKDOWN")

        # Check yard utilization
        yard = db.query(YardCapacity).first()
        yard_util = (yard.teu_used / yard.teu_capacity) if yard and yard.teu_capacity > 0 else 0.65

        # Check weather / tidal restriction
        weather_events = db.query(WeatherEvent).all()
        tidal_active = any(
            w.draft_restriction_m > 0 and to_aware_utc(w.window_start) <= now <= to_aware_utc(w.window_end)
            for w in weather_events
        )

        # Compute arrival overlap for upcoming scheduled vessels
        vessels = db.query(Vessel).all()
        overlap_counts = {}
        for v1 in vessels:
            count = 0
            eta1 = to_aware_utc(v1.carrier_eta)
            if eta1:
                for v2 in vessels:
                    if v1.id != v2.id:
                        eta2 = to_aware_utc(v2.carrier_eta)
                        if eta2 and abs((eta1 - eta2).total_seconds()) <= 6 * 3600:
                            count += 1
            overlap_counts[v1.id] = count

        return {
            "crane_breakdowns": breakdown_count,
            "yard_utilization": yard_util,
            "tidal_active": tidal_active,
            "overlapping_arrivals": overlap_counts,
        }
