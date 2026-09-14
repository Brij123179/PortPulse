"""
PortPulse Continuous Feedback Loop & Calibration Tracker (F-502, Increment 5).

Tracks operator intervention decisions on prescriptive recommendations
(Accept / Modify / Reject) to feed continuous learning, heuristic calibration,
and drift detection.
"""

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from collections import defaultdict
from sqlalchemy.orm import Session

from app.models.entities import AuditLogEntry


class FeedbackLoopTracker:
    """
    Collects supervisor feedback on solver recommendations and monitors calibration drift.
    """

    def __init__(self):
        # In-memory fast cache of decisions
        self._action_history: List[Dict[str, Any]] = []

    def record_feedback(
        self,
        recommendation_id: str,
        rec_type: str,
        action: str,  # ACCEPTED, REJECTED, MODIFIED
        actor: str,
        reason: Optional[str] = None,
        model_version: str = "v1.2-milp-highend"
    ) -> Dict[str, Any]:
        """Record an operator feedback event."""
        record = {
            "recommendation_id": recommendation_id,
            "recommendation_type": rec_type,
            "action": action,
            "actor": actor,
            "reason": reason or "Standard dispatch approval",
            "model_version": model_version,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self._action_history.append(record)
        return record

    def get_summary(self, db: Optional[Session] = None) -> Dict[str, Any]:
        """
        Aggregate supervisor feedback metrics:
        - Total recommendations reviewed
        - Acceptance rate (%) overall and per type (DIVERSION, SLOW_STEAM, PRIORITY_RESEQUENCE)
        - Drift status / retraining trigger recommendation
        """
        # If DB provided, also query audit log entries for 'RECOMMENDATION_ACTION'
        all_actions = list(self._action_history)

        if db:
            audit_entries = db.query(AuditLogEntry).filter(
                AuditLogEntry.action.like("%RECOMMENDATION%")
            ).all()
            for entry in audit_entries:
                all_actions.append({
                    "recommendation_id": entry.entity_id,
                    "recommendation_type": "GENERAL",
                    "action": entry.action.replace("RECOMMENDATION_", ""),
                    "actor": entry.actor,
                    "reason": entry.payload_snapshot,
                    "model_version": "v1.2",
                    "timestamp": entry.timestamp.isoformat() if entry.timestamp else ""
                })

        total = len(all_actions)
        if total == 0:
            return {
                "total_reviewed": 0,
                "overall_acceptance_rate_pct": 100.0,
                "breakdown_by_type": {
                    "DIVERSION": {"accepted": 0, "rejected": 0, "rate_pct": 100.0},
                    "SLOW_STEAM": {"accepted": 0, "rejected": 0, "rate_pct": 100.0},
                    "PRIORITY_RESEQUENCE": {"accepted": 0, "rejected": 0, "rate_pct": 100.0}
                },
                "calibration_status": "CALIBRATED",
                "retraining_recommended": False
            }

        accepted_count = sum(1 for a in all_actions if a["action"] == "ACCEPTED")
        acceptance_rate = (accepted_count / total) * 100.0

        by_type = defaultdict(lambda: {"accepted": 0, "rejected": 0})
        for a in all_actions:
            t = a.get("recommendation_type", "GENERAL")
            if a["action"] == "ACCEPTED":
                by_type[t]["accepted"] += 1
            else:
                by_type[t]["rejected"] += 1

        breakdown = {}
        for t, counts in by_type.items():
            sub_tot = counts["accepted"] + counts["rejected"]
            rate = (counts["accepted"] / sub_tot * 100.0) if sub_tot > 0 else 100.0
            breakdown[t] = {
                "accepted": counts["accepted"],
                "rejected": counts["rejected"],
                "rate_pct": round(rate, 1)
            }

        # If acceptance rate falls below 70%, trigger a recommendation recalibration
        retraining_needed = acceptance_rate < 70.0

        return {
            "total_reviewed": total,
            "overall_acceptance_rate_pct": round(acceptance_rate, 1),
            "breakdown_by_type": breakdown,
            "calibration_status": "DRIFT_DETECTED" if retraining_needed else "CALIBRATED",
            "retraining_recommended": retraining_needed,
            "last_evaluated": datetime.now(timezone.utc).isoformat()
        }


feedback_tracker = FeedbackLoopTracker()
