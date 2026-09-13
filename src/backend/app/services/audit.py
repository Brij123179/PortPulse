import json
import uuid
from typing import Optional, List, Tuple, Any, Dict
from sqlalchemy.orm import Session
from app.models.entities import AuditLogEntry
from app.core.logging import correlation_id_ctx


class AuditService:
    @staticmethod
    def record_event(
        db: Session,
        actor: str,
        action: str,
        entity_type: str,
        entity_id: str,
        payload_snapshot: Optional[Any] = None,
        correlation_id: Optional[str] = None
    ) -> AuditLogEntry:
        """
        Appends an immutable audit record to the audit trail.
        """
        try:
            cid = correlation_id or correlation_id_ctx.get()
        except Exception:
            cid = None

        if not cid:
            cid = f"req-{uuid.uuid4().hex[:12]}"

        # Serialize payload if it's a dict or object
        payload_str = None
        if payload_snapshot is not None:
            if isinstance(payload_snapshot, str):
                payload_str = payload_snapshot
            else:
                try:
                    payload_str = json.dumps(payload_snapshot, default=str)
                except Exception:
                    payload_str = str(payload_snapshot)

        entry = AuditLogEntry(
            correlation_id=cid,
            actor=actor,
            action=action.upper(),
            entity_type=entity_type.upper(),
            entity_id=str(entity_id),
            payload_snapshot=payload_str
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry

    @staticmethod
    def get_logs(
        db: Session,
        limit: int = 50,
        offset: int = 0,
        entity_type: Optional[str] = None,
        action: Optional[str] = None,
        actor: Optional[str] = None
    ) -> Tuple[int, List[AuditLogEntry]]:
        """
        Retrieves paginated audit log entries with optional filters.
        """
        query = db.query(AuditLogEntry)
        if entity_type:
            query = query.filter(AuditLogEntry.entity_type == entity_type.upper())
        if action:
            query = query.filter(AuditLogEntry.action == action.upper())
        if actor:
            query = query.filter(AuditLogEntry.actor == actor)

        total = query.count()
        items = query.order_by(AuditLogEntry.timestamp.desc()).offset(offset).limit(limit).all()
        return total, items
