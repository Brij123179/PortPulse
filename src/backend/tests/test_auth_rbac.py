def test_auth_login_success(client):
    """Test standard login returning JWT token."""
    login_data = {"username": "admin", "password": "admin123"}
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "admin"


def test_auth_login_invalid_credentials(client):
    """Test login failure on bad password."""
    login_data = {"username": "admin", "password": "wrongpassword"}
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 401
    assert "Invalid username or password" in response.json()["message"]


def test_rbac_server_side_enforcement(client, supervisor_headers):
    """F-106 / 03_security.md §2: Server-side RBAC enforcement."""
    # Registering a user requires Admin role; supervisor must be rejected with 403 Forbidden
    payload = {
        "username": "newuser",
        "email": "newuser@portpulse.local",
        "password": "password123",
        "role": "shift_supervisor"
    }
    response = client.post("/api/v1/auth/register", json=payload, headers=supervisor_headers)
    assert response.status_code == 403
    assert "Access denied" in response.json()["message"]


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

