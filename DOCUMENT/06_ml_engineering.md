# ML Engineering Design — PortPulse
### Written from an ML engineer's point of view, not a developer's

A developer asks "which library do I import." An ML engineer asks "what am I actually predicting, what's my ground truth, how will I know if the model is lying to me, and what happens when reality drifts out from under it." This document is structured around those questions.

---

## 1. Problem Framing — What Is Actually a Prediction Problem Here

Not everything in PortPulse is ML. Being precise about this matters for the pitch and for the build:

| Component | Is it ML? | Why |
|---|---|---|
| Vessel ETA correction (F-201) | **Yes — regression** | Predicting a continuous value (arrival time) from features |
| Berth occupancy forecast (F-202) | **Yes — time-series forecasting** | Predicting occupancy probability over a future horizon |
| Congestion risk tiering (F-203) | **Yes — classification (or thresholded regression output)** | Mapping a continuous risk score to green/amber/red |
| Cascading delay simulation (F-205) | **Partially — simulation over model outputs**, not itself a learned model | Propagates ETA/occupancy predictions through a rules-based dependency graph |
| Berth/crane assignment (F-305) | **No — constraint optimisation (MILP)** | Deterministic, explainable, not learned. Do not call this "AI" in the pitch beyond "AI-informed" — judges on technical criteria will notice if you conflate optimisation with ML |
| Routing/diversion recommendation (F-301–F-303) | **Hybrid** — rules + the risk model's output as a trigger, ranked by the cost estimator | The "recommend" step consumes ML outputs but is largely rules + optimisation |
| Shift briefing / chat (F-401, F-406) | **Generative AI (LLM), not a trained-from-scratch model** | Foundation model + RAG, evaluated differently from a regression/classification model (see §6) |

Being this explicit is itself worth pitch points: it shows the team understands *where* the "AI" actually is, rather than hand-waving the whole pipeline as "AI-powered."

## 2. Data Pipeline & Feature Engineering

### 2.1 Data Sources (hackathon-feasible)
Per the problem statement's own guidance, real AIS access requires paid APIs, so the system of record for both demo and model training is the **synthetic data generator** (F-101). This is a deliberate ML engineering decision, not a shortcut to hide: a synthetic generator lets you *control ground truth*, which is otherwise the hardest part of this problem (real port congestion labels are messy and delayed).

### 2.2 Feature Store (conceptual, not necessarily a dedicated tool at hackathon scale)
| Feature group | Examples |
|---|---|
| Vessel-level | Carrier-reported ETA, vessel class, cargo volume, priority flag, historical carrier ETA-accuracy bias |
| Berth-level | Length/draft utilization headroom, crane availability ratio, upcoming maintenance windows |
| Temporal | Hour of day, day of week, proximity to known high-traffic windows |
| Interaction | Number of vessels with overlapping ETA windows targeting compatible berths (this is the feature that actually drives congestion — a single ETA in isolation tells you little) |
| Historical | Rolling average dwell time for this vessel class at this berth, delay-cause frequency |
| Weather/tide | Draft-restriction windows, forecast severity |

### 2.3 Data Quality Checks (before anything touches a model)
- Range checks (no negative dwell time, no ETA before "now" minus a sane buffer).
- Referential integrity (every TurnaroundRecord references a real vessel/berth).
- Class balance check on injected shock events — if every training "year" has the same shock pattern, the model will overfit to that pattern and fail to generalize to a judge's live what-if scenario.

