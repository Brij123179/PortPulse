from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class VesselDelayShockRequest(BaseModel):
    vessel_id: Optional[str] = Field(None, description="ID of the vessel to delay (e.g., 'V-001')")
    vessel_name: Optional[str] = Field(None, description="Name of the vessel to delay (e.g., 'Maersk Mc-Kinney Moller')")
    delay_hours: float = Field(..., ge=0.5, le=168.0, description="Injected arrival delay duration in hours")
    delay_cause: Optional[str] = Field("ENGINE_BREAKDOWN", description="Root cause of the shock disruption")
    apply_to_database: bool = Field(False, description="If True, commits the updated ETA to live database and triggers ML risk evaluation")


class ShockSummaryImpact(BaseModel):
    total_monetary_damages_usd: float = Field(..., description="Aggregate monetary cost caused by the delay shock across the harbor ($USD)")
    demurrage_damages_usd: float = Field(..., description="Total additional contractual demurrage fines incurred ($USD)")
    bunker_waste_usd: float = Field(..., description="Excess bunker fuel cost burned by idling vessels at anchorage ($USD)")
    berth_disruption_cost_usd: float = Field(..., description="Quayside operational disruption and schedule re-sequencing overhead ($USD)")
    co2_excess_tonnes: float = Field(..., description="Excess metric tonnes of CO2 emitted by idling vessels")
    total_additional_wait_hours: float = Field(..., description="Sum of extra waiting hours suffered across all harbor vessels")
    baseline_avg_wait_hours: float = Field(..., description="Port-wide average wait time before delay shock")
    simulated_avg_wait_hours: float = Field(..., description="Port-wide average wait time after delay shock")
    port_average_wait_spike_hours: float = Field(..., description="Net increase in harbor average wait time")
    total_vessels_affected: int = Field(..., description="Total count of vessels experiencing delay or berth re-timing")
    total_fleets_affected: int = Field(..., description="Count of distinct shipping fleets / alliances impacted")
    recovery_horizon_hours: float = Field(..., description="Estimated hours until port operations absorb the delay and normalize")
    severity: str = Field(..., description="CRITICAL, HIGH, MODERATE, LOW")


class FleetChainImpact(BaseModel):
    fleet_name: str = Field(..., description="Global carrier alliance or fleet group (e.g., '2M Alliance', 'Ocean Alliance')")
    carrier: str = Field(..., description="Lead shipping line (e.g., 'Maersk Line', 'MSC', 'CMA CGM')")
    vessels_affected_count: int = Field(..., description="Number of vessels in this fleet collaterally affected")
    total_delay_hours: float = Field(..., description="Cumulative delay hours absorbed by this fleet")
    total_demurrage_usd: float = Field(..., description="Total demurrage cost inflicted on this fleet ($USD)")
    affected_vessels: List[str] = Field(default_factory=list, description="Names of affected vessels in this fleet")
    chain_risk_level: str = Field("HIGH", description="CRITICAL, HIGH, MODERATE, LOW")
    operational_note: str = Field(..., description="Summary narrative explaining how the delay propagated to this fleet")


class AffectedVesselDetail(BaseModel):
    vessel_id: str
    vessel_name: str
    vessel_class: str
    carrier: str
    fleet: str
    assigned_berth_id: Optional[str] = None
    assigned_berth_name: Optional[str] = None
    original_start_time: str
    delayed_start_time: str
    wait_increase_hours: float
    demurrage_impact_usd: float
    impact_category: str = Field(..., description="PRIMARY_SHOCK, BERTH_COLLISION_CASCADE, QUEUE_DISPLACEMENT, ANCHORAGE_STACK")
    impact_reason: str
    severity: str = Field("MODERATE", description="CRITICAL, HIGH, MODERATE, LOW")


class MitigationAction(BaseModel):
    action_type: str = Field(..., description="BERTH_DIVERSION, SLOW_STEAMING, CRANE_BOOST, PRIORITY_SWAP")
    target_vessel_name: str
    description: str
    potential_savings_usd: float
    potential_hours_saved: float


class TargetVesselMetadata(BaseModel):
    id: str
    name: str
    vessel_class: str
    carrier: str
    fleet: str
    cargo_volume: int
    draft_m: float
    length_m: float
    original_eta: str
    delayed_eta: str
    delay_hours: float
    current_status: str
    assigned_berth_id: Optional[str] = None
    assigned_berth_name: Optional[str] = None


class VesselDelayShockResponse(BaseModel):
    status: str = "success"
    correlation_id: str
    applied_to_live: bool
    delay_cause: str
    target_vessel: TargetVesselMetadata
    summary_impact: ShockSummaryImpact
    fleet_chain_impacts: List[FleetChainImpact]
    affected_vessels: List[AffectedVesselDetail]
    mitigation_recommendations: List[MitigationAction]
    message: str
