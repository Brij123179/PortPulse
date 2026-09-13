import pytest
from fastapi.testclient import TestClient
from app.main import app


def test_real_db_live_status():
    """End-to-end verification against the seeded portpulse.db file."""
    with TestClient(app) as client:
        response = client.get("/api/v1/status/table", headers={"X-User-Role": "shift_supervisor"})
        assert response.status_code == 200
        data = response.json()
        assert data["summary"]["total_vessels"] == 50
        assert data["summary"]["total_berths"] == 10
        assert len(data["vessels"]) == 50
        assert len(data["berths"]) == 10
        assert data["correlation_id"].startswith("pp-") or len(data["correlation_id"]) > 0


def test_master_data_berths_real_db():
    with TestClient(app) as client:
        response = client.get("/api/v1/master-data/berths", headers={"X-User-Role": "admin"})
        assert response.status_code == 200
        berths = response.json()
        assert len(berths) == 10
        # Check crane count
        total_cranes = sum(len(b["cranes"]) for b in berths)
        assert total_cranes >= 20
