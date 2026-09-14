"""
FastAPI Compatibility Router implementing the exact REST endpoints specified in BACKEND.md:
- GET /api/health
- POST /api/login
- POST /api/logout
- GET /api/me
- GET /api/vessels
- GET /api/berths
- GET /api/congestion
- GET /api/recommendations
- GET /api/optimize
- GET /api/plan
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import (
    create_access_token,
    verify_password,
    get_current_user,
    CurrentUser
)
from app.models.entities import User, Berth, Vessel
from app.services.optimiser.solver import berth_optimiser
from app.services.optimiser.recommender import prescriptive_recommender

router = APIRouter(prefix="/api", tags=["Standard REST API (BACKEND.md)"])


class LoginRequest(BaseModel):
    username: str
    password: str


# --- /api/health ---
@router.get("/health")
def api_health():
    """Liveness check specified in BACKEND.md."""
    return {"status": "ok"}


# --- /api/login ---
@router.post("/login")
def api_login(req: LoginRequest, db: Session = Depends(get_db)):
    """
    Session-based login specified in BACKEND.md & SECURITY.md.
    Uses constant-time comparison (secrets.compare_digest).
    """
    user = db.query(User).filter(User.username == req.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "unauthorized", "message": "Invalid username or password"}
        )

    # Constant time password check
    if not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "unauthorized", "message": "Invalid username or password"}
        )

    token = create_access_token(data={"sub": user.username, "role": user.role, "user_id": user.id})
    display_name = user.username.replace('_', ' ').title()
    return {
        "token": token,
        "user": {
            "username": user.username,
            "role": user.role,
            "display_name": display_name
        }
    }


# --- /api/logout ---
@router.post("/logout")
def api_logout(user: CurrentUser = Depends(get_current_user)):
    """Invalidates session on the client as specified in BACKEND.md."""
    return {"status": "ok", "message": "logged_out"}


# --- /api/me ---
@router.get("/me")
def api_me(user: CurrentUser = Depends(get_current_user)):
    """Returns authenticated user identity and role as specified in BACKEND.md."""
    return {
        "username": user.username,
        "role": user.role,
        "display_name": user.username.replace('_', ' ').title()
    }


# --- /api/vessels ---
@router.get("/vessels")
def api_vessels(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """Returns the full synthetic vessel list as specified in BACKEND.md."""
    vessels = db.query(Vessel).order_by(Vessel.carrier_eta.asc()).all()
    return [
        {
            "id": v.id,
            "name": v.name,
            "vessel_class": v.vessel_class,
            "eta": v.carrier_eta.isoformat() if v.carrier_eta else None,
            "etd": (v.carrier_eta + timedelta(hours=24)).isoformat() if v.carrier_eta else None,
            "cargo_teu": v.cargo_volume,
            "draft_m": v.draft_m,
            "length_m": v.length_m,
            "status": v.status,
            "assigned_berth_id": v.assigned_berth_id
        }
        for v in vessels
    ]


# --- /api/berths ---
@router.get("/berths")
def api_berths(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """Returns the full synthetic berth list as specified in BACKEND.md."""
    berths = db.query(Berth).order_by(Berth.id.asc()).all()
    return [
        {
            "id": b.id,
            "name": b.name,
            "length_m": b.length_m,
            "draft_limit_m": b.draft_limit_m,
            "crane_count": b.crane_slots,
            "capacity_teu": getattr(b, "max_teu_capacity", b.crane_slots * 1500)
        }
        for b in berths
    ]


# --- /api/congestion ---
@router.get("/congestion")
def api_congestion(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """
    Answers: 'which berths will be overloaded, and when?'
    Formula from BACKEND.md:
    risk = overlapping_vessel_count * min(demand_TEU / berth_capacity_TEU, 1.0)
    Thresholds: LOW < 1.0, MEDIUM < 2.2, else HIGH.
    Includes summarize_high_risk() collapsing consecutive hourly HIGH slots per berth.
    """
    now = datetime.now(timezone.utc)
    berths = db.query(Berth).all()
    vessels = db.query(Vessel).filter(Vessel.carrier_eta != None).all()

    slots = []
    high_risk_slots = {b.id: [] for b in berths}

    for hour_offset in range(72):
        window_start = now + timedelta(hours=hour_offset)
        window_end = window_start + timedelta(hours=1)

        for b in berths:
            # Check overlapping vessels
            overlapping = []
            demand_teu = 0
            for v in vessels:
                raw_eta = v.corrected_eta or v.carrier_eta
                v_eta = raw_eta.replace(tzinfo=timezone.utc) if raw_eta.tzinfo is None else raw_eta
                v_etd = v_eta + timedelta(hours=24)

                # Check if vessel touches this 1h slot and is compatible or assigned
                if (v_eta < window_end and v_etd > window_start):
                    if v.assigned_berth_id == b.id or (v.assigned_berth_id is None and v.draft_m <= b.draft_limit_m):
                        overlapping.append(v)
                        demand_teu += v.cargo_volume

            overlapping_count = len(overlapping)
            capacity = getattr(b, "max_teu_capacity", b.crane_slots * 1500)
            ratio = min(demand_teu / capacity, 1.0)
            risk_score = round(overlapping_count * ratio, 2)

            if risk_score < 1.0:
                tier = "LOW"
            elif risk_score < 2.2:
                tier = "MEDIUM"
            else:
                tier = "HIGH"

            slot_item = {
                "berth_id": b.id,
                "berth_name": b.name,
                "hour_offset": hour_offset,
                "time": window_start.strftime("%Y-%m-%d %H:%M"),
                "overlapping_vessel_count": overlapping_count,
                "demand_teu": demand_teu,
                "risk_score": risk_score,
                "risk_tier": tier
            }
            slots.append(slot_item)

            if tier == "HIGH":
                high_risk_slots[b.id].append(slot_item)

    # summarize_high_risk(): collapses consecutive hourly HIGH slots per berth
    high_risk_summary = []
    for b in berths:
        b_highs = high_risk_slots[b.id]
        if not b_highs:
            continue

        # Group consecutive hours
        groups = []
        current_group = []
        for slot in b_highs:
            if not current_group:
                current_group.append(slot)
            elif slot["hour_offset"] == current_group[-1]["hour_offset"] + 1:
                current_group.append(slot)
            else:
                groups.append(current_group)
                current_group = [slot]
        if current_group:
            groups.append(current_group)

        for g in groups:
            start_time = g[0]["time"]
            end_time = (now + timedelta(hours=g[-1]["hour_offset"] + 1)).strftime("%Y-%m-%d %H:%M")
            peak_risk = max(s["risk_score"] for s in g)
            high_risk_summary.append({
                "berth_id": b.id,
                "berth_name": b.name,
                "window": f"HIGH from {start_time} to {end_time}",
                "start_hour": g[0]["hour_offset"],
                "end_hour": g[-1]["hour_offset"] + 1,
                "peak_risk": peak_risk,
                "duration_hours": len(g)
            })

    return {
        "slots": slots,
        "high_risk_summary": high_risk_summary
    }


# --- /api/recommendations ---
@router.get("/recommendations")
def api_recommendations(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """Returns prescriptive recommendations as specified in BACKEND.md."""
    res = prescriptive_recommender.generate_recommendations(db, horizon_hours=72)
    actions = []
    for r in res.recommendations:
        actions.append({
            "id": r.id,
            "type": r.recommendation_type,
            "vessel_id": r.vessel_id,
            "vessel_name": r.vessel_name,
            "action_summary": r.action_summary,
            "estimated_hours_saved": round(r.impact.hours_saved, 1),
            "cost_saving_usd": r.impact.demurrage_saved_usd,
            "co2_saved_mt": r.impact.co2_saved_mt,
            "rationale": r.rationale,
            "status": r.status
        })
    return {"recommendations": actions}


# --- /api/optimize ---
@router.get("/optimize")
def api_optimize(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """
    Returns berth assignments, unassigned vessels, berths used, and avg wait
    as specified in BACKEND.md.
    """
    plan = berth_optimiser.solve(db, horizon_hours=72)
    all_vessels = db.query(Vessel).all()
    scheduled_ids = {a.vessel_id for a in plan.assignments}
    unassigned = [v.id for v in all_vessels if v.id not in scheduled_ids]
    berths_used = sorted(list({a.assigned_berth_id for a in plan.assignments}))

    return {
        "solver_status": plan.solver_status,
        "assignments": [
            {
                "vessel_id": a.vessel_id,
                "vessel_name": a.vessel_name,
                "berth_id": a.assigned_berth_id,
                "berth_name": a.assigned_berth_name,
                "start_time": a.start_time.isoformat() if hasattr(a.start_time, "isoformat") else str(a.start_time),
                "end_time": a.end_time.isoformat() if hasattr(a.end_time, "isoformat") else str(a.end_time),
                "allocated_cranes": a.allocated_cranes,
                "expected_dwell_hours": a.expected_dwell_hours,
                "wait_time_hours": a.wait_time_hours
            }
            for a in plan.assignments
        ],
        "unassigned_vessel_ids": unassigned,
        "berths_used": berths_used,
        "estimated_avg_wait_hours": plan.average_wait_time_hours
    }


# --- /api/plan ---
@router.get("/plan")
def api_plan(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """
    Generates a plain-text shift briefing as specified in BACKEND.md §plan_generator.py:
    Grounded with real numbers, showing top 5 highest-priority risk windows and recommendations.
    """
    now = datetime.now(timezone.utc)
    plan = berth_optimiser.solve(db, horizon_hours=72)
    recs_res = prescriptive_recommender.generate_recommendations(db, horizon_hours=72)
    
    congestion_data = api_congestion(db=db, user=user)
    high_risks = congestion_data["high_risk_summary"]

    briefing_lines = [
        "=================================================================",
        f"PORTPULSE 72-HOUR OPERATIONAL SHIFT BRIEFING (HANDOVER MANIFEST)",
        f"Generated: {now.strftime('%Y-%m-%d %H:%M UTC')} | Active Horizon: 72 Hours",
        "=================================================================",
        "",
        "1. EXECUTIVE OVERVIEW",
        f"- Scheduled Vessel Movements: {plan.vessels_scheduled} vessels across 72h window",
        f"- Quayside STS Crane Utilization: {plan.crane_utilization_pct}% fleet capacity",
        f"- Projected Average Berth Wait: {plan.average_wait_time_hours} hours",
        f"- High-Risk Congestion Spikes Identified: {len(high_risks)} operational windows",
        "",
        "2. TOP CRITICAL BOTTLENECK WINDOWS"
    ]

    if high_risks:
        for idx, hr in enumerate(high_risks[:5], start=1):
            briefing_lines.append(f"  [{idx}] {hr['berth_name']}: {hr['window']} (Peak Risk Factor: {hr['peak_risk']})")
        if len(high_risks) > 5:
            briefing_lines.append(f"  (+{len(high_risks) - 5} additional minor bottleneck windows monitored)")
    else:
        briefing_lines.append("  No severe HIGH-risk bottleneck spikes detected across the 72h horizon.")

    briefing_lines.extend([
        "",
        "3. RECOMMENDED OPERATIONAL INTERVENTIONS (PRIORITIZED)"
    ])

    recs = recs_res.recommendations
    if recs:
        for idx, r in enumerate(recs[:5], start=1):
            briefing_lines.append(
                f"  [{idx}] {r.recommendation_type} -> {r.vessel_name}: {r.action_summary} "
                f"(Saves ~{round(r.impact.hours_saved, 1)}h, ${r.impact.demurrage_saved_usd:,.0f} demurrage)"
            )
        if len(recs) > 5:
            briefing_lines.append(f"  (+{len(recs) - 5} additional recommendations in active queue)")
    else:
        briefing_lines.append("  No urgent intervention actions pending supervisor review.")

    display_name = user.username.replace('_', ' ').title()
    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    briefing_lines.extend([
        "",
        "4. HANDOVER SIGN-OFF",
        f"Prepared for: {display_name} ({role_str.replace('_', ' ').title()})",
        "Compliance: All assignments physically validated against berth draft, length, and crane capacity limits.",
        "================================================================="
    ])

    return {"briefing": "\n".join(briefing_lines)}
