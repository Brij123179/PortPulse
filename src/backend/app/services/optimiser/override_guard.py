"""
Manual Override Guardrail Validator (F-307 / 02_srs.md §3.3)
Validates manual supervisor reassignments against physical and temporal hard constraints:
1. Vessel draft <= Berth draft limit
2. Vessel length <= Berth quay length
3. Berth availability / collision detection (no double-booking)
Hard constraint violations are rejected outright with an explicit error.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session

from app.models.entities import Berth, Vessel
from app.schemas.optimiser import ManualOverrideRequest, OverrideValidationResult, SuggestedResolution
from app.core.logging import logger, correlation_id_ctx


def to_aware_utc(dt: datetime) -> datetime:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class OverrideGuardrail:
    SAFETY_BUFFER_MINUTES = 45

    def validate_and_apply(
        self,
        db: Session,
        req: ManualOverrideRequest,
        actor_username: str
    ) -> OverrideValidationResult:
        """
        Validates manual supervisor override against physical constraints and collision checks.
        """
        corr_id = correlation_id_ctx.get() or "override-guard"

        # 1. Fetch vessel and target berth
        vessel = db.query(Vessel).filter(Vessel.id == req.vessel_id).first()
        if not vessel:
            return OverrideValidationResult(
                correlation_id=corr_id,
                is_valid=False,
                status="REJECTED_HARD_CONSTRAINT",
                vessel_id=req.vessel_id,
                vessel_name="Unknown",
                berth_id=req.target_berth_id,
                berth_name="Unknown",
                constraint_violations=[f"Vessel with ID '{req.vessel_id}' not found."],
                warnings=[],
                message="Override rejected: invalid vessel ID."
            )

        target_berth = db.query(Berth).filter(Berth.id == req.target_berth_id).first()
        if not target_berth:
            return OverrideValidationResult(
                correlation_id=corr_id,
                is_valid=False,
                status="REJECTED_HARD_CONSTRAINT",
                vessel_id=vessel.id,
                vessel_name=vessel.name,
                berth_id=req.target_berth_id,
                berth_name="Unknown",
                constraint_violations=[f"Target berth with ID '{req.target_berth_id}' not found."],
                warnings=[],
                message="Override rejected: target berth does not exist."
            )

        violations: List[str] = []
        warnings: List[str] = []

        # 2. Check Hard Physical Constraint 1: Draft
        if vessel.draft_m > target_berth.draft_limit_m:
            violations.append(
                f"DRAFT INCOMPATIBILITY: Vessel draft ({vessel.draft_m:.1f}m) exceeds berth draft limit ({target_berth.draft_limit_m:.1f}m) by {vessel.draft_m - target_berth.draft_limit_m:.1f}m. Severe grounding hazard."
            )

        # 3. Check Hard Physical Constraint 2: Length
        if vessel.length_m > target_berth.length_m:
            violations.append(
                f"QUAY LENGTH INCOMPATIBILITY: Vessel length ({vessel.length_m:.1f}m) exceeds available berth quay length ({target_berth.length_m:.1f}m) by {vessel.length_m - target_berth.length_m:.1f}m."
            )

        # 4. Check Temporal Overlap / Collision Constraint on Target Berth
        req_start = to_aware_utc(req.new_start_time)
        v_dwell = max(8.0, float(getattr(vessel, "dwell_hours", 24.0) or 24.0))
        req_end = req_start + timedelta(hours=v_dwell)

        # Query existing vessels currently assigned or berthed at target_berth
        other_vessels = db.query(Vessel).filter(
            Vessel.assigned_berth_id == target_berth.id,
            Vessel.id != vessel.id,
            Vessel.status.in_(["BERTHED", "SCHEDULED", "APPROACHING"])
        ).all()

        now_utc = datetime.now(timezone.utc)
        for ov in other_vessels:
            ov_eta = to_aware_utc(ov.corrected_eta or ov.carrier_eta or req_start)
            ov_dwell = max(8.0, float(getattr(ov, "dwell_hours", 24.0) or 24.0))
            ov_end = ov_eta + timedelta(hours=ov_dwell)
            if ov.status == "BERTHED":
                if ov_end <= now_utc:
                    ov_end = now_utc + timedelta(hours=8.0)
                if ov_eta >= now_utc:
                    ov_eta = now_utc - timedelta(hours=2.0)

            # Check overlap between [req_start, req_end] and [ov_eta, ov_end]
            if not (req_end <= ov_eta or req_start >= ov_end):
                violations.append(
                    f"BERTH OCCUPANCY COLLISION: Target berth '{target_berth.name}' is already reserved for '{ov.name}' from {ov_eta.strftime('%Y-%m-%d %H:%M')} to {ov_end.strftime('%Y-%m-%d %H:%M')}."
                )

        # Soft checks / warnings
        if target_berth.crane_slots < 2:
            warnings.append(
                f"Low crane capacity on berth ({target_berth.crane_slots} cranes available). Dwell time may increase."
            )

        if violations:
            logger.warning(
                f"Manual override for vessel {vessel.id} to berth {target_berth.id} REJECTED: {violations}",
                extra={"extra_data": {"violations": violations, "actor": actor_username}}
            )

            # Compute automated collision / constraint resolutions
            resolutions: List[SuggestedResolution] = []

            # 1. Alternative Berth Resolution (Find available compatible berths)
            all_berths = db.query(Berth).filter(Berth.id != target_berth.id).all()
            for cand_b in all_berths:
                if cand_b.status == "MAINTENANCE":
                    continue
                if vessel.draft_m > cand_b.draft_limit_m or vessel.length_m > cand_b.length_m:
                    continue
                
                # Check conflict on cand_b
                b_vessels = db.query(Vessel).filter(
                    Vessel.assigned_berth_id == cand_b.id,
                    Vessel.id != vessel.id,
                    Vessel.status.in_(["BERTHED", "SCHEDULED", "APPROACHING"])
                ).all()

                has_conflict = False
                for bv in b_vessels:
                    bv_eta = to_aware_utc(bv.corrected_eta or bv.carrier_eta or req_start)
                    bv_dwell = max(8.0, float(getattr(bv, "dwell_hours", 24.0) or 24.0))
                    bv_end = bv_eta + timedelta(hours=bv_dwell)
                    if bv.status == "BERTHED":
                        if bv_end <= now_utc:
                            bv_end = now_utc + timedelta(hours=8.0)
                        if bv_eta >= now_utc:
                            bv_eta = now_utc - timedelta(hours=2.0)
                    if not (req_end <= bv_eta or req_start >= bv_end):
                        has_conflict = True
                        break

                if not has_conflict:
                    resolutions.append(
                        SuggestedResolution(
                            resolution_type="ALTERNATIVE_BERTH",
                            description=f"Reassign to {cand_b.name} ({cand_b.id})",
                            target_berth_id=cand_b.id,
                            target_berth_name=cand_b.name,
                            recommended_start_time=req_start,
                            reasoning=f"Fully compatible (Max {cand_b.length_m:.0f}m LOA, {cand_b.draft_limit_m:.1f}m Draft) and immediately available with 0 collisions."
                        )
                    )
                    if len(resolutions) >= 3:
                        break

            # 2. Deferred Time Window Resolution (if target berth had a collision)
            colliding_ends = []
            for ov in other_vessels:
                ov_eta = to_aware_utc(ov.corrected_eta or ov.carrier_eta or req_start)
                ov_dwell = max(8.0, float(getattr(ov, "dwell_hours", 24.0) or 24.0))
                ov_end = ov_eta + timedelta(hours=ov_dwell)
                if not (req_end <= ov_eta or req_start >= ov_end):
                    colliding_ends.append(ov_end)

            if colliding_ends:
                earliest_free = max(colliding_ends) + timedelta(minutes=45)
                resolutions.append(
                    SuggestedResolution(
                        resolution_type="DEFERRED_TIME_WINDOW",
                        description=f"Schedule at {target_berth.name} starting {earliest_free.strftime('%Y-%m-%d %H:%M')}",
                        target_berth_id=target_berth.id,
                        target_berth_name=target_berth.name,
                        recommended_start_time=earliest_free,
                        reasoning="Immediate slot after current ship departs with mandatory 45-minute safety buffer."
                    )
                )

            return OverrideValidationResult(
                correlation_id=corr_id,
                is_valid=False,
                status="REJECTED_HARD_CONSTRAINT",
                vessel_id=vessel.id,
                vessel_name=vessel.name,
                berth_id=target_berth.id,
                berth_name=target_berth.name,
                constraint_violations=violations,
                warnings=warnings,
                suggested_resolutions=resolutions,
                message=f"Override rejected: {len(violations)} hard physical constraint violation(s) detected."
            )

        # 5. Apply the valid override to database
        vessel.assigned_berth_id = target_berth.id
        vessel.carrier_eta = req_start
        vessel.corrected_eta = req_start
        db.commit()
        db.refresh(vessel)

        try:
            from app.services.event_bus import event_bus, EventType
            event_bus.publish(
                EventType.ASSIGNMENT_CHANGED,
                entity_type="VESSEL",
                action="MANUAL_OVERRIDE",
                vessel_id=vessel.id,
                berth_id=target_berth.id
            )
        except Exception:
            pass

        logger.info(
            f"Manual override APPROVED: Vessel '{vessel.name}' reassigned to '{target_berth.name}' at {req_start.isoformat()} by '{actor_username}' (Reason: {req.override_reason})",
            extra={"extra_data": {"vessel": vessel.id, "berth": target_berth.id, "actor": actor_username}}
        )

        return OverrideValidationResult(
            correlation_id=corr_id,
            is_valid=True,
            status="APPROVED",
            vessel_id=vessel.id,
            vessel_name=vessel.name,
            berth_id=target_berth.id,
            berth_name=target_berth.name,
            constraint_violations=[],
            warnings=warnings,
            message=f"Override successfully verified and applied: {vessel.name} assigned to {target_berth.name}."
        )


override_guard = OverrideGuardrail()
