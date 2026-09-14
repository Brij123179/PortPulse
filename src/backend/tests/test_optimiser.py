"""
Tests for Increment 3: Prescriptive Layer & Optimisation (F-301 - F-308)
Includes:
- Property-based testing for 0% hard constraint violations
- Sev-1 Infeasibility detection test
- Recommendation generation and action recording
- Manual supervisor override guardrail enforcement
- Server-side RBAC enforcement across all endpoints
- What-If scenario simulation
"""

import pytest
from datetime import datetime, timedelta, timezone
from app.services.optimiser.solver import berth_optimiser
from app.services.optimiser.cost_engine import cost_engine
from app.services.optimiser.recommender import prescriptive_recommender
from app.models.entities import Berth, Vessel


def test_property_based_hard_constraints_zero_violations(db_session):
    """
    PROPERTY-BASED TEST (02_srs.md §5 / Master Build Prompt §4):
    Simulates allocation across all vessels and berths.
    Asserts 0% violations across all 4 hard constraints:
    1. Assigned berth draft >= vessel draft
    2. Assigned berth length >= vessel length
    3. Assigned cranes <= berth crane slots
    4. Non-overlapping berth occupancies (no double-booking)
    """
    res = berth_optimiser.solve(db_session, horizon_hours=72)
    assert res.solver_status == "OPTIMAL"
    assert res.vessels_scheduled > 0

    berths_by_id = {b.id: b for b in db_session.query(Berth).all()}
    schedule_by_berth = {}

    for assignment in res.assignments:
        berth = berths_by_id[assignment.assigned_berth_id]

        # Hard Constraint 1: Draft
        assert assignment.draft_m <= berth.draft_limit_m, (
            f"Draft violation: vessel draft {assignment.draft_m}m > berth draft {berth.draft_limit_m}m"
        )

        # Hard Constraint 2: Length
        assert assignment.length_m <= berth.length_m, (
            f"Length violation: vessel length {assignment.length_m}m > berth length {berth.length_m}m"
        )

        # Hard Constraint 3: Crane capacity
        assert assignment.allocated_cranes <= berth.crane_slots, (
            f"Crane violation: allocated {assignment.allocated_cranes} > berth capacity {berth.crane_slots}"
        )

        # Hard Constraint 4: Temporal Non-Overlap
        if berth.id not in schedule_by_berth:
            schedule_by_berth[berth.id] = []

        for prev_start, prev_end in schedule_by_berth[berth.id]:
            # No interval can overlap
            overlap = not (assignment.end_time <= prev_start or assignment.start_time >= prev_end)
            assert not overlap, (
                f"Double booking collision on berth {berth.id}: "
                f"[{assignment.start_time} - {assignment.end_time}] collides with [{prev_start} - {prev_end}]"
            )

        schedule_by_berth[berth.id].append((assignment.start_time, assignment.end_time))


def test_solver_sev1_infeasibility_guarantee(db_session):
    """
    SEV-1 INFEASIBILITY GUARANTEE:
    If a forced assignment violates physical draft/length constraints,
    the solver MUST return 'INFEASIBLE' with explicit reason, NEVER an invalid assignment.
    """
    vessel = db_session.query(Vessel).first()
    shallow_berth = db_session.query(Berth).order_by(Berth.draft_limit_m.asc()).first()

    # Artificially set vessel draft deeper than shallow berth
    original_draft = vessel.draft_m
    try:
        vessel.draft_m = shallow_berth.draft_limit_m + 3.0
        db_session.commit()

        # Force assignment into the incompatible berth
        res = berth_optimiser.solve(
            db_session,
            horizon_hours=72,
            forced_assignments={vessel.id: shallow_berth.id}
        )

        assert res.solver_status == "INFEASIBLE"
        assert len(res.violated_constraints) > 0
        assert any("PHYSICAL DRAFT VIOLATION" in c for c in res.violated_constraints)
        assert len(res.assignments) == 0
    finally:
        vessel.draft_m = original_draft
        db_session.commit()


def test_maritime_cost_engine_formulas():
    """Verify deterministic cost and fuel formulas against domain specs."""
    # Demurrage calculation: 10h saved on Panamax = $10,000
    panamax_demurrage = cost_engine.calculate_demurrage_saving(10.0, vessel_class="PANAMAX")
    assert panamax_demurrage == 10000.0

    # Slow-steaming cubic law: 18 kts to 14 kts on 24h transit
    impact = cost_engine.calculate_slow_steam_impact(transit_hours=24.0, speed_reduction_knots=4.0)
    assert impact["fuel_saved_mt"] > 10.0
    assert impact["fuel_saved_usd"] > 5000.0
    assert impact["co2_saved_mt"] > 30.0


def test_recommendations_endpoint(client, supervisor_headers):
    """F-301 - F-304: Prescriptive recommendations query."""
    res = client.get("/api/v1/recommendations?horizon=72", headers=supervisor_headers)
    assert res.status_code == 200
    data = res.json()
    assert "recommendations" in data
    assert len(data["recommendations"]) > 0

    # Check that each recommendation includes grounded rationale, impact, and confidence
    first_rec = data["recommendations"][0]
    assert "rationale" in first_rec and len(first_rec["rationale"]) > 10
    assert "impact" in first_rec
    assert first_rec["impact"]["net_benefit_usd"] != 0
    assert 0.0 <= first_rec["confidence_score"] <= 1.0


