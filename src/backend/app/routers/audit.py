from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import CurrentUser, get_current_user
from app.schemas.audit import AuditLogListResponse, AuditLogResponse
from app.services.audit import AuditService

router = APIRouter(prefix="/api/v1/audit", tags=["Audit & Activity Logging"])


@router.get("/logs", response_model=AuditLogListResponse)
def get_audit_logs(
    limit: int = Query(50, ge=1, le=200, description="Max records to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type (BERTH, VESSEL, RECOMMENDATION, SOLVER, OVERRIDE)"),
    action: Optional[str] = Query(None, description="Filter by action (e.g. CREATE_BERTH, RECOMMENDATION_DECISION)"),
    actor: Optional[str] = Query(None, description="Filter by username"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """
    Returns an append-only audit trail of operational events, master data mutations,
    prescriptive recommendation actions, and manual supervisor overrides.
    Accessible to all authenticated terminal personnel.
    """
    total, items = AuditService.get_logs(
        db=db,
        limit=limit,
        offset=offset,
        entity_type=entity_type,
        action=action,
        actor=actor
    )
    return AuditLogListResponse(
        total=total,
        items=[AuditLogResponse.model_validate(item) for item in items]
    )
