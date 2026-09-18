import pytest
from datetime import datetime, timezone, timedelta
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


@pytest.fixture
def planner_token():
    return create_access_token(data={"sub": "planner", "role": "vessel_planner"})


# --- 1. CSV EXPORT TESTS ---

def test_export_berths_csv(client, supervisor_token):
    res = client.get(
        "/api/v1/master-data/export/berths.csv",
        headers={"Authorization": f"Bearer {supervisor_token}"}
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    text = res.text
    assert "id,name,length_m,draft_limit_m,crane_slots" in text
    assert "B-01" in text


def test_export_vessels_csv(client, supervisor_token):
    res = client.get(
        "/api/v1/master-data/export/vessels.csv",
        headers={"Authorization": f"Bearer {supervisor_token}"}
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    text = res.text
    assert "id,name,vessel_class" in text


def test_export_operations_plan_csv(client, supervisor_token):
    res = client.get(
        "/api/v1/optimiser/export/operations-plan.csv?horizon_hours=72",
        headers={"Authorization": f"Bearer {supervisor_token}"}
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    text = res.text
    assert "vessel_id,vessel_name" in text
    assert "allocated_cranes" in text


# --- 2. CSV IMPORT TESTS ---

def test_import_berths_csv(client, admin_token):
    csv_payload = (
        "id,name,length_m,draft_limit_m,crane_slots,status,contractual_priority_rules\n"
        "B-CSV-01,Test CSV Quay Alpha,400.0,16.0,3,AVAILABLE,STANDARD\n"
        "B-CSV-02,Test CSV Quay Beta,350.0,14.5,2,AVAILABLE,STANDARD\n"
    )
    res = client.post(
        "/api/v1/master-data/import/berths",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"csv_content": csv_payload}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ["success", "partial_success"]
    assert data["imported_count"] >= 1

    # Verify berth and cranes exist
    b_res = client.get("/api/v1/master-data/berths/B-CSV-01", headers={"Authorization": f"Bearer {admin_token}"})
    assert b_res.status_code == 200
    assert b_res.json()["name"] == "Test CSV Quay Alpha"

    # Cleanup
    client.delete("/api/v1/master-data/berths/B-CSV-01", headers={"Authorization": f"Bearer {admin_token}"})
    client.delete("/api/v1/master-data/berths/B-CSV-02", headers={"Authorization": f"Bearer {admin_token}"})


def test_import_vessels_csv_validation(client, planner_token, admin_token):
    # Pre-cleanup if exists
    client.delete("/api/v1/master-data/vessels/V-CSV-01", headers={"Authorization": f"Bearer {admin_token}"})

    csv_payload = (
        "id,name,imo,carrier,vessel_class,cargo_volume_teu,draft_m,length_m,carrier_eta,priority_flag\n"
        "V-CSV-01,Maersk CSV Leader,IMO9910001,Maersk,POST_PANAMAX,5500,12.0,280.0,2026-09-15T08:00:00Z,true\n"
    )
    res = client.post(
        "/api/v1/master-data/import/vessels",
        headers={"Authorization": f"Bearer {planner_token}"},
        json={"csv_content": csv_payload}
    )
    assert res.status_code == 200
    assert res.json()["imported_count"] >= 1

    # Cleanup with admin privileges
    del_res = client.delete("/api/v1/master-data/vessels/V-CSV-01", headers={"Authorization": f"Bearer {admin_token}"})
    assert del_res.status_code in [200, 204]


# --- 3. COLLISION RESOLUTION SUGGESTIONS TEST ---

def test_override_collision_resolution_suggestions(client, supervisor_token):
    # Find a vessel currently berthed
    status_res = client.get("/api/v1/status/table", headers={"Authorization": f"Bearer {supervisor_token}"})
    assert status_res.status_code == 200
    data = status_res.json()
    berthed_vessel = next((v for v in data["vessels"] if v["status"] == "BERTHED"), None)
    other_vessel = next((v for v in data["vessels"] if v["status"] != "BERTHED"), None)

    if berthed_vessel and other_vessel:
        target_b_id = berthed_vessel["assigned_berth_id"]
        # Try to reassign other_vessel to target_b_id at the exact same current time
        now_iso = datetime.now(timezone.utc).isoformat()
        override_res = client.post(
            "/api/v1/optimiser/override",
            headers={"Authorization": f"Bearer {supervisor_token}"},
            json={
                "vessel_id": other_vessel["id"],
                "target_berth_id": target_b_id,
                "new_start_time": now_iso,
                "override_reason": "Emergency berth reallocation test"
            }
        )
        assert override_res.status_code == 200
        res_data = override_res.json()
        assert res_data["is_valid"] is False
        assert res_data["status"] == "REJECTED_HARD_CONSTRAINT"
        assert len(res_data["suggested_resolutions"]) > 0

        # Verify resolution options provided
        types = [s["resolution_type"] for s in res_data["suggested_resolutions"]]
        assert "ALTERNATIVE_BERTH" in types or "DEFERRED_TIME_WINDOW" in types


# --- 4. DEPENDENCY CHECK ON DELETION ---

def test_cannot_delete_berthed_vessel(client, admin_token):
    status_res = client.get("/api/v1/status/table", headers={"Authorization": f"Bearer {admin_token}"})
    berthed_vessel = next((v for v in status_res.json()["vessels"] if v["status"] == "BERTHED"), None)
    if berthed_vessel:
        del_res = client.delete(
            f"/api/v1/master-data/vessels/{berthed_vessel['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert del_res.status_code == 400
        assert "actively berthed" in del_res.json().get("message", del_res.json().get("detail", ""))


def test_import_turnaround_csv_and_retrain(client, admin_token):
    csv_payload = (
        "vessel_id,vessel_class,berth_id,actual_arrival_time,departure_time,scheduled_dwell_hours,actual_dwell_hours,delay_cause,delay_minutes,shift_id\n"
        "TEST-TURN-01,Panamax,B-05,2026-03-01T10:00:00Z,2026-03-02T12:00:00Z,22.0,26.0,CRANE_OUTAGE,240,SHIFT_A\n"
        "TEST-TURN-02,Feeder,B-08,2026-03-01T14:00:00Z,2026-03-02T04:00:00Z,14.0,14.0,NONE,0,SHIFT_B\n"
    )
    res = client.post(
        "/api/v1/master-data/import/turnaround?retrain_model=true",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"csv_content": csv_payload}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ["success", "partial_success"]
    assert data["imported_count"] == 2

    # Verify retrain endpoint works
    retrain_res = client.post("/api/v1/forecast/retrain", headers={"Authorization": f"Bearer {admin_token}"})
    assert retrain_res.status_code == 200
    metrics = retrain_res.json()
    assert len(metrics["models"]) > 0
    assert metrics["models"][0]["trained_model_score"] < metrics["models"][0]["naive_baseline_score"]
    assert metrics["models"][0]["improvement_pct"] > 10.0