def test_recommendation_action_flow(client, supervisor_headers):
    """F-407 / F-501: Accept, modify, or reject action flow."""
    # First get a recommendation ID
    rec_res = client.get("/api/v1/recommendations", headers=supervisor_headers)
    assert rec_res.status_code == 200
    recs = rec_res.json()["recommendations"]
    target_id = recs[0]["id"]

    # Post ACCEPT action
    action_payload = {
        "action": "ACCEPT",
        "notes": "Approved by Shift Supervisor for immediate implementation"
    }
    action_res = client.post(
        f"/api/v1/recommendations/{target_id}/action",
        json=action_payload,
        headers=supervisor_headers
    )
    assert action_res.status_code == 200
    res_data = action_res.json()
    assert res_data["status"] == "ACCEPT"
    assert res_data["action_by"] == "supervisor"


def test_manual_override_guardrail_rejection(client, supervisor_headers, db_session):
    """F-307: Manual override rejecting physical draft incompatibility."""
    vessel = db_session.query(Vessel).order_by(Vessel.draft_m.desc()).first()
    shallow_berth = db_session.query(Berth).order_by(Berth.draft_limit_m.asc()).first()

    # If vessel draft is deeper than shallow berth, expect REJECTED_HARD_CONSTRAINT
    if vessel.draft_m > shallow_berth.draft_limit_m:
        override_payload = {
            "vessel_id": vessel.id,
            "target_berth_id": shallow_berth.id,
            "new_start_time": datetime.now(timezone.utc).isoformat(),
            "override_reason": "Emergency berth reallocation test"
        }
        res = client.post("/api/v1/optimiser/override", json=override_payload, headers=supervisor_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["is_valid"] is False
        assert data["status"] == "REJECTED_HARD_CONSTRAINT"
        assert any("DRAFT INCOMPATIBILITY" in v for v in data["constraint_violations"])


def test_whatif_simulator_endpoint(client, planner_headers, db_session):
    """F-308: What-If simulation comparing hypothetical KPIs."""
    vessel = db_session.query(Vessel).first()
    berth = db_session.query(Berth).all()[-1]

    whatif_payload = {
        "scenario_name": "Test Diversion Scenario",
        "interventions": [
            {
                "intervention_type": "DIVERT",
                "vessel_id": vessel.id,
                "target_berth_id": berth.id
            },
            {
                "intervention_type": "SLOW_STEAM",
                "vessel_id": vessel.id,
                "speed_reduction_knots": 3.0
            }
        ]
    }
    res = client.post("/api/v1/optimiser/whatif", json=whatif_payload, headers=planner_headers)
    assert res.status_code == 200
    data = res.json()
    assert "comparisons" in data
    assert len(data["comparisons"]) == 4
    assert data["total_demurrage_saved_usd"] >= 0


def test_rbac_optimiser_and_recommendations_matrix(client, planner_headers, supervisor_headers, admin_headers):
    """
    SERVER-SIDE RBAC ENFORCEMENT (§6 RBAC Matrix):
    - POST /optimiser/run: Admin allowed, Supervisor denied (403), Planner denied (403)
    - POST /recommendations/{id}/action: Supervisor allowed, Planner denied (403)
    """
    # 1. POST /optimiser/run
    run_payload = {"horizon_hours": 72}
    
    # Planner should be denied 403
    res_planner = client.post("/api/v1/optimiser/run", json=run_payload, headers=planner_headers)
    assert res_planner.status_code == 403

    # Supervisor should be denied 403
    res_sup = client.post("/api/v1/optimiser/run", json=run_payload, headers=supervisor_headers)
    assert res_sup.status_code == 403

    # Admin should succeed 200
    res_admin = client.post("/api/v1/optimiser/run", json=run_payload, headers=admin_headers)
    assert res_admin.status_code == 200
    assert res_admin.json()["solver_status"] == "OPTIMAL"

    # 2. POST /recommendations/{id}/action
    action_payload = {"action": "REJECT", "notes": "No capacity"}
    res_planner_action = client.post("/api/v1/recommendations/REC-TEST/action", json=action_payload, headers=planner_headers)
    assert res_planner_action.status_code == 403


def test_solver_crane_allocation_scales_with_vessel_class(db_session):
    """Verify that ULCV and Post-Panamax vessels receive proper crane allocations (Bug C-3)."""
    from app.services.optimiser.solver import berth_optimiser
    res = berth_optimiser.solve(db_session, horizon_hours=72)
    assert res.solver_status == "OPTIMAL"
    
    # Check that at least one ULCV or Post-Panamax assignment has >= 3 cranes allocated
    large_assignments = [
        a for a in res.assignments 
        if str(a.vessel_class).upper().replace("-", "_") in ("ULCV", "ULTRA_LARGE", "POST_PANAMAX")
    ]
    if large_assignments:
        crane_counts = [a.allocated_cranes for a in large_assignments]
        assert any(c >= 3 for c in crane_counts), f"Expected >= 3 cranes for large vessels, got: {crane_counts}"


def test_null_eta_safety_in_predictions(db_session):
    """Verify that vessels with null carrier_eta do not crash prediction engine (Bug C-4)."""
    from app.services.ml.eta_model import ETACorrectionModel
    from app.services.ml.feature_store import FeatureStore
    from app.models.entities import Vessel
    
    v = Vessel(
        id="V-NULL-ETA",
        name="Null ETA Explorer",
        vessel_class="Panamax",
        cargo_volume=2500,
        carrier_eta=None,
        length_m=280.0,
        draft_m=12.0,
        status="SCHEDULED"
    )
    port_context = FeatureStore.get_port_context(db_session)
    model = ETACorrectionModel()
    # Should safely compute without AttributeError / TypeError
    pred_eta, offset, c_low, c_high, factors = model.predict_vessel_eta(v, port_context)
    assert pred_eta is not None
    assert offset >= 0.0
