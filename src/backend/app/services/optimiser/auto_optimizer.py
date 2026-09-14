"""Auto-Optimizer: Full ML → Solver → Recommendations pipeline (Phase 3)."""
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional, Any
from sqlalchemy import case
from sqlalchemy.orm import Session

from app.models.entities import Vessel, Berth
from app.services.ml.risk_engine import risk_engine
from app.services.optimiser.solver import berth_optimiser
from app.services.optimiser.recommender import prescriptive_recommender
from app.services.audit import AuditService
from app.core.logging import logger, correlation_id_ctx


class AutoOptimizer:
    """Orchestrates the full optimization pipeline with user approval workflow."""

    def __init__(self):
        self._pending_results: Dict[str, Dict[str, Any]] = {}

    def run_full_optimization(self, db: Session, actor: str, actor_role: str = "", actor_id: int = 0, horizon_hours: int = 72) -> Dict[str, Any]:
        """
        Run the complete pipeline:
        1. Re-train ML models with current data
        2. Run MILP solver for optimal berth assignments
        3. Generate prescriptive recommendations
        Returns a pending result that requires user confirmation.
        """
        result_id = f"OPT-{uuid.uuid4().hex[:8].upper()}"
        corr_id = correlation_id_ctx.get() or f"auto-opt-{result_id}"

        logger.info(f"Auto-Optimizer: Starting full pipeline (result_id={result_id}, actor={actor})")

        # Step 1: Ensure ML models are fitted (fast check, reuse trained model if already ready)
        try:
            if not risk_engine.models_initialized or not getattr(risk_engine.eta_model, "is_fitted", False):
                risk_engine.initialize_models(db)
            ml_status = "READY"
        except Exception as e:
            logger.error(f"Auto-Optimizer: ML check failed: {e}", exc_info=True)
            ml_status = f"FAILED: {str(e)[:100]}"

        # Step 2: Run MILP solver
        try:
            solver_result = berth_optimiser.solve(db, horizon_hours=horizon_hours)
            solver_status = solver_result.solver_status
        except Exception as e:
            logger.error(f"Auto-Optimizer: Solver failed: {e}", exc_info=True)
            solver_result = None
            solver_status = f"FAILED: {str(e)[:100]}"

        # Step 3: Generate recommendations
        try:
            recommendations = prescriptive_recommender.generate_recommendations(db, horizon_hours=horizon_hours)
            rec_count = recommendations.total_recommendations
        except Exception as e:
            logger.error(f"Auto-Optimizer: Recommendations failed: {e}", exc_info=True)
            recommendations = None
            rec_count = 0

        pending = {
            "result_id": result_id,
            "correlation_id": corr_id,
            "actor": actor,
            "actor_role": actor_role,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "PENDING_APPROVAL",
            "ml_status": ml_status,
            "solver_status": solver_status,
            "solver_result": solver_result,
            "recommendations": recommendations,
            "recommendations_count": rec_count,
            "assignments_count": solver_result.vessels_scheduled if solver_result else 0,
            "average_wait_time_hours": solver_result.average_wait_time_hours if solver_result else 0.0,
            "total_demurrage_usd": solver_result.total_port_demurrage_usd if solver_result else 0.0,
            "crane_utilization_pct": solver_result.crane_utilization_pct if solver_result else 0.0,
        }

        self._pending_results[result_id] = pending

        AuditService.record_event(
            db=db,
            actor=actor,
            action="AUTO_OPTIMIZE_RUN",
            entity_type="SOLVER",
            entity_id=result_id,
            payload_snapshot={
                "ml_status": ml_status,
                "solver_status": solver_status,
                "assignments_count": pending["assignments_count"],
            },
            actor_role=actor_role,
            actor_id=actor_id,
        )

        logger.info(f"Auto-Optimizer: Pipeline complete (result_id={result_id}, ml={ml_status}, solver={solver_status}, recs={rec_count})")
        return pending

    def confirm_optimization(self, db: Session, result_id: str, actor: str, actor_role: str = "", actor_id: int = 0) -> Dict[str, Any]:
        """
        Apply the approved optimization result to the database.
        Uses batch queries to avoid N*queries network latency.
        """
        pending = self._pending_results.get(result_id)
        if not pending:
            return {"status": "NOT_FOUND", "message": f"Optimization result '{result_id}' not found or already processed."}

        if pending["status"] != "PENDING_APPROVAL":
            return {"status": "ALREADY_PROCESSED", "message": f"Result '{result_id}' was already {pending['status']}."}

        solver_result = pending.get("solver_result")
        if not solver_result or solver_result.solver_status != "OPTIMAL":
            pending["status"] = "REJECTED"
            return {"status": "CANNOT_APPLY", "message": "Solver result is not OPTIMAL. Cannot apply assignments."}

        # Batch fetch all vessels and construct a single SQL UPDATE with CASE
        all_vessels = {v.id: v for v in db.query(Vessel).all()}
        updates = {}
        for assignment in solver_result.assignments:
            vessel = all_vessels.get(assignment.vessel_id)
            if not vessel or vessel.status == "BERTHED":
                continue
            new_status = vessel.status if vessel.status == "ANCHORED" else "SCHEDULED"
            updates[vessel.id] = (assignment.assigned_berth_id, new_status)

        applied_count = len(updates)
        if updates:
            v_ids = list(updates.keys())
            berth_mapping = {vid: val[0] for vid, val in updates.items()}
            status_mapping = {vid: val[1] for vid, val in updates.items()}
            db.query(Vessel).filter(Vessel.id.in_(v_ids)).update(
                {
                    Vessel.assigned_berth_id: case(berth_mapping, value=Vessel.id),
                    Vessel.status: case(status_mapping, value=Vessel.id),
                },
                synchronize_session=False
            )
            db.commit()
        pending["status"] = "CONFIRMED"
        pending["confirmed_at"] = datetime.now(timezone.utc).isoformat()
        pending["confirmed_by"] = actor
        pending["applied_count"] = applied_count

        AuditService.record_event(
            db=db,
            actor=actor,
            action="AUTO_OPTIMIZE_CONFIRM",
            entity_type="SOLVER",
            entity_id=result_id,
            payload_snapshot={"applied_count": applied_count},
            actor_role=actor_role,
            actor_id=actor_id,
        )

        # Trigger ML re-prediction after assignments change
        try:
            from app.services.event_bus import event_bus, EventType
            event_bus.publish(EventType.ASSIGNMENT_CHANGED, entity_type="VESSEL", action="AUTO_OPTIMIZE_APPLY", count=applied_count)
        except Exception:
            pass

        logger.info(f"Auto-Optimizer: Confirmed result {result_id}, applied {applied_count} assignments")
        return {
            "status": "CONFIRMED",
            "result_id": result_id,
            "applied_count": applied_count,
            "message": f"Successfully applied {applied_count} vessel assignments.",
        }

    def reject_optimization(self, db: Session, result_id: str, actor: str, actor_role: str = "", actor_id: int = 0, reason: str = "") -> Dict[str, Any]:
        """Reject a pending optimization result without applying."""
        pending = self._pending_results.get(result_id)
        if not pending:
            return {"status": "NOT_FOUND", "message": f"Optimization result '{result_id}' not found."}

        pending["status"] = "REJECTED"
        pending["rejected_at"] = datetime.now(timezone.utc).isoformat()
        pending["rejected_by"] = actor
        pending["rejection_reason"] = reason

        AuditService.record_event(
            db=db,
            actor=actor,
            action="AUTO_OPTIMIZE_REJECT",
            entity_type="SOLVER",
            entity_id=result_id,
            payload_snapshot={"reason": reason},
            actor_role=actor_role,
            actor_id=actor_id,
        )

        logger.info(f"Auto-Optimizer: Rejected result {result_id} by {actor}: {reason}")
        return {"status": "REJECTED", "result_id": result_id, "message": f"Optimization result rejected."}

    def get_pending(self, result_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a pending result by ID."""
        return self._pending_results.get(result_id)


auto_optimizer = AutoOptimizer()
