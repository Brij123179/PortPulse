import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.auth import create_access_token


@pytest.fixture
def client():
    return TestClient(app)


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
