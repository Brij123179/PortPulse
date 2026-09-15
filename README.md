# PortPulse — Container Congestion Predictor & Port Operations Optimiser
### IBM BoB AI Hackathon 2026 — Problem Statement L1

![Validate Submission](https://github.com/diya2405/ibm-hackathon-pcpirates/actions/workflows/validate.yml/badge.svg)

> **A predictive digital twin and prescriptive cockpit for maritime container terminals that predicts quayside and anchorage bottlenecks 72 hours in advance and generates constraint-guaranteed optimization advisories.**

---

## 📑 Table of Contents
- [Problem Statement & Operational Challenge](#-problem-statement--operational-challenge)
- [System Architecture](#-system-architecture)
- [Core Features & Modules](#-core-features--modules)
  - [1. 72-Hour Quayside Spatial Harbor Map](#1-72-hour-quayside-spatial-harbor-map)
  - [2. Zero-Scroll Operations Cockpit (5 Sub-Tabs)](#2-zero-scroll-operations-cockpit-5-sub-tabs)
  - [3. Predictive Machine Learning Engine](#3-predictive-machine-learning-engine)
  - [4. Prescriptive Mixed-Integer Linear Programming (MILP) Optimiser](#4-prescriptive-mixed-integer-linear-programming-milp-optimiser)
  - [5. Generative AI Copilot & Maritime RAG Assistant](#5-generative-ai-copilot--maritime-rag-assistant)
  - [6. Supervisor Manual Override Modal with AI Conflict Resolution](#6-supervisor-manual-override-modal-with-ai-conflict-resolution)
  - [7. Enterprise RBAC & Dedicated Operator Login](#7-enterprise-rbac--dedicated-operator-login)
  - [8. Governance, Immutable Audit Trails & Continuous Learning](#8-governance-immutable-audit-trails--continuous-learning)
- [Incremental Delivery Scorecard](#-incremental-delivery-scorecard)
- [Pre-Configured Operator Roles & Credentials](#-pre-configured-operator-roles--credentials)
- [Local Installation & Quickstart](#-local-installation--quickstart)
- [Automated Verification & Test Suite](#-automated-verification--test-suite)

---

## 🌊 Problem Statement & Operational Challenge

Container port terminals handle immense cargo volumes under volatile conditions: carrier schedule unreliability, tidal fluctuations, crane mechanical breakdowns, and fluctuating container dwell times. When disruptions hit, the standard operational response is manual and reactive — relying on phone calls and static spreadsheets.

Cascading delays accumulate exponentially:
- **Demurrage Penalties**: Commercial laytime breaches cost carriers and terminals between **\$1,040 to \$3,125 per hour** per vessel (BIMCO standards).
- **Emissions & Fuel Waste**: Vessels idling at anchorage or rushing at high speed consume excess bunker fuel, spiking maritime greenhouse gas emissions.
- **Berth Under-Utilization**: Imbalanced crane allocation and uncoordinated turnaround leave deepwater berths vacant while anchorage basins overflow.

**PortPulse** solves this challenge by pairing **Predictive AI** (correcting carrier ETA bias and forecasting 72h berth occupancy) with **Prescriptive Optimization** (HiGHS MILP solver guaranteeing zero hard constraint violations) and **Generative AI** (real-time maritime regulatory RAG assistant and automated shift handover briefings).

---

## 🏗️ System Architecture

```mermaid
flowchart TB
    subgraph Data Layer
        SQLite[(SQLite / TOS DB)]
        Supabase[(Supabase RAG Vector Store)]
        Synth[Synthetic Port Data Generator]
    end

    subgraph Intelligence Core
        ML[GradientBoosting ETA Corrector]
        Markov[72h Occupancy Probability Matrix]
        HiGHS[HiGHS MILP Berth & Crane Optimiser]
        Groq[Groq Ultra-Fast LLM Inference]
    end

    subgraph Backend API (FastAPI)
        Auth[JWT RBAC & Password Hashing]
        API[FastAPI REST Endpoints]
        Audit[Immutable Audit Trail & Correlation IDs]
        Feedback[Operator Feedback Loop Tracker]
    end

    subgraph Frontend Cockpit (React + TypeScript + Vite)
        SpatialMap[Quayside Spatial Harbor Map]
        Manifest[72h Berthing Manifest Table]
        Gantt[72h Gantt Timeline]
        ShockLab[Congestion Shock Testing Lab]
        Briefing[Dynamic AI Shift Briefing]
        ChatDrawer[RAG Maritime Copilot]
        OverrideModal[Manual Override & Conflict Resolver]
    end

    Synth --> SQLite
    SQLite --> API
    Supabase --> Groq
    API --> ML --> Markov --> HiGHS
    API --> Groq
    API --> Frontend Cockpit
```

---

## ⚡ Core Features & Modules

### 1. 72-Hour Quayside Spatial Harbor Map
- **Continuous Coastline Geography**: Visually models 10 quayside berths (`B-01` through `B-10`) along a realistic physical coastline with operational water depth indicators (11.0m to 16.5m deepwater berths).
- **STS Crane Gantry Allocation**: Displays active Ship-to-Shore (STS) crane gantries assigned to each berth in real time.
- **True-to-Scale Vessel Dimensions**: Vessel footprints visually scaled according to vessel classification:
  - Ultra-Large Container Vessels (ULCV): 400m LOA
  - Post-Panamax: 366m LOA
  - Panamax: 294m LOA
  - Feeder: 160m LOA
- **Luminous High-Contrast Theme**: Designed for bright daylight and dark control tower visibility with deep navy slates (`bg-slate-900/95`), neon cyan depth indicators, and safety amber crane chips.
- **Dynamic Congestion Rings**:
  - 🟢 **Normal / Direct Berth** ($\le 1.0\text{h}$ delay): Emerald status ring.
  - 🟡 **Minor Delay** ($1.0 - 5.0\text{h}$ delay): Amber alert ring.
  - 🔴 **Severe Bottleneck** ($> 5.0\text{h}$ delay): Pulsing crimson border with live BIMCO demurrage penalty estimation.
- **Paginated Offshore Anchorage Basin**: Displays waiting vessels queued offshore awaiting berth availability without vertical page jumping.
- **Approach Fairway Channel**: Tracks incoming vessels currently navigating under pilot escort.
- **Slide-Up Inspection HUD**: Clicking any berth or vessel opens an informative bottom HUD drawer with technical specs, dwell windows, under-keel clearance, and demurrage calculations.

---

### 2. Zero-Scroll Operations Cockpit (5 Sub-Tabs)
To eliminate vertical scrolling fatigue across long operational shifts, the 72-Hour Operations Plan is partitioned into **5 dedicated, first-class sub-tabs**:

1. `[ 🗺️ Quayside Spatial Map ]`: Dedicated quayside view with top KPI telemetry strip, high-contrast harbor visualization, paginated offshore anchorage, and vessel inspection HUD drawer.
2. `[ 📋 Berthing Manifest Table ]`: Shift-level filtering (`All Shifts`, `Shift 1`–`Shift 6`), quick search, page size selection (`10 / 20 / 50 / All`), and paginated gang-allocation table displayed immediately at the top with zero scrolling.
3. `[ 📊 72h Gantt Timeline ]`: Full-width visual schedule timeline tracking vessel berthing windows, turnaround durations, and crane allocations.
4. `[ ⚡ Congestion Testing Lab ]`: Standalone testing bay with 4 one-click shock injection scenarios (`Mega-Ship Surge`, `Crane Breakdown`, `Low Tide Anomaly`, `Reset Baseline`) alongside step-by-step prediction explainability guides.
5. `[ 🤖 AI Shift Briefing ]`: One-click operational briefing generator grounded in live TOS data with quick CSV download and print capabilities.

---

### 3. Predictive Machine Learning Engine
- **ETA Correction Regressor (`F-201`)**: Corrects carrier schedule optimism by training on historical vessel dimensions, past carrier dwell histories, meteorological factors, and quayside crane congestion.
  - **Model MAE:** **1.17 hours** vs. Naive Baseline **1.75 hours** (**33.0% error reduction**).
  - **Model RMSE:** **1.69 hours** vs. Naive Baseline **2.06 hours** (**18.1% improvement**).
- **72h Occupancy Probability Matrix (`F-202`)**: Hour-by-hour occupancy calculation across all 10 berths and 72 hours (720 discrete time slots).
- **Risk Heatmap & Driver Explainability (`F-203`, `F-206`)**: Color-coded risk matrix (Green $\le 0.40$, Amber $0.40-0.75$, Red $> 0.75$) with SHAP-inspired driver breakdowns (*e.g., Weather & Tidal Outage 39.7%, STS Crane Breakdown 33.7%, Cargo Dwell 12.8%*).
- **Calibrated Uncertainty Bounds (`F-207`)**: Calibrated 80% Confidence Intervals ($Z = 1.28 \times \sigma_{\text{res}}$) achieve **84.4% empirical test coverage**.

---

### 4. Prescriptive Mixed-Integer Linear Programming (MILP) Optimiser
- **Mathematical Optimization Engine (`F-305`)**: Formulates quayside scheduling as a Mixed-Integer Linear Program solved via SciPy's HiGHS solver.
- **Guaranteed Hard Constraints**:
  - **Draft Invariance**: Vessel draft $\le$ Berth water depth minus safety Under-Keel Clearance (UKC).
  - **Length Invariance**: Vessel LOA $\le$ Physical berth length.
  - **Crane Slot Invariance**: Maximum simultaneous STS cranes assigned $\le$ Berth gantry limit.
  - **Temporal Non-Overlap**: No two vessels occupying the same physical berth segment simultaneously.
- **Prescriptive Interventions**:
  - **Vessel Diversions (`F-301`)**: Proposes alternative berths when primary berths face critical congestion.
  - **Slow-Steaming Advisories (`F-302`)**: Recommends speed reduction down fairway channels, using cubic-law fuel consumption models ($P \propto v^3$) to save bunker fuel and mitigate $\text{CO}_2$.
  - **Side-by-Side Cost Engine (`F-304`)**: Quantifies Net Financial Benefit (\$), Demurrage Penalties Saved (\$), and Emissions Mitigated ($\text{t CO}_2$).
- **What-If Simulation Sandbox (`F-308`)**: Simulates hypothetical schedule adjustments non-destructively before persisting to production.

---

### 5. Generative AI Copilot & Maritime RAG Assistant
- **RAG Operational Copilot (`F-406`)**: Docked slide-over drawer accessible from the top navigation bar via **"Ask AI"**.
- **Supabase Cloud PostgreSQL Knowledge Base**: Table `portpulse_rag_documents` populated with 6 authoritative maritime reference documents:
  1. *World Port Index (NGA Pub 150)* — Deepwater container berth constraints, channel depths, and draft safety limits.
  2. *BIMCO Commercial Laytime & Demurrage Guidelines (2025/2026)* — Contractual penalty rates (\$1,040/h to \$3,125/h) by vessel class.
  3. *IMO Safety of Navigation Resolution A.893(21)* — Dynamic Under-Keel Clearance (UKC) protocols and squat effect calculations.
  4. *IAPH & TOS Quayside Performance Standards* — STS crane gang moves/hour and berth throughput benchmarking.
  5. *IMO Slow-Steaming Standards & 4th GHG Study* — Fuel consumption cubic power law ($P \propto v^3$) and $\text{CO}_2$ mitigation ($1\text{ MT VLSFO} = 3.114\text{ MT CO}_2$).
  6. *PortPulse Incident SOP* — Cascading delay mitigation and pilot boarding procedures.
- **Groq Ultra-Low Latency LLM Inference**: Integrated `openai/gpt-oss-120b` via Groq API generating grounded operational advice in $<150$ms.
- **Dual Source Grounding**: Synthesizes live operational state (berth status, vessel queue, active crane breakdowns, MILP recommendations) with Supabase maritime regulatory guidelines.
- **Mechanical Anti-Hallucination Validator**: Automatically cross-references all mentioned berth IDs and vessel names against the live database.
- **Prompt-Injection Defense**: Sanitizes user queries and restricts AI capabilities strictly to read-only maritime assistance.
- **Dynamic AI Shift Handover Briefing (`F-401`)**: Generates structured shift briefing notes with 1-click Markdown display, CSV export, and print formatting.

---

### 6. Supervisor Manual Override Modal with AI Conflict Resolution
- **Fullscreen / Maximize Toggle (`[ ⛶ ]`)**: Maximizes the override modal to full-screen view for spacious scheduling workflows on terminal control tower screens.
- **Dual Sub-Tabs**:
  - `[ 🎯 Reassignment Parameters ]`: Vessel selection, destination berth, arrival/departure date pickers, free compatible berth chips, and supervisor justification.
  - `[ ⚡ AI Conflict Resolutions ]`: Evaluated HiGHS alternatives segregated into a clean sub-tab with 1-click `Apply Safe Alternative` buttons, automatically surfacing when hard constraint violations occur.

---

### 7. Enterprise RBAC & Dedicated Operator Login
- **Dedicated Login Page (`LoginPage.tsx`)**: Secure command portal presented when unauthenticated.
- **4 One-Click Demo Profiles**:
  - 🛡️ **Administrator (`admin`)**: Master data CRUD, operator provisioning, system governance.
  - ⚓ **Shift Supervisor (`supervisor`)**: Quayside dispatch, manual override approvals, AI shift briefings.
  - 📊 **Vessel Planner (`planner`)**: ETA ML predictions, berth scheduling, What-If simulation sandbox.
  - 🏢 **Terminal Manager (`manager`)**: Executive KPIs, demurrage analysis, decarbonization audits.
- **Strict Admin-Only User Registration**: Self-registration is strictly disabled. Non-admin attempts to invoke `POST /api/v1/auth/register` receive `HTTP 403 Forbidden`.

---

### 8. Governance, Immutable Audit Trails & Continuous Learning
- **Immutable Audit Trail (`F-501`)**: Detailed governance logging of actor, role, action, timestamp, correlation ID, and payload snapshots in `ActivityLogView.tsx`.
- **Operator Feedback Loop Tracker (`F-502`)**: Tracks supervisor decisions on recommendations in `FeedbackLoopTracker`, calculating acceptance rates by intervention type (`DIVERSION`, `SLOW_STEAM`, `PRIORITY_RESEQUENCE`) and alerting on calibration drift.
- **Congestion Shock Testing Lab (`F-503`)**: Dynamic injection of mega-ship arrival surges, crane breakdowns, and low tide anomalies (`POST /api/v1/ingestion/shock`).

---

## 🏆 Incremental Delivery Scorecard

| Increment | Scope | Status | Verification & Evidence |
| :--- | :--- | :---: | :--- |
| **I1: Foundation** | Data pipeline, synthetic generator (`F-101`), master data CRUD (`F-104`), read-only Live Status Table (`F-105`), RBAC (`F-106`), theme tokens (`F-410`). | ✅ **100% COMPLETE** | 16/16 Unit & RBAC tests passing. Master schema with 50 vessels, 10 berths, crane inventories, and JWT authentication. |
| **I2: Prediction** | ETA correction model (`F-201`), 72h occupancy forecast (`F-202`), risk heatmap with SHAP explainability (`F-203`, `F-206`) & confidence intervals (`F-207`). | ✅ **100% COMPLETE** | 5/5 Forecast tests passing. GradientBoosting achieves **1.17h MAE** vs **1.75h baseline** (**33.0% improvement**). Empirical 80% CI coverage is **84.4%**. |
| **I3: Prescriptive** | Diversions (`F-301`), slow-steam advisories (`F-302`), cost/impact estimator (`F-304`), MILP optimiser (`F-305`), What-If simulation (`F-308`). | ✅ **100% COMPLETE** | 8/8 Optimizer tests passing. Deterministic HiGHS MILP solver guarantees zero hard constraint violations. |
| **I4: Cockpit & GenAI** | LLM shift briefing (`F-401`), 72h Gantt (`F-402`), RAG chat assistant (`F-406`), recommendation actions (`F-407`), unified cockpit (`F-408`). | ✅ **100% COMPLETE** | Groq LLM + Supabase RAG copilot grounded in 6 maritime standards with anti-hallucination validation and dynamic shift briefing. |
| **I5: Platform & Trust** | Audit log (`F-501`), feedback loop (`F-502`), historical replay scenario (`F-503`). | ✅ **100% COMPLETE** | Immutable audit trail, operator feedback drift tracker, and historical shock scenario injection. |

---

## 🔑 Pre-Configured Operator Roles & Credentials

For fast evaluation and role-based demonstrations, PortPulse provides four pre-seeded operational profiles:

| Role | Username | Default Password | Permissions & Operational Scope |
| :--- | :--- | :--- | :--- |
| 🛡️ **Administrator** | `admin` | `admin123` | Master data CRUD (Berths/Vessels), operator provisioning, role management, full system governance. |
| ⚓ **Shift Supervisor** | `supervisor` | `super123` | Quayside dispatch, manual berth overrides, approval/rejection of AI recommendations, AI shift briefings. |
| 📊 **Vessel Planner** | `planner` | `plan123` | ETA ML prediction adjustments, 72h berth scheduling, What-If simulation sandbox, shock scenario testing. |
| 🏢 **Terminal Manager** | `manager` | `manage123` | Executive KPI monitoring, demurrage penalty tracking, decarbonization audits, audit log inspection. |

---

## 🚀 Local Installation & Quickstart

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/diya2405/ibm-hackathon-pcpirates.git
cd ibm-hackathon-pcpirates
```

### 2. Backend Setup
```bash
cd src/backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux / macOS:
# source .venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
*The backend automatically seeds the SQLite database (`portpulse.db`) with 50 vessels, 10 berths, crane allocations, pre-configured users, and fits the ML models on startup.*

### 3. Frontend Setup
```bash
# In a new terminal window:
cd src/frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open your browser at **`http://127.0.0.1:5173`** to access the PortPulse command center.

---

## 🧪 Automated Verification & Test Suite

PortPulse includes a comprehensive automated test suite covering all backend services, machine learning models, optimization solvers, RBAC policies, and audit logging.

```bash
cd src/backend
pytest -v
```

```
============================= test session starts =============================
platform win32 -- Python 3.12.7, pytest-9.1.1
rootdir: E:\IBM_HACKATHON_PORTPLUS\src\backend
collected 48 items

tests/test_audit.py (4/4 passed) ........................................ [  8%]
tests/test_auth_rbac.py (5/5 passed) .................................... [ 18%]
tests/test_chat_and_feedback.py (5/5 passed) ............................ [ 29%]
tests/test_csv_and_resolutions.py (7/7 passed) .......................... [ 43%]
tests/test_forecast.py (5/5 passed) ..................................... [ 54%]
tests/test_ingestion.py (4/4 passed) .................................... [ 62%]
tests/test_live_e2e.py (2/2 passed) ..................................... [ 66%]
tests/test_master_data.py (4/4 passed) .................................. [ 75%]
tests/test_optimiser.py (8/8 passed) .................................... [ 91%]
tests/test_status.py (4/4 passed) ....................................... [100%]

============================== 48 passed in 6.02s ==============================
```

Frontend production bundle verification:
```bash
cd src/frontend
npm run build
```
*(Transpiles with TypeScript, optimizes chunks, and verifies 0 compile errors).*
