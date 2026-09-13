import csv
import io
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import CurrentUser, get_current_user, require_roles, UserRole
from app.models.entities import Berth, Crane, Vessel
from app.services.audit import AuditService
from app.services.optimiser.solver import berth_optimiser

router = APIRouter(prefix="/api/v1", tags=["CSV Import & Export Engine"])


class CsvImportResult(BaseModel):
    status: str
    imported_count: int
    updated_count: int
    errors: List[str]
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
        operational_cranes = db.query(Crane).filter(Crane.berth_id == b.id, Crane.status == "OPERATIONAL").count()
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
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=portpulse_berths.csv"}
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
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=portpulse_vessels.csv"}
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
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=portpulse_72h_operations_plan.csv"}
    )


# =========================================================================
# 2. IMPORT ENDPOINTS
# =========================================================================

async def extract_csv_text(request: Request) -> str:
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await request.form()
        for field_name in ["file", "csv_file", "upload"]:
            field = form.get(field_name)
            if field and hasattr(field, "read"):
                raw = await field.read()
                return raw.decode("utf-8")
        # Fallback to any file in form
        for v in form.values():
            if hasattr(v, "read"):
                raw = await v.read()
                return raw.decode("utf-8")
        if "csv_content" in form:
            return str(form["csv_content"])
    elif "application/json" in content_type:
        data = await request.json()
        if isinstance(data, dict):
            return data.get("csv_content", "")
    else:
        body = await request.body()
        return body.decode("utf-8")
    return ""


def parse_csv_stream(content: str) -> List[dict]:
    f = io.StringIO(content.strip())
    reader = csv.DictReader(f)
    return [row for row in reader]


@router.post("/master-data/import/berths", response_model=CsvImportResult)
async def import_berths_csv(
    request: Request,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_roles([UserRole.ADMIN]))
):
    """
    Imports berths from CSV. Automatically connects cranes and validates boundaries.
    Restricted to Admin role.
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
            b_id = row.get("id", "").strip()
            name = row.get("name", "").strip() or f"Berth {b_id}"
            length_m = float(row.get("length_m", 0))
            draft_limit_m = float(row.get("draft_limit_m", 0))
            crane_slots = int(row.get("crane_slots", 2))
            rules = row.get("contractual_priority_rules", "STANDARD").strip()
            status_val = row.get("status", "AVAILABLE").strip().upper()

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

        except Exception as e:
            errors.append(f"Row {idx}: Error processing row: {str(e)}")

    db.commit()

    AuditService.record_event(
        db=db,
        actor=admin.username,
        action="IMPORT_BERTHS_CSV",
        entity_type="BERTH",
        entity_id="BATCH",
        payload_snapshot={"imported": imported, "updated": updated, "error_count": len(errors)}
    )

    return CsvImportResult(
        status="success" if not errors else "partial_success",
        imported_count=imported,
        updated_count=updated,
        errors=errors,
        message=f"Processed {imported + updated} berths ({imported} new created with cranes, {updated} updated)."
    )


@router.post("/master-data/import/vessels", response_model=CsvImportResult)
async def import_vessels_csv(
    request: Request,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([UserRole.ADMIN, UserRole.VESSEL_PLANNER]))
):
    """
    Imports vessels from CSV. Validates length and draft against assigned berths.
    Restricted to Admin and Vessel Planner roles.
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
            v_id = row.get("id", "").strip()
            name = row.get("name", "").strip() or f"Vessel {v_id}"
            v_class = row.get("vessel_class", "POST_PANAMAX").strip().upper()
            cargo_teu = int(float(row.get("cargo_volume_teu", row.get("cargo_volume", 4000))))
            draft_m = float(row.get("draft_m", 11.5))
            length_m = float(row.get("length_m", 250.0))
            eta_raw = row.get("carrier_eta", "").strip()
            priority_flag = str(row.get("priority_flag", "false")).strip().lower() in ["true", "1", "yes"]
            assigned_berth_id = row.get("assigned_berth_id", "").strip() or None
            status_val = row.get("status", "SCHEDULED").strip().upper()

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

    return CsvImportResult(
        status="success" if not errors else "partial_success",
        imported_count=imported,
        updated_count=updated,
        errors=errors,
        message=f"Processed {imported + updated} vessels ({imported} new created, {updated} updated)."
    )
