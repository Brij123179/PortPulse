import pytest
from app.services.sanitizer import (
    sanitize_ai_response,
    clamp_confidence,
    clamp_percentage,
    sanitize_positive_number,
    sanitize_ml_output,
    validate_entity_id,
)
from app.services.event_bus import event_bus, EventType


def test_sanitize_ai_response_xss():
    malicious = "<script>alert('xss')</script>Hello <iframe src='evil.com'></iframe>World"
    clean = sanitize_ai_response(malicious)
    assert "<script>" not in clean
    assert "<iframe>" not in clean
    assert "Hello" in clean
    assert "World" in clean


def test_sanitize_ai_response_event_handlers():
    malicious = '<button onclick="exploit()">Click</button>'
    clean = sanitize_ai_response(malicious)
    assert "onclick=" not in clean


def test_clamp_confidence_bounds():
    assert clamp_confidence(1.5) == 1.0
    assert clamp_confidence(-0.5) == 0.0
    assert clamp_confidence(0.85) == 0.85
    assert clamp_confidence("invalid") == 0.5


def test_clamp_percentage_bounds():
    assert clamp_percentage(120.0) == 100.0
    assert clamp_percentage(-10.0) == 0.0
    assert clamp_percentage(73.5) == 73.5


def test_sanitize_positive_number():
    assert sanitize_positive_number(-50.0) == 0.0
    assert sanitize_positive_number(125.5) == 125.5
    assert sanitize_positive_number("bad", default=10.0) == 10.0


def test_sanitize_ml_output_dict():
    raw_ml = {
        "model_name": "GradientBoosting<script>evil()</script>",
        "eta_confidence": 1.45,
        "occupancy_pct": 115.0,
        "demurrage_usd": -300.0,
        "nested": {
            "probability": -0.2,
            "fuel_cost": 500.0
        }
    }
    sanitized = sanitize_ml_output(raw_ml)
    assert "<script>" not in sanitized["model_name"]
    assert sanitized["eta_confidence"] == 1.0
    assert sanitized["occupancy_pct"] == 100.0
    assert sanitized["demurrage_usd"] == 0.0
    assert sanitized["nested"]["probability"] == 0.0
    assert sanitized["nested"]["fuel_cost"] == 500.0


def test_validate_entity_id():
    assert validate_entity_id("B-01; DROP TABLE;") == "B-01DROPTABLE"
    assert validate_entity_id("REC-DIV-101", prefix="REC-") == "REC-DIV-101"
    assert validate_entity_id("INVALID-101", prefix="REC-") == ""


def test_event_bus_pub_sub():
    events_received = []

    def on_event(**kwargs):
        events_received.append(kwargs)

    event_bus.subscribe(EventType.DATA_CHANGED, on_event)
    event_bus.publish(EventType.DATA_CHANGED, entity_type="BERTH", action="TEST")
    assert len(events_received) >= 1
    assert any(e.get("action") == "TEST" for e in events_received)


def test_auto_optimizer_rbac(client, supervisor_headers, planner_headers, admin_headers):
    # Shift supervisor should be denied from auto-optimize
    res = client.post("/api/v1/optimiser/auto-optimize", headers=supervisor_headers)
    assert res.status_code == 403

    # Vessel planner should be denied
    res = client.post("/api/v1/optimiser/auto-optimize", headers=planner_headers)
    assert res.status_code == 403

    # Admin should be allowed
    res = client.post("/api/v1/optimiser/auto-optimize", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "result_id" in data
    assert data["status"] == "PENDING_APPROVAL"
    assert "assignments_count" in data


def test_auto_optimizer_confirm_reject_flow(client, admin_headers):
    # Run auto-optimizer to get a pending result
    res = client.post("/api/v1/optimiser/auto-optimize", headers=admin_headers)
    assert res.status_code == 200
    result_id = res.json()["result_id"]

    # Reject flow
    reject_res = client.post(
        f"/api/v1/optimiser/auto-optimize/{result_id}/reject?reason=Manual%20Override%20Preferred",
        headers=admin_headers
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "REJECTED"

    # Confirm flow with fresh optimization
    res2 = client.post("/api/v1/optimiser/auto-optimize", headers=admin_headers)
    assert res2.status_code == 200
    result_id2 = res2.json()["result_id"]

    confirm_res = client.post(
        f"/api/v1/optimiser/auto-optimize/{result_id2}/confirm",
        headers=admin_headers
    )
    assert confirm_res.status_code == 200
    assert confirm_res.json()["status"] == "CONFIRMED"
    assert confirm_res.json()["applied_count"] >= 0
