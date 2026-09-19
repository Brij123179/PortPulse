from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, field_serializer


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    correlation_id: str
    actor: str
    actor_role: Optional[str] = None
    actor_id: Optional[int] = None
    action: str
    entity_type: str
    entity_id: str
    payload_snapshot: Optional[str] = None
    client_ip: Optional[str] = None
    prev_hash: Optional[str] = None
    entry_hash: Optional[str] = None
    timestamp: datetime

    @field_serializer("timestamp")
    def serialize_timestamp(self, dt: datetime, _info) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class AuditLogListResponse(BaseModel):
    total: int
    items: List[AuditLogResponse]


class AuditIntegrityResponse(BaseModel):
    is_valid: bool
    total_verified: int
    chain_head: Optional[str] = None
    compromised_entry_id: Optional[int] = None
    error: Optional[str] = None
    verified_at: str


class AuditAnomaly(BaseModel):
    type: str
    severity: str  # HIGH, MEDIUM, LOW, CRITICAL
    description: str
    actor: Optional[str] = None
    client_ip: Optional[str] = None
    timestamp: str
    details: Optional[dict] = None


class AuditAnomalyListResponse(BaseModel):
    total: int
    anomalies: List[AuditAnomaly]
