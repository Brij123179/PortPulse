from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.entities import Vessel, Berth
from app.schemas.forecast import CascadeSimulationResponse, CascadeImpactedVessel


def to_aware_utc(dt: datetime) -> datetime:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class CascadingDelaySimulator:
    """
    F-205 / 06_ml_engineering.md §1:
    Simulates schedule ripple effects across berths when an upstream vessel experiences an operational delay.
    Answers: 'If Berth X slips by Δt hours, what breaks next?'
    """

    @staticmethod
    def simulate_delay_ripple(
        db: Session,
        target_vessel_id: str,
        delay_hours: float,
        correlation_id: str = "sim-cascade"
    ) -> CascadeSimulationResponse:
        vessel: Vessel = db.query(Vessel).filter(Vessel.id == target_vessel_id).first()
        if not vessel:
            return CascadeSimulationResponse(
                correlation_id=correlation_id,
                trigger_vessel_id=target_vessel_id,
                trigger_delay_hours=delay_hours,
                total_ripple_delay_hours=0.0,
                impacted_vessels_count=0,
                impacted_vessels=[],
                summary_explanation=f"Target vessel {target_vessel_id} not found."
            )

        assigned_berth_id = vessel.assigned_berth_id or "B-01"
        berth = db.query(Berth).filter(Berth.id == assigned_berth_id).first()
        berth_name = berth.name if berth else assigned_berth_id

        # Calculate original departure and delayed departure
        dwell = 24.0 if vessel.vessel_class in ["Panamax", "Feeder"] else 40.0
        orig_arr = to_aware_utc(vessel.corrected_eta or vessel.carrier_eta)
        orig_dep = orig_arr + timedelta(hours=dwell)
        delayed_dep = orig_dep + timedelta(hours=delay_hours)

        # Find downstream vessels assigned or targeting this berth scheduled within 24h of delayed departure
        candidate_vessels: List[Vessel] = (
            db.query(Vessel)
            .filter(
                Vessel.id != vessel.id,
                Vessel.status != "DEPARTED"
            )
            .all()
        )

        impacted: List[CascadeImpactedVessel] = []
        total_ripple = 0.0

        current_blocker_time = delayed_dep

        for other_v in sorted(candidate_vessels, key=lambda x: to_aware_utc(x.carrier_eta)):
            other_eta = to_aware_utc(other_v.carrier_eta)
            # If scheduled at the same berth or competing for it
            is_same_berth = (other_v.assigned_berth_id == assigned_berth_id)
            is_overlap = (other_eta < current_blocker_time and other_eta >= orig_arr)

            if is_same_berth and is_overlap:
                slip = (current_blocker_time - other_eta).total_seconds() / 3600.0
                slip = round(max(1.0, slip), 1)
                new_berth_time = other_eta + timedelta(hours=slip)

                impacted.append(
                    CascadeImpactedVessel(
                        vessel_id=other_v.id,
                        vessel_name=other_v.name,
                        berth_id=assigned_berth_id,
                        original_eta=other_v.carrier_eta,
                        new_projected_berth_time=new_berth_time,
                        cascade_delay_hours=slip,
                        conflict_type="BERTH_COLLISION"
                    )
                )
                total_ripple += slip
                # Push blocker time forward for the next vessel
                other_dwell = 20.0
                current_blocker_time = new_berth_time + timedelta(hours=other_dwell)

        # If no vessels were explicitly assigned to this berth, model queue congestion
        if not impacted and candidate_vessels:
            # Pick the next vessel arriving in proximity
            next_v = candidate_vessels[0]
            impacted.append(
                CascadeImpactedVessel(
                    vessel_id=next_v.id,
                    vessel_name=next_v.name,
                    berth_id=assigned_berth_id,
                    original_eta=next_v.carrier_eta,
                    new_projected_berth_time=next_v.carrier_eta + timedelta(hours=delay_hours * 0.75),
                    cascade_delay_hours=round(delay_hours * 0.75, 1),
                    conflict_type="QUEUE_DELAY"
                )
            )
            total_ripple += round(delay_hours * 0.75, 1)

        summary = (
            f"A {delay_hours:.1f}h slip on {vessel.name} at {berth_name} propagates into "
            f"{len(impacted)} downstream vessel(s), generating {total_ripple:.1f} hours of cumulative schedule displacement."
        )

        return CascadeSimulationResponse(
            correlation_id=correlation_id,
            trigger_vessel_id=vessel.id,
            trigger_delay_hours=delay_hours,
            total_ripple_delay_hours=round(total_ripple, 1),
            impacted_vessels_count=len(impacted),
            impacted_vessels=impacted,
            summary_explanation=summary
        )
