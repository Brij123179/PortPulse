import random
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from app.models.entities import (
    Berth, Crane, Vessel, YardCapacity, TurnaroundRecord, WeatherEvent, User
)
from app.core.auth import get_password_hash
from app.core.logging import logger

VESSEL_NAMES = [
    "Maersk Mc-Kinney Moller", "Ever Given", "MSC Oscar", "CMA CGM Jacques Saade",
    "HMM Algeciras", "OOCL Hong Kong", "COSCO Shipping Universe", "Madrid Maersk",
    "ONE Apus", "Yang Ming Wellhead", "ZIM Antwerp", "Ever Golden", "MSC Zoe",
    "CMA CGM Palais Royal", "Maersk Madrid", "Hapag-Lloyd Al Jmeliyah", "Ever Ace",
    "MSC Gulsun", "OOCL Scandinavia", "COSCO Nebula", "ONE Triumph", "MSC Isabella",
    "CMA CGM Rivoli", "Maersk Munich", "HMM Dublin", "Ever Globe", "ZIM Kingston",
    "CMA CGM Champs Elysees", "MSC Arina", "Maersk Emden", "ONE Competence", "Ever Gifted",
    "HMM Southampton", "COSCO Solar", "MSC Mia", "CMA CGM Concorde", "Maersk Evora",
    "Ever Govern", "ONE Trust", "MSC Febe", "HMM Stockholm", "COSCO Galaxy",
    "CMA CGM Sorbonne", "Maersk Essen", "Ever Grade", "ONE Tradition", "MSC Ambra",
    "HMM Le Havre", "COSCO Star", "CMA CGM Trocadero"
]

VESSEL_CLASSES = {
    "Feeder": {"len_min": 130, "len_max": 190, "draft_min": 7.0, "draft_max": 9.5, "teu_min": 800, "teu_max": 2500, "dwell_mean": 14.0},
    "Panamax": {"len_min": 220, "len_max": 290, "draft_min": 10.0, "draft_max": 12.0, "teu_min": 3000, "teu_max": 5200, "dwell_mean": 24.0},
    "Post-Panamax": {"len_min": 300, "len_max": 350, "draft_min": 12.5, "draft_max": 14.5, "teu_min": 6500, "teu_max": 11000, "dwell_mean": 36.0},
    "ULCV": {"len_min": 366, "len_max": 400, "draft_min": 14.5, "draft_max": 16.5, "teu_min": 14000, "teu_max": 22000, "dwell_mean": 48.0},
}


