from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    correlation_id: str
    actor: str
    action: str
    entity_type: str
    entity_id: str
    payload_snapshot: Optional[str] = None
    timestamp: datetime


class AuditLogListResponse(BaseModel):
    total: int
    items: List[AuditLogResponse]
