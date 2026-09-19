from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.entities import AuditLogEntry
from app.services.audit import AuditService
from app.schemas.audit import AuditAnomaly


class AuditAnomalyService:
    @staticmethod
    def detect_anomalies(db: Session) -> List[AuditAnomaly]:
        """
        Analyzes the tamper-evident audit logs and detects operational, access,
        and integrity anomalies in near-real-time.
        """
        anomalies: List[AuditAnomaly] = []

        # 1. Cryptographic Chain Integrity Anomaly Check
        integrity = AuditService.verify_chain_integrity(db)
        if not integrity.get("is_valid"):
            anomalies.append(
                AuditAnomaly(
                    type="CHAIN_TAMPER_DETECTED",
                    severity="CRITICAL",
                    description=(
                        f"Cryptographic hash chain broken at record ID {integrity.get('compromised_entry_id')}. "
                        f"{integrity.get('error')}"
                    ),
                    actor="UNKNOWN_ADVERSARY",
                    client_ip="INTERNAL",
                    timestamp=integrity.get("verified_at", datetime.now(timezone.utc).isoformat()),
                    details=integrity
                )
            )

        # Retrieve recent logs for temporal pattern analysis (past 24 hours)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        recent_logs = (
            db.query(AuditLogEntry)
            .filter(AuditLogEntry.timestamp >= cutoff)
            .order_by(AuditLogEntry.timestamp.desc())
            .all()
        )

        if not recent_logs:
            return anomalies

        # 2. Burst Berth Reassignments (>= 4 reallocations/edits within any 5-minute sliding window)
        berth_events = [
            e for e in recent_logs
            if e.entity_type == "BERTH" and ("ALLOCAT" in e.action or "CREATE" in e.action or "UPDATE" in e.action)
        ]
        actor_berth_times: Dict[str, List[datetime]] = {}
        for e in berth_events:
            ts = e.timestamp if e.timestamp.tzinfo else e.timestamp.replace(tzinfo=timezone.utc)
            actor_berth_times.setdefault(e.actor, []).append(ts)

        for actor, timestamps in actor_berth_times.items():
            sorted_ts = sorted(timestamps)
            for i in range(len(sorted_ts)):
                window_end = sorted_ts[i] + timedelta(minutes=5)
                burst_count = sum(1 for t in sorted_ts[i:] if t <= window_end)
                if burst_count >= 4:
                    anomalies.append(
                        AuditAnomaly(
                            type="BURST_BERTH_REASSIGNMENTS",
                            severity="HIGH",
                            description=(
                                f"Operator '{actor}' triggered {burst_count} rapid berth mutations "
                                f"within a 5-minute operational window."
                            ),
                            actor=actor,
                            client_ip="VARIOUS",
                            timestamp=sorted_ts[i].isoformat(),
                            details={"event_count": burst_count, "window_minutes": 5}
                        )
                    )
                    break

        # 3. Rapid State Mutations (>= 10 write events within 60 seconds from any single client IP or actor)
        ip_events: Dict[str, List[datetime]] = {}
        for e in recent_logs:
            ip = e.client_ip or "127.0.0.1"
            ts = e.timestamp if e.timestamp.tzinfo else e.timestamp.replace(tzinfo=timezone.utc)
            ip_events.setdefault(ip, []).append(ts)

        for ip, timestamps in ip_events.items():
            sorted_ts = sorted(timestamps)
            for i in range(len(sorted_ts)):
                window_end = sorted_ts[i] + timedelta(seconds=60)
                mutation_count = sum(1 for t in sorted_ts[i:] if t <= window_end)
                if mutation_count >= 10:
                    anomalies.append(
                        AuditAnomaly(
                            type="RAPID_STATE_MUTATIONS",
                            severity="MEDIUM",
                            description=(
                                f"Client IP {ip} executed {mutation_count} state-mutating requests "
                                f"within 60 seconds (suspected automation or scripted flooding)."
                            ),
                            actor="SYSTEM_MONITOR",
                            client_ip=ip,
                            timestamp=sorted_ts[i].isoformat(),
                            details={"mutation_count": mutation_count, "window_seconds": 60}
                        )
                    )
                    break

        # 4. Repeated Authentication or Password Failure Suspicion
        auth_failures = [
            e for e in recent_logs
            if "LOGIN_FAILED" in e.action or "AUTH_FAILURE" in e.action
        ]
        ip_auth_fails: Dict[str, int] = {}
        for af in auth_failures:
            ip = af.client_ip or "127.0.0.1"
            ip_auth_fails[ip] = ip_auth_fails.get(ip, 0) + 1

        for ip, count in ip_auth_fails.items():
            if count >= 3:
                anomalies.append(
                    AuditAnomaly(
                        type="MFA_BRUTE_FORCE_SUSPICION",
                        severity="HIGH",
                        description=f"Multiple failed authentication attempts ({count}) recorded from IP {ip}.",
                        actor="UNKNOWN",
                        client_ip=ip,
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        details={"failed_attempts": count}
                    )
                )

        return anomalies
