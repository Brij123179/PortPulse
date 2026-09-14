# PortPulse — Container Congestion Predictor & Port Operations Optimiser
### IBM BoB AI Hackathon 2026 — Problem Statement L1

> **One-liner:** A predictive twin of the port that tells shift supervisors what will jam up in the next 72 hours — and hands them the fix, in one click, grounded by IBM Bob.

---

## Overview

Port operations face massive cascading delays when disruptions occur. Berth, crane, and yard allocations across hundreds of vessels are conventionally managed via manual, reactive spreadsheets. PortPulse transforms port operations from reactive fire-fighting to proactive, constraint-guaranteed optimization:

1. **Predicts Congestion Hotspots (72h Horizon):** Learns vessel turnaround patterns, corrects optimistic carrier ETAs, and computes hour-by-hour berth occupancy probabilities.
2. **Prescribes Actionable Interventions:** Evaluates diversion, slow-steaming, and re-sequencing options with transparent side-by-side cost and time impact estimates.
3. **Solves Berth & Crane Allocations (MILP):** Guarantees zero hard constraint violations (draft limits, berth length, crane availability, shift windows).
4. **Human-in-the-Loop Cockpit:** Live heatmap, Gantt schedule, recommendation feed (Accept / Modify / Reject), and natural-language shift briefings grounded via IBM Bob / watsonx.ai.

---

## Incremental Delivery Plan

| Increment | Scope | Status |
|---|---|---|
| **I1: Foundation** | Data pipeline, synthetic generator (F-101), master data CRUD (F-104), read-only Live Status Table (F-105), RBAC (F-106), theme tokens (F-410). | **COMPLETE (16/16 Tests Passing)** |
| **I2: Prediction** | ETA correction model (F-201), 72h occupancy forecast (F-202), risk heatmap with SHAP explainability (F-203, F-206) & confidence intervals (F-207). | **COMPLETE (33% MAE reduction, 84.4% CI coverage)** |
| **I3: Prescriptive** | Diversions (F-301), slow-steam advisories (F-302), cost/impact estimator (F-304), MILP optimiser (F-305), What-If simulation (F-308). | **COMPLETE (HiGHS MILP, $ Demurrage/CO2 saved)** |
| **I4: Cockpit & GenAI**| LLM shift briefing (F-401), 72h Gantt (F-402), RAG chat assistant (F-406), recommendation actions (F-407), unified cockpit (F-408). | **COMPLETE (watsonx.ai RAG Copilot & AI Briefing)** |
| **I5: Platform & Trust**| Audit log (F-501), feedback loop (F-502), historical replay scenario (F-503). | **COMPLETE (Continuous learning & audit trail)** |

---

## Quickstart & Setup

Refer to [`docs/setup-guide.md`](docs/setup-guide.md) for full local setup instructions optimized for an Intel i3, 8GB RAM development environment.

```bash
# Backend (FastAPI + SQLite)
cd src/backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (React + Vite)
cd src/frontend
npm install
npm run dev
```

---

## Documentation Directory

- [`docs/problem-statement.md`](docs/problem-statement.md): Context and quantification of container port congestion.
- [`docs/solution-overview.md`](docs/solution-overview.md): High-level operational workflow and business value.
- [`docs/architecture.md`](docs/architecture.md): System design, service decomposition, and data flow.
- [`docs/setup-guide.md`](docs/setup-guide.md): Reproducible run instructions and environment configuration.
- [`docs/security.md`](docs/security.md): Threat modeling, server-side RBAC, and prompt protection.
- [`docs/ml-engineering.md`](docs/ml-engineering.md): ML problem framing, baselines, temporal splits, and evaluation.
