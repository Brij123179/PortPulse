from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import require_roles, UserRole, CurrentUser
from app.services.ingestion import PortDataGenerator
from app.models.entities import TurnaroundRecord, Vessel, Berth, Crane, YardCapacity
from app.schemas.common import SuccessResponse
from app.core.logging import correlation_id_ctx

router = APIRouter(prefix="/api/v1/ingestion", tags=["Data Ingestion & Synthetic Generator"])


class TurnaroundRecordItem(BaseModel):
    id: int
    vessel_id: str
    vessel_class: str
    berth_id: str
    arrival_time: datetime
    departure_time: datetime
    actual_dwell_hours: float
    scheduled_dwell_hours: float
    delay_cause: Optional[str] = None
    delay_minutes: float
    shift_id: str


class TurnaroundHistoryResponse(BaseModel):
    correlation_id: Optional[str] = None
    total_count: int
    returned_count: int
    records: List[TurnaroundRecordItem]


@router.post("/generate", response_model=SuccessResponse)
def trigger_generation(
    vessels: int = Query(50, ge=10, le=200, description="Number of vessels to generate"),
    berths: int = Query(10, ge=4, le=30, description="Number of berths to generate"),
    seed: int = Query(42, description="Random seed for deterministic generation"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([UserRole.ADMIN, UserRole.TERMINAL_MANAGER]))
):
    """
    F-101 / F-102: Generates synthetic port dataset and historical turnaround store (F-103).
    Role restricted to Admin and Terminal Manager.
    """
    generator = PortDataGenerator(seed=seed)
    stats = generator.generate_all(
        db,
        vessel_count=vessels,
        berth_count=berths,
        historical_days=365,
        clear_existing=True
    )
    return SuccessResponse(
        status="success",
        message=f"Generated {stats['vessels']} vessels, {stats['berths']} berths, {stats['cranes']} cranes, and {stats['turnaround_records']} historical records.",
        correlation_id=correlation_id_ctx.get(),
        data=stats
    )


@router.post("/shock-event", response_model=SuccessResponse)
def inject_shock(
    event_type: str = Query(..., description="crane_outage, mega_ship_surge, tidal_restriction"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([UserRole.ADMIN, UserRole.TERMINAL_MANAGER, UserRole.SHIFT_SUPERVISOR]))
):
    """
    F-101: Injects an operational shock event for dynamic testing and demo scenarios.
    """
    valid_events = ["crane_outage", "mega_ship_surge", "tidal_restriction"]
    if event_type not in valid_events:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid event_type '{event_type}'. Must be one of: {valid_events}"
        )

    generator = PortDataGenerator()
    result = generator.inject_shock_event(db, event_type=event_type)
    return SuccessResponse(
        status="success",
        message=f"Shock event '{event_type}' injected successfully.",
        correlation_id=correlation_id_ctx.get(),
        data=result
    )


@router.get("/history", response_model=TurnaroundHistoryResponse)
def get_historical_records(
    limit: int = Query(50, ge=1, le=500),
    vessel_class: Optional[str] = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([UserRole.ADMIN, UserRole.TERMINAL_MANAGER, UserRole.SHIFT_SUPERVISOR, UserRole.VESSEL_PLANNER]))
):
    """
    F-103: Historical turnaround store endpoint for model training and historical verification.
    """
    query = db.query(TurnaroundRecord)
    if vessel_class:
        query = query.filter(TurnaroundRecord.vessel_class == vessel_class)
    
    total = query.count()
    records = query.order_by(TurnaroundRecord.arrival_time.desc()).limit(limit).all()
    
    return {
        "correlation_id": correlation_id_ctx.get(),
        "total_count": total,
        "returned_count": len(records),
        "records": [
            {
                "id": r.id,
                "vessel_id": r.vessel_id,
                "vessel_class": r.vessel_class,
                "berth_id": r.berth_id,
                "arrival_time": r.arrival_time,
                "departure_time": r.departure_time,
                "actual_dwell_hours": r.actual_dwell_hours,
                "scheduled_dwell_hours": r.scheduled_dwell_hours,
                "delay_cause": r.delay_cause,
                "delay_minutes": r.delay_minutes,
                "shift_id": r.shift_id,
            }
            for r in records
        ]
    }
