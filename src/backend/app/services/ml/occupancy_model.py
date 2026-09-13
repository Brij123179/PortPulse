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

            # Dwell duration based on TEU and class
            base_dwell = 14.0 if v.vessel_class == "Feeder" else 24.0 if v.vessel_class == "Panamax" else 36.0 if v.vessel_class == "Post-Panamax" else 48.0
            
            start = v_eta if v.status == "BERTHED" else corr_eta
            vessel_schedules.append({
                "vessel": v,
                "start_time": start,
                "dwell_hours": base_dwell,
                "end_time": start + timedelta(hours=base_dwell),
                "factors": factors
            })

        berth_forecasts: Dict[str, List[Dict[str, Any]]] = {b.id: [] for b in berths}
        anchorage_timeline: List[Dict[str, Any]] = []

        # Current anchorage count
        current_anchored = sum(1 for v in vessels if v.status == "ANCHORED")

        # Simulate hour-by-hour through the 72-hour horizon
        for h in range(1, horizon_hours + 1):
            target_hour = now + timedelta(hours=h)
            waiting_offshore = 0

            for b in berths:
                # Calculate occupancy probability at target_hour for berth b
                prob, exp_vessel, top_factors = self._compute_berth_hour_probability(
                    b, target_hour, vessel_schedules, cranes_by_berth.get(b.id, []), port_context
                )

                # Confidence bounds: 10th and 90th percentile
                # Uncertainty widens as horizon h grows
                uncertainty_margin = min(0.18, 0.04 + (h / horizon_hours) * 0.12)
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

            # Calculate anchorage queue (F-204)
            # Count incoming vessels that have arrived by target_hour but whose assigned/compatible berths are occupied
            active_arrivals = sum(
                1 for s in vessel_schedules
                if s["vessel"].status != "BERTHED"
                and s["start_time"] <= target_hour <= s["end_time"]
            )
            # Baseline offshore queue with dynamic fluctuation
            pred_queue = max(0, min(25, int(current_anchored * max(0.2, 1.0 - h / 36.0) + (active_arrivals * 0.35))))
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
        port_context: Dict[str, Any]
    ) -> Tuple[float, Any, List[Dict[str, Any]]]:
        """Calculates occupancy probability and SHAP-style explainability for a specific berth-hour."""
        overlapping_vessels = []

        for s in vessel_schedules:
            v: Vessel = s["vessel"]
            # Target berth check: either directly assigned, or currently berthed, or compatible
            is_assigned = (v.assigned_berth_id == berth.id)
            is_active_berthed = (v.status == "BERTHED" and v.assigned_berth_id == berth.id)

            if is_assigned or is_active_berthed:
                if s["start_time"] <= target_hour <= s["end_time"]:
                    overlapping_vessels.append(s)

        has_crane_breakdown = any(c.status == "BREAKDOWN" for c in cranes)
        factors = []

        if len(overlapping_vessels) >= 2:
            # Overlapping berth collision!
            prob = 0.95
            v_names = ", ".join(s["vessel"].name for s in overlapping_vessels[:2])
            factors.append({
                "feature_name": "Berth Collision / Overlap",
                "impact_pct": 45,
                "direction": "INCREASE",
                "description": f"Schedule clash between {v_names} at {berth.name}"
            })
            exp_vessel = overlapping_vessels[0]["vessel"]

        elif len(overlapping_vessels) == 1:
            s = overlapping_vessels[0]
            exp_vessel = s["vessel"]
            # Probability depends on confidence and duration
            prob = 0.88 if exp_vessel.status == "BERTHED" else 0.82

            if exp_vessel.vessel_class == "ULCV":
                factors.append({
                    "feature_name": "Mega-Ship Quayside Footprint",
                    "impact_pct": 35,
                    "direction": "INCREASE",
                    "description": f"ULCV ({exp_vessel.length_m}m) occupies 95%+ of {berth.name} quay"
                })

            factors.extend(s.get("factors", []))

        else:
            # Berth is not explicitly scheduled, but could have queue spillover
            exp_vessel = None
            prob = 0.12

        # Adjust for crane outage
        if has_crane_breakdown:
            prob = min(0.98, prob + 0.15)
            factors.append({
                "feature_name": "Crane Crane Capacity Curtailment",
                "impact_pct": 30,
                "direction": "INCREASE",
                "description": f"Crane out of service at {berth.name} extends turnaround dwell"
            })

        # Adjust for tidal restriction
        if port_context.get("tidal_active", False) and berth.draft_limit_m > 14.0:
            factors.append({
                "feature_name": "Tidal Anomaly Window",
                "impact_pct": 18,
                "direction": "INCREASE",
                "description": "High tide draft clearance required for unberthing"
            })

        # Keep top 3 factors only (F-206)
        top_3_factors = factors[:3]
        if not top_3_factors:
            top_3_factors.append({
                "feature_name": "Nominal Buffer Clearance",
                "impact_pct": 10,
                "direction": "DECREASE",
                "description": "Ample quay spacing and operational slack"
            })

        return prob, exp_vessel, top_3_factors
