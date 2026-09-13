"""
Pydantic schemas for Increment 3: Prescriptive Layer & Optimisation (F-301 - F-308)
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class CostImpactEstimate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hours_saved: float = Field(..., description="Estimated hours of waiting/turnaround saved")
    demurrage_saved_usd: float = Field(..., description="Projected demurrage savings based on standard maritime rates ($25k/day)")
    bunker_fuel_saved_usd: float = Field(0.0, description="Fuel cost savings from slow-steaming ($650/mt VLSFO)")
    co2_saved_mt: float = Field(0.0, description="Emissions reduction from slow-steaming (3.114 mt CO2 / mt fuel)")
    operational_cost_usd: float = Field(0.0, description="Estimated cost to execute the action (e.g. extra pilotage/tug)")
    net_benefit_usd: float = Field(..., description="Net economic saving: (demurrage + fuel) - operational_cost")


class PrescriptiveRecommendation(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Unique recommendation ID (e.g. REC-101)")
    recommendation_type: str = Field(..., description="DIVERSION | SLOW_STEAM | PRIORITY_RESEQUENCE")
    vessel_id: str
    vessel_name: str
    carrier: Optional[str] = None
    source_berth_id: Optional[str] = None
    source_berth_name: Optional[str] = None
    target_berth_id: Optional[str] = None
    target_berth_name: Optional[str] = None
    
    # Action specific details
    action_summary: str = Field(..., description="One-sentence executive summary (e.g. 'Divert MSC Oscar to Berth 04')")
    rationale: str = Field(..., description="Human-readable grounded reason explaining why this action is recommended")
    speed_adjustment_knots: Optional[float] = Field(None, description="Recommended speed reduction for slow-steam")
    original_eta: datetime
    recommended_eta: datetime
    
    # Financial & operational impact
    impact: CostImpactEstimate
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence in recommendation feasibility")
    status: str = Field("PENDING", description="PENDING | ACCEPTED | MODIFIED | REJECTED")
    action_timestamp: Optional[datetime] = None
    action_by_user: Optional[str] = None
    action_notes: Optional[str] = None


class RecommendationActionRequest(BaseModel):
    action: str = Field(..., description="ACCEPT | MODIFY | REJECT")
    modified_berth_id: Optional[str] = Field(None, description="If MODIFY, alternate target berth")
    modified_eta: Optional[datetime] = Field(None, description="If MODIFY, alternate ETA")
    notes: Optional[str] = Field(None, description="Supervisor decision notes / rationale")


class RecommendationActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    correlation_id: str
    recommendation_id: str
    status: str
    action_by: str
    action_timestamp: datetime
    message: str


class RecommendationsListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    correlation_id: str
    total_recommendations: int
    active_count: int
    recommendations: List[PrescriptiveRecommendation]


# --- MILP Berth & Crane Assignment Models (F-305) ---

class VesselAssignment(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    vessel_id: str
    vessel_name: str
    vessel_class: str
    length_m: float
    draft_m: float
    assigned_berth_id: str
    assigned_berth_name: str
    start_time: datetime
    end_time: datetime
    allocated_cranes: int
    expected_dwell_hours: float
    wait_time_hours: float
    demurrage_cost_usd: float


class OptimisationRunRequest(BaseModel):
    horizon_hours: int = Field(72, ge=12, le=168, description="Optimisation look-ahead horizon")
    wait_time_weight: float = Field(1.0, ge=0.0, description="Objective weight for minimizing vessel wait time")
    crane_utilization_weight: float = Field(0.5, ge=0.0, description="Objective weight for maximizing crane utilization")
    priority_cargo_weight: float = Field(2.0, ge=0.0, description="Objective weight for protecting high-priority / reefer cargo")


class OptimisationRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    correlation_id: str
    solver_status: str = Field(..., description="OPTIMAL | FEASIBLE | INFEASIBLE")
    solve_time_seconds: float
    horizon_hours: int
    vessels_scheduled: int
    average_wait_time_hours: float
    total_port_demurrage_usd: float
    crane_utilization_pct: float
    assignments: List[VesselAssignment]
    violated_constraints: List[str] = Field(default_factory=list, description="Explicit violation reasons if INFEASIBLE")


# --- Manual Override Models (F-307) ---

class ManualOverrideRequest(BaseModel):
    vessel_id: str
    target_berth_id: str
    new_start_time: datetime
    override_reason: str = Field(..., min_length=3, description="Operational justification for supervisor override")


class SuggestedResolution(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    resolution_type: str = Field(..., description="ALTERNATIVE_BERTH | DEFERRED_TIME_WINDOW")
    description: str
    target_berth_id: Optional[str] = None
    target_berth_name: Optional[str] = None
    recommended_start_time: Optional[datetime] = None
    reasoning: str


class OverrideValidationResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    correlation_id: str
    is_valid: bool
    status: str = Field(..., description="APPROVED | REJECTED_HARD_CONSTRAINT")
    vessel_id: str
    vessel_name: str
    berth_id: str
    berth_name: str
    constraint_violations: List[str] = Field(default_factory=list, description="Specific hard constraint violations detected")
    warnings: List[str] = Field(default_factory=list, description="Operational soft warnings (e.g. minor crane shortage)")
    suggested_resolutions: List[SuggestedResolution] = Field(default_factory=list, description="Automated collision resolution alternatives")
    message: str


# --- What-If Simulation Models (F-308) ---

class WhatIfIntervention(BaseModel):
    intervention_type: str = Field(..., description="DIVERT | SLOW_STEAM | CRANE_BOOST")
    vessel_id: str
    target_berth_id: Optional[str] = None
    speed_reduction_knots: Optional[float] = None
    additional_cranes: Optional[int] = None


class WhatIfRequest(BaseModel):
    scenario_name: str = Field("Hypothetical Operational Scenario", description="Label for what-if run")
    interventions: List[WhatIfIntervention]


class WhatIfMetricComparison(BaseModel):
    metric_name: str
    baseline_value: float
    simulated_value: float
    delta: float
    unit: str
    improvement: bool


class WhatIfResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    correlation_id: str
    scenario_name: str
    simulated_at: datetime
    summary: str
    comparisons: List[WhatIfMetricComparison]
    red_tier_berth_hours_before: int
    red_tier_berth_hours_after: int
    total_demurrage_saved_usd: float
