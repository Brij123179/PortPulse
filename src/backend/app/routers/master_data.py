from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import require_roles, UserRole, CurrentUser, get_current_user
from app.services.master_data import MasterDataService
from app.services.audit import AuditService
from app.schemas.berth import BerthCreate, BerthUpdate, BerthResponse, YardCapacityResponse
from app.schemas.vessel import VesselCreate, VesselUpdate, VesselResponse
from app.schemas.common import SuccessResponse
from app.core.logging import correlation_id_ctx

router = APIRouter(prefix="/api/v1/master-data", tags=["Master Data CRUD"])


# --- BERTHS ---

@router.get("/berths", response_model=List[BerthResponse])
def list_berths(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """F-104: List all berths and associated cranes."""
    return MasterDataService.list_berths(db)


@router.get("/berths/{berth_id}", response_model=BerthResponse)
def get_berth(berth_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """F-104: Retrieve a specific berth specification."""
    return MasterDataService.get_berth(db, berth_id)


@router.post("/berths", response_model=BerthResponse, status_code=status.HTTP_201_CREATED)
def create_berth(
    berth_in: BerthCreate,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_roles([UserRole.ADMIN]))
):
    """F-104 / F-106: Admin creates new berth configuration."""
    res = MasterDataService.create_berth(db, berth_in)
    AuditService.record_event(
        db=db,
        actor=admin.username,
        actor_role=admin.role.value,
        actor_id=admin.id,
        action="CREATE_BERTH",
        entity_type="BERTH",
        entity_id=res.id,
        payload_snapshot={"name": res.name, "length_m": res.length_m, "draft_limit_m": res.draft_limit_m, "crane_slots": res.crane_slots}
    )
    return res


@router.put("/berths/{berth_id}", response_model=BerthResponse)
def update_berth(
    berth_id: str,
    berth_update: BerthUpdate,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_roles([UserRole.ADMIN, UserRole.TERMINAL_MANAGER]))
):
    """F-104 / F-106: Update berth parameters."""
    res = MasterDataService.update_berth(db, berth_id, berth_update)
    AuditService.record_event(
        db=db,
        actor=admin.username,
        actor_role=admin.role.value,
        actor_id=admin.id,
        action="UPDATE_BERTH",
        entity_type="BERTH",
        entity_id=res.id,
        payload_snapshot=berth_update.model_dump(exclude_unset=True)
    )
    return res


@router.delete("/berths/{berth_id}", response_model=SuccessResponse)
def delete_berth(
    berth_id: str,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_roles([UserRole.ADMIN]))
):
    """F-104 / F-106: Admin deletes berth (rejects if active vessel berthed)."""
    MasterDataService.delete_berth(db, berth_id)
    AuditService.record_event(
        db=db,
        actor=admin.username,
        actor_role=admin.role.value,
        actor_id=admin.id,
        action="DELETE_BERTH",
        entity_type="BERTH",
        entity_id=berth_id
    )
    return SuccessResponse(
        status="success",
        message=f"Berth '{berth_id}' removed successfully.",
        correlation_id=correlation_id_ctx.get()
    )


# --- VESSELS ---

@router.get("/vessels", response_model=List[VesselResponse])
def list_vessels(
    limit: int = Query(100, ge=1, le=500),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """F-104: List vessels with optional status filter."""
    return MasterDataService.list_vessels(db, limit=limit, status_filter=status)


@router.get("/vessels/{vessel_id}", response_model=VesselResponse)
def get_vessel(vessel_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """F-104: Retrieve a specific vessel."""
    return MasterDataService.get_vessel(db, vessel_id)


@router.post("/vessels", response_model=VesselResponse, status_code=status.HTTP_201_CREATED)
def create_vessel(
    vessel_in: VesselCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([UserRole.ADMIN, UserRole.VESSEL_PLANNER]))
):
    """F-104 / F-106: Provision a new scheduled vessel with draft/length validation."""
    res = MasterDataService.create_vessel(db, vessel_in)
    AuditService.record_event(
        db=db,
        actor=user.username,
        actor_role=user.role.value,
        actor_id=user.id,
        action="CREATE_VESSEL",
        entity_type="VESSEL",
        entity_id=res.id,
        payload_snapshot={"name": res.name, "imo": res.imo, "carrier": res.carrier, "teu": res.teu, "assigned_berth_id": res.assigned_berth_id}
    )
    return res


@router.put("/vessels/{vessel_id}", response_model=VesselResponse)
def update_vessel(
    vessel_id: str,
    vessel_update: VesselUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([UserRole.ADMIN, UserRole.VESSEL_PLANNER, UserRole.SHIFT_SUPERVISOR]))
):
    """F-104 / F-106: Update vessel specs or assignment."""
    res = MasterDataService.update_vessel(db, vessel_id, vessel_update)
    AuditService.record_event(
        db=db,
        actor=user.username,
        actor_role=user.role.value,
        actor_id=user.id,
        action="UPDATE_VESSEL",
        entity_type="VESSEL",
        entity_id=res.id,
        payload_snapshot=vessel_update.model_dump(exclude_unset=True)
    )
    return res


@router.delete("/vessels/{vessel_id}", response_model=SuccessResponse)
def delete_vessel(
    vessel_id: str,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_roles([UserRole.ADMIN]))
):
    """F-104 / F-106: Admin deletes vessel record."""
    MasterDataService.delete_vessel(db, vessel_id)
    AuditService.record_event(
        db=db,
        actor=admin.username,
        actor_role=admin.role.value,
        actor_id=admin.id,
        action="DELETE_VESSEL",
        entity_type="VESSEL",
        entity_id=vessel_id
    )
    return SuccessResponse(
        status="success",
        message=f"Vessel '{vessel_id}' deleted successfully.",
        correlation_id=correlation_id_ctx.get()
    )


# --- YARD CAPACITY ---

@router.get("/yard", response_model=YardCapacityResponse)
def get_yard(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """F-104: Current container yard capacity status."""
    yard = MasterDataService.get_yard_capacity(db)
    if not yard:
        return YardCapacityResponse(
            id=1, teu_capacity=50000, teu_used=30000,
            reefer_plugs_available=500, reefer_plugs_used=300,
            utilization_pct=60.0
        )
    utilization = round((yard.teu_used / yard.teu_capacity) * 100, 1) if yard.teu_capacity > 0 else 0.0
    return YardCapacityResponse(
        id=yard.id,
        teu_capacity=yard.teu_capacity,
        teu_used=yard.teu_used,
        reefer_plugs_available=yard.reefer_plugs_available,
        reefer_plugs_used=yard.reefer_plugs_used,
        utilization_pct=utilization
    )
