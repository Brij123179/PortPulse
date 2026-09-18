from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class FactorAttribution(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    feature_name: str = Field(..., description="Feature driving the risk score")
    impact_pct: float = Field(..., description="Relative contribution percentage")
    direction: str = Field("INCREASE", description="INCREASE or DECREASE")
    description: str = Field(..., description="Grounded explanation string (F-206)")


class BerthHourRiskItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hour_offset: int = Field(..., ge=1, le=168, description="Hour index from now")
    forecast_time: datetime
    occupancy_probability: float = Field(..., ge=0.0, le=1.0)
    confidence_low: float = Field(..., ge=0.0, le=1.0)
    confidence_high: float = Field(..., ge=0.0, le=1.0)
    risk_tier: str = Field("GREEN", description="GREEN, AMBER, RED")
    expected_vessel_id: Optional[str] = None
    expected_vessel_name: Optional[str] = None
    top_factors: List[FactorAttribution] = []


class BerthHeatmapTrack(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    berth_id: str
    berth_name: str
    length_m: float
    draft_limit_m: float
    crane_slots: int
    timeline: List[BerthHourRiskItem]


class HeatmapSummary(BaseModel):
    red_tier_count: int
    amber_tier_count: int
    green_tier_count: int
    critical_berths: List[str]
    peak_congestion_window: str
    baseline_red_tier_count: Optional[int] = None
    red_hours_resolved_count: Optional[int] = None
    is_optimized: Optional[bool] = False


class HeatmapResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    correlation_id: str
    model_version: str = "lgb-prophet-v1.0"
    generated_at: datetime
    horizon_hours: int = 72
    summary: HeatmapSummary
    berths: List[BerthHeatmapTrack]


class AnchorageHourItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hour_offset: int
    forecast_time: datetime
    predicted_queue: int
    confidence_low: int
    confidence_high: int


class AnchorageForecastResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    correlation_id: str
    horizon_hours: int = 72
    current_queue: int
    peak_predicted_queue: int
    timeline: List[AnchorageHourItem]


class CascadeSimulationRequest(BaseModel):
    vessel_id: str = Field(..., description="Target vessel experiencing delay")
    delay_hours: float = Field(..., gt=0, le=48, description="Simulated slip in hours")


class CascadeImpactedVessel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    vessel_id: str
    vessel_name: str
    berth_id: str
    original_eta: datetime
    new_projected_berth_time: datetime
    cascade_delay_hours: float
    conflict_type: str = Field("BERTH_COLLISION", description="BERTH_COLLISION or QUEUE_DELAY")


class CascadeSimulationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    correlation_id: str
    trigger_vessel_id: str
    trigger_delay_hours: float
    total_ripple_delay_hours: float
    impacted_vessels_count: int
    impacted_vessels: List[CascadeImpactedVessel]
    summary_explanation: str


class ModelEvaluationMetric(BaseModel):
    task: str
    metric_name: str
    naive_baseline_score: float
    trained_model_score: float
    improvement_pct: float
    better: str
    description: str


class MLMetricsResponse(BaseModel):
    correlation_id: str
    evaluated_at: datetime
    models: List[ModelEvaluationMetric]
