import csv
import io
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import CurrentUser, get_current_user, require_roles, UserRole
from app.models.entities import Berth, Crane, Vessel, TurnaroundRecord
from app.services.audit import AuditService
from app.services.optimiser.solver import berth_optimiser
from app.services.event_bus import event_bus, EventType
from app.services.ml.risk_engine import risk_engine

router = APIRouter(prefix="/api/v1", tags=["CSV Import & Export Engine"])


class CsvImportResult(BaseModel):
    status: str
    imported_count: int
    updated_count: int
    cranes_created: int = 0
    errors: List[str] = []
    message: str


# =========================================================================
# 1. EXPORT ENDPOINTS
# =========================================================================

@router.get("/master-data/export/berths.csv")
def export_berths_csv(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """
    Exports all terminal berths as CSV with specifications and active cranes.
    """
    berths = db.query(Berth).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "name", "length_m", "draft_limit_m", "crane_slots",
        "operational_cranes", "contractual_priority_rules", "status"
    ])

    for b in berths:
        operational_cranes = sum(1 for c in b.cranes if getattr(c, "status", "OPERATIONAL") == "OPERATIONAL")
        writer.writerow([
            b.id,
            b.name,
            b.length_m,
            b.draft_limit_m,
            b.crane_slots,
            operational_cranes,
            b.contractual_priority_rules or "STANDARD",
            b.status
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": "attachment; filename=portpulse_berths.csv",
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


@router.get("/master-data/export/vessels.csv")
def export_vessels_csv(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """
    Exports current scheduled and berthed vessels manifest as CSV.
    """
    vessels = db.query(Vessel).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "name", "vessel_class", "cargo_volume_teu",
        "draft_m", "length_m", "carrier_eta", "corrected_eta",
        "priority_flag", "assigned_berth_id", "status"
    ])

    for v in vessels:
        writer.writerow([
            v.id,
            v.name,
            v.vessel_class,
            v.cargo_volume,
            v.draft_m,
            v.length_m,
            v.carrier_eta.isoformat() if v.carrier_eta else "",
            v.corrected_eta.isoformat() if v.corrected_eta else "",
            v.priority_flag,
            v.assigned_berth_id or "",
            v.status
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": "attachment; filename=portpulse_vessels.csv",
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


@router.get("/optimiser/export/operations-plan.csv")
def export_operations_plan_csv(
    horizon_hours: int = 72,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """
    Fulfills Challenge Feature 4: Exports official 72-Hour Port Operations Plan
    for Shift Supervisors as a standard TOS CSV.
    """
    plan = berth_optimiser.solve(db, horizon_hours=horizon_hours)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "vessel_id", "vessel_name", "vessel_class", "length_m", "draft_m",
        "assigned_berth_id", "assigned_berth_name", "start_time", "end_time",
        "allocated_cranes", "expected_dwell_hours", "wait_time_hours", "demurrage_cost_usd"
    ])

    for a in plan.assignments:
        writer.writerow([
            a.vessel_id,
            a.vessel_name,
            a.vessel_class,
            a.length_m,
            a.draft_m,
            a.assigned_berth_id,
            a.assigned_berth_name,
            a.start_time.isoformat() if hasattr(a.start_time, "isoformat") else str(a.start_time),
            a.end_time.isoformat() if hasattr(a.end_time, "isoformat") else str(a.end_time),
            a.allocated_cranes,
            a.expected_dwell_hours,
            a.wait_time_hours,
            a.demurrage_cost_usd
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": "attachment; filename=portpulse_72h_operations_plan.csv",
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


# =========================================================================
# 2. IMPORT ENDPOINTS
# =========================================================================

MAX_CSV_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB limit (L-10)


async def extract_csv_text(request: Request) -> str:
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await request.form()
        for field_name in ["file", "csv_file", "upload"]:
            field = form.get(field_name)
            if field and hasattr(field, "read"):
                raw = await field.read()
                if len(raw) > MAX_CSV_SIZE_BYTES:
                    raise HTTPException(status_code=413, detail="CSV file exceeds maximum allowed size of 10MB")
                return raw.decode("utf-8")
        # Fallback to any file in form
        for v in form.values():
            if hasattr(v, "read"):
                raw = await v.read()
                if len(raw) > MAX_CSV_SIZE_BYTES:
                    raise HTTPException(status_code=413, detail="CSV file exceeds maximum allowed size of 10MB")
                return raw.decode("utf-8")
        if "csv_content" in form:
            return str(form["csv_content"])
    elif "application/json" in content_type:
        data = await request.json()
        if isinstance(data, dict):
            return data.get("csv_content", "")
    else:
        body = await request.body()
        if len(body) > MAX_CSV_SIZE_BYTES:
            raise HTTPException(status_code=413, detail="CSV payload exceeds maximum allowed size of 10MB")
        return body.decode("utf-8")
    return ""


def safe_float(val, default: float = 0.0) -> float:
    if val is None:
        return default
    s = str(val).strip()
    if not s:
        return default
    try:
        return float(s)
    except (ValueError, TypeError):
        return default


def safe_int(val, default: int = 0) -> int:
    if val is None:
        return default
    s = str(val).strip()
    if not s:
        return default
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return default


def parse_csv_stream(content: str) -> List[dict]:
    # Strip UTF-8 BOM if present (e.g. from Excel exports)
    if content.startswith("\ufeff"):
        content = content[1:]
    f = io.StringIO(content.strip())
    reader = csv.DictReader(f)
    rows = []
    for raw_row in reader:
        if not raw_row:
            continue
        # Normalize keys: strip whitespace, lowercase, normalize separators
        cleaned = {}
        for k, v in raw_row.items():
            if k is not None:
                clean_k = k.strip().lower().replace(" ", "_").replace("-", "_")
                clean_v = v.strip() if isinstance(v, str) else v
                cleaned[clean_k] = clean_v
        if any(v is not None and v != "" for v in cleaned.values()):
            rows.append(cleaned)
    return rows


@router.post("/master-data/import/berths", response_model=CsvImportResult)
async def import_berths_csv(
    request: Request,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([
        UserRole.ADMIN, UserRole.TERMINAL_MANAGER, UserRole.VESSEL_PLANNER, UserRole.SHIFT_SUPERVISOR
    ]))
):
    """
    Imports berths from CSV. Automatically connects cranes and validates boundaries.
    Available to all operational port roles.
    """
    csv_text = await extract_csv_text(request)
    if not csv_text.strip():
        raise HTTPException(status_code=400, detail="No CSV data provided. Submit via file upload or JSON payload.")

    rows = parse_csv_stream(csv_text)
    if not rows:
        raise HTTPException(status_code=400, detail="CSV is empty or missing headers.")

    imported = 0
    updated = 0
    cranes_created = 0
    errors = []

    for idx, row in enumerate(rows, start=1):
        try:
            with db.begin_nested():
                b_id = str(row.get("id") or row.get("berth_id") or row.get("berth") or "").strip()
                name = str(row.get("name") or row.get("berth_name") or f"Berth {b_id}").strip()
                length_m = safe_float(row.get("length_m") or row.get("length") or row.get("length(m)"), 0.0)
                draft_limit_m = safe_float(row.get("draft_limit_m") or row.get("draft_limit") or row.get("draft_m") or row.get("draft"), 0.0)
                crane_slots = safe_int(row.get("crane_slots") or row.get("cranes") or row.get("crane_count"), 2)
                rules = str(row.get("contractual_priority_rules") or row.get("rules") or row.get("priority_rules") or "STANDARD").strip()
                status_val = str(row.get("status") or "AVAILABLE").strip().upper()

                if not b_id:
                    errors.append(f"Row {idx}: Missing berth ID.")
                    continue
                if length_m < 50.0 or length_m > 600.0:
                    errors.append(f"Row {idx} ({b_id}): Length {length_m}m out of realistic bounds [50m - 600m].")
                    continue
                if draft_limit_m < 3.0 or draft_limit_m > 25.0:
                    errors.append(f"Row {idx} ({b_id}): Draft limit {draft_limit_m}m out of bounds [3m - 25m].")
                    continue

                existing = db.query(Berth).filter(Berth.id == b_id).first()
                if existing:
                    existing.name = name
                    existing.length_m = length_m
                    existing.draft_limit_m = draft_limit_m
                    existing.crane_slots = crane_slots
                    existing.contractual_priority_rules = rules
                    existing.status = status_val
                    updated += 1
                else:
                    new_berth = Berth(
                        id=b_id,
                        name=name,
                        length_m=length_m,
                        draft_limit_m=draft_limit_m,
                        crane_slots=crane_slots,
                        contractual_priority_rules=rules,
                        status=status_val
                    )
                    db.add(new_berth)
                    db.flush()

                    # Automatically provision crane slots for new berth
                    for c_idx in range(1, crane_slots + 1):
                        crane = Crane(
                            id=f"CR-{b_id}-{c_idx:02d}",
                            berth_id=b_id,
                            name=f"STS Crane {b_id}-{c_idx:02d}",
                            status="OPERATIONAL"
                        )
                        db.add(crane)
                    imported += 1
                    cranes_created += crane_slots

        except Exception as e:
            errors.append(f"Row {idx}: Error processing row: {str(e)}")

    db.commit()

    AuditService.record_event(
        db=db,
        actor=user.username,
        action="IMPORT_BERTHS_CSV",
        entity_type="BERTH",
        entity_id="BATCH",
        payload_snapshot={"imported": imported, "updated": updated, "cranes_created": cranes_created, "error_count": len(errors)}
    )

    event_bus.publish(EventType.DATA_CHANGED, entity_type="BERTH", action="CSV_IMPORT")
    return CsvImportResult(
        status="success" if not errors else "partial_success",
        imported_count=imported,
        updated_count=updated,
        cranes_created=cranes_created,
        errors=errors,
        message=f"Processed {imported + updated} berths ({imported} new created with {cranes_created} cranes, {updated} updated)."
    )


@router.post("/master-data/import/vessels", response_model=CsvImportResult)
async def import_vessels_csv(
    request: Request,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([
        UserRole.ADMIN, UserRole.TERMINAL_MANAGER, UserRole.VESSEL_PLANNER, UserRole.SHIFT_SUPERVISOR
    ]))
):
    """
    Imports vessels from CSV. Validates length and draft against assigned berths.
    Available to all operational port roles.
    """
    csv_text = await extract_csv_text(request)
    if not csv_text.strip():
        raise HTTPException(status_code=400, detail="No CSV data provided. Submit via file upload or JSON payload.")

    rows = parse_csv_stream(csv_text)
    if not rows:
        raise HTTPException(status_code=400, detail="CSV is empty or missing headers.")

    imported = 0
    updated = 0
    errors = []

    for idx, row in enumerate(rows, start=1):
        try:
            with db.begin_nested():
                v_id = str(row.get("id") or row.get("vessel_id") or row.get("imo") or "").strip()
                name = str(row.get("name") or row.get("vessel_name") or f"Vessel {v_id}").strip()
                v_class_raw = str(row.get("vessel_class") or row.get("class") or row.get("type") or "POST_PANAMAX").strip().upper().replace("-", "_")
                if "ULCV" in v_class_raw or "ULTRA" in v_class_raw:
                    v_class = "ULCV"
                elif "POST" in v_class_raw:
                    v_class = "Post-Panamax"
                elif "FEED" in v_class_raw:
                    v_class = "Feeder"
                else:
                    v_class = "Panamax"

                cargo_teu = safe_int(row.get("cargo_volume_teu") or row.get("cargo_volume") or row.get("teu") or row.get("cargo"), 4000)
                draft_m = safe_float(row.get("draft_m") or row.get("draft"), 11.5)
                length_m = safe_float(row.get("length_m") or row.get("length"), 250.0)
                eta_raw = str(row.get("carrier_eta") or row.get("eta") or row.get("arrival_time") or "").strip()
                priority_flag = str(row.get("priority_flag") or row.get("priority") or "false").strip().lower() in ["true", "1", "yes"]
                assigned_berth_id = str(row.get("assigned_berth_id") or row.get("berth_id") or row.get("berth") or "").strip() or None
                status_val = str(row.get("status") or "SCHEDULED").strip().upper()

                if not v_id:
                    errors.append(f"Row {idx}: Missing vessel ID.")
                    continue

                # Parse ETA
                try:
                    eta_dt = datetime.fromisoformat(eta_raw.replace("Z", "+00:00")) if eta_raw else datetime.now(timezone.utc)
                except Exception:
                    eta_dt = datetime.now(timezone.utc)

                # Check assigned berth constraints
                if assigned_berth_id:
                    berth = db.query(Berth).filter(Berth.id == assigned_berth_id).first()
                    if not berth:
                        errors.append(f"Row {idx} ({v_id}): Target berth '{assigned_berth_id}' does not exist.")
                        continue
                    if length_m > berth.length_m:
                        errors.append(f"Row {idx} ({v_id}): Length ({length_m}m) exceeds berth '{assigned_berth_id}' length ({berth.length_m}m).")
                        continue
                    if draft_m > berth.draft_limit_m:
                        errors.append(f"Row {idx} ({v_id}): Draft ({draft_m}m) exceeds berth '{assigned_berth_id}' limit ({berth.draft_limit_m}m).")
                        continue

                existing = db.query(Vessel).filter(Vessel.id == v_id).first()
                if existing:
                    existing.name = name
                    existing.vessel_class = v_class
                    existing.cargo_volume = cargo_teu
                    existing.draft_m = draft_m
                    existing.length_m = length_m
                    existing.carrier_eta = eta_dt
                    existing.corrected_eta = eta_dt
                    existing.priority_flag = priority_flag
                    existing.assigned_berth_id = assigned_berth_id
                    existing.status = status_val
                    updated += 1
                else:
                    new_vessel = Vessel(
                        id=v_id,
                        name=name,
                        vessel_class=v_class,
                        cargo_volume=cargo_teu,
                        draft_m=draft_m,
                        length_m=length_m,
                        carrier_eta=eta_dt,
                        corrected_eta=eta_dt,
                        priority_flag=priority_flag,
                        assigned_berth_id=assigned_berth_id,
                        status=status_val
                    )
                    db.add(new_vessel)
                    imported += 1

        except Exception as e:
            errors.append(f"Row {idx}: Error processing vessel row: {str(e)}")

    db.commit()

    AuditService.record_event(
        db=db,
        actor=user.username,
        action="IMPORT_VESSELS_CSV",
        entity_type="VESSEL",
        entity_id="BATCH",
        payload_snapshot={"imported": imported, "updated": updated, "error_count": len(errors)}
    )

    event_bus.publish(EventType.DATA_CHANGED, entity_type="VESSEL", action="CSV_IMPORT")
    return CsvImportResult(
        status="success" if not errors else "partial_success",
        imported_count=imported,
        updated_count=updated,
        errors=errors,
        message=f"Processed {imported + updated} vessels ({imported} new created, {updated} updated)."
    )


@router.post("/master-data/import/turnaround", response_model=CsvImportResult)
async def import_turnaround_csv(
    request: Request,
    retrain_model: bool = False,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([
        UserRole.ADMIN, UserRole.TERMINAL_MANAGER, UserRole.VESSEL_PLANNER, UserRole.SHIFT_SUPERVISOR
    ]))
):
    """
    Imports historical turnaround records from CSV dataset.
    Optionally triggers immediate ML model re-training on new data.
    """
    csv_text = await extract_csv_text(request)
    if not csv_text.strip():
        raise HTTPException(status_code=400, detail="No CSV data provided.")

    rows = parse_csv_stream(csv_text)
    if not rows:
        raise HTTPException(status_code=400, detail="CSV is empty or missing headers.")

    imported = 0
    errors = []

    for idx, row in enumerate(rows, start=1):
        try:
            with db.begin_nested():
                v_id = str(row.get("vessel_id") or row.get("id") or f"HIST-V{idx:04d}").strip()
                v_class = str(row.get("vessel_class") or row.get("class") or "Panamax").strip()
                berth_id = str(row.get("berth_id") or row.get("berth") or "B-05").strip()

                arr_raw = str(row.get("actual_arrival_time") or row.get("arrival_time") or row.get("arrival") or "")
                dep_raw = str(row.get("departure_time") or row.get("departure") or "")

                try:
                    arr_dt = datetime.fromisoformat(arr_raw.replace("Z", "+00:00")) if arr_raw else datetime.now(timezone.utc)
                except Exception:
                    arr_dt = datetime.now(timezone.utc)

                actual_dwell = safe_float(row.get("actual_dwell_hours") or row.get("actual_dwell"), 24.0)
                sched_dwell = safe_float(row.get("scheduled_dwell_hours") or row.get("scheduled_dwell"), 22.0)

                try:
                    dep_dt = datetime.fromisoformat(dep_raw.replace("Z", "+00:00")) if dep_raw else (arr_dt + timedelta(hours=actual_dwell))
                except Exception:
                    dep_dt = arr_dt + timedelta(hours=actual_dwell)

                delay_cause = str(row.get("delay_cause") or row.get("cause") or "NONE").strip().upper()
                delay_minutes = safe_int(row.get("delay_minutes") or row.get("delay"), 0)
                shift_id = str(row.get("shift_id") or row.get("shift") or "SHIFT_A").strip()

                record = TurnaroundRecord(
                    vessel_id=v_id,
                    vessel_class=v_class,
                    berth_id=berth_id,
                    arrival_time=arr_dt,
                    departure_time=dep_dt,
                    actual_dwell_hours=actual_dwell,
                    scheduled_dwell_hours=sched_dwell,
                    delay_cause=delay_cause,
                    delay_minutes=delay_minutes,
                    shift_id=shift_id,
                    recorded_at=dep_dt
                )
                db.add(record)
                imported += 1

        except Exception as e:
            errors.append(f"Row {idx}: Error processing row: {str(e)}")

    db.commit()

    AuditService.record_event(
        db=db,
        actor=user.username,
        action="IMPORT_TURNAROUND_CSV",
        entity_type="TURNAROUND_RECORD",
        entity_id="BATCH",
        payload_snapshot={"imported": imported, "retrain_model": retrain_model, "error_count": len(errors)}
    )

    if retrain_model:
        risk_engine.retrain_and_predict(db)

    event_bus.publish(EventType.DATA_CHANGED, entity_type="TURNAROUND_RECORD", action="CSV_IMPORT")

    return CsvImportResult(
        status="success" if not errors else "partial_success",
        imported_count=imported,
        updated_count=0,
        errors=errors,
        message=f"Imported {imported} historical turnaround records." + (" ML models retrained." if retrain_model else "")
    )

