"""
Generates a comprehensive, realistic historical turnaround and AIS telemetry dataset
for PortPulse model training, cross-validation, and operational benchmarking.
Outputs: data/historical_turnaround_dataset.csv (3,500+ records)
"""

import os
import csv
import random
import math
from datetime import datetime, timedelta, timezone

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)
OUTPUT_CSV = os.path.join(DATA_DIR, "historical_turnaround_dataset.csv")

CARRIER_PROFILES = {
    "Maersk": {"mean_bias": 1.25, "std_bias": 1.10},
    "MSC": {"mean_bias": 2.40, "std_bias": 1.65},
    "CMA CGM": {"mean_bias": 1.80, "std_bias": 1.35},
    "COSCO": {"mean_bias": 2.10, "std_bias": 1.50},
    "Hapag-Lloyd": {"mean_bias": 0.95, "std_bias": 0.85},
    "Evergreen": {"mean_bias": 1.60, "std_bias": 1.20},
    "ONE": {"mean_bias": 1.45, "std_bias": 1.15},
    "Yang Ming": {"mean_bias": 1.75, "std_bias": 1.30},
    "HMM": {"mean_bias": 1.35, "std_bias": 1.05},
    "ZIM": {"mean_bias": 2.05, "std_bias": 1.40},
    "Wan Hai": {"mean_bias": 1.55, "std_bias": 1.10},
    "PIL": {"mean_bias": 1.90, "std_bias": 1.25},
    "X-Press Feeders": {"mean_bias": 1.10, "std_bias": 0.90},
    "KMTC": {"mean_bias": 1.40, "std_bias": 1.00},
    "SITC": {"mean_bias": 1.15, "std_bias": 0.85},
    "OOCL": {"mean_bias": 1.30, "std_bias": 1.00},
}

VESSEL_CLASSES = {
    "Feeder": {"len_min": 130, "len_max": 190, "draft_min": 7.0, "draft_max": 9.5, "teu_min": 800, "teu_max": 2500, "dwell_mean": 18.5, "dwell_std": 4.5},
    "Handymax": {"len_min": 180, "len_max": 220, "draft_min": 8.5, "draft_max": 11.0, "teu_min": 2000, "teu_max": 3500, "dwell_mean": 24.0, "dwell_std": 5.5},
    "Panamax": {"len_min": 220, "len_max": 290, "draft_min": 10.0, "draft_max": 12.0, "teu_min": 3000, "teu_max": 5200, "dwell_mean": 32.0, "dwell_std": 7.0},
    "Post-Panamax": {"len_min": 300, "len_max": 350, "draft_min": 12.5, "draft_max": 14.5, "teu_min": 6500, "teu_max": 11000, "dwell_mean": 46.5, "dwell_std": 9.0},
    "Neo-Panamax": {"len_min": 340, "len_max": 366, "draft_min": 13.5, "draft_max": 15.5, "teu_min": 10000, "teu_max": 15000, "dwell_mean": 52.0, "dwell_std": 10.5},
    "ULCV": {"len_min": 366, "len_max": 400, "draft_min": 14.5, "draft_max": 16.5, "teu_min": 14000, "teu_max": 24000, "dwell_mean": 64.0, "dwell_std": 12.5},
}

BERTH_CATALOG = {
    "B-01": {"length_m": 450.0, "draft_m": 16.5, "cranes": 4, "allowed_classes": ["ULCV", "Neo-Panamax", "Post-Panamax"]},
    "B-02": {"length_m": 420.0, "draft_m": 16.0, "cranes": 4, "allowed_classes": ["ULCV", "Neo-Panamax", "Post-Panamax"]},
    "B-03": {"length_m": 400.0, "draft_m": 15.5, "cranes": 4, "allowed_classes": ["ULCV", "Neo-Panamax", "Post-Panamax"]},
    "B-04": {"length_m": 350.0, "draft_m": 14.5, "cranes": 3, "allowed_classes": ["Post-Panamax", "Panamax"]},
    "B-05": {"length_m": 340.0, "draft_m": 14.0, "cranes": 3, "allowed_classes": ["Post-Panamax", "Panamax"]},
    "B-06": {"length_m": 320.0, "draft_m": 13.5, "cranes": 3, "allowed_classes": ["Panamax", "Handymax"]},
    "B-07": {"length_m": 300.0, "draft_m": 13.0, "cranes": 3, "allowed_classes": ["Panamax", "Handymax"]},
    "B-08": {"length_m": 240.0, "draft_m": 11.5, "cranes": 2, "allowed_classes": ["Handymax", "Feeder"]},
    "B-09": {"length_m": 220.0, "draft_m": 11.0, "cranes": 2, "allowed_classes": ["Handymax", "Feeder"]},
    "B-10": {"length_m": 200.0, "draft_m": 10.5, "cranes": 2, "allowed_classes": ["Feeder"]},
}

DELAY_CAUSES = [
    ("NONE", 0.65),
    ("CRANE_OUTAGE", 0.12),
    ("WEATHER", 0.10),
    ("YARD_CONGESTION", 0.08),
    ("PILOT_UNAVAILABLE", 0.03),
    ("TIDAL_WINDOW_MISSED", 0.02)
]

SHIFTS = ["SHIFT_A (06:00-14:00)", "SHIFT_B (14:00-22:00)", "SHIFT_C (22:00-06:00)"]


