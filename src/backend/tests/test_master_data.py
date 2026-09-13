import pytest


def test_list_berths(client, supervisor_headers):
    """F-104: Test listing berths returns 10 berths with cranes."""
    response = client.get("/api/v1/master-data/berths", headers=supervisor_headers)
    assert response.status_code == 200
    berths = response.json()
    assert len(berths) == 10
    first = berths[0]
    assert "length_m" in first
    assert "draft_limit_m" in first
    assert len(first["cranes"]) >= 2


def test_create_and_delete_berth_as_admin(client, admin_headers):
    """F-104 / F-106: Admin creates a new berth and then deletes it."""
    new_berth = {
        "id": "B-TEST",
        "name": "Berth Test Quay",
        "length_m": 350.0,
        "draft_limit_m": 14.5,
        "crane_slots": 2,
        "contractual_priority_rules": "Test rule",
        "status": "AVAILABLE"
    }
    create_resp = client.post("/api/v1/master-data/berths", json=new_berth, headers=admin_headers)
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["id"] == "B-TEST"

    # Delete the test berth
    del_resp = client.delete("/api/v1/master-data/berths/B-TEST", headers=admin_headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "success"


def test_create_berth_unauthorized_for_supervisor(client, supervisor_headers):
    """F-106: Supervisor role cannot create berths (server-side RBAC)."""
    new_berth = {
        "id": "B-FORBIDDEN",
        "name": "Forbidden Berth",
        "length_m": 300.0,
        "draft_limit_m": 12.0,
        "crane_slots": 2,
        "status": "AVAILABLE"
    }
    response = client.post("/api/v1/master-data/berths", json=new_berth, headers=supervisor_headers)
    assert response.status_code == 403


def test_vessel_length_validation_against_berth(client, planner_headers):
    """F-104: System rejects vessel assignment if vessel length exceeds berth length."""
    # B-08 length is 220m
    oversized_vessel = {
        "id": "IMO9999999",
        "name": "Too Big Vessel",
        "vessel_class": "ULCV",
        "cargo_volume": 18000,
        "carrier_eta": "2026-10-01T12:00:00Z",
        "priority_flag": True,
        "length_m": 400.0,
        "draft_m": 15.0,
        "status": "SCHEDULED",
        "assigned_berth_id": "B-08"
    }
    response = client.post("/api/v1/master-data/vessels", json=oversized_vessel, headers=planner_headers)
    assert response.status_code == 400
    assert "exceeds berth length" in response.json()["message"]
