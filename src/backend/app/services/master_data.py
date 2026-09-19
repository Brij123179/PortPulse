from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.entities import Berth, Crane, Vessel, YardCapacity
from app.schemas.berth import BerthCreate, BerthUpdate, CraneCreate
from app.schemas.vessel import VesselCreate, VesselUpdate
from app.services.event_bus import event_bus, EventType


class MasterDataService:
    """Master data management service covering F-104 with strict validation."""

    @staticmethod
    def list_berths(db: Session) -> List[Berth]:
        return db.query(Berth).all()

    @staticmethod
    def get_berth(db: Session, berth_id: str) -> Berth:
        berth = db.query(Berth).filter(Berth.id == berth_id).first()
        if not berth:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Berth '{berth_id}' not found")
        return berth

    @staticmethod
    def create_berth(db: Session, berth_in: BerthCreate) -> Berth:
        existing = db.query(Berth).filter(Berth.id == berth_in.id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Berth '{berth_in.id}' already exists")
        
        berth = Berth(
            id=berth_in.id,
            name=berth_in.name,
            length_m=berth_in.length_m,
            draft_limit_m=berth_in.draft_limit_m,
            crane_slots=berth_in.crane_slots,
            contractual_priority_rules=berth_in.contractual_priority_rules,
            status=berth_in.status
        )
        db.add(berth)
        db.commit()
        db.refresh(berth)
        event_bus.publish(EventType.DATA_CHANGED, entity_type="BERTH", action="CREATE", entity_id=berth.id)
        try:
            from app.services.ml.risk_engine import risk_engine
            risk_engine.re_evaluate_all_predictions(db, trigger=f"CREATE_BERTH_{berth.id}")
        except Exception:
            pass
        return berth

    @staticmethod
    def update_berth(db: Session, berth_id: str, berth_update: BerthUpdate) -> Berth:
        berth = MasterDataService.get_berth(db, berth_id)
        update_data = berth_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(berth, key, value)
        db.commit()
        db.refresh(berth)
        event_bus.publish(EventType.DATA_CHANGED, entity_type="BERTH", action="UPDATE", entity_id=berth_id)
        try:
            from app.services.ml.risk_engine import risk_engine
            risk_engine.re_evaluate_all_predictions(db, trigger=f"UPDATE_BERTH_{berth_id}")
        except Exception:
            pass
        return berth

    @staticmethod
    def delete_berth(db: Session, berth_id: str) -> bool:
        berth = MasterDataService.get_berth(db, berth_id)
        # Check if active vessels assigned
        assigned_vessel = db.query(Vessel).filter(Vessel.assigned_berth_id == berth_id).first()
        if assigned_vessel:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete Berth '{berth_id}' because Vessel '{assigned_vessel.name}' is currently assigned to it."
            )
        # Remove associated cranes first
        db.query(Crane).filter(Crane.berth_id == berth_id).delete()
        db.delete(berth)
        db.commit()
        event_bus.publish(EventType.DATA_CHANGED, entity_type="BERTH", action="DELETE", entity_id=berth_id)
        try:
            from app.services.ml.risk_engine import risk_engine
            risk_engine.re_evaluate_all_predictions(db, trigger=f"DELETE_BERTH_{berth_id}")
        except Exception:
            pass
        return True

    @staticmethod
    def list_vessels(db: Session, limit: int = 100, status_filter: Optional[str] = None) -> List[Vessel]:
        query = db.query(Vessel)
        if status_filter:
            query = query.filter(Vessel.status == status_filter.upper())
        return query.limit(limit).all()

    @staticmethod
    def get_vessel(db: Session, vessel_id: str) -> Vessel:
        vessel = db.query(Vessel).filter(Vessel.id == vessel_id).first()
        if not vessel:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Vessel '{vessel_id}' not found")
        return vessel

    @staticmethod
    def create_vessel(db: Session, vessel_in: VesselCreate) -> Vessel:
        existing = db.query(Vessel).filter(Vessel.id == vessel_in.id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Vessel '{vessel_in.id}' already exists")
        
        # Validate draft and length against assigned berth if specified
        if vessel_in.assigned_berth_id:
            berth = MasterDataService.get_berth(db, vessel_in.assigned_berth_id)
            if vessel_in.length_m > berth.length_m:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Vessel length ({vessel_in.length_m}m) exceeds berth length ({berth.length_m}m)"
                )
            if vessel_in.draft_m > berth.draft_limit_m:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Vessel draft ({vessel_in.draft_m}m) exceeds berth draft limit ({berth.draft_limit_m}m)"
                )

        vessel = Vessel(**vessel_in.model_dump())
        db.add(vessel)
        db.commit()
        db.refresh(vessel)
        event_bus.publish(EventType.DATA_CHANGED, entity_type="VESSEL", action="CREATE", entity_id=vessel.id)
        try:
            from app.services.ml.risk_engine import risk_engine
            risk_engine.re_evaluate_all_predictions(db, trigger=f"CREATE_VESSEL_{vessel.id}")
        except Exception:
            pass
        return vessel

    @staticmethod
    def update_vessel(db: Session, vessel_id: str, vessel_update: VesselUpdate) -> Vessel:
        vessel = MasterDataService.get_vessel(db, vessel_id)
        update_data = vessel_update.model_dump(exclude_unset=True)

        target_berth_id = update_data.get("assigned_berth_id", vessel.assigned_berth_id)
        target_len = update_data.get("length_m", vessel.length_m)
        target_draft = update_data.get("draft_m", vessel.draft_m)

        if target_berth_id:
            berth = MasterDataService.get_berth(db, target_berth_id)
            if target_len > berth.length_m:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Vessel length ({target_len}m) exceeds berth length ({berth.length_m}m)"
                )
            if target_draft > berth.draft_limit_m:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Vessel draft ({target_draft}m) exceeds berth draft limit ({berth.draft_limit_m}m)"
                )

        for key, value in update_data.items():
            setattr(vessel, key, value)
        db.commit()
        db.refresh(vessel)
        event_bus.publish(EventType.DATA_CHANGED, entity_type="VESSEL", action="UPDATE", entity_id=vessel_id)
        try:
            from app.services.ml.risk_engine import risk_engine
            risk_engine.re_evaluate_all_predictions(db, trigger=f"UPDATE_VESSEL_{vessel_id}")
        except Exception:
            pass
        return vessel

    @staticmethod
    def delete_vessel(db: Session, vessel_id: str) -> bool:
        vessel = MasterDataService.get_vessel(db, vessel_id)
        if vessel.status == "BERTHED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete vessel '{vessel.name}' while actively berthed at {vessel.assigned_berth_id or 'quay'}. Departure must be logged first."
            )
        db.delete(vessel)
        db.commit()
        event_bus.publish(EventType.DATA_CHANGED, entity_type="VESSEL", action="DELETE", entity_id=vessel_id)
        try:
            from app.services.ml.risk_engine import risk_engine
            risk_engine.re_evaluate_all_predictions(db, trigger=f"DELETE_VESSEL_{vessel_id}")
        except Exception:
            pass
        return True

    @staticmethod
    def get_yard_capacity(db: Session) -> Optional[YardCapacity]:
        return db.query(YardCapacity).first()
