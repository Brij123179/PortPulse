"""Standalone seed utility for PortPulse database initialization."""
from app.core.database import engine, Base, SessionLocal
from app.services.ingestion import PortDataGenerator
from app.config import settings


def seed_database(vessels: int = None, berths: int = None, seed: int = None):
    if vessels is None:
        vessels = settings.PORTPULSE_SYNTHETIC_VESSELS
    if berths is None:
        berths = settings.PORTPULSE_SYNTHETIC_BERTHS
    if seed is None:
        seed = settings.PORTPULSE_SYNTHETIC_SEED

    print(f"Creating database tables for engine: {engine.url}...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        generator = PortDataGenerator(seed=seed)
        stats = generator.generate_all(
            db,
            vessel_count=vessels,
            berth_count=berths,
            historical_days=365,
            clear_existing=True
        )
        print("Database seeded successfully with stats:", stats)
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
