"""
Tests for Operational Shock Lab: Vessel Delay Shock & System Cascade Predictor
Verifies:
1. Sandbox prediction simulation with accurate monetary ($) and time (h) damage metrics
2. Multi-fleet chain impact attribution across global shipping alliances (2M, Ocean Alliance, etc.)
3. Domino cascade identification of affected vessels (primary vs secondary berth conflicts / displacement)
4. Prescriptive mitigation recommendations synthesis
5. Live database injection mode committing updated ETA and logging audit records
"""

import pytest
from datetime import datetime
from app.models.entities import Vessel, Berth, AuditLogEntry
from app.services.optimiser.solver import to_aware_utc
from app.services.optimiser.shock_simulator import vessel_delay_shock_simulator, resolve_carrier_and_fleet


def test_carrier_fleet_resolution():
    carrier, fleet = resolve_carrier_and_fleet("Maersk Mc-Kinney Moller")
    assert carrier == "Maersk Line"
    assert fleet == "2M Alliance"

    carrier, fleet = resolve_carrier_and_fleet("Ever Given")
    assert carrier == "Evergreen Marine"
    assert fleet == "Ocean Alliance"

    carrier, fleet = resolve_carrier_and_fleet("HMM Algeciras")
    assert carrier == "HMM (Hyundai Merchant Marine)"
    assert fleet == "THE / Premier Alliance"

    carrier, fleet = resolve_carrier_and_fleet("Unknown Feeder 1")
    assert carrier == "Regional Feeder Line"
    assert fleet == "Independent Regional Fleet"


def test_vessel_delay_shock_sandbox_endpoint(client, supervisor_headers, db_session):
    """Verifies that injecting a delay shock in sandbox mode predicts cascade damages without modifying DB."""
    vessel = db_session.query(Vessel).filter(Vessel.status.in_(["SCHEDULED", "APPROACHING"])).first()
    assert vessel is not None
    original_eta = vessel.carrier_eta

    payload = {
        "vessel_id": vessel.id,
        "delay_hours": 12.0,
        "delay_cause": "ENGINE_BREAKDOWN",
        "apply_to_database": False
    }

    res = client.post("/api/v1/optimiser/shock-simulation/vessel-delay", json=payload, headers=supervisor_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "success"
    assert data["applied_to_live"] is False
    assert data["delay_cause"] == "Engine Breakdown"

    # Target vessel metadata
    assert data["target_vessel"]["id"] == vessel.id
    assert data["target_vessel"]["name"] == vessel.name
    assert data["target_vessel"]["delay_hours"] == 12.0

    # Summary damages
    summary = data["summary_impact"]
    assert summary["total_monetary_damages_usd"] > 0
    assert summary["demurrage_damages_usd"] > 0
    assert summary["bunker_waste_usd"] >= 0
    assert summary["total_additional_wait_hours"] >= 12.0
    assert summary["total_vessels_affected"] >= 1
    assert summary["total_fleets_affected"] >= 1
    assert summary["recovery_horizon_hours"] > 0

    # Multi-fleet chain impacts
    fleet_impacts = data["fleet_chain_impacts"]
    assert len(fleet_impacts) >= 1
    first_fleet = fleet_impacts[0]
    assert "fleet_name" in first_fleet
    assert first_fleet["total_demurrage_usd"] > 0
    assert len(first_fleet["affected_vessels"]) >= 1

    # Affected vessels list contains primary shock
    affected = data["affected_vessels"]
    assert len(affected) >= 1
    primary = next((a for a in affected if a["impact_category"] == "PRIMARY_SHOCK"), None)
    assert primary is not None
    assert primary["vessel_id"] == vessel.id
    assert primary["wait_increase_hours"] == 12.0

    # Mitigation recommendations
    mitigations = data["mitigation_recommendations"]
    assert len(mitigations) >= 1
    assert any(m["potential_savings_usd"] > 0 for m in mitigations)

    # Assert database record was NOT altered in sandbox mode
    db_session.expire_all()
    unchanged_vessel = db_session.query(Vessel).filter(Vessel.id == vessel.id).first()
    assert unchanged_vessel.carrier_eta == original_eta


def test_vessel_delay_shock_live_injection(client, admin_headers, db_session):
    """Verifies that apply_to_database=True persists new ETA and generates an audit log."""
    vessel = db_session.query(Vessel).filter(Vessel.status.in_(["SCHEDULED", "APPROACHING"])).first()
    assert vessel is not None
    initial_audit_count = db_session.query(AuditLogEntry).count()

    payload = {
        "vessel_id": vessel.id,
        "delay_hours": 6.0,
        "delay_cause": "WEATHER_ANOMALY",
        "apply_to_database": True
    }

    res = client.post("/api/v1/optimiser/shock-simulation/vessel-delay", json=payload, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["applied_to_live"] is True
    assert data["target_vessel"]["id"] == vessel.id

    # Verify database was updated
    db_session.expire_all()
    updated_vessel = db_session.query(Vessel).filter(Vessel.id == vessel.id).first()
    assert to_aware_utc(updated_vessel.carrier_eta) == datetime.fromisoformat(data["target_vessel"]["delayed_eta"])

    # Verify audit log was recorded
    new_audit_count = db_session.query(AuditLogEntry).count()
    assert new_audit_count > initial_audit_count
    latest_audit = db_session.query(AuditLogEntry).order_by(AuditLogEntry.timestamp.desc()).first()
    assert latest_audit.action == "VESSEL_DELAY_SHOCK_INJECTION"
    assert latest_audit.entity_id == vessel.id
