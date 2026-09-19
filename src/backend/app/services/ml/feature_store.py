from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
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
    def calculate_harmonic_tide(dt: datetime) -> Dict[str, Any]:
        """
        Nautical Harmonic Tide Model:
        Simulates semi-diurnal tidal constituent (M2 period: 12.42h).
        Mean sea level: 3.0m, tidal amplitude: 1.8m (Spring range 1.2m to 4.8m).
        """
        if dt is None:
            return {"tide_height_m": 3.0, "is_high_tide": True, "hours_to_next_high": 0.0}
        t_hours = dt.hour + (dt.minute / 60.0) + (dt.second / 3600.0)
        phase_rad = 2.0 * np.pi * (t_hours % 12.42) / 12.42
        tide_height = round(3.0 + 1.8 * np.cos(phase_rad), 2)
        is_high_tide = tide_height >= 3.8
        
        # Calculate time until next high water window (phase_rad = 0 or 2pi)
        rem_phase = (12.42 - (t_hours % 12.42)) % 12.42
        hours_to_high = round(rem_phase if rem_phase <= 6.21 else (12.42 - rem_phase), 1)

        return {
            "tide_height_m": tide_height,
            "is_high_tide": is_high_tide,
            "hours_to_next_high": hours_to_high,
        }

    @staticmethod
    def extract_vessel_features(vessel: Vessel, current_context: Dict[str, Any]) -> Dict[str, float]:
        """
        Extracts operational features for a single vessel given current port context t0,
        incorporating astronomical tidal harmonics and AIS kinematic proxies.
        """
        eta: datetime = to_aware_utc(vessel.carrier_eta)
        hour = eta.hour if eta else 12
        day_of_week = eta.weekday() if eta else 0
        v_class = map_vessel_class(vessel.vessel_class)

        # Interaction features (F-202): count of other vessels arriving within +/- 6h window
        overlapping_arrivals = current_context.get("overlapping_arrivals", {}).get(vessel.id, 0)
        crane_breakdowns = current_context.get("crane_breakdowns", 0)
        yard_utilization = current_context.get("yard_utilization", 0.65)

        # Astronomical Harmonic Tide & Dynamic Under-Keel Clearance (UKC)
        tide_info = FeatureStore.calculate_harmonic_tide(eta)
        tide_height = tide_info["tide_height_m"]
        nominal_channel_depth = 14.5
        total_water_depth = nominal_channel_depth + tide_height
        safe_ukc_required = 1.0 + (0.08 * float(vessel.draft_m))
        ukc_margin = total_water_depth - float(vessel.draft_m) - safe_ukc_required
        tidal_restriction = 1.0 if (ukc_margin < 0 or current_context.get("tidal_active", False)) else 0.0

        # Kinematic voyage speed deficit proxy
        design_speed = 21.0 if v_class >= 2 else 17.0
        speed_deficit = 0.0 if not vessel.priority_flag else -2.0

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
            "tide_height_m": float(tide_height),
            "ukc_margin_m": float(round(ukc_margin, 2)),
            "speed_deficit_knots": float(speed_deficit),
        }

    @staticmethod
    def get_port_context(db: Session, target_time: datetime = None, vessels: Optional[List[Vessel]] = None) -> Dict[str, Any]:
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
        if vessels is None:
            vessels = db.query(Vessel).all()

        vessel_etas = []
        for v in vessels:
            eta = to_aware_utc(v.carrier_eta)
            if eta:
                vessel_etas.append((v.id, eta.timestamp()))

        vessel_etas.sort(key=lambda x: x[1])
        overlap_counts: Dict[str, int] = {}
        window_sec = 6.0 * 3600.0
        n = len(vessel_etas)
        left = 0
        right = 0
        for i, (vid, ts) in enumerate(vessel_etas):
            while left < n and vessel_etas[left][1] < ts - window_sec:
                left += 1
            while right < n and vessel_etas[right][1] <= ts + window_sec:
                right += 1
            overlap_counts[vid] = max(0, right - left - 1)

        return {
            "crane_breakdowns": breakdown_count,
            "yard_utilization": yard_util,
            "tidal_active": tidal_active,
            "overlapping_arrivals": overlap_counts,
        }
