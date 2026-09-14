from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

_db_url = settings.effective_db_url

# Connection args vary by backend
connect_args = {}
engine_kwargs = {
    "echo": settings.PORTPULSE_DB_ECHO,
}

if _db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
else:
    # PostgreSQL pool settings for Supabase (PgBouncer on port 6543)
    engine_kwargs.update({
        "pool_size": 5,
        "max_overflow": 10,
        "pool_pre_ping": True,
        "pool_recycle": 1800,
    })

engine = create_engine(_db_url, connect_args=connect_args, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
