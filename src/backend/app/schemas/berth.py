from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class CraneBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    crane_type: str = Field("STS", description="STS or Gantry")
    status: str = Field("OPERATIONAL", description="OPERATIONAL, MAINTENANCE, BREAKDOWN")


class CraneCreate(CraneBase):
    id: str
    berth_id: str


class CraneResponse(CraneBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    berth_id: str
    maintenance_windows_json: Optional[str] = "[]"


class BerthBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    length_m: float = Field(..., gt=0, description="Length of berth quay in meters")
    draft_limit_m: float = Field(..., gt=0, description="Max permissible draft in meters")
    crane_slots: int = Field(2, ge=1, le=10, description="Max cranes accommodated")
    contractual_priority_rules: Optional[str] = None
    status: str = Field("AVAILABLE", description="AVAILABLE, OCCUPIED, MAINTENANCE")


class BerthCreate(BerthBase):
    id: str = Field(..., min_length=2, max_length=50)


class BerthUpdate(BaseModel):
    name: Optional[str] = None
    length_m: Optional[float] = Field(None, gt=0)
    draft_limit_m: Optional[float] = Field(None, gt=0)
    crane_slots: Optional[int] = Field(None, ge=1, le=10)
    contractual_priority_rules: Optional[str] = None
    status: Optional[str] = None


class BerthResponse(BerthBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    cranes: List[CraneResponse] = []


class YardCapacityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    teu_capacity: int
    teu_used: int
    reefer_plugs_available: int
    reefer_plugs_used: int
    utilization_pct: float