class PortDataGenerator:
    """
    Synthetic port data generator satisfying F-101, F-102, F-103.
    Deterministic with seed support, configurable 50-150 vessels, 10-20 berths.
    """

    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = random.Random(seed)

    def generate_all(
        self,
        db: Session,
        vessel_count: int = 50,
        berth_count: int = 10,
        historical_days: int = 365,
        clear_existing: bool = True
    ) -> Dict[str, int]:
        """Runs the complete end-to-end synthetic data generation pipeline."""
        logger.info("Starting synthetic port data generation", extra={"extra_data": {"vessels": vessel_count, "berths": berth_count}})

        if clear_existing:
            self._clear_data(db)

        # 1. Create Default Users (Admin, Supervisor, Planner, Manager)
        users_count = self._seed_users(db)

        # 2. Master Berth & Crane Infrastructure (F-101, F-102)
        berths_created, cranes_created = self._seed_berths_and_cranes(db, count=berth_count)

        # 3. Yard Capacity Initial State
        self._seed_yard_capacity(db)

        # 4. Ingest Vessels across upcoming 72h-120h schedule
        vessels_created = self._seed_vessels(db, count=vessel_count, berths_count=berth_count)

        # 5. Historical Turnaround Records for 1 Year (F-103)
        turnaround_count = self._seed_historical_turnaround(db, days=historical_days)

        # 6. Default Weather / Tide baseline
        self._seed_weather(db)

        db.commit()
        logger.info("Synthetic data generation completed successfully")

        return {
            "users": users_count,
            "berths": berths_created,
            "cranes": cranes_created,
            "vessels": vessels_created,
            "turnaround_records": turnaround_count,
        }

    def _clear_data(self, db: Session):
        db.query(TurnaroundRecord).delete()
        db.query(Vessel).delete()
        db.query(Crane).delete()
        db.query(Berth).delete()
        db.query(YardCapacity).delete()
        db.query(WeatherEvent).delete()
        db.commit()

    def _seed_users(self, db: Session) -> int:
        users = [
            User(username="admin", email="admin@portpulse.local", hashed_password=get_password_hash("admin123"), role="admin"),
            User(username="supervisor", email="supervisor@portpulse.local", hashed_password=get_password_hash("super123"), role="shift_supervisor"),
            User(username="planner", email="planner@portpulse.local", hashed_password=get_password_hash("plan123"), role="vessel_planner"),
            User(username="manager", email="manager@portpulse.local", hashed_password=get_password_hash("manage123"), role="terminal_manager"),
        ]
        count = 0
        for u in users:
            existing = db.query(User).filter(User.username == u.username).first()
            if not existing:
                db.add(u)
                count += 1
        db.flush()
        return count

    def _seed_berths_and_cranes(self, db: Session, count: int = 10) -> tuple[int, int]:
        berth_count = 0
        crane_count = 0

        for i in range(1, count + 1):
            berth_id = f"B-{i:02d}"
            if i <= 3:
                # Deep-water mega berth
                length_m = 420.0
                draft_m = 16.5
                crane_slots = 4
                rules = "Priority: ULCV & Post-Panamax with Tier 1 SLA"
            elif i <= 7:
                # Standard container berth
                length_m = 340.0
                draft_m = 14.0
                crane_slots = 3
                rules = "Standard container vessels, max 14m draft"
            else:
                # Feeder / coastal berth
                length_m = 220.0
                draft_m = 11.0
                crane_slots = 2
                rules = "Feeder priority, quick turnaround <18h"

            berth = Berth(
                id=berth_id,
                name=f"Berth {i:02d} Quay",
                length_m=length_m,
                draft_limit_m=draft_m,
                crane_slots=crane_slots,
                contractual_priority_rules=rules,
                status="AVAILABLE"
            )
            db.add(berth)
            berth_count += 1

            # Seed cranes per berth
            for c_idx in range(1, crane_slots + 1):
                crane_id = f"CR-{berth_id}-{c_idx}"
                crane = Crane(
                    id=crane_id,
                    berth_id=berth_id,
                    name=f"STS Crane {berth_id} #{c_idx}",
                    crane_type="STS",
                    status="OPERATIONAL",
                    maintenance_windows_json="[]"
                )
                db.add(crane)
                crane_count += 1

        db.flush()
        return berth_count, crane_count

    def _seed_yard_capacity(self, db: Session):
        yard = YardCapacity(
            teu_capacity=60000,
            teu_used=38500,
            reefer_plugs_available=600,
            reefer_plugs_used=415,
        )
        db.add(yard)
        db.flush()

    def _seed_vessels(self, db: Session, count: int = 50, berths_count: int = 10) -> int:
        now = datetime.now(timezone.utc)
        class_weights = ["Feeder"] * 20 + ["Panamax"] * 15 + ["Post-Panamax"] * 10 + ["ULCV"] * 5
        vessel_count = 0

        # Pre-assign a few active berths to show live occupancy
        active_berths = [f"B-{i:02d}" for i in range(1, min(4, berths_count + 1))]

        for idx in range(count):
            name = VESSEL_NAMES[idx % len(VESSEL_NAMES)]
            v_id = f"IMO{9200000 + idx + 1}"
            v_class = class_weights[idx % len(class_weights)]
            specs = VESSEL_CLASSES[v_class]

            length = round(self.rng.uniform(specs["len_min"], specs["len_max"]), 1)
            draft = round(self.rng.uniform(specs["draft_min"], specs["draft_max"]), 1)
            cargo = self.rng.randint(specs["teu_min"], specs["teu_max"])
            is_priority = (self.rng.random() < 0.20) or (v_class == "ULCV")

            # Determine arrival timeframe:
            # 3 vessels berthed now, 5 vessels anchored waiting, rest scheduled over next 72-96h
            if idx < len(active_berths):
                status = "BERTHED"
                assigned_berth = active_berths[idx]
                carrier_eta = now - timedelta(hours=self.rng.randint(2, 10))
                # Update berth status to occupied
                b = db.query(Berth).filter(Berth.id == assigned_berth).first()
                if b:
                    b.status = "OCCUPIED"
            elif idx < len(active_berths) + 4:
                status = "ANCHORED"
                assigned_berth = None
                carrier_eta = now - timedelta(hours=self.rng.randint(1, 4))
            else:
                status = "SCHEDULED"
                assigned_berth = None
                future_hours = self.rng.randint(1, 96)
                carrier_eta = now + timedelta(hours=future_hours)

            # ETA correction baseline (carriers are systematically optimistic by 1-5h)
            bias_hours = self.rng.uniform(0.5, 4.0)
            corrected_eta = carrier_eta + timedelta(hours=bias_hours)
            confidence = round(self.rng.uniform(0.82, 0.98), 2)

            vessel = Vessel(
                id=v_id,
                name=f"{name} ({idx+1})",
                vessel_class=v_class,
                cargo_volume=cargo,
                carrier_eta=carrier_eta,
                corrected_eta=corrected_eta,
                eta_confidence=confidence,
                priority_flag=is_priority,
                length_m=length,
                draft_m=draft,
                status=status,
                assigned_berth_id=assigned_berth
            )
            db.add(vessel)
            vessel_count += 1

        db.flush()
        return vessel_count

    def _seed_historical_turnaround(self, db: Session, days: int = 365) -> int:
        """Seeds expanded turnaround logs (F-103) for ML training and validation."""
        import os
        import csv

        # Check if pre-generated rich historical dataset exists
        dataset_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data", "historical_turnaround_dataset.csv")
        record_count = 0

        if os.path.exists(dataset_path):
            logger.info(f"Loading turnaround records from curated dataset: {dataset_path}")
            try:
                with open(dataset_path, mode="r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        v_id = row.get("vessel_id")
                        v_class = row.get("vessel_class") or "Panamax"
                        berth_id = row.get("berth_id") or "B-05"
                        
                        try:
                            arr_dt = datetime.fromisoformat(row["actual_arrival_time"])
                        except Exception:
                            arr_dt = datetime.now(timezone.utc)
                        try:
                            dep_dt = datetime.fromisoformat(row["departure_time"])
                        except Exception:
                            dep_dt = arr_dt + timedelta(hours=float(row.get("actual_dwell_hours", 24.0)))

                        record = TurnaroundRecord(
                            vessel_id=v_id,
                            vessel_class=v_class,
                            berth_id=berth_id,
                            arrival_time=arr_dt,
                            departure_time=dep_dt,
                            actual_dwell_hours=float(row.get("actual_dwell_hours", 24.0)),
                            scheduled_dwell_hours=float(row.get("scheduled_dwell_hours", 22.0)),
                            delay_cause=row.get("delay_cause", "NONE"),
                            delay_minutes=int(float(row.get("delay_minutes", 0))),
                            shift_id=row.get("shift_id", "SHIFT_A"),
                            recorded_at=dep_dt
                        )
                        db.add(record)
                        record_count += 1
                        if record_count >= 2500:
                            break

                db.flush()
                logger.info(f"Loaded {record_count} historical turnaround records from dataset.")
                return record_count
            except Exception as e:
                logger.warning(f"Failed to read dataset file ({e}), falling back to generator.", exc_info=True)

        now = datetime.now(timezone.utc)
        total_records = 2500
        delay_causes = (
            ["NONE"] * 65 +
            ["CRANE_OUTAGE"] * 12 +
            ["WEATHER"] * 10 +
            ["YARD_CONGESTION"] * 8 +
            ["PILOT_UNAVAILABLE"] * 3 +
            ["TIDAL_WINDOW_MISSED"] * 2
        )

        classes = list(VESSEL_CLASSES.keys())
        shifts = ["SHIFT_A (06:00-14:00)", "SHIFT_B (14:00-22:00)", "SHIFT_C (22:00-06:00)"]

        for i in range(total_records):
            days_ago = self.rng.uniform(1, 730)  # Past 2 years
            arrival_time = now - timedelta(days=days_ago)
            v_class = self.rng.choice(classes)
            specs = VESSEL_CLASSES[v_class]

            scheduled_dwell = round(self.rng.gauss(specs["dwell_mean"], 3.0), 1)
            scheduled_dwell = max(8.0, scheduled_dwell)

            cause = self.rng.choice(delay_causes)
            if cause == "NONE":
                delay_min = 0
                actual_dwell = round(scheduled_dwell + self.rng.uniform(-0.8, 0.5), 1)
            elif cause == "CRANE_OUTAGE":
                delay_min = self.rng.randint(60, 420)
                actual_dwell = round(scheduled_dwell + (delay_min / 60.0), 1)
            elif cause == "WEATHER":
                delay_min = self.rng.randint(60, 480)
                actual_dwell = round(scheduled_dwell + (delay_min / 60.0), 1)
            elif cause == "YARD_CONGESTION":
                delay_min = self.rng.randint(45, 300)
                actual_dwell = round(scheduled_dwell + (delay_min / 60.0), 1)
            else:
                delay_min = self.rng.randint(30, 240)
                actual_dwell = round(scheduled_dwell + (delay_min / 60.0), 1)

            # Berths matching class constraints
            if v_class == "ULCV":
                berth_id = self.rng.choice(["B-01", "B-02", "B-03"])
            elif v_class == "Feeder":
                berth_id = self.rng.choice(["B-08", "B-09", "B-10"])
            else:
                berth_id = self.rng.choice(["B-04", "B-05", "B-06", "B-07"])

            departure_time = arrival_time + timedelta(hours=actual_dwell)

            record = TurnaroundRecord(
                vessel_id=f"HIST-V{i:04d}",
                vessel_class=v_class,
                berth_id=berth_id,
                arrival_time=arrival_time,
                departure_time=departure_time,
                actual_dwell_hours=actual_dwell,
                scheduled_dwell_hours=scheduled_dwell,
                delay_cause=cause,
                delay_minutes=delay_min,
                shift_id=self.rng.choice(shifts),
                recorded_at=departure_time
            )
            db.add(record)
            record_count += 1

        db.flush()
        return record_count

    def _seed_weather(self, db: Session):
        now = datetime.now(timezone.utc)
        w = WeatherEvent(
            window_start=now,
            window_end=now + timedelta(hours=48),
            severity="LOW",
            event_type="NORMAL_CONDITIONS",
            draft_restriction_m=0.0,
            wind_speed_knots=12.0
        )
        db.add(w)
        db.flush()

    def inject_shock_event(self, db: Session, event_type: str) -> Dict[str, str]:
        """
        Inject shock events for demo scenarios (F-101):
        - 'crane_outage': Takes Crane CR-B-02-1 down for emergency maintenance
        - 'mega_ship_surge': Clusters 3 ULCVs in a 4-hour arrival window
        - 'tidal_restriction': Severe low tide restricts drafts to 13.0m
        """
        now = datetime.now(timezone.utc)
        if event_type == "crane_outage":
            crane = db.query(Crane).filter(Crane.id == "CR-B-02-1").first()
            if not crane:
                crane = db.query(Crane).first()
            if crane:
                crane.status = "BREAKDOWN"
                crane.maintenance_windows_json = f'[{{"start": "{now.isoformat()}", "reason": "Emergency Gearbox Failure"}}]'
                db.commit()
                return {"event": "crane_outage", "target": crane.id, "detail": "STS Crane suffered emergency mechanical breakdown"}

        elif event_type == "mega_ship_surge":
            # Reposition 3 ULCV vessels to arrive within next 3 hours
            ulcvs = db.query(Vessel).filter(Vessel.vessel_class == "ULCV").limit(3).all()
            for i, v in enumerate(ulcvs):
                v.carrier_eta = now + timedelta(hours=i + 1)
                v.corrected_eta = v.carrier_eta + timedelta(minutes=45)
                v.status = "SCHEDULED"
            db.commit()
            return {"event": "mega_ship_surge", "count": str(len(ulcvs)), "detail": "3 Ultra Large Container Vessels clustered into 3-hour arrival window"}

        elif event_type == "tidal_restriction":
            w = WeatherEvent(
                window_start=now + timedelta(hours=6),
                window_end=now + timedelta(hours=18),
                severity="HIGH",
                event_type="SPRING_LOW_TIDE",
                draft_restriction_m=2.5,
                wind_speed_knots=28.0
            )
            db.add(w)
            db.commit()
            return {"event": "tidal_restriction", "detail": "Draft limit curtailed by 2.5m for next 12 hours due to tidal anomaly"}

        return {"error": f"Unknown event type: {event_type}"}
