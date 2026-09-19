import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.auth import create_access_token




@pytest.fixture
def admin_token():
    return create_access_token(data={"sub": "admin", "role": "admin"})


@pytest.fixture
def supervisor_token():
    return create_access_token(data={"sub": "supervisor", "role": "shift_supervisor"})


def test_audit_logs_endpoint_invalid_token(client):
    response = client.get(
        "/api/v1/audit/logs",
        headers={"Authorization": "Bearer invalid_token_xyz"}
    )
    assert response.status_code == 401


def test_audit_logs_endpoint_success(client, admin_token):
    response = client.get(
        "/api/v1/audit/logs",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)


def test_audit_trail_recorded_on_berth_create(client, admin_token):
    berth_id = "B-AUDIT-99"
    # Create berth
    res = client.post(
        "/api/v1/master-data/berths",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "id": berth_id,
            "name": "Audit Test Berth",
            "length_m": 420.0,
            "draft_limit_m": 16.5,
            "crane_slots": 4,
            "contractual_priority_rules": "PRIORITY_A",
            "status": "AVAILABLE"
        }
    )
    assert res.status_code == 201

    # Check audit log contains the creation
    log_res = client.get(
        f"/api/v1/audit/logs?entity_type=BERTH&action=CREATE_BERTH",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert log_res.status_code == 200
    items = log_res.json()["items"]
    matching = [i for i in items if i["entity_id"] == berth_id]
    assert len(matching) > 0
    assert matching[0]["actor"] == "admin"
    assert matching[0]["action"] == "CREATE_BERTH"

    # Cleanup
    del_res = client.delete(
        f"/api/v1/master-data/berths/{berth_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert del_res.status_code == 200


def test_audit_trail_recorded_on_recommendation_action(client, supervisor_token):
    res = client.post(
        "/api/v1/recommendations/REC-AUDIT-001/action",
        headers={"Authorization": f"Bearer {supervisor_token}"},
        json={"action": "ACCEPT", "notes": "Approved in shift briefing"}
    )
    assert res.status_code == 200

    log_res = client.get(
        "/api/v1/audit/logs?entity_type=RECOMMENDATION",
        headers={"Authorization": f"Bearer {supervisor_token}"}
    )
    assert log_res.status_code == 200
    items = log_res.json()["items"]
    matching = [i for i in items if i["entity_id"] == "REC-AUDIT-001"]
    assert len(matching) > 0
    assert matching[0]["actor"] == "supervisor"
    assert matching[0]["action"] == "RECOMMENDATION_ACCEPT"


def test_all_operational_roles_can_view_system_logs(client, supervisor_token):
    planner_token = create_access_token(data={"sub": "planner", "role": "vessel_planner"})
    # Vessel planner can access audit logs
    res = client.get("/api/v1/audit/logs", headers={"Authorization": f"Bearer {planner_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data

    # Shift supervisor can view general audit logs without actor restriction
    res_sup = client.get("/api/v1/audit/logs", headers={"Authorization": f"Bearer {supervisor_token}"})
    assert res_sup.status_code == 200
    assert "items" in res_sup.json()


def test_audit_trail_recorded_on_fleet_generation_and_shock(client, admin_token, supervisor_token):
    # Fleet generation audit
    gen_res = client.post(
        "/api/v1/ingestion/generate?vessels=10&berths=4&seed=999",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert gen_res.status_code == 200

    # Shock event audit
    shock_res = client.post(
        "/api/v1/ingestion/shock-event?event_type=crane_outage",
        headers={"Authorization": f"Bearer {supervisor_token}"}
    )
    assert shock_res.status_code == 200

    # Verify audit logs
    log_res = client.get(
        "/api/v1/audit/logs?limit=20",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert log_res.status_code == 200
    items = log_res.json()["items"]
    actions = [i["action"] for i in items]
    assert "FLEET_SYNTHETIC_GENERATION" in actions
    assert "SHOCK_EVENT_INJECTION" in actions

    # Restore baseline 10 berths and 50 vessels for subsequent test suites
    client.post(
        "/api/v1/ingestion/generate?vessels=50&berths=10&seed=42",
        headers={"Authorization": f"Bearer {admin_token}"}
    )


def test_audit_log_timestamp_format_has_utc_offset(client, admin_token):
    log_res = client.get(
        "/api/v1/audit/logs?limit=5",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert log_res.status_code == 200
    items = log_res.json()["items"]
    if len(items) > 0:
        ts = items[0]["timestamp"]
        # Must contain timezone information (+00:00 or Z)
        assert "+00:00" in ts or ts.endswith("Z")