### 2.4 Splitting Strategy — This Is Where Most Time-Series Mistakes Happen
- **Temporal split, never random split.** Train on the earliest 70% of synthetic history, validate on the next 15%, test on the final 15%, strictly by time. A random shuffle-split here would leak future information into training (the model would "see" outcomes it shouldn't know yet) and produce misleadingly good offline metrics that fall apart in the live demo.
- **No feature computed with a future-looking window** (e.g., "average delay this week" must only use data available at prediction time, not the full week including hours not yet happened).

## 3. Modelling Approach

### 3.1 Baselines First (non-negotiable)
Before touching Prophet/XGBoost/LSTM, establish a naive baseline: "berth occupancy tomorrow = berth occupancy same hour last week" or "corrected ETA = carrier ETA + historical mean bias for this carrier." **Every subsequent model must beat this baseline on held-out data, or it doesn't ship.** This is the single most common gap between a "coder's ML" and an "ML engineer's ML": a coder wires up XGBoost because it's available; an ML engineer proves it's actually better than doing nothing clever.

### 3.2 Candidate Models
| Task | Candidates | Selection driver |
|---|---|---|
| ETA correction | Gradient-boosted trees (XGBoost/LightGBM) on tabular features | Fast, interpretable via feature importance/SHAP, handles mixed feature types well — appropriate given hackathon data volume |
| Berth occupancy forecast | Prophet (fast, interpretable, handles seasonality) as primary; LSTM only if Prophet underperforms and time permits | Prophet is the right first choice for a 72h horizon with clear daily/weekly seasonality and a small hackathon dataset — an LSTM needs more data than a synthetic generator can meaningfully provide before it starts memorizing noise |
| Risk tiering | Thresholded output of the occupancy/ETA models, calibrated against historical outcome rates, not an arbitrarily chosen cutoff | Avoids the common mistake of picking green/amber/red boundaries by eye instead of by validated outcome frequency |

### 3.3 Hyperparameter Tuning
- Small, time-boxed grid/random search on the validation split only — never touch the test split until final reporting.
- Track every run (params, metrics, data version) even with something as lightweight as a CSV or MLflow if time allows — an ML engineer never reports "the model got 92% accuracy" without being able to say which exact run and dataset produced that number.

## 4. Evaluation — By Task, With the Right Metric for Each

| Task | Primary metric(s) | Why this metric, not another |
|---|---|---|
| ETA correction (regression) | MAE, RMSE, MAPE | MAE for typical-case interpretability ("off by X hours on average"), RMSE to penalize the rare large miss that actually causes a berth collision in the schedule |
| Berth occupancy forecast | Brier score, calibration curve | This is a **probability**, not a point estimate — accuracy alone would hide whether the model's "80% occupied" actually happens ~80% of the time. Calibration is the metric that makes F-207 (confidence intervals) trustworthy rather than decorative |
| Risk tiering (classification) | Precision/Recall per tier, confusion matrix (esp. false "green" on an actual red — a missed congestion event is far costlier than a false alarm) | Plain accuracy is misleading on an imbalanced tier distribution (most berth-hours are "green"); recall on "red" is the number that matters operationally |
| Cost/impact estimator | Backtested against synthetic historical outcomes: did the estimated $ / time saved roughly match what the simulator says would have happened | Keeps the "wow" cost number in the demo honest rather than an unvalidated guess |

**Report a confusion matrix and calibration curve in the submission docs, not just a headline accuracy number** — judges scoring "Technical Implementation Quality" read for exactly this kind of rigor.

## 5. Explainability (F-206) — Implementation, Not Just a Slide Bullet

- Tree-based models (ETA correction, risk tiering support) expose SHAP values directly — surface the top 3 contributing features per prediction in the API response (`RiskScore.top_factors[]` in `05_backend.md`).
- Prophet's own decomposition (trend/seasonality/holiday-equivalent shock events) doubles as a natural-language explanation source: "occupancy is elevated because of a detected surge pattern similar to [historical event]."
- Every explanation shown to a user must trace back to an actual feature value in that prediction's input — never a templated, generic explanation string. This is the difference between real explainability and a UI that merely looks explainable.

## 6. The Generative Layer (F-401, F-406) — Different Discipline, Different Risks

This is not "the same ML," and treating it identically is a common mistake:
- **Grounding, not fine-tuning**: the LLM never generates a berth ID, ETA, or risk score from its own knowledge — every fact in the briefing is retrieved from the actual current data (RAG), and the prompt template explicitly instructs the model to only report on data it's been given.
- **Output validation** (also in `03_security.md`): post-generation, check that every berth/vessel ID mentioned in the briefing exists in the current dataset — reject and regenerate (or flag) if not. This catches hallucination mechanically rather than hoping the prompt alone prevents it.
- **Evaluation is qualitative + spot-check, not accuracy-metric-based**: a small rubric (factual correctness against source data, clarity, actionability) scored by a human reviewer on a sample of generated briefings each increment, not a single automated score.

## 7. MLOps / Feedback Loop (I5, but designed for from day one)

- **Model versioning**: every deployed model tagged with a version, trained-on-data timestamp, and evaluation metrics snapshot — this is what makes `RiskScore.model_version` (`05_backend.md`) meaningful rather than a placeholder field.
- **Feedback loop (F-502)**: supervisor accept/reject actions on recommendations (F-407) are logged with the model version and inputs active at that time; this becomes a labeled dataset for retraining — "did the model's red flag lead to an accepted diversion, or did the supervisor reject it as a false alarm."
- **Drift monitoring** (documented even if not fully built in the hackathon window): track the live distribution of key input features (e.g., vessel arrival rate, cargo volume) against the training distribution; a large shift is the trigger for retraining before accuracy silently degrades — call this out explicitly as a "future roadmap" item if not implemented, rather than silently omitting it.
- **Retraining trigger policy**: scheduled retrain (e.g., weekly) as the baseline; drift-triggered retrain as the roadmap item.

## 8. Validation Against the Historical Scenario (F-503)

The single most convincing thing this team can put in front of judges: replay the 2021 LA/Long Beach-style shock event (mega-ships clustering, no slack in the schedule) through the trained model and show it would have flagged the risk tier as "red" *before* the queue actually formed, with a lead time comparable to or better than the 72h target. This is the ML-engineer version of a demo "wow" moment — it's a **backtest**, not a live prediction, and should be labeled as such in the pitch (never imply a backtest result is a live guarantee).

## 9. Known Limitations & Risks (state these explicitly — see `03_security.md §8` for the same principle applied to security)
- Trained entirely on synthetic data; real-world carrier ETA bias, weather patterns, and labor dynamics will differ — the pitch should frame this as "validated methodology, ready for real-data calibration," not "production-accurate."
- Small hackathon-scale dataset limits how much a model like an LSTM can be trusted over a simpler baseline — this is why Prophet/XGBoost are the primary choices, not a limitation to hide.
- Risk-tier thresholds calibrated on synthetic outcome rates may not transfer directly to a real terminal's risk tolerance — this should be a configurable parameter (`RiskScore` thresholding), not a hardcoded constant, precisely because it will need re-tuning on real deployment.
