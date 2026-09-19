import pytest


def test_auth_supervisor_login_direct_access_token(client):
    """Test non-privileged role login returning direct access token without MFA."""
    login_data = {"username": "supervisor", "password": "super123"}
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["mfa_required"] is False
    assert data["user"]["username"] == "supervisor"
    assert data["user"]["role"] == "shift_supervisor"


def test_auth_admin_login_requires_mfa_challenge(client):
    """Test privileged admin role login triggers MFA challenge token."""
    login_data = {"username": "admin", "password": "admin123"}
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    data = response.json()
    assert data["mfa_required"] is True
    assert "mfa_token" in data
    assert data["demo_code"] == "849201"
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "admin"


def test_auth_terminal_manager_login_requires_mfa_challenge(client):
    """Test privileged terminal manager role login triggers MFA challenge."""
    login_data = {"username": "manager", "password": "manage123"}
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    data = response.json()
    assert data["mfa_required"] is True
    assert "mfa_token" in data
    assert data["user"]["role"] == "terminal_manager"


def test_mfa_verify_invalid_code_rejected(client):
    """Test MFA verify rejects incorrect verification code with 401."""
    login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    mfa_token = login_res.json()["mfa_token"]

    verify_res = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": mfa_token, "code": "000000"})
    assert verify_res.status_code == 401
    assert "Invalid MFA verification code" in verify_res.json()["message"]


def test_mfa_verify_success_returns_jwt_access_token(client):
    """Test MFA verify with valid 6-digit code returns full session JWT access token."""
    login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    mfa_token = login_res.json()["mfa_token"]

    verify_res = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": mfa_token, "code": "849201"})
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert "access_token" in data
    assert data["mfa_required"] is False
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "admin"


def test_mfa_pending_token_cannot_access_apis(client):
    """Test that an ephemeral MFA challenge token cannot be used to bypass API security."""
    login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    mfa_token = login_res.json()["mfa_token"]

    # Calling an authenticated route using mfa_token as Bearer token must fail
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {mfa_token}"})
    assert res.status_code == 401
    assert "MFA challenge token cannot be used" in res.json()["message"]


def test_auth_login_invalid_credentials(client):
    """Test login failure on bad password."""
    login_data = {"username": "admin", "password": "wrongpassword"}
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 401
    assert "Invalid username or password" in response.json()["message"]


def test_rbac_server_side_enforcement(client, supervisor_headers):
    """F-106 / 03_security.md §2: Server-side RBAC enforcement."""
    payload = {
        "username": "newuser",
        "email": "newuser@portpulse.local",
        "password": "password123",
        "role": "shift_supervisor"
    }
    response = client.post("/api/v1/auth/register", json=payload, headers=supervisor_headers)
    assert response.status_code == 403
    assert "Access denied" in response.json()["message"]


def test_rbac_berth_csv_import_restricted_to_admin_and_manager(client, planner_headers):
    """Verify that vessel_planner cannot import/modify berth infrastructure via CSV."""
    res = client.post(
        "/api/v1/master-data/import/berths",
        headers=planner_headers,
        json={"csv_content": "id,name\nB-TEST,Test Berth\n"}
    )
    assert res.status_code == 403
    assert "Access denied" in res.json()["message"]


def test_rbac_forecast_retrain_restricted(client, supervisor_headers):
    """Verify that shift_supervisor cannot trigger resource-intensive ML retraining."""
    res = client.post("/api/v1/forecast/retrain", headers=supervisor_headers)
    assert res.status_code == 403
    assert "Access denied" in res.json()["message"]


def test_rbac_solver_run_restricted_to_admin_and_manager(client, planner_headers):
    """Verify that vessel_planner cannot execute the MILP solver."""
    res = client.post("/api/v1/optimiser/run", headers=planner_headers, json={})
    assert res.status_code == 403
    assert "Access denied" in res.json()["message"]


def test_correlation_id_tracing_header(client):
    """FR-X2: Response header and body include correlation ID."""
    custom_corr = "test-corr-id-999"
    response = client.get("/health", headers={"X-Correlation-ID": custom_corr})
    assert response.status_code == 200
    assert response.headers.get("X-Correlation-ID") == custom_corr
    assert response.json()["correlation_id"] == custom_corr


def test_admin_can_register_user_and_anonymous_cannot(client, admin_headers):
    """Verify admin can provision users, while unauthenticated users get 401/403."""
    payload = {
        "username": "junior_planner",
        "email": "junior@portpulse.com",
        "password": "juniorpass123",
        "role": "vessel_planner"
    }
    # Unauthenticated request rejected
    res_anon = client.post("/api/v1/auth/register", json=payload)
    assert res_anon.status_code in (401, 403)
    
    # Admin request accepted
    res_admin = client.post("/api/v1/auth/register", json=payload, headers=admin_headers)
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert data["username"] == "junior_planner"
    assert data["role"] == "vessel_planner"


def test_register_invalid_role_rejected(client, admin_headers):
    """Verify registration rejects invalid/arbitrary role strings (Bug H-9)."""
    payload = {
        "username": "rogue_user",
        "email": "rogue@portpulse.com",
        "password": "roguepass123",
        "role": "super_admin_unauthorized"
    }
    response = client.post("/api/v1/auth/register", json=payload, headers=admin_headers)
    assert response.status_code == 422


def test_anonymous_without_headers_rejected(client):
    """Verify endpoints reject completely unauthenticated requests when dev bypass is off (Bug C-1)."""
    from app.config import settings
    prev = settings.PORTPULSE_DEV_AUTH_BYPASS
    settings.PORTPULSE_DEV_AUTH_BYPASS = False
    try:
        response = client.get("/api/v1/status/table")
        assert response.status_code == 401
    finally:
        settings.PORTPULSE_DEV_AUTH_BYPASS = prev
