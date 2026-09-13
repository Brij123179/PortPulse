from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class VesselStatusItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    vessel_class: str
    cargo_volume: int
    carrier_eta: datetime
    corrected_eta: Optional[datetime] = None
    eta_confidence: float
    priority_flag: bool
    length_m: float
    draft_m: float
    status: str
    assigned_berth_id: Optional[str] = None
    assigned_berth_name: Optional[str] = None
    quay_fit: bool = True
    draft_fit: bool = True
    predicted_delay_hours: Optional[float] = None
    delay_factors: Optional[List[str]] = None


class BerthStatusItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    length_m: float
    draft_limit_m: float
    crane_slots: int
    operational_cranes: int
    status: str  # AVAILABLE, OCCUPIED, MAINTENANCE
    current_vessel_id: Optional[str] = None
    current_vessel_name: Optional[str] = None
    utilization_pct: float = 0.0


class LiveStatusSummary(BaseModel):
    total_vessels: int
    scheduled_vessels: int
    anchored_vessels: int
    berthed_vessels: int
    total_berths: int
    available_berths: int
    occupied_berths: int
    maintenance_berths: int
    total_quay_length_m: float
    yard_teu_capacity: int
    yard_teu_used: int
    yard_utilization_pct: float
    last_updated: datetime


class LiveStatusTableResponse(BaseModel):
    correlation_id: str
    summary: LiveStatusSummary
    vessels: List[VesselStatusItem]
    berths: List[BerthStatusItem]
