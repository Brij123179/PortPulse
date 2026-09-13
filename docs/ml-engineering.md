# ML Engineering Design — PortPulse
### Written from an ML engineer's point of view, not a developer's

A developer asks "which library do I import." An ML engineer asks "what am I actually predicting, what's my ground truth, how will I know if the model is lying to me, and what happens when reality drifts out from under it." This document is structured around those questions.

---

## 1. Problem Framing — What Is Actually a Prediction Problem Here

| Component | Is it ML? | Why |
|---|---|---|
| Vessel ETA correction (F-201) | **Yes — regression** | Predicting a continuous arrival timestamp/offset from tabular features |
| Berth occupancy forecast (F-202) | **Yes — time-series forecasting** | Predicting occupancy probability over a 72-hour horizon |
| Congestion risk tiering (F-203) | **Yes — classification / thresholded regression** | Mapping risk probability to green/amber/red tiers |
| Cascading delay simulation (F-205) | **Partially — simulation over model outputs** | Propagates delay distributions through the schedule dependency graph |
| Berth/crane assignment (F-305) | **No — constraint optimisation (MILP)** | Deterministic mathematical optimization under hard constraints, not learned |
| Routing/diversion recommendation (F-301–F-303) | **Hybrid** | Rule-based trigger from risk model outputs, ranked by cost estimator |
| Shift briefing / chat (F-401, F-406) | **Generative AI (LLM)** | Pre-trained foundation model grounded via RAG on current state |

---

## 2. Data Pipeline & Feature Engineering

### 2.1 Synthetic Data Generator (F-101)
As live AIS feeds require paid commercial subscriptions, the system of record for demo and training is the synthetic data generator. It provides ground truth for turnaround records, historical carrier delays, and shock events (e.g. crane breakdown, mega-ship surge).

### 2.2 Feature Store
- **Vessel Features:** Carrier-reported ETA, vessel class, TEU volume, priority flag, historical carrier accuracy bias.
- **Berth Features:** Length/draft headroom, crane density, scheduled maintenance windows.
- **Temporal Features:** Hour of day, day of week, tidal window restrictions.
- **Interaction Features:** Congestion overlap (number of incoming vessels competing for compatible berths within a 12h window).

### 2.3 Splitting Strategy
- **Strict Temporal Split:** Earliest 70% for training, next 15% for validation, final 15% for out-of-time testing.
- **No Lookahead Leakage:** Features are strictly computed using historical windows prior to prediction time $t_0$.

---

## 3. Modelling & Baselines

### 3.1 Baselines First
Before training gradient boosted trees or Prophet models, establish naive operational baselines:
- **Occupancy Baseline:** "Berth occupancy at hour $h$ = occupancy at hour $h - 168$ (same hour last week)".
- **ETA Baseline:** "Corrected ETA = Carrier ETA + historical mean carrier bias".
*Every trained model must beat its naive baseline on the held-out test split.*

### 3.2 Model Selection (Tailored to Intel i3 / 8GB RAM)
- **ETA Correction:** LightGBM / XGBoost on tabular features (fast CPU inference, minimal memory footprint).
- **Occupancy Forecast:** Facebook Prophet (decomposes trend and daily/weekly seasonality, low memory overhead, interpretable components). Avoid heavy LSTM/deep learning models.
- **Risk Tiering:** Calibrated thresholding on occupancy and queue probability.

---

## 4. Evaluation Metrics
- **ETA Correction:** MAE, RMSE, MAPE.
- **Occupancy Forecast:** Brier score and calibration curve (assessing probability accuracy).
- **Risk Tiering:** Precision, Recall, and Confusion Matrix (prioritizing high recall on "Red" congestion events).

---

## 5. Explainability (F-206)
- Tree models expose SHAP feature attributions, populating the top 3 contributing factors in every `RiskScore` response.
- Prophet trend/seasonality decomposition surfaces plain-language drivers ("Elevated due to peak Friday clustering").

---

## 6. Generative AI Grounding (F-401, F-406)
- Grounded RAG with strict prompt boundaries.
- Mechanical output validation ensuring every vessel and berth ID mentioned in generated text exists in the live database before rendering in the UI.
