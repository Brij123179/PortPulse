"""
PortPulse — Machine Learning Model Training & Evaluation Pipeline
Trains and serializes the GradientBoosting ETA Correction model on historical turnaround records.
Outputs evaluation metrics, naive baseline comparisons, and feature importance rankings.
"""

import os
import sys
import argparse
import csv
import math
from datetime import datetime, timezone
import numpy as np
import joblib
from sklearn.ensemble import GradientBoostingRegressor

# Add src/backend to python path for internal imports if needed
BACKEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

CLASS_MAP = {"Feeder": 0, "Handymax": 1, "Panamax": 2, "Post-Panamax": 3, "Neo-Panamax": 4, "ULCV": 5}
FEATURE_NAMES = [
    "vessel_class_idx", "hour_of_day", "day_of_week", "scheduled_dwell_hours",
    "crane_outage_flag", "weather_outage_flag", "sin_hour", "cos_hour",
    "is_weekend", "yard_congestion_flag"
]


def load_dataset(csv_path: str):
    """Loads and vectorizes turnaround records from CSV."""
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset not found at {csv_path}")

    records = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append(row)

    # Sort strictly by arrival time to prevent temporal leakage
    try:
        records.sort(key=lambda r: r.get("actual_arrival_time") or r.get("arrival_time") or "")
    except Exception:
        pass

    X_list = []
    y_list = []

    for r in records:
        v_class = r.get("vessel_class", "Panamax")
        cls_idx = CLASS_MAP.get(v_class, 2)

        arr_str = r.get("actual_arrival_time") or r.get("arrival_time")
        try:
            dt = datetime.fromisoformat(arr_str)
        except Exception:
            dt = datetime.now(timezone.utc)

        hour = dt.hour
        weekday = dt.weekday()
        sin_hour = math.sin(2 * math.pi * hour / 24.0)
        cos_hour = math.cos(2 * math.pi * hour / 24.0)
        is_weekend = 1.0 if weekday >= 5 else 0.0

        sched_dwell = float(r.get("scheduled_dwell_hours", 24.0))
        cause = (r.get("delay_cause") or "NONE").upper()
        delay_min = float(r.get("delay_minutes", 0.0))
        delay_hours = delay_min / 60.0

        features = [
            float(cls_idx),
            float(hour),
            float(weekday),
            float(sched_dwell),
            1.0 if cause == "CRANE_OUTAGE" else 0.0,
            1.0 if cause == "WEATHER" else 0.0,
            float(sin_hour),
            float(cos_hour),
            float(is_weekend),
            1.0 if cause == "YARD_CONGESTION" else 0.0,
        ]

        X_list.append(features)
        y_list.append(delay_hours)

    return np.array(X_list), np.array(y_list), records


def evaluate_naive_baseline(y_train, y_test):
    """Computes naive mean-bias baseline performance on test set."""
    mean_bias = float(np.mean(y_train))
    baseline_residuals = y_test - mean_bias
    mae = float(np.mean(np.abs(baseline_residuals)))
    rmse = float(np.sqrt(np.mean(baseline_residuals ** 2)))
    return mae, rmse, mean_bias