def generate_dataset(num_records: int = 3500, seed: int = 42):
    rng = random.Random(seed)
    now = datetime.now(timezone.utc)
    carriers = list(CARRIER_PROFILES.keys())
    vessel_classes = list(VESSEL_CLASSES.keys())
    weights = [0.25, 0.15, 0.25, 0.18, 0.10, 0.07]  # Class distribution

    causes, cause_weights = zip(*DELAY_CAUSES)

    rows = []
    headers = [
        "vessel_id", "vessel_name", "carrier", "vessel_class", "cargo_volume_teu",
        "length_m", "draft_m", "berth_id", "cranes_allocated",
        "carrier_reported_eta", "actual_arrival_time", "departure_time",
        "arrival_speed_knots", "wind_speed_knots", "tidal_restriction_flag",
        "scheduled_dwell_hours", "actual_dwell_hours", "delay_minutes",
        "delay_cause", "shift_id", "eta_bias_hours"
    ]
    rows.append(headers)

    for i in range(1, num_records + 1):
        v_class = rng.choices(vessel_classes, weights=weights, k=1)[0]
        specs = VESSEL_CLASSES[v_class]
        carrier = rng.choice(carriers)
        carrier_bias_stat = CARRIER_PROFILES[carrier]

        # Sizing
        length = round(rng.uniform(specs["len_min"], specs["len_max"]), 1)
        draft = round(rng.uniform(specs["draft_min"], specs["draft_max"]), 1)
        teu = rng.randint(specs["teu_min"], specs["teu_max"])

        # Suitable berths
        eligible_berths = [b_id for b_id, b_info in BERTH_CATALOG.items() if v_class in b_info["allowed_classes"]]
        if not eligible_berths:
            eligible_berths = ["B-05"]
        berth_id = rng.choice(eligible_berths)
        berth_info = BERTH_CATALOG[berth_id]
        allocated_cranes = berth_info["cranes"]

        # Timeline across past 2 years (730 days)
        days_ago = rng.uniform(0.5, 720.0)
        carrier_eta = now - timedelta(days=days_ago)

        # Carrier ETA bias computation (with noise)
        base_bias = rng.gauss(carrier_bias_stat["mean_bias"], carrier_bias_stat["std_bias"])
        bias_hours = max(0.0, round(base_bias, 2))

        # Weather condition
        wind_speed = round(rng.weibullvariate(18.0, 2.2), 1)
        tidal_flag = 1 if (wind_speed > 28.0 or draft > 14.5 and rng.random() < 0.25) else 0

        # Arrival speed
        speed = round(rng.gauss(14.5, 1.8), 1)
        if wind_speed > 30.0:
            speed = max(6.0, round(speed - rng.uniform(2.0, 4.5), 1))
            bias_hours += round(rng.uniform(1.0, 3.5), 2)

        actual_arrival = carrier_eta + timedelta(hours=bias_hours)

        # Dwell calculation
        scheduled_dwell = round(max(8.0, rng.gauss(specs["dwell_mean"], specs["dwell_std"] * 0.5)), 1)

        # Operational delay cause
        cause = rng.choices(causes, weights=cause_weights, k=1)[0]
        if cause == "NONE":
            delay_minutes = 0
            actual_dwell = round(max(6.0, scheduled_dwell + rng.uniform(-1.0, 0.8)), 1)
        elif cause == "CRANE_OUTAGE":
            delay_minutes = rng.randint(60, 420)
            actual_dwell = round(scheduled_dwell + (delay_minutes / 60.0), 1)
        elif cause == "WEATHER":
            delay_minutes = rng.randint(90, 540)
            actual_dwell = round(scheduled_dwell + (delay_minutes / 60.0), 1)
        elif cause == "YARD_CONGESTION":
            delay_minutes = rng.randint(45, 300)
            actual_dwell = round(scheduled_dwell + (delay_minutes / 60.0), 1)
        elif cause == "TIDAL_WINDOW_MISSED":
            delay_minutes = rng.randint(180, 720)
            actual_dwell = round(scheduled_dwell + (delay_minutes / 60.0), 1)
        else:  # PILOT_UNAVAILABLE
            delay_minutes = rng.randint(45, 180)
            actual_dwell = round(scheduled_dwell + (delay_minutes / 60.0), 1)

        departure = actual_arrival + timedelta(hours=actual_dwell)

        # Shift
        arrival_hour = actual_arrival.hour
        if 6 <= arrival_hour < 14:
            shift = SHIFTS[0]
        elif 14 <= arrival_hour < 22:
            shift = SHIFTS[1]
        else:
            shift = SHIFTS[2]

        v_id = f"IMO{9300000 + i}"
        v_name = f"{carrier} {v_class} {i:04d}"

        rows.append([
            v_id,
            v_name,
            carrier,
            v_class,
            teu,
            length,
            draft,
            berth_id,
            allocated_cranes,
            carrier_eta.isoformat(),
            actual_arrival.isoformat(),
            departure.isoformat(),
            speed,
            wind_speed,
            tidal_flag,
            scheduled_dwell,
            actual_dwell,
            delay_minutes,
            cause,
            shift,
            bias_hours
        ])

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(rows)

    print(f"Successfully generated {OUTPUT_CSV} with {len(rows)-1} comprehensive turnaround records.")


if __name__ == "__main__":
    generate_dataset(num_records=3500, seed=42)
