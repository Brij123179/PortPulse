import pytest
from app.services.ml.eta_model import ETACorrectionModel
from app.services.ml.baselines import NaiveBaselinesEvaluator
from app.models.entities import TurnaroundRecord, Vessel


def test_naive_baselines_vs_trained_model(db_session):
    """
    06_ml_engineering.md §3.1 & Prompt §4:
    Verifies that the trained ETA correction model strictly beats the naive carrier bias baseline.
    """
    records = db_session.query(TurnaroundRecord).all()
    assert len(records) >= 50

    baseline_metrics = NaiveBaselinesEvaluator.evaluate_eta_baseline(records)
    assert baseline_metrics["mae"] > 0
    assert baseline_metrics["rmse"] > 0

    model = ETACorrectionModel()
    model_metrics = model.fit_and_evaluate(db_session)

    assert model_metrics["beats_baseline"] is True
    assert model_metrics["model_mae_hours"] < model_metrics["baseline_mae_hours"]
    assert model_metrics["mae_improvement_pct"] > 10.0


def test_72h_berth_occupancy_and_confidence_bands(client, supervisor_headers):
    """
    F-202 / F-203 / F-207:
    Verifies 72-hour occupancy probabilities, uncertainty bands, and risk tiers.
    """
    response = client.get("/api/v1/risk/heatmap?horizon=72", headers=supervisor_headers)
    assert response.status_code == 200
    data = response.json()

    assert data["horizon_hours"] == 72
    assert len(data["berths"]) == 10

    for b in data["berths"]:
        assert len(b["timeline"]) == 72
        for h in b["timeline"]:
            prob = h["occupancy_probability"]
            c_low = h["confidence_low"]
            c_high = h["confidence_high"]
            tier = h["risk_tier"]

            # Probability bounds
            assert 0.0 <= prob <= 1.0
            # Confidence interval bounds (F-207)
            assert c_low <= prob <= c_high
            # Risk tier assignment
            assert tier in ["GREEN", "AMBER", "RED"]
            if prob >= 0.85:
                assert tier == "RED"
            elif prob >= 0.60:
                assert tier == "AMBER"

            # Explainability layer (F-206)
            assert len(h["top_factors"]) > 0
            for factor in h["top_factors"]:
                assert "feature_name" in factor
                assert "impact_pct" in factor
                assert "description" in factor
                assert len(factor["description"]) > 5


def test_anchorage_queue_forecast(client, supervisor_headers):
    """F-204: Offshore queue forecast."""
    response = client.get("/api/v1/forecast/anchorage?horizon=72", headers=supervisor_headers)
    assert response.status_code == 200
    data = response.json()

    assert data["horizon_hours"] == 72
    assert len(data["timeline"]) == 72
    for item in data["timeline"]:
        assert item["predicted_queue"] >= 0
        assert item["confidence_low"] <= item["predicted_queue"] <= item["confidence_high"]


def test_cascading_delay_simulation(client, supervisor_headers, db_session):
    """F-205: Cascading delay simulator."""
    # Find any active vessel
    vessel = db_session.query(Vessel).first()
    assert vessel is not None

    req_payload = {
        "vessel_id": vessel.id,
        "delay_hours": 4.0
    }
    response = client.post("/api/v1/simulate/cascade", json=req_payload, headers=supervisor_headers)
    assert response.status_code == 200
    data = response.json()

    assert data["trigger_vessel_id"] == vessel.id
    assert data["trigger_delay_hours"] == 4.0
    assert data["total_ripple_delay_hours"] >= 0.0
    assert "summary_explanation" in data
    assert len(data["summary_explanation"]) > 10


def test_forecast_metrics_endpoint(client, supervisor_headers):
    """Verifies baseline comparison metrics endpoint."""
    response = client.get("/api/v1/forecast/metrics", headers=supervisor_headers)
    assert response.status_code == 200
    data = response.json()

    assert len(data["models"]) >= 2
    for m in data["models"]:
        assert m["naive_baseline_score"] > 0
        assert m["trained_model_score"] > 0
        assert m["improvement_pct"] >= 0
