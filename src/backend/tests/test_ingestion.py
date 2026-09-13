from app.models.entities import Vessel, Berth, Crane, TurnaroundRecord, YardCapacity


def test_generator_counts(db_session):
    """F-101: Test synthetic port generator generates 50 vessels and 10 berths."""
    vessels = db_session.query(Vessel).all()
    berths = db_session.query(Berth).all()
    cranes = db_session.query(Crane).all()
    records = db_session.query(TurnaroundRecord).all()
    yard = db_session.query(YardCapacity).first()

    assert len(vessels) == 50
    assert len(berths) == 10
    assert len(cranes) >= 20  # Each berth has at least 2 cranes
    assert len(records) >= 300 # 1 synthetic year of historical data (F-103)
    assert yard is not None
    assert yard.teu_capacity > 0
    assert yard.teu_used <= yard.teu_capacity


def test_shock_event_crane_outage(client, supervisor_headers):
    """F-101: Test injection of crane outage shock event."""
    response = client.post("/api/v1/ingestion/shock-event?event_type=crane_outage", headers=supervisor_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "crane_outage" in data["message"]


def test_shock_event_mega_ship_surge(client, supervisor_headers):
    """F-101: Test injection of mega-ship surge shock event."""
    response = client.post("/api/v1/ingestion/shock-event?event_type=mega_ship_surge", headers=supervisor_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "mega_ship_surge" in data["message"]


def test_historical_records_endpoint(client, supervisor_headers):
    """F-103: Test query for historical turnaround records."""
    response = client.get("/api/v1/ingestion/history?limit=10", headers=supervisor_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] >= 300
    assert len(data["records"]) == 10
    first = data["records"][0]
    assert "actual_dwell_hours" in first
    assert "delay_cause" in first
