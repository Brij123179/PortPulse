import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
import app.models.entities
from app.main import app
from app.services.ingestion import PortDataGenerator
from app.core.auth import create_access_token

# In-memory SQLite engine for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session")
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    generator = PortDataGenerator(seed=42)
    generator.generate_all(db, vessel_count=50, berth_count=10, historical_days=365, clear_existing=True)
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(setup_db):
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_headers():
    token = create_access_token(data={"sub": "admin", "role": "admin", "user_id": 1})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def supervisor_headers():
    token = create_access_token(data={"sub": "supervisor", "role": "shift_supervisor", "user_id": 2})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def planner_headers():
    token = create_access_token(data={"sub": "planner", "role": "vessel_planner", "user_id": 3})
    return {"Authorization": f"Bearer {token}"}
