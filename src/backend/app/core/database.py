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


def run_migrations():
    """Ensures enterprise security and audit columns exist in SQLite database."""
    try:
        from sqlalchemy import text
        with engine.begin() as conn:
            if engine.dialect.name == "sqlite":
                res = conn.execute(text("PRAGMA table_info(audit_log)")).fetchall()
                existing_cols = {row[1] for row in res}
                if existing_cols:
                    if "client_ip" not in existing_cols:
                        conn.execute(text("ALTER TABLE audit_log ADD COLUMN client_ip VARCHAR(50)"))
                    if "prev_hash" not in existing_cols:
                        conn.execute(text("ALTER TABLE audit_log ADD COLUMN prev_hash VARCHAR(64)"))
                    if "entry_hash" not in existing_cols:
                        conn.execute(text("ALTER TABLE audit_log ADD COLUMN entry_hash VARCHAR(64)"))
    except Exception:
        pass


run_migrations()


def get_db():
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