def train(
    dataset_path: str,
    output_model_path: str,
    n_estimators: int = 120,
    learning_rate: float = 0.05,
    max_depth: int = 4
):
    print(f"[INFO] Loading dataset from: {dataset_path}")
    X, y, raw_records = load_dataset(dataset_path)
    total_samples = len(X)
    print(f"[INFO] Loaded {total_samples} total turnaround records.")

    # 70% temporal train / 30% held-out test
    split_idx = int(total_samples * 0.70)
    X_train, y_train = X[:split_idx], y[:split_idx]
    X_test, y_test = X[split_idx:], y[split_idx:]

    print(f"[INFO] Training split: {len(X_train)} samples | Test split: {len(X_test)} samples")

    print(f"[INFO] Training GradientBoostingRegressor (trees={n_estimators}, lr={learning_rate}, max_depth={max_depth})...")
    model = GradientBoostingRegressor(
        n_estimators=n_estimators,
        learning_rate=learning_rate,
        max_depth=max_depth,
        subsample=0.85,
        random_state=42
    )
    model.fit(X_train, y_train)

    # Test evaluation
    y_pred = model.predict(X_test)
    residuals = y_test - y_pred
    mae = float(np.mean(np.abs(residuals)))
    rmse = float(np.sqrt(np.mean(residuals ** 2)))
    r2 = float(model.score(X_test, y_test))
    residual_std = max(0.45, float(np.std(residuals)))

    # Baseline comparison
    b_mae, b_rmse, b_mean = evaluate_naive_baseline(y_train, y_test)
    improvement_mae = max(0.0, ((b_mae - mae) / b_mae) * 100.0) if b_mae > 0 else 0.0
    improvement_rmse = max(0.0, ((b_rmse - rmse) / b_rmse) * 100.0) if b_rmse > 0 else 0.0

    print("\n" + "=" * 65)
    print("MODEL EVALUATION & BENCHMARK RESULTS")
    print("=" * 65)
    print(f"  * Trained Samples:            {len(X_train)}")
    print(f"  * Test Evaluation Samples:    {len(X_test)}")
    print(f"  * Model Test MAE:             {mae:.2f} hours")
    print(f"  * Naive Baseline MAE:         {b_mae:.2f} hours")
    print(f"  * MAE Accuracy Improvement:   {improvement_mae:.1f}%")
    print(f"  * Model Test RMSE:            {rmse:.2f} hours")
    print(f"  * Naive Baseline RMSE:        {b_rmse:.2f} hours")
    print(f"  * RMSE Error Reduction:       {improvement_rmse:.1f}%")
    print(f"  * R2 Goodness-of-Fit:         {r2:.3f}")
    print(f"  * Residual Uncertainty (std): +/-{residual_std:.2f} hours")
    print(f"  * Beats Naive Baseline:       {'[YES] Strictly Outperforms' if mae < b_mae else '[NO]'}")
    print("=" * 65)

    # Feature Importance
    print("\nFEATURE IMPORTANCE RANKINGS:")
    importances = model.feature_importances_
    sorted_idx = np.argsort(importances)[::-1]
    for rank, idx in enumerate(sorted_idx, start=1):
        print(f"  {rank:2d}. {FEATURE_NAMES[idx]:<25} : {importances[idx] * 100:.1f}%")

    # Persist model
    metrics_dict = {
        "model_name": "GradientBoosting-ETA-v2-Optimized",
        "sample_count": total_samples,
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "model_mae_hours": round(mae, 2),
        "baseline_mae_hours": round(b_mae, 2),
        "mae_improvement_pct": round(improvement_mae, 1),
        "model_rmse_hours": round(rmse, 2),
        "baseline_rmse_hours": round(b_rmse, 2),
        "rmse_improvement_pct": round(improvement_rmse, 1),
        "r2_score": round(r2, 3),
        "residual_std": round(residual_std, 2),
        "beats_baseline": mae < b_mae,
    }

    os.makedirs(os.path.dirname(output_model_path), exist_ok=True)
    joblib.dump({
        "model": model,
        "residual_std": residual_std,
        "evaluation_metrics": metrics_dict,
        "saved_at": datetime.now(timezone.utc).isoformat()
    }, output_model_path)
    print(f"\n[OK] Serialized model saved to: {output_model_path}")
    return metrics_dict


def main():
    parser = argparse.ArgumentParser(description="Train PortPulse ETA Correction Machine Learning Model")
    default_dataset = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "historical_turnaround_dataset.csv")
    default_output = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "src", "backend", "app", "services", "ml", "saved_models", "eta_model.joblib"
    )

    parser.add_argument("--dataset", default=default_dataset, help="Path to turnaround dataset CSV")
    parser.add_argument("--output", default=default_output, help="Path to output saved joblib model")
    parser.add_argument("--n-estimators", type=int, default=120, help="Number of gradient boosting trees")
    parser.add_argument("--lr", type=float, default=0.05, help="Learning rate")
    parser.add_argument("--max-depth", type=int, default=4, help="Maximum tree depth")

    args = parser.parse_args()
    train(
        dataset_path=args.dataset,
        output_model_path=args.output,
        n_estimators=args.n_estimators,
        learning_rate=args.lr,
        max_depth=args.max_depth
    )


if __name__ == "__main__":
    main()
