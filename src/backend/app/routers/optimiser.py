"""
FastAPI Router for Increment 3: Prescriptive Layer & Optimisation (F-301 - F-308)
"""

from fastapi import APIRouter, Depends, Query, Path, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import CurrentUser, get_current_user, require_roles
from app.schemas.optimiser import (
    RecommendationsListResponse,
    RecommendationActionRequest,
    RecommendationActionResponse,
    OptimisationRunRequest,
    OptimisationRunResponse,
    ManualOverrideRequest,
    OverrideValidationResult,
    WhatIfRequest,
    WhatIfResponse
)
from app.services.optimiser.recommender import prescriptive_recommender
from app.services.optimiser.solver import berth_optimiser
from app.services.optimiser.override_guard import override_guard
from app.services.optimiser.whatif_simulator import whatif_simulator
from app.services.audit import AuditService

router = APIRouter(prefix="/api/v1", tags=["Prescriptive Layer & Optimisation"])


# --- F-301 - F-304: Prescriptive Recommendations ---

@router.get("/recommendations", response_model=RecommendationsListResponse)
def get_recommendations(
    horizon: int = Query(72, ge=12, le=168, description="Lookahead horizon in hours"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles("admin", "terminal_manager", "shift_supervisor", "vessel_planner"))
):
    """
    F-301 - F-304: Returns active prescriptive recommendations with side-by-side
    cost ($), time (h), and emissions (CO2) impact analysis.
    All operational roles have read/view access.
    """
    return prescriptive_recommender.generate_recommendations(db, horizon_hours=horizon)


@router.post("/recommendations/{recommendation_id}/action", response_model=RecommendationActionResponse)
def act_on_recommendation(
    recommendation_id: str = Path(..., description="Target recommendation ID (e.g. REC-DIV-101)"),
    payload: RecommendationActionRequest = ...,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles("admin", "terminal_manager", "shift_supervisor"))
):
    """
    F-407 / F-501: Records Accept, Modify, or Reject decision by an authorized supervisor.
    Vessel planners have view-only access and are denied.
    """
    res = prescriptive_recommender.record_action(
        recommendation_id=recommendation_id,
        req=payload,
        username=user.username
    )
    AuditService.record_event(
        db=db,
        actor=user.username,
        action=f"RECOMMENDATION_{payload.action.upper()}",
        entity_type="RECOMMENDATION",
        entity_id=recommendation_id,
        payload_snapshot={"action": payload.action, "notes": payload.notes, "modified_berth_id": payload.modified_berth_id}
    )
    return res


# --- F-305: Berth & Crane Assignment Optimisation (MILP) ---

@router.get("/optimiser/plan", response_model=OptimisationRunResponse)
def get_optimisation_plan(
    horizon: int = Query(72, ge=12, le=168, description="Lookahead horizon in hours"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles("admin", "terminal_manager", "shift_supervisor", "vessel_planner"))
):
    """
    F-305 / Challenge Feature 4: Read-only access to current 72h optimized berth/crane operations plan.
    Accessible to all operational roles (Admin, Terminal Manager, Shift Supervisor, Vessel Planner).
    """
    return berth_optimiser.solve(db, horizon_hours=horizon)


@router.post("/optimiser/run", response_model=OptimisationRunResponse)
def run_optimisation(
    payload: OptimisationRunRequest = OptimisationRunRequest(),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles("admin", "terminal_manager"))
):
    """
    F-305: Solves 72h berth/crane allocation via Mixed-Integer Linear Programming.
    Enforces hard constraints: draft, length, crane capacity, non-overlapping berths.
    Sev-1 Guarantee: returns explicit INFEASIBLE if a constraint cannot be met.
    Restricted to Admin and Terminal Manager roles.
    """
    res = berth_optimiser.solve(
        db,
        horizon_hours=payload.horizon_hours,
        wait_time_weight=payload.wait_time_weight,
        crane_utilization_weight=payload.crane_utilization_weight,
        priority_cargo_weight=payload.priority_cargo_weight
    )
    AuditService.record_event(
        db=db,
        actor=user.username,
        action="OPTIMISATION_RUN",
        entity_type="SOLVER",
        entity_id=res.solver_status,
        payload_snapshot={
            "status": res.solver_status,
            "vessels_scheduled": res.vessels_scheduled,
            "solve_time_seconds": res.solve_time_seconds,
            "horizon_hours": payload.horizon_hours
        }
    )
    return res


@router.post("/optimiser/recompute", response_model=OptimisationRunResponse)
def recompute_optimisation(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles("admin", "terminal_manager", "shift_supervisor"))
):
    """
    F-306: Auto/manual re-run hook within 30s of new ETA update or delay shock event.
    """
    res = berth_optimiser.solve(db, horizon_hours=72)
    AuditService.record_event(
        db=db,
        actor=user.username,
        action="OPTIMISATION_RECOMPUTE",
        entity_type="SOLVER",
        entity_id=res.solver_status,
        payload_snapshot={
            "status": res.solver_status,
            "vessels_scheduled": res.vessels_scheduled,
            "solve_time_seconds": res.solve_time_seconds
        }
    )
    return res


# --- F-307: Manual Supervisor Override with Guardrails ---

@router.post("/optimiser/override", response_model=OverrideValidationResult)
def manual_override(
    payload: ManualOverrideRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles("admin", "terminal_manager", "shift_supervisor"))
):
    """
    F-307: Validates manual supervisor reassignment against hard physical constraints.
    Rejects draft/length violations and time collisions outright with detailed violation messages.
    """
    res = override_guard.validate_and_apply(db, payload, actor_username=user.username)
    AuditService.record_event(
        db=db,
        actor=user.username,
        action=f"OVERRIDE_{res.status}",
        entity_type="BERTH_ASSIGNMENT",
        entity_id=payload.vessel_id,
        payload_snapshot={
            "target_berth_id": payload.target_berth_id,
            "new_start_time": str(payload.new_start_time),
            "reason": payload.override_reason,
            "is_valid": res.is_valid,
            "violations": res.constraint_violations,
            "warnings": res.warnings
        }
    )
    return res


# --- F-308: What-If Sandbox Simulator ---

@router.post("/optimiser/whatif", response_model=WhatIfResponse)
def run_what_if_simulation(
    payload: WhatIfRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles("admin", "terminal_manager", "shift_supervisor", "vessel_planner"))
):
    """
    F-308: Tests hypothetical interventions in a non-destructive sandbox,
    recalculating wait times, red hours, and demurrage savings.
    """
    return whatif_simulator.simulate(db, payload)
