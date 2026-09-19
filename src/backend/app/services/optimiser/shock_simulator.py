"""
Vessel Delay Shock & System Cascade Simulator (Operational Shock Lab)
Simulates the domino ripple effect of delaying an individual vessel across the port infrastructure:
- Solves baseline vs shocked MILP schedules via BerthCraneOptimiser
- Measures system-wide monetary damages (demurrage, bunker fuel idling, berth disruption overhead)
- Measures total time damages (port wait time spike, schedule slippage, recovery horizon)
- Identifies collaterally affected vessels with exact cascade trigger mechanisms
- Analyzes cross-fleet chain impacts on major global carrier alliances (2M, Ocean Alliance, THE Alliance, etc.)
- Synthesizes prescriptive mitigation interventions to neutralize the ripple effect
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.entities import Vessel, Berth, YardCapacity
from app.schemas.shock_simulation import (
    VesselDelayShockRequest,
    VesselDelayShockResponse,
    ShockSummaryImpact,
    FleetChainImpact,
    AffectedVesselDetail,
    MitigationAction,
    TargetVesselMetadata
)
from app.services.optimiser.solver import berth_optimiser, to_aware_utc
from app.services.optimiser.cost_engine import cost_engine
from app.services.audit import AuditService
from app.core.logging import logger, correlation_id_ctx


CARRIER_FLEET_MAPPING: List[Dict[str, Any]] = [
    {"keyword": "MAERSK", "carrier": "Maersk Line", "fleet": "2M Alliance"},
    {"keyword": "MSC", "carrier": "Mediterranean Shipping Co (MSC)", "fleet": "2M Alliance"},
    {"keyword": "CMA CGM", "carrier": "CMA CGM Group", "fleet": "Ocean Alliance"},
    {"keyword": "COSCO", "carrier": "COSCO Shipping Lines", "fleet": "Ocean Alliance"},
    {"keyword": "EVER", "carrier": "Evergreen Marine", "fleet": "Ocean Alliance"},
    {"keyword": "OOCL", "carrier": "OOCL", "fleet": "Ocean Alliance"},
    {"keyword": "ONE", "carrier": "Ocean Network Express (ONE)", "fleet": "THE / Premier Alliance"},
    {"keyword": "HMM", "carrier": "HMM (Hyundai Merchant Marine)", "fleet": "THE / Premier Alliance"},
    {"keyword": "YANG MING", "carrier": "Yang Ming Marine Transport", "fleet": "THE / Premier Alliance"},
    {"keyword": "HAPAG", "carrier": "Hapag-Lloyd", "fleet": "Gemini Cooperation"},
    {"keyword": "ZIM", "carrier": "ZIM Integrated Shipping", "fleet": "Independent Global Fleet"},
    {"keyword": "WAN HAI", "carrier": "Wan Hai Lines", "fleet": "Independent Asian Fleet"},
]


def resolve_carrier_and_fleet(vessel_name: str) -> Tuple[str, str]:
    """Resolves maritime carrier and global shipping alliance from vessel name."""
    v_upper = (vessel_name or "").upper().strip()
    for entry in CARRIER_FLEET_MAPPING:
        if entry["keyword"] in v_upper:
            return entry["carrier"], entry["fleet"]
    return "Regional Feeder Line", "Independent Regional Fleet"


class VesselDelayShockSimulator:
    """
    High-fidelity shock simulation engine that isolates and models the domino effects
    of a single vessel's schedule disruption across berths, queues, and shipping alliances.
    """

    def simulate_delay_shock(
        self,
        db: Session,
        req: VesselDelayShockRequest,
        actor_username: str = "system",
        actor_role: str = "shift_supervisor",
        actor_id: Optional[int] = None
    ) -> VesselDelayShockResponse:
        corr_id = correlation_id_ctx.get() or "shock-sim"
        now = datetime.now(timezone.utc)

        # 1. Locate target vessel
        target_vessel: Optional[Vessel] = None
        if req.vessel_id:
            target_vessel = db.query(Vessel).filter(Vessel.id == req.vessel_id).first()
        if not target_vessel and req.vessel_name:
            clean_name = req.vessel_name.strip()
            target_vessel = db.query(Vessel).filter(
                (Vessel.name.ilike(f"%{clean_name}%")) | (Vessel.id.ilike(f"%{clean_name}%"))
            ).first()
            if not target_vessel:
                sample_ships = [v.name for v in db.query(Vessel).limit(5).all()]
                sample_str = ", ".join(sample_ships)
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Vessel '{req.vessel_name}' not found in active fleet. Available vessels include: {sample_str}..."
                )
        if not target_vessel and not req.vessel_id and not req.vessel_name:
            # Fallback: pick the first scheduled / approaching vessel
            target_vessel = db.query(Vessel).filter(
                Vessel.status.in_(["SCHEDULED", "APPROACHING", "ANCHORED"])
            ).first()

        if not target_vessel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No active vessels available in the port fleet to simulate."
            )

        if target_vessel.status == "DEPARTED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Vessel {target_vessel.name} ({target_vessel.id}) has already departed the terminal."
            )

        target_carrier, target_fleet = resolve_carrier_and_fleet(target_vessel.name)

        # 2. Compute baseline schedule
        baseline_res = berth_optimiser.solve(db, horizon_hours=72)
        baseline_assignments = {a.vessel_id: a for a in baseline_res.assignments}

        # 3. Calculate shocked ETA for target vessel
        orig_eta = to_aware_utc(target_vessel.corrected_eta or target_vessel.carrier_eta or now)
        delayed_eta = orig_eta + timedelta(hours=req.delay_hours)

        # 4. Compute shocked schedule via non-destructive in-memory overrides
        vessel_overrides = {
            target_vessel.id: {
                "carrier_eta": delayed_eta,
                "corrected_eta": delayed_eta,
            }
        }
        shocked_res = berth_optimiser.solve(
            db, horizon_hours=72, vessel_overrides=vessel_overrides
        )
        shocked_assignments = {a.vessel_id: a for a in shocked_res.assignments}

        # 5. Find target vessel's assigned berths
        base_target_assign = baseline_assignments.get(target_vessel.id)
        shock_target_assign = shocked_assignments.get(target_vessel.id)
        target_berth_id = (shock_target_assign.assigned_berth_id if shock_target_assign else None) or \
                          (base_target_assign.assigned_berth_id if base_target_assign else target_vessel.assigned_berth_id)
        target_berth_name = (shock_target_assign.assigned_berth_name if shock_target_assign else None) or \
                            (base_target_assign.assigned_berth_name if base_target_assign else "Berth TBD")

        # 6. Evaluate domino impacts across all scheduled vessels
        affected_vessels: List[AffectedVesselDetail] = []
        total_wait_hours_added = 0.0
        total_demurrage_damages = 0.0

        # Primary target vessel impact
        target_wait_increase = 0.0
        target_demurrage_increase = 0.0
        if base_target_assign and shock_target_assign:
            target_wait_increase = max(0.0, round(shock_target_assign.wait_time_hours - base_target_assign.wait_time_hours, 1))
            target_demurrage_increase = max(0.0, round(shock_target_assign.demurrage_cost_usd - base_target_assign.demurrage_cost_usd, 2))

        if target_demurrage_increase <= 0.0:
            target_demurrage_increase = cost_engine.calculate_demurrage_saving(
                req.delay_hours, vessel_class=target_vessel.vessel_class, is_priority=getattr(target_vessel, "priority_flag", False)
            )

        cause_label = (req.delay_cause or "ENGINE_BREAKDOWN").replace("_", " ").title()

        affected_vessels.append(
            AffectedVesselDetail(
                vessel_id=target_vessel.id,
                vessel_name=target_vessel.name,
                vessel_class=target_vessel.vessel_class or "Panamax",
                carrier=target_carrier,
                fleet=target_fleet,
                assigned_berth_id=target_berth_id,
                assigned_berth_name=target_berth_name,
                original_start_time=(base_target_assign.start_time if base_target_assign else orig_eta).isoformat(),
                delayed_start_time=(shock_target_assign.start_time if shock_target_assign else delayed_eta).isoformat(),
                wait_increase_hours=round(req.delay_hours, 1),
                demurrage_impact_usd=target_demurrage_increase,
                impact_category="PRIMARY_SHOCK",
                impact_reason=f"Primary shock source: Injected {req.delay_hours:.1f}h delay due to {cause_label}.",
                severity="CRITICAL" if req.delay_hours >= 12.0 else "HIGH"
            )
        )
        total_wait_hours_added += req.delay_hours
        total_demurrage_damages += target_demurrage_increase

        # Secondary ripple impacts on other vessels
        for v_id, base_a in baseline_assignments.items():
            if v_id == target_vessel.id:
                continue

            shock_a = shocked_assignments.get(v_id)
            if not shock_a:
                continue

            # Compare wait times and start times
            wait_delta = round(shock_a.wait_time_hours - base_a.wait_time_hours, 1)
            demurrage_delta = round(shock_a.demurrage_cost_usd - base_a.demurrage_cost_usd, 2)
            time_shift_hours = round((shock_a.start_time - base_a.start_time).total_seconds() / 3600.0, 1)

            # Check if this vessel suffered collateral damage
            is_affected = wait_delta >= 0.3 or demurrage_delta >= 100.0 or time_shift_hours >= 0.8
            if is_affected:
                v_carrier, v_fleet = resolve_carrier_and_fleet(base_a.vessel_name)
                
                # Determine cascade category and specific reason
                if base_a.assigned_berth_id == target_berth_id or shock_a.assigned_berth_id == target_berth_id:
                    category = "BERTH_COLLISION_CASCADE"
                    reason = (
                        f"Direct Berth Conflict: Docking window displaced on {shock_a.assigned_berth_name} "
                        f"due to delayed quay occupancy of {target_vessel.name} (+{max(wait_delta, time_shift_hours):.1f}h wait)."
                    )
                    sev = "CRITICAL" if wait_delta >= 6.0 else "HIGH"
                elif shock_a.assigned_berth_id != base_a.assigned_berth_id:
                    category = "QUEUE_DISPLACEMENT"
                    reason = (
                        f"Queue Re-routing: Shifted from {base_a.assigned_berth_name} to {shock_a.assigned_berth_name} "
                        f"to prevent port gridlock (+{max(wait_delta, time_shift_hours):.1f}h schedule slippage)."
                    )
                    sev = "HIGH" if wait_delta >= 4.0 else "MODERATE"
                else:
                    category = "ANCHORAGE_STACK"
                    reason = (
                        f"Anchorage Stacking: Idling offshore as harbor fairway and pilot slots "
                        f"became congested (+{max(wait_delta, time_shift_hours):.1f}h delay)."
                    )
                    sev = "MODERATE"

                effective_wait = max(0.5, max(wait_delta, time_shift_hours))
                effective_cost = max(demurrage_delta, cost_engine.calculate_demurrage_saving(
                    effective_wait, vessel_class=base_a.vessel_class
                ))

                affected_vessels.append(
                    AffectedVesselDetail(
                        vessel_id=base_a.vessel_id,
                        vessel_name=base_a.vessel_name,
                        vessel_class=base_a.vessel_class,
                        carrier=v_carrier,
                        fleet=v_fleet,
                        assigned_berth_id=shock_a.assigned_berth_id,
                        assigned_berth_name=shock_a.assigned_berth_name,
                        original_start_time=base_a.start_time.isoformat(),
                        delayed_start_time=shock_a.start_time.isoformat(),
                        wait_increase_hours=effective_wait,
                        demurrage_impact_usd=round(effective_cost, 2),
                        impact_category=category,
                        impact_reason=reason,
                        severity=sev
                    )
                )
                total_wait_hours_added += effective_wait
                total_demurrage_damages += effective_cost

        # 7. Multi-fleet chain aggregation
        fleet_dict: Dict[str, Dict[str, Any]] = {}
        for aff in affected_vessels:
            f_key = aff.fleet
            if f_key not in fleet_dict:
                fleet_dict[f_key] = {
                    "fleet_name": aff.fleet,
                    "carrier": aff.carrier,
                    "vessels_affected_count": 0,
                    "total_delay_hours": 0.0,
                    "total_demurrage_usd": 0.0,
                    "affected_vessels": [],
                    "categories": set()
                }
            fleet_dict[f_key]["vessels_affected_count"] += 1
            fleet_dict[f_key]["total_delay_hours"] += aff.wait_increase_hours
            fleet_dict[f_key]["total_demurrage_usd"] += aff.demurrage_impact_usd
            fleet_dict[f_key]["affected_vessels"].append(aff.vessel_name)
            fleet_dict[f_key]["categories"].add(aff.impact_category)

        fleet_chain_impacts: List[FleetChainImpact] = []
        for f_name, f_data in fleet_dict.items():
            cost_val = round(f_data["total_demurrage_usd"], 2)
            delay_val = round(f_data["total_delay_hours"], 1)

            if cost_val >= 40000.0 or delay_val >= 20.0:
                risk_lvl = "CRITICAL"
            elif cost_val >= 15000.0 or delay_val >= 10.0:
                risk_lvl = "HIGH"
            elif cost_val >= 5000.0:
                risk_lvl = "MODERATE"
            else:
                risk_lvl = "LOW"

            has_primary = "PRIMARY_SHOCK" in f_data["categories"]
            if has_primary:
                note = f"Direct shock epicenter: Fleet absorbs primary disruption with {f_data['vessels_affected_count']} vessel(s) and ${cost_val:,.0f} demurrage exposure."
            else:
                note = f"Collateral ripple damage: {f_data['vessels_affected_count']} vessel(s) queued offshore behind delayed berths, totaling {delay_val}h idle time."

            fleet_chain_impacts.append(
                FleetChainImpact(
                    fleet_name=f_name,
                    carrier=f_data["carrier"],
                    vessels_affected_count=f_data["vessels_affected_count"],
                    total_delay_hours=delay_val,
                    total_demurrage_usd=cost_val,
                    affected_vessels=f_data["affected_vessels"],
                    chain_risk_level=risk_lvl,
                    operational_note=note
                )
            )

        # Sort fleet impacts by total financial damage descending
        fleet_chain_impacts.sort(key=lambda x: x.total_demurrage_usd, reverse=True)

        # 8. Compute system monetary damages & fuel waste
        # Bunker fuel waste: Idling container vessel at anchor burns ~0.15 mt VLSFO/hour at $650/mt
        bunker_waste_usd = round(total_wait_hours_added * 0.15 * cost_engine.VLSFO_PRICE_PER_MT, 2)
        co2_excess_tonnes = round(total_wait_hours_added * 0.15 * cost_engine.CO2_FACTOR_PER_MT_FUEL, 2)
        
        # Container Yard (CY) Saturation Damages:
        yard = db.query(YardCapacity).first()
        yard_util = (yard.teu_used / yard.teu_capacity) if yard and yard.teu_capacity > 0 else 0.72
        yard_damage_usd = cost_engine.calculate_yard_congestion_damage(
            req.delay_hours, float(getattr(target_vessel, "cargo_volume", 3000) or 3000), yard_util
        )
        berth_disruption_cost_usd = round(total_wait_hours_added * 250.0 + yard_damage_usd, 2)  # Port overhead + CY congestion
        total_monetary_damages_usd = round(total_demurrage_damages + bunker_waste_usd + berth_disruption_cost_usd, 2)

        base_avg_wait = baseline_res.average_wait_time_hours
        sim_avg_wait = round(base_avg_wait + (total_wait_hours_added / max(1, len(baseline_res.assignments))), 1)
        wait_spike = round(sim_avg_wait - base_avg_wait, 1)

        # Estimate recovery horizon: time until the last delayed ship vacates quay
        recovery_hours = round(max(req.delay_hours * 1.5, 12.0), 1)

        if total_monetary_damages_usd >= 50000.0 or total_wait_hours_added >= 24.0:
            system_severity = "CRITICAL"
        elif total_monetary_damages_usd >= 20000.0 or total_wait_hours_added >= 12.0:
            system_severity = "HIGH"
        else:
            system_severity = "MODERATE"

        summary_impact = ShockSummaryImpact(
            total_monetary_damages_usd=total_monetary_damages_usd,
            demurrage_damages_usd=round(total_demurrage_damages, 2),
            bunker_waste_usd=bunker_waste_usd,
            berth_disruption_cost_usd=berth_disruption_cost_usd,
            co2_excess_tonnes=co2_excess_tonnes,
            total_additional_wait_hours=round(total_wait_hours_added, 1),
            baseline_avg_wait_hours=base_avg_wait,
            simulated_avg_wait_hours=sim_avg_wait,
            port_average_wait_spike_hours=wait_spike,
            total_vessels_affected=len(affected_vessels),
            total_fleets_affected=len(fleet_chain_impacts),
            recovery_horizon_hours=recovery_hours,
            severity=system_severity
        )

        # 9. Formulate prescriptive mitigations
        mitigations: List[MitigationAction] = []
        if len(affected_vessels) > 1:
            second_vessel = affected_vessels[1]
            mitigations.append(
                MitigationAction(
                    action_type="BERTH_DIVERSION",
                    target_vessel_name=second_vessel.vessel_name,
                    description=f"Divert {second_vessel.vessel_name} to an alternative open berth with matching draft clearance to bypass Berth {target_berth_id} bottleneck.",
                    potential_savings_usd=round(second_vessel.demurrage_impact_usd * 0.85, 2),
                    potential_hours_saved=round(second_vessel.wait_increase_hours * 0.80, 1)
                )
            )

        mitigations.append(
            MitigationAction(
                action_type="SLOW_STEAMING",
                target_vessel_name=target_vessel.name,
                description=f"Issue slow-steaming speed advisory (-3.0 kts) to incoming vessels in {target_fleet} to absorb wait time at sea, reducing fuel burn and CO2 emissions.",
                potential_savings_usd=round(bunker_waste_usd * 0.65, 2),
                potential_hours_saved=round(req.delay_hours * 0.40, 1)
            )
        )

        mitigations.append(
            MitigationAction(
                action_type="CRANE_BOOST",
                target_vessel_name=target_vessel.name,
                description=f"Temporarily allocate +1 STS Gantry Crane to Berth {target_berth_id} upon {target_vessel.name}'s arrival to compress discharge time by 20%.",
                potential_savings_usd=round(target_demurrage_increase * 0.45, 2),
                potential_hours_saved=round(req.delay_hours * 0.25, 1)
            )
        )

        if yard_util >= 0.70:
            mitigations.append(
                MitigationAction(
                    action_type="YARD_BUFFER_MANAGEMENT",
                    target_vessel_name=target_vessel.name,
                    description=f"Pre-stage export container blocks and open virtual overflow buffer in Yard to prevent RTG crane deadlock during the {req.delay_hours:.1f}h quay stall.",
                    potential_savings_usd=round(yard_damage_usd * 0.75, 2),
                    potential_hours_saved=round(min(4.0, req.delay_hours * 0.25), 1)
                )
            )

        # 10. Live database injection if requested
        applied_to_live = False
        if req.apply_to_database:
            target_vessel.carrier_eta = delayed_eta
            target_vessel.corrected_eta = delayed_eta
            db.commit()
            applied_to_live = True

            # Trigger ML risk engine re-forecast
            try:
                from app.services.ml.risk_engine import risk_engine
                risk_engine.re_evaluate_all_predictions(db, trigger=f"VESSEL_DELAY_SHOCK_{target_vessel.name}")
            except Exception as e:
                logger.warning(f"Risk engine re-evaluation notice: {e}")

            # Record governance audit trail
            AuditService.record_event(
                db=db,
                actor=actor_username,
                actor_role=actor_role,
                actor_id=actor_id,
                action="VESSEL_DELAY_SHOCK_INJECTION",
                entity_type="VESSEL",
                entity_id=target_vessel.id,
                payload_snapshot={
                    "vessel_name": target_vessel.name,
                    "delay_hours": req.delay_hours,
                    "delay_cause": req.delay_cause,
                    "delayed_eta": delayed_eta.isoformat(),
                    "total_monetary_damages_usd": total_monetary_damages_usd,
                    "total_wait_hours_added": total_wait_hours_added,
                    "affected_vessels_count": len(affected_vessels)
                }
            )

        target_metadata = TargetVesselMetadata(
            id=target_vessel.id,
            name=target_vessel.name,
            vessel_class=target_vessel.vessel_class or "Panamax",
            carrier=target_carrier,
            fleet=target_fleet,
            cargo_volume=target_vessel.cargo_volume or 3500,
            draft_m=target_vessel.draft_m or 12.0,
            length_m=target_vessel.length_m or 250.0,
            original_eta=orig_eta.isoformat(),
            delayed_eta=delayed_eta.isoformat(),
            delay_hours=round(req.delay_hours, 1),
            current_status=target_vessel.status or "SCHEDULED",
            assigned_berth_id=target_berth_id,
            assigned_berth_name=target_berth_name
        )

        msg = (
            f"Vessel Delay Shock simulated successfully: {target_vessel.name} delayed by {req.delay_hours:.1f}h. "
            f"Predicted {len(affected_vessels)} affected vessels across {len(fleet_chain_impacts)} fleets, "
            f"totaling ${total_monetary_damages_usd:,.0f} in damages."
        )

        return VesselDelayShockResponse(
            status="success",
            correlation_id=corr_id,
            applied_to_live=applied_to_live,
            delay_cause=cause_label,
            target_vessel=target_metadata,
            summary_impact=summary_impact,
            fleet_chain_impacts=fleet_chain_impacts,
            affected_vessels=affected_vessels,
            mitigation_recommendations=mitigations,
            message=msg
        )


vessel_delay_shock_simulator = VesselDelayShockSimulator()
