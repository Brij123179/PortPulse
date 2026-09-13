from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import CurrentUser, get_current_user
from app.services.ml.risk_engine import risk_engine
from app.services.ml.cascade_simulator import CascadingDelaySimulator
from app.schemas.forecast import (
    HeatmapResponse, AnchorageForecastResponse, CascadeSimulationRequest,
    CascadeSimulationResponse, MLMetricsResponse
)
from app.core.logging import correlation_id_ctx

router = APIRouter(prefix="/api/v1", tags=["Prediction Core & Forecasting"])


@router.get("/risk/heatmap", response_model=HeatmapResponse)
def get_congestion_heatmap(
    horizon: int = Query(72, ge=12, le=168, description="Forecast horizon in hours"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """
    F-203 / F-206 / F-207:
    Returns the hour-by-hour congestion risk heatmap across all berths for the next 72 hours,
    with SHAP explainability factors and 10th-90th percentile confidence bounds.
    """
    return risk_engine.generate_heatmap(db, horizon_hours=horizon)


@router.get("/forecast/berths", response_model=HeatmapResponse)
def get_berth_occupancy_forecast(
    horizon: int = Query(72, ge=12, le=168),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """
    F-202: Alias for berth occupancy probability forecast across 72h horizon.
    """
    return risk_engine.generate_heatmap(db, horizon_hours=horizon)


@router.get("/forecast/anchorage", response_model=AnchorageForecastResponse)
def get_anchorage_queue_forecast(
    horizon: int = Query(72, ge=12, le=168),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """
    F-204: Predicts number of vessels waiting in offshore anchorage queue over the horizon.
    """
    return risk_engine.get_anchorage_forecast(db, horizon_hours=horizon)


@router.post("/simulate/cascade", response_model=CascadeSimulationResponse)
def simulate_cascading_delay(
    request: CascadeSimulationRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """
    F-205: Simulates how an operational delay on one vessel cascades into downstream berth assignments.
    """
    corr_id = correlation_id_ctx.get() or "cascade-sim"
    return CascadingDelaySimulator.simulate_delay_ripple(
        db,
        target_vessel_id=request.vessel_id,
        delay_hours=request.delay_hours,
        correlation_id=corr_id
    )


@router.get("/forecast/metrics", response_model=MLMetricsResponse)
def get_ml_metrics(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """
    06_ml_engineering.md §3.1 / Prompt §4:
    Returns comparative evaluation metrics proving trained models beat the naive baselines.
    """
    return risk_engine.get_evaluation_metrics(db)
