# 💡 Solution Overview — PortPulse

## In Brief

PortPulse is a full-stack predictive-prescriptive port operations platform that corrects carrier ETA bias (GradientBoosting, **1.17h MAE**, 33% improvement), forecasts 72-hour berth occupancy hour-by-hour, and runs a HiGHS MILP solver that generates constraint-guaranteed berth and crane schedules with **zero hard constraint violations** — all surfaced through a zero-scroll supervisor cockpit with a live spatial harbor map and a Groq LLM + Supabase RAG copilot.

---

## Vision

PortPulse acts as an operational twin and prescriptive decision-support engine for container terminals. Rather than merely observing ongoing delays, PortPulse projects congestion 72 hours into the future, calculates optimal berth and crane allocations, and presents human operators with verified recommendations and automated shift briefings.

---

## Core Capabilities

### 1. Ingestion & Operational Normalization (Increment 1)
- Ingests vessel schedules, berth configurations (length, draft limit, crane slots), yard utilization, and environmental constraints (weather/tide).
- Normalizes data into a unified schema stored in SQLite (for lightweight local execution) or PostgreSQL (for production scaling).
- Provides an immediate, read-only Live Status Table for terminal personnel with JWT RBAC protecting all write operations.

### 2. Predictive Congestion Engine (Increment 2)
- **ETA Correction**: GradientBoosting regressor corrects carrier schedule optimism — **1.17h MAE** vs **1.75h naive baseline** (33.0% improvement, 18.1% RMSE reduction).
- **72h Occupancy Matrix**: Hour-by-hour berth occupancy probabilities across 10 berths × 72 hours (720 discrete time slots).
- **Risk Heatmap**: Green/Amber/Red tier classification with SHAP-inspired driver breakdowns and calibrated 80% confidence intervals achieving **84.4% empirical coverage**.

### 3. Prescriptive Interventions & MILP Optimization (Increment 3)
- Generates diversion, slow-steaming ($P \propto v^3$ fuel law), and priority re-sequencing advisories with transparent cost/time metrics.
- HiGHS MILP solver computes mathematically optimal berth and crane assignments — **zero hard constraint violations** guaranteed across all 8/8 optimizer tests.
- What-If simulation sandbox for non-destructive schedule testing before committing to production.

### 4. Generative AI Cockpit & Shift Briefings (Increment 4)
- Groq LLM (`openai/gpt-oss-120b`) + Supabase RAG copilot grounded in 6 authoritative maritime regulatory standards.
- Anti-hallucination validator cross-references all mentioned berth IDs and vessel names against the live database.
- Dynamic AI shift handover briefing with 1-click Markdown display, CSV export, and print formatting.
- Zero-scroll unified cockpit: Quayside Spatial Map, Berthing Manifest, 72h Gantt, Congestion Testing Lab, AI Shift Briefing.

### 5. Governance, Audit & Continuous Learning (Increment 5)
- Immutable append-only audit trail capturing every AI recommendation and human accept/modify/reject decision with correlation IDs.
- Operator feedback drift tracker: acceptance rates by intervention type (DIVERSION / SLOW_STEAM / PRIORITY_RESEQUENCE) with calibration drift alerting.
- Congestion Shock Testing Lab: one-click injection of Mega-Ship Surge, Crane Breakdown, Low Tide Anomaly scenarios.

---

## Key Numbers

| Metric | Value |
| :--- | :--- |
| ETA Corrector MAE | **1.17h** (vs 1.75h baseline — 33% improvement) |
| ETA Corrector RMSE | **1.69h** (vs 2.06h baseline — 18.1% improvement) |
| 80% CI Empirical Coverage | **84.4%** |
| MILP Hard Constraint Violations | **0** |
| Automated Test Pass Rate | **48/48** |
| Berths Modelled | 10 (B-01 to B-10) |
| Forecast Horizon | 72 hours (720 time slots) |
| RAG Knowledge Base Documents | 6 maritime standards |
