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
