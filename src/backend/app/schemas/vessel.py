from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class VesselBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    vessel_class: str = Field(..., description="Feeder, Panamax, Post-Panamax, ULCV")
    cargo_volume: int = Field(..., ge=0, description="TEU cargo volume")
    carrier_eta: datetime = Field(..., description="Carrier reported arrival time")
    priority_flag: bool = Field(False, description="Priority cargo indicator")
    length_m: float = Field(..., gt=0, description="Vessel length overall in meters")
    draft_m: float = Field(..., gt=0, description="Operational draft depth in meters")
    status: str = Field("SCHEDULED", description="SCHEDULED, ANCHORED, BERTHED, DEPARTED")
    assigned_berth_id: Optional[str] = None


class VesselCreate(VesselBase):
    id: str = Field(..., min_length=2, max_length=50, description="Vessel IMO or unique ID")


class VesselUpdate(BaseModel):
    name: Optional[str] = None
    vessel_class: Optional[str] = None
    cargo_volume: Optional[int] = Field(None, ge=0)
    carrier_eta: Optional[datetime] = None
    priority_flag: Optional[bool] = None
    length_m: Optional[float] = Field(None, gt=0)
    draft_m: Optional[float] = Field(None, gt=0)
    status: Optional[str] = None
    assigned_berth_id: Optional[str] = None


class VesselResponse(VesselBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    corrected_eta: Optional[datetime] = None
    eta_confidence: float = 0.90
