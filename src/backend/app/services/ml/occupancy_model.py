import math
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Tuple
import numpy as np
from sqlalchemy.orm import Session

from app.models.entities import Berth, Vessel, Crane, WeatherEvent
from app.services.ml.eta_model import ETACorrectionModel
from app.services.ml.feature_store import FeatureStore


def to_aware_utc(dt: datetime) -> datetime:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class BerthOccupancyForecaster:
    """
    F-202 / F-204 / 06_ml_engineering.md §3.2:
    72-hour probabilistic occupancy forecasting and anchorage queue prediction.
    Outputs hour-by-hour occupancy probability with uncertainty bands (F-207).
    """

    def __init__(self, eta_model: ETACorrectionModel):
        self.eta_model = eta_model

    def forecast_72h(
        self,
        db: Session,
        horizon_hours: int = 72
    ) -> Tuple[Dict[str, List[Dict[str, Any]]], List[Dict[str, Any]]]:
        """
        Generates 72-hour forecast for each berth and offshore anchorage queue.
        Returns (berth_forecasts_map, anchorage_timeline).
        """
        now = to_aware_utc(datetime.now(timezone.utc))
        port_context = FeatureStore.get_port_context(db, now)

        berths: List[Berth] = db.query(Berth).all()
        vessels: List[Vessel] = db.query(Vessel).all()
        cranes_by_berth = {b.id: [c for c in b.cranes] for b in berths}

        # Predict corrected ETAs and dwell times for all scheduled vessels
        vessel_schedules = []
        for v in vessels:
            if v.status == "DEPARTED":
                continue

            v_eta = to_aware_utc(v.carrier_eta)
            corr_eta, offset_h, conf_low, conf_high, factors = self.eta_model.predict_vessel_eta(v, port_context)
            corr_eta = to_aware_utc(corr_eta)

            # Dwell duration based on TEU, normalized class, and berth crane capacity
            v_class_raw = (v.vessel_class or "").strip().upper()
            if "FEEDER" in v_class_raw:
                nominal_dwell = max(10.0, min(20.0, v.cargo_volume / 200.0))
            elif "PANAMAX" in v_class_raw and "POST" not in v_class_raw:
                nominal_dwell = max(18.0, min(32.0, v.cargo_volume / 220.0))
            elif "POST" in v_class_raw:
                nominal_dwell = max(26.0, min(42.0, v.cargo_volume / 240.0))
            else:  # ULCV / ULTRA_LARGE
                nominal_dwell = max(36.0, min(56.0, v.cargo_volume / 260.0))

            # Priority cargo fast-tracks crane turnaround (-15% dwell)
            if v.priority_flag:
                nominal_dwell *= 0.85

            start = v_eta if v.status == "BERTHED" else corr_eta
            vessel_schedules.append({
                "vessel": v,
                "start_time": start,
                "dwell_hours": round(nominal_dwell, 1),
                "end_time": start + timedelta(hours=nominal_dwell),
                "factors": factors
            })

        berth_forecasts: Dict[str, List[Dict[str, Any]]] = {b.id: [] for b in berths}
        anchorage_timeline: List[Dict[str, Any]] = []

        # Current anchorage count
        current_anchored = sum(1 for v in vessels if v.status == "ANCHORED")

        # Simulate hour-by-hour through the 72-hour horizon
        for h in range(1, horizon_hours + 1):
            target_hour = now + timedelta(hours=h)

            for b in berths:
                # Calculate occupancy probability at target_hour for berth b
                prob, exp_vessel, top_factors = self._compute_berth_hour_probability(
                    b, target_hour, vessel_schedules, cranes_by_berth.get(b.id, []), port_context, vessels
                )

                # Confidence bounds: 10th and 90th percentile
                # Uncertainty widens gracefully as horizon h grows
                uncertainty_margin = min(0.16, 0.03 + (h / horizon_hours) * 0.11)
                conf_low = max(0.0, prob - uncertainty_margin)
                conf_high = min(1.0, prob + uncertainty_margin)

                # Assign risk tier (F-203)
                if prob >= 0.85:
                    tier = "RED"
                elif prob >= 0.60:
                    tier = "AMBER"
                else:
                    tier = "GREEN"

                berth_forecasts[b.id].append({
                    "hour_offset": h,
                    "forecast_time": target_hour,
                    "occupancy_probability": round(prob, 2),
                    "confidence_low": round(conf_low, 2),
                    "confidence_high": round(conf_high, 2),
                    "risk_tier": tier,
                    "expected_vessel_id": exp_vessel.id if exp_vessel else None,
                    "expected_vessel_name": exp_vessel.name if exp_vessel else None,
                    "top_factors": top_factors,
                })

            # Calculate anchorage queue forecast (F-204)
            # Count incoming vessels waiting for compatible berths
            active_waiting = sum(
                1 for s in vessel_schedules
                if s["vessel"].status == "ANCHORED" or (
                    s["vessel"].status == "SCHEDULED" and s["start_time"] <= target_hour
                )
            )
            berths_discharging = sum(
                1 for b in berths
                if any(s["vessel"].assigned_berth_id == b.id and s["start_time"] <= target_hour <= s["end_time"] for s in vessel_schedules)
            )

            # Equilibrium queue based on arrival rate and berth service throughput
            queue_decay = max(0.15, 1.0 - (h / 48.0))
            pred_queue = max(0, min(25, int(round(current_anchored * queue_decay + active_waiting * 0.40 - berths_discharging * 0.15))))
            q_low = max(0, pred_queue - 2)
            q_high = pred_queue + 3

            anchorage_timeline.append({
                "hour_offset": h,
                "forecast_time": target_hour,
                "predicted_queue": pred_queue,
                "confidence_low": q_low,
                "confidence_high": q_high,
            })

        return berth_forecasts, anchorage_timeline

    def _compute_berth_hour_probability(
        self,
        berth: Berth,
        target_hour: datetime,
        vessel_schedules: List[Dict[str, Any]],
        cranes: List[Crane],
        port_context: Dict[str, Any],
        all_vessels: List[Vessel] = None
    ) -> Tuple[float, Any, List[Dict[str, Any]]]:
        """Calculates occupancy probability and explainable factor attribution for a specific berth-hour."""
        overlapping_vessels = []
        near_vessels = []

        for s in vessel_schedules:
            v: Vessel = s["vessel"]
            is_assigned = (v.assigned_berth_id == berth.id)
            is_active_berthed = (v.status == "BERTHED" and v.assigned_berth_id == berth.id)

            if is_assigned or is_active_berthed:
                if s["start_time"] <= target_hour <= s["end_time"]:
                    overlapping_vessels.append(s)
                elif abs((s["start_time"] - target_hour).total_seconds()) <= 3600 or abs((s["end_time"] - target_hour).total_seconds()) <= 3600:
                    near_vessels.append(s)

        has_crane_breakdown = any(c.status == "BREAKDOWN" for c in cranes)
        operational_cranes = sum(1 for c in cranes if c.status == "OPERATIONAL")
        factors = []

        if len(overlapping_vessels) >= 2:
            # Overlapping berth collision!
            prob = 0.96
            v_names = ", ".join(s["vessel"].name for s in overlapping_vessels[:2])
            factors.append({
                "feature_name": "Quay Collision / Multi-Vessel Clashing",
                "impact_pct": 50,
                "direction": "INCREASE",
                "description": f"Schedule overlap between {v_names} at {berth.name}"
            })
            exp_vessel = overlapping_vessels[0]["vessel"]

        elif len(overlapping_vessels) == 1:
            s = overlapping_vessels[0]
            exp_vessel = s["vessel"]
            base_prob = 0.90 if exp_vessel.status == "BERTHED" else 0.82
            
            # Spatial footprint
            len_ratio = exp_vessel.length_m / max(1.0, berth.length_m)
            if len_ratio >= 0.85:
                factors.append({
                    "feature_name": "Quayside Spatial Footprint",
                    "impact_pct": 35,
                    "direction": "INCREASE",
                    "description": f"{exp_vessel.name} ({exp_vessel.length_m}m) occupies {round(len_ratio * 100)}% of {berth.name} quay length"
                })
            
            # Draft under-keel clearance
            draft_margin = berth.draft_limit_m - exp_vessel.draft_m
            if draft_margin < 1.0:
                factors.append({
                    "feature_name": "Under-Keel Clearance Margin",
                    "impact_pct": 25,
                    "direction": "INCREASE",
                    "description": f"Tight draft margin ({draft_margin:.1f}m) requires tidal assistance for docking"
                })

            prob = min(0.95, base_prob + (0.05 if len_ratio > 0.9 else 0.0))
            factors.extend(s.get("factors", []))

        elif len(near_vessels) >= 1:
            # Mooring / unmooring transition buffer
            exp_vessel = near_vessels[0]["vessel"]
            prob = 0.38
            factors.append({
                "feature_name": "Mooring & Pilotage Transition Buffer",
                "impact_pct": 20,
                "direction": "INCREASE",
                "description": f"Tug maneuvers and line handling for {exp_vessel.name}"
            })

        else:
            # Berth currently free; check queue backlog compatible with this berth
            exp_vessel = None
            compatible_anchored = 0
            if all_vessels:
                compatible_anchored = sum(
                    1 for v in all_vessels
                    if v.status == "ANCHORED" and v.length_m <= berth.length_m and v.draft_m <= berth.draft_limit_m
                )
            
            if compatible_anchored >= 2:
                prob = min(0.45, 0.15 + compatible_anchored * 0.08)
                factors.append({
                    "feature_name": "Queued Anchorage Inflow",
                    "impact_pct": 25,
                    "direction": "INCREASE",
                    "description": f"{compatible_anchored} anchored vessels awaiting compatible quay slot at {berth.name}"
                })
            else:
                prob = 0.10

        # Adjust for crane outage
        if has_crane_breakdown:
            prob = min(0.98, prob + 0.15)
            factors.append({
                "feature_name": "STS Crane Capacity Curtailment",
                "impact_pct": 30,
                "direction": "INCREASE",
                "description": f"Crane out of service at {berth.name} ({operational_cranes}/{len(cranes)} operational) extends container dwell"
            })

        # Adjust for tidal restriction
        if port_context.get("tidal_active", False) and berth.draft_limit_m > 14.0:
            factors.append({
                "feature_name": "Tidal Gate Restriction",
                "impact_pct": 20,
                "direction": "INCREASE",
                "description": "High tide navigation window required for deepwater quay egress"
            })

        # Keep top 3 factors only (F-206)
        top_3_factors = factors[:3]
        if not top_3_factors:
            top_3_factors.append({
                "feature_name": "Nominal Operating Buffer",
                "impact_pct": 10,
                "direction": "DECREASE",
                "description": "Berth possesses sufficient quay length, draft depth, and STS crane coverage"
            })

        return prob, exp_vessel, top_3_factors
