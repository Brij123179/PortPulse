def test_get_vessels_status(client, supervisor_headers):
    """F-105: Live vessel status endpoint returns vessels with fit checks."""
    response = client.get("/api/v1/status/vessels", headers=supervisor_headers)
    assert response.status_code == 200
    vessels = response.json()
    assert len(vessels) > 0
    first = vessels[0]
    assert "carrier_eta" in first
    assert "quay_fit" in first
    assert "draft_fit" in first


def test_get_berths_status(client, supervisor_headers):
    """F-105: Live berth status endpoint returns operational cranes and occupancy."""
    response = client.get("/api/v1/status/berths", headers=supervisor_headers)
    assert response.status_code == 200
    berths = response.json()
    assert len(berths) == 10
    first = berths[0]
    assert "operational_cranes" in first
    assert "status" in first


def test_get_live_status_summary(client, supervisor_headers):
    """F-105: Summary counters for dashboard display."""
    response = client.get("/api/v1/status/summary", headers=supervisor_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total_vessels"] == 50
    assert data["total_berths"] == 10
    assert data["yard_teu_capacity"] > 0
    assert data["yard_utilization_pct"] > 0


def test_get_live_status_table_endpoint(client, supervisor_headers):
    """F-105: Unified table response."""
    response = client.get("/api/v1/status/table", headers=supervisor_headers)
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "vessels" in data
    assert "berths" in data
    assert "correlation_id" in data
