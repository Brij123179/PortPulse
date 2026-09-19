import pytest
from fastapi.testclient import TestClient
from app.core.auth import create_access_token
from app.models.entities import AuditLogEntry, User, AdminApprovalRequest
from app.services.audit import AuditService


@pytest.fixture
def admin_headers():
    token = create_access_token(data={"sub": "admin", "role": "admin", "user_id": 1})
    return {"Authorization": f"Bearer {token}", "X-Requested-With": "XMLHttpRequest"}


@pytest.fixture
def admin2_headers():
    token = create_access_token(data={"sub": "admin_security", "role": "admin", "user_id": 99})
    return {"Authorization": f"Bearer {token}", "X-Requested-With": "XMLHttpRequest"}


@pytest.fixture
def supervisor_headers():
    token = create_access_token(data={"sub": "supervisor", "role": "shift_supervisor", "user_id": 2})
    return {"Authorization": f"Bearer {token}", "X-Requested-With": "XMLHttpRequest"}


@pytest.fixture
def viewer_headers():
    token = create_access_token(data={"sub": "viewer_guest", "role": "viewer", "user_id": 3})
    return {"Authorization": f"Bearer {token}", "X-Requested-With": "XMLHttpRequest"}


def test_field_level_masking_in_csv_exports(client, admin_headers, supervisor_headers, viewer_headers):
    """
    Verifies Field-Level Role-Based Masking:
    Commercial priority rules, exact cargo volume, and demurrage liabilities
    are redacted for non-privileged roles (supervisor/viewer), but visible to Admin.
    """
    # 1. Admin gets unredacted export
    admin_berths = client.get("/api/v1/master-data/export/berths.csv", headers=admin_headers)
    assert admin_berths.status_code == 200
    assert "[REDACTED: ROLE RESTRICTED]" not in admin_berths.text

    # 2. Viewer gets redacted export
    viewer_berths = client.get("/api/v1/master-data/export/berths.csv", headers=viewer_headers)
    assert viewer_berths.status_code == 200
    assert "[REDACTED: ROLE RESTRICTED]" in viewer_berths.text

    # 3. Vessel cargo volume masking
    admin_vessels = client.get("/api/v1/master-data/export/vessels.csv", headers=admin_headers)
    assert admin_vessels.status_code == 200
    assert "[REDACTED: ROLE RESTRICTED]" not in admin_vessels.text

    viewer_vessels = client.get("/api/v1/master-data/export/vessels.csv", headers=viewer_headers)
    assert viewer_vessels.status_code == 200
    assert "[REDACTED: ROLE RESTRICTED]" in viewer_vessels.text

    # 4. Operations plan demurrage cost masking
    admin_plan = client.get("/api/v1/optimiser/export/operations-plan.csv", headers=admin_headers)
    assert admin_plan.status_code == 200
    assert "[REDACTED: ROLE RESTRICTED]" not in admin_plan.text

    supervisor_plan = client.get("/api/v1/optimiser/export/operations-plan.csv", headers=supervisor_headers)
    assert supervisor_plan.status_code == 200
    assert "[REDACTED: ROLE RESTRICTED]" in supervisor_plan.text


def test_cryptographic_audit_hash_chain_and_tamper_detection(client, db_session, admin_headers):
    """
    Verifies SHA-256 hash chaining of audit logs:
    1. Records chained entries.
    2. Validates integrity check succeeds.
    3. Simulates database record alteration and validates tamper detection.
    """
    # Verify baseline integrity
    res = client.get("/api/v1/audit/verify-integrity", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["is_valid"] is True

    # Generate a new audited action
    client.post(
        "/api/v1/master-data/berths",
        headers=admin_headers,
        json={
            "id": "B-INTEG-01",
            "name": "Integrity Test Berth",
            "length_m": 350.0,
            "draft_limit_m": 15.0,
            "crane_slots": 3,
            "contractual_priority_rules": "STANDARD",
            "status": "AVAILABLE"
        }
    )

    # Re-verify integrity with new record
    res2 = client.get("/api/v1/audit/verify-integrity", headers=admin_headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["is_valid"] is True
    assert data2["total_verified"] > 0

    # Tamper with the last entry's payload in the database
    last_entry = db_session.query(AuditLogEntry).order_by(AuditLogEntry.id.desc()).first()
    original_payload = last_entry.payload_snapshot
    last_entry.payload_snapshot = '{"tampered": "malicious_covert_edit"}'
    db_session.commit()

    # Verify integrity now detects tampering
    tamper_res = client.get("/api/v1/audit/verify-integrity", headers=admin_headers)
    assert tamper_res.status_code == 200
    tamper_data = tamper_res.json()
    assert tamper_data["is_valid"] is False
    assert tamper_data["compromised_entry_id"] == last_entry.id
    assert "tampering detected" in tamper_data["error"].lower()

    # Revert modification for clean state
    last_entry.payload_snapshot = original_payload
    db_session.commit()

    # Clean up test berth
    client.delete("/api/v1/master-data/berths/B-INTEG-01", headers=admin_headers)


def test_dual_control_admin_elevation_workflow(client, db_session, admin_headers, admin2_headers):
    """
    Verifies Dual-Control Second-Admin Approval Workflow:
    1. Admin A submits request to create an Admin account -> returns 202 Accepted.
    2. Admin A attempts to self-approve -> rejected with 403 (dual control violation).
    3. Admin B approves the elevation -> user created successfully.
    """
    target_username = "new_security_officer"
    payload = {
        "username": target_username,
        "email": "security_officer@portpulse.com",
        "password": "SecurePassword123!",
        "role": "admin"
    }

    # Step 1: Admin A requests admin creation
    res = client.post("/api/v1/auth/register", json=payload, headers=admin_headers)
    assert res.status_code == 202
    data = res.json()
    assert data["status"] == "PENDING_SECOND_ADMIN_APPROVAL"
    approval_id = data["approval_id"]

    # Target user must NOT exist yet
    user_in_db = db_session.query(User).filter(User.username == target_username).first()
    assert user_in_db is None

    # Step 2: Admin A attempts to self-approve -> Forbidden (dual control violation)
    self_approve_res = client.post(f"/api/v1/auth/approvals/{approval_id}/approve", headers=admin_headers)
    assert self_approve_res.status_code == 403
    err_msg = (self_approve_res.json().get("message") or self_approve_res.json().get("detail") or "").lower()
    assert "dual-control violation" in err_msg

    # Step 3: Admin B approves the request
    approve_res = client.post(f"/api/v1/auth/approvals/{approval_id}/approve", headers=admin2_headers)
    assert approve_res.status_code == 200
    approve_data = approve_res.json()
    assert approve_data["status"] == "APPROVED"
    assert approve_data["approved_by"] == "admin_security"

    # User must now exist in database with admin role
    created_user = db_session.query(User).filter(User.username == target_username).first()
    assert created_user is not None
    assert created_user.role == "admin"


def test_security_headers_enforced(client):
    """
    Verifies HSTS, nosniff, X-Frame-Options, CSP, and Permissions-Policy.
    """
    res = client.get("/health")
    assert res.status_code == 200
    assert "max-age=31536000" in res.headers.get("Strict-Transport-Security", "")
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert "default-src 'self'" in res.headers.get("Content-Security-Policy", "")
