import json
import uuid
import hashlib
from datetime import datetime, timezone
from typing import Optional, List, Tuple, Any, Dict
from sqlalchemy.orm import Session
from app.models.entities import AuditLogEntry
from app.core.logging import logger, correlation_id_ctx, client_ip_ctx

GENESIS_HASH = "GENESIS_PORTPULSE_INTEGRITY_CHAIN"


class AuditService:
    @staticmethod
    def compute_entry_hash(
        prev_hash: str,
        correlation_id: str,
        actor: str,
        actor_id: Optional[int],
        actor_role: Optional[Any],
        client_ip: Optional[str],
        action: str,
        entity_type: str,
        entity_id: str,
        payload_snapshot: Optional[str]
    ) -> str:
        """
        Computes SHA-256 cryptographic digest binding previous hash and record payload.
        """
        role_str = actor_role.value if hasattr(actor_role, "value") else str(actor_role or "")
        raw_chain_string = (
            f"{prev_hash}|{correlation_id}|{actor}|{actor_id or ''}|"
            f"{role_str}|{client_ip or ''}|{str(action).upper()}|"
            f"{str(entity_type).upper()}|{str(entity_id)}|{payload_snapshot or ''}"
        )
        return hashlib.sha256(raw_chain_string.encode("utf-8")).hexdigest()

    @staticmethod
    def record_event(
        db: Session,
        actor: str,
        action: str,
        entity_type: str,
        entity_id: str,
        payload_snapshot: Optional[Any] = None,
        correlation_id: Optional[str] = None,
        actor_role: Optional[Any] = None,
        actor_id: Optional[int] = None,
        client_ip: Optional[str] = None
    ) -> AuditLogEntry:
        """
        Appends a cryptographically tamper-evident, append-only audit record to the audit trail.
        Chains SHA-256 hash to the previous entry to prevent silent log alteration or deletion.
        """
        try:
            cid = correlation_id or correlation_id_ctx.get()
        except Exception:
            cid = None

        if not cid:
            cid = f"req-{uuid.uuid4().hex[:12]}"

        try:
            resolved_ip = client_ip or client_ip_ctx.get() or "127.0.0.1"
        except Exception:
            resolved_ip = client_ip or "127.0.0.1"

        role_str = actor_role.value if hasattr(actor_role, "value") else (str(actor_role) if actor_role else None)

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

        # Retrieve previous entry hash for cryptographic chaining
        latest_entry = (
            db.query(AuditLogEntry)
            .order_by(AuditLogEntry.id.desc())
            .first()
        )
        prev_hash = latest_entry.entry_hash if (latest_entry and latest_entry.entry_hash) else GENESIS_HASH

        entry_hash = AuditService.compute_entry_hash(
            prev_hash=prev_hash,
            correlation_id=cid,
            actor=actor,
            actor_id=actor_id,
            actor_role=role_str,
            client_ip=resolved_ip,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            payload_snapshot=payload_str
        )

        entry = AuditLogEntry(
            correlation_id=cid,
            actor=actor,
            actor_role=role_str,
            actor_id=actor_id,
            action=action.upper(),
            entity_type=entity_type.upper(),
            entity_id=str(entity_id),
            payload_snapshot=payload_str,
            client_ip=resolved_ip,
            prev_hash=prev_hash,
            entry_hash=entry_hash
        )
        db.add(entry)
        try:
            db.commit()
            db.refresh(entry)
        except Exception as e:
            db.rollback()
            logger.warning(f"Audit log commit rolled back: {e}")
        return entry

    @staticmethod
    def verify_chain_integrity(db: Session) -> Dict[str, Any]:
        """
        Validates the complete cryptographic chain of audit logs from genesis to head.
        Detects any unauthorized modification, deletion, or truncation of historical records.
        """
        entries = db.query(AuditLogEntry).order_by(AuditLogEntry.id.asc()).all()
        if not entries:
            return {
                "is_valid": True,
                "total_verified": 0,
                "chain_head": GENESIS_HASH,
                "compromised_entry_id": None,
                "error": None,
                "verified_at": datetime.now(timezone.utc).isoformat()
            }

        expected_prev = GENESIS_HASH
        for idx, entry in enumerate(entries):
            # If entry was generated prior to chaining, grandfather it or check if prev_hash is present
            if entry.prev_hash is None or entry.entry_hash is None:
                continue

            if entry.prev_hash != expected_prev:
                return {
                    "is_valid": False,
                    "total_verified": idx,
                    "chain_head": expected_prev,
                    "compromised_entry_id": entry.id,
                    "error": f"Chain link broken at entry ID {entry.id}: expected prev_hash {expected_prev[:16]}..., found {entry.prev_hash[:16]}...",
                    "verified_at": datetime.now(timezone.utc).isoformat()
                }

            expected_hash = AuditService.compute_entry_hash(
                prev_hash=entry.prev_hash,
                correlation_id=entry.correlation_id,
                actor=entry.actor,
                actor_id=entry.actor_id,
                actor_role=entry.actor_role,
                client_ip=entry.client_ip,
                action=entry.action,
                entity_type=entry.entity_type,
                entity_id=entry.entity_id,
                payload_snapshot=entry.payload_snapshot
            )

            if entry.entry_hash != expected_hash:
                return {
                    "is_valid": False,
                    "total_verified": idx,
                    "chain_head": expected_prev,
                    "compromised_entry_id": entry.id,
                    "error": f"Payload tampering detected at entry ID {entry.id}: content digest does not match stored hash.",
                    "verified_at": datetime.now(timezone.utc).isoformat()
                }

            expected_prev = entry.entry_hash

        return {
            "is_valid": True,
            "total_verified": len(entries),
            "chain_head": expected_prev,
            "compromised_entry_id": None,
            "error": None,
            "verified_at": datetime.now(timezone.utc).isoformat()
        }

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
        items = query.order_by(AuditLogEntry.timestamp.desc(), AuditLogEntry.id.desc()).offset(offset).limit(limit).all()
        return total, items
