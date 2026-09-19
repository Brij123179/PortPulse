"""
Chat, GenAI Briefing, and Model Feedback Router (F-406, F-401, F-502).

Endpoints:
- POST /api/v1/chat/query: Grounded RAG conversational Q&A
- POST /api/v1/chat/briefing: Dynamic LLM Shift Briefing generator
- GET /api/v1/ml/feedback/summary: Continuous learning & calibration tracker
- POST /api/v1/ml/feedback/record: Record operator recommendation feedback
"""

from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_user, CurrentUser
from app.services.chat.assistant import chat_assistant
from app.services.ml.feedback import feedback_tracker
from app.services.audit import AuditService

router = APIRouter(prefix="/api/v1", tags=["GenAI & Operational Intelligence (F-401, F-406, F-502)"])


class ChatQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500, description="Natural language operational query")


class ChatQueryResponse(BaseModel):
    query: str
    answer: str
    model: str
    timestamp: str
    citations: List[str]
    grounding_summary: Dict[str, Any]


class BriefingRequest(BaseModel):
    shift_label: Optional[str] = Field("Upcoming 12h Shift", description="Label for the shift handover")


class FeedbackRecordRequest(BaseModel):
    recommendation_id: str
    recommendation_type: str
    action: str  # ACCEPTED, REJECTED, MODIFIED
    reason: Optional[str] = None


@router.post("/chat/query", response_model=ChatQueryResponse)
def query_chat_assistant(
    req: ChatQueryRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """
    F-406: Process natural-language operational queries grounded in real-time
    database state with mechanical anti-hallucination validation and prompt injection defense.
    """
    res = chat_assistant.answer_query(db, req.query)
    citations = res.get("citations", []) if isinstance(res, dict) else getattr(res, "citations", [])
    AuditService.record_event(
        db=db,
        actor=user.username,
        actor_role=user.role.value if hasattr(user.role, "value") else str(user.role),
        actor_id=user.id,
        action="COPILOT_QUERY",
        entity_type="CHAT",
        entity_id="RAG_ASSISTANT",
        payload_snapshot={"query": req.query[:120], "citations": citations}
    )
    return res


@router.post("/chat/briefing")
def generate_ai_shift_briefing(
    req: BriefingRequest = BriefingRequest(),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """
    F-401: Generate an AI-synthesized operational shift handover briefing
    grounded on live optimization, delayed vessels, and crane states.
    """
    shift_label = req.shift_label or "Upcoming 12h Shift"
    briefing = chat_assistant.generate_shift_briefing(db, shift_label)
    AuditService.record_event(
        db=db,
        actor=user.username,
        actor_role=user.role.value if hasattr(user.role, "value") else str(user.role),
        actor_id=user.id,
        action="AI_SHIFT_BRIEFING",
        entity_type="REPORT",
        entity_id=shift_label,
        payload_snapshot={"shift_label": shift_label}
    )
    return briefing


@router.get("/ml/feedback/summary")
def get_model_feedback_summary(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """
    F-502: Retrieve operator feedback metrics, recommendation acceptance rates,
    and calibration drift alerts for continuous retraining.
    """
    return feedback_tracker.get_summary(db)


@router.post("/ml/feedback/record")
def record_recommendation_feedback(
    req: FeedbackRecordRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """
    F-502: Record operator intervention on prescriptive recommendations.
    """
    res = feedback_tracker.record_feedback(
        recommendation_id=req.recommendation_id,
        rec_type=req.recommendation_type,
        action=req.action,
        actor=user.username,
        reason=req.reason
    )
    AuditService.record_event(
        db=db,
        actor=user.username,
        actor_role=user.role.value if hasattr(user.role, "value") else str(user.role),
        actor_id=user.id,
        action="RECOMMENDATION_FEEDBACK",
        entity_type="RECOMMENDATION",
        entity_id=req.recommendation_id,
        payload_snapshot={"action": req.action, "rec_type": req.recommendation_type, "reason": req.reason}
    )
    return res
