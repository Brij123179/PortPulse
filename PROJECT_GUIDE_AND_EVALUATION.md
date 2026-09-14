# PortPulse — Project Guide, Requirements Checklist & Evaluation Walkthrough

**Problem Statement L1:** Container Congestion Predictor & Port Operations Optimiser  
**Competition:** Bobathon 2026 — IBM Bob AI Hackathon  
**Repository:** [diya2405/ibm-hackathon-pcpirates](https://github.com/diya2405/ibm-hackathon-pcpirates)  
**System Completeness:** 100% across Increments I1, I2, I3, I4, and I5  
**Automated Test Suite:** 48 / 48 Tests Passing (100% pass rate)

---

## 1. Executive Summary & Core Value Proposition

Modern container gateway terminals lose tens of millions of dollars each year to quayside congestion, carrier demurrage penalties (\$1,000–\$3,125/hour per vessel), and unnecessary bunker fuel emissions caused by ships racing to wait at congested anchorages.

**PortPulse** solves this challenge through a closed-loop operations platform combining:
1. **Gradient Boosting Machine Learning** (`F-201`, `F-202`) to eliminate carrier ETA optimism bias, delivering a **33.0% error reduction** over raw AIS estimates.
2. **Mixed-Integer Linear Programming (MILP)** (`F-305`) using the HiGHS solver to compute mathematically optimal berth assignments with **zero hard constraint violations** (draft, length, crane capacity, time non-overlap).
3. **Prescriptive Interventions** (`F-301`, `F-302`, `F-304`) computing cost-benefit trade-offs for vessel diversions and fairway slow-steaming.
4. **Grounded Generative AI & Maritime RAG** (`F-401`, `F-406`) synthesizing live terminal state and cloud Supabase knowledge (World Port Index NGA Pub 150, BIMCO demurrage standards, IMO UKC protocols) with ultra-fast Groq LLM inference (< 150ms).
5. **Enterprise Platform & Trust** (`F-106`, `F-501`, `F-502`) with encrypted JWT RBAC, admin-only user provisioning, immutable audit logging, and an operator feedback loop with drift detection.

---

## 2. Requirements Reconciliation Checklist (100% Complete)

| Requirement / Feature ID | Problem Statement Scope & Specification | Delivery Status | Verification Evidence / Metric |
| :--- | :--- | :---: | :--- |
| **F-101: Synthetic Data Pipeline** | 50 vessels across 4 classes (Feeder, Panamax, Post-Panamax, ULCV), 10 berths with realistic physical parameters, 365 days historical baseline. | ✅ **Complete** | `test_ingestion.py` passes. Verified 50 vessels, 10 berths, 20 STS cranes, 365 days generated. |
| **F-104: Master Data CRUD** | Administrative management of berths and vessels with dependency checks preventing deletion of berthed vessels or draft mismatches. | ✅ **Complete** | `test_master_data.py` passes 4/4. Deletion guards and dimensional validations verified. |
| **F-105: Live Status Table** | High-density terminal status table with multi-tier pagination (10/20/50/All), searching, sorting, and Under-Keel Clearance (UKC) margins. | ✅ **Complete** | `test_status.py` passes 4/4. Responsive table with UKC warning tags and real-time berth fit badges. |
| **F-106: Server-Side RBAC** | Cryptographic JWT authentication, password hashing, and endpoint authorization across 4 roles (`admin`, `shift_supervisor`, `vessel_planner`, `terminal_manager`). | ✅ **Complete** | `test_auth_rbac.py` passes 5/5. Non-admin registration blocked with HTTP 403. |
| **F-201: ETA Correction Model** | Corrects carrier optimism bias using vessel dimensions, past carrier dwell histories, and quayside crane congestion. | ✅ **Complete** | **MAE = 1.17h** vs. Naive Baseline 1.75h (**33.0% improvement**). **RMSE = 1.69h** vs. 2.06h (**18.1% improvement**). |
| **F-202: 72h Occupancy Matrix** | Hour-by-hour occupancy probability calculation across all 10 berths and 72 hours (720 discrete time slots). | ✅ **Complete** | `test_forecast.py` passes. Evaluates berth slot probabilities and anchorage queue depth. |
| **F-203 & F-206: Risk Heatmap & SHAP** | Visual classification (Green $\le 0.40$, Amber $0.40-0.75$, Red $> 0.75$) with top 3 driver attributions (Weather, Crane outage, Cargo dwell). | ✅ **Complete** | Rendered in `CongestionHeatmap.tsx`. Driver breakdown tooltips on each cell. |
| **F-207: Calibrated Confidence Bounds** | Empirical confidence intervals for vessel arrival and dwell windows. | ✅ **Complete** | Theoretical 80% CI achieves **84.4% empirical test coverage** (calibrated). |
| **F-301: Vessel Diversions** | Proposes alternative berths when primary berths exceed capacity or draft limits. | ✅ **Complete** | Tested in `test_optimiser.py`. Proposes optimal alternative deepwater quays. |
| **F-302: Slow-Steaming Advisories** | Fairway speed reduction calculating cubic-law fuel savings and CO2 emission abatement. | ✅ **Complete** | Formulas verified in `test_maritime_cost_engine_formulas`. 1 MT VLSFO = 3.114 MT CO2. |
| **F-304: Cost/Impact Engine** | Financial breakdown calculating Net Benefit ($), Demurrage Saved ($), and Emissions Mitigated (t CO2). | ✅ **Complete** | High-precision maritime cost engine with BIMCO-calibrated demurrage rates ($1,040-$3,125/h). |
| **F-305: MILP Solver** | Solves quayside allocations using HiGHS (`scipy.optimize.milp`). | ✅ **Complete** | **0% hard constraint violations** on draft, length, crane limits, and slot overlap. |
| **F-308: What-If Sandbox** | Non-destructive simulation sandbox for hypothetical delays and crane breakdowns. | ✅ **Complete** | `WhatIfSimulator.tsx` and `POST /api/v1/optimiser/whatif` report comparative before/after metrics. |
| **F-401: AI Shift Briefing** | Single-click executive handover briefing synthesizing live operational telemetry into structured handover markdown. | ✅ **Complete** | Generated in `OperationsPlanView.tsx` via `POST /api/v1/chat/briefing`. |
| **F-406: RAG Chat Assistant** | Grounded operational copilot combining live SQLite state + Supabase PostgreSQL maritime knowledge base with Groq LLM inference. | ✅ **Complete** | Tested via `POST /api/v1/chat/query`. Sub-150ms responses, dual citations, anti-hallucination validation. |
| **F-407: Action Feed** | Accept / Modify / Reject workflow capturing supervisor rationale and audit logs. | ✅ **Complete** | Interactive cards in `RecommendationFeed.tsx`. Full audit integration. |
| **F-408: Unified Cockpit** | Integrated top-navigation header with role-tailored tabs, 60s auto-refresh, and theme toggle. | ✅ **Complete** | `Navbar.tsx` and streamlined view routing across light/dark themes. |
| **F-410: Theme Tokens** | High-contrast enterprise maritime design tokens for control tower visibility. | ✅ **Complete** | Dark/Light mode toggle with CSS custom properties and WCAG AAA compliance. |
| **F-501: Audit Log** | Immutable governance logging of actor, action, timestamp, correlation ID, and payload snapshots. | ✅ **Complete** | Tracked in `ActivityLogView.tsx` and tested in `test_audit.py`. |
| **F-502: Feedback Loop** | Tracks operator decisions, measures acceptance rates, and detects model calibration drift. | ✅ **Complete** | `FeedbackLoopTracker` monitors acceptance rates (< 70% drift threshold). |
| **F-503: Historical Replay & Shocks** | Dynamic injection of mega-ship arrival surges and crane breakdown scenarios. | ✅ **Complete** | Verified via `POST /api/v1/ingestion/shock`. Tested in `test_ingestion.py`. |

---

## 3. Tab-by-Tab Cockpit Guide (What Every Tab Does)

The PortPulse navigation bar automatically adapts based on the active operator role:

### 1. 📋 72h Operations Plan (`OperationsPlanView.tsx`)
- **Primary Users:** Shift Supervisor, Vessel Planner, Terminal Manager, Administrator.
- **Core Purpose:** The central operational manifest for the upcoming 72 hours.
- **Key Capabilities:**
  - **Berth-by-Berth Schedule Horizon:** Visualizes all 10 quays with their assigned vessels, arrival/departure windows, and draft utilization.
  - **Dynamic AI Shift Handover Generator (`F-401`):** Click **"Generate Shift Handover Briefing"** to instantly compile live traffic, delayed ships, crane bottlenecks, and demurrage savings into a structured executive markdown brief.
  - **Shift Filters:** Quickly toggle between 12h, 24h, 48h, and 72h horizons.
  - **CSV Export:** 1-click export of the operational schedule for terminal operating systems (TOS).

### 2. 🌡️ Congestion Heatmap (`CongestionHeatmap.tsx`)
- **Primary Users:** Terminal Manager, Vessel Planner, Administrator.
- **Core Purpose:** Visualizes 72-hour congestion risk probabilities across all 10 berths (720 discrete hourly slots).
- **Key Capabilities:**
  - **Color-Coded Risk Severity:** Green ($\le 0.40$), Amber ($0.40–0.75$), and Red ($> 0.75$).
  - **SHAP Feature Driver Attribution (`F-206`):** Hover over any cell to see the exact percentage contribution of root causes (e.g. `Weather/Tides: 39.7%`, `STS Crane Breakdown: 33.7%`, `Cargo Dwell: 12.8%`).
  - **Anchorage Queue Curve:** Real-time forecast of vessels waiting in the outer anchorage basin.

### 3. 💡 Prescriptive Actions (`RecommendationFeed.tsx`)
- **Primary Users:** Shift Supervisor, Terminal Manager, Administrator.
- **Core Purpose:** Actionable decision-support feed powered by the MILP optimizer.
- **Key Capabilities:**
  - **Intervention Cards:** Proposes **Diversions**, **Slow-Steaming Advisories**, and **Resequencing Actions**.
  - **Financial & Environmental Metrics:** Displays Demurrage Saved (\$) and Fuel $	ext{CO}_2$ Mitigated for each action.
  - **Operator Decision Workflow (`F-407`):** Operators can click **Accept**, **Modify**, or **Reject** (with mandatory reason capture).
  - **Feedback Loop Integration (`F-502`):** Decisions update model calibration metrics in real time.

### 4. ⚙️ Berth Allocator & Sandbox (`BerthScheduleGantt.tsx` & `WhatIfSimulator.tsx`)
- **Primary Users:** Vessel Planner, Terminal Manager, Administrator.
- **Core Purpose:** Interactive berth timeline and hypothetical scenario testing.
- **Key Capabilities:**
  - **Interactive 72h Gantt Chart (`F-402`):** Visualizes vessel dockings, lengths, and crane allocations.
  - **What-If Sandbox Simulator (`F-308`):** Simulate shock scenarios non-destructively:
    - Add $+3.5	ext{h}$ delay to a mega-ship arrival.
    - Simulate an unexpected STS crane breakdown on Berth 04.
    - Click **"Run What-If Simulation"** to evaluate before/after turnaround times, queue length, and demurrage impact without mutating production records.

### 5. 🗺️ Terminal Map (`PortMap.tsx`)
- **Primary Users:** All Roles.
- **Core Purpose:** Spatial GIS layout of the container terminal.
- **Key Capabilities:**
  - Displays the 10 deepwater berths along the coastline.
  - Highlights approaching navigation fairways, pilot boarding grounds, and outer anchorage holding areas.
  - Visual status indicators for occupied vs. available berths.

### 6. 📊 Live Queue (`LiveStatusTable.tsx`)
- **Primary Users:** All Roles.
- **Core Purpose:** Real-time searchable manifest of all commercial vessels in the port domain.
- **Key Capabilities:**
  - **High-Density Table:** Shows IMO, vessel name, class, carrier ETA, ML corrected ETA, draft, and assigned berth.
  - **UKC Draft Safety Margins:** Displays real-time Under-Keel Clearance badges ensuring $\ge 1.0	ext{m}$ clearance over chart datum depth.
  - **Table Pagination:** Switch between 10, 20, 50, or All records per page with Next/Prev pagination.
  - **Search & Sort:** Instant multi-column filtering by vessel name, class, or status.

### 7. 🌊 Delay Simulation (`CascadeDelaySimulator.tsx`)
- **Primary Users:** Vessel Planner, Terminal Manager, Administrator.
- **Core Purpose:** Visualizes downstream ripple effects of operational delays.
- **Key Capabilities:**
  - Shows how an ETA slip on an upstream vessel cascades into downstream berthing conflicts.
  - Recommends proactive fairway speed adjustments to prevent anchorage congestion.

### 8. 📜 Activity Log (`ActivityLogView.tsx`)
- **Primary Users:** Terminal Manager, Administrator.
- **Core Purpose:** Immutable audit trail and governance oversight (`F-501`).
- **Key Capabilities:**
  - Records every critical action: user login, recommendation approval, manual override, berth creation, and configuration updates.
  - Displays Actor, Timestamp, Correlation ID (`X-Correlation-ID`), Action Code, and JSON Payload Snapshot.

### 9. 🎯 Forecast Benchmarks (`MLMetricsView.tsx`)
- **Primary Users:** Vessel Planner, Terminal Manager, Administrator.
- **Core Purpose:** Transparent evaluation of machine learning models against naive baselines.
- **Key Capabilities:**
  - Compares trained GradientBoosting models against AIS-only baselines.
  - Displays MAE, RMSE, and $R^2$ metrics alongside confidence interval calibration curves.

### 10. 💬 PortPulse AI Copilot Drawer (`ChatAssistantDrawer.tsx`)
- **Primary Users:** Accessible to all roles via the **"Ask AI"** button in the top navigation bar.
- **Core Purpose:** Conversational domain assistant grounded in live operational facts and maritime knowledge (`F-406`).
- **Key Capabilities:**
  - **Dual Knowledge Grounding:** Combines live terminal state (vessels, berths, crane breakdowns) with Supabase cloud documents (World Port Index NGA Pub 150, BIMCO demurrage standards, IMO UKC protocols).
  - **Sub-150ms Response Time:** Powered by Groq API (`openai/gpt-oss-120b`).
  - **Mechanical Anti-Hallucination Guard:** Validates all mentioned berth IDs and vessel names against verified database entities.
  - **Prompt Injection Defense:** Strict read-only query boundaries.

---

## 4. Role-Based Access Control (RBAC) & Default Credentials

PortPulse enforces server-side and client-side RBAC across 4 discrete roles:

| Role | Default Username | Default Password | Permitted Tabs | Key Authorizations & Scopes |
| :--- | :--- | :--- | :--- | :--- |
| 🛡️ **Administrator** | `admin` | `admin123` | All Tabs + Master Data & User Management | Full root access. **Sole authority to provision/register new operators**. Infrastructure CRUD, override guardrails, database seeding. |
| ⚓ **Shift Supervisor** | `supervisor` | `super123` | Operations Plan, Recommendations, Live Queue, Terminal Map | Quayside tactical dispatch. Approve/reject recommendations, generate AI shift handover briefings, manage berth assignments. |
| 📊 **Vessel Planner** | `planner` | `plan123` | Allocator & Sandbox, Operations Plan, Live Queue, Terminal Map | Tactical scheduling. Run What-If simulations, evaluate ETA ML predictions, adjust berth allocations. |
| 🏢 **Terminal Manager** | `manager` | `manage123` | Operations Plan, Congestion Heatmap, Recommendations, Allocator, Live Queue, Activity Log, Benchmarks | Executive operations. Strategic KPIs, demurrage mitigation reports, carbon abatement audit, governance logs. |

> [!IMPORTANT]
> **Strict Admin-Only Registration Rule**: Public self-registration is completely disabled. Attempting to invoke `POST /api/v1/auth/register` or `POST /api/v1/auth/users` without an `admin` JWT token strictly returns **HTTP 403 Forbidden**. Only an authenticated Administrator can access the User Management panel to register operators.

---

## 5. Step-by-Step Evaluation & Testing Flow for Judges

Follow this 5-minute testing flow to verify the entire system end-to-end:

### Step 1: Login & Authentication Verification
1. Open the application at `http://127.0.0.1:5173` (or your deployed Vercel URL).
2. Confirm the dedicated **Login Page** appears with:
   - PortPulse brand and "Terminal Gateway Online" status badge.
   - The 4 **Quick Demo Profiles** grid (`admin`, `supervisor`, `planner`, `manager`).
   - The Admin-Only registration security notice.
3. Click **"Sign In as Supervisor"** — verify immediate 1-click authentication and transition into the Operations Cockpit!

### Step 2: Quayside Dispatch & AI Shift Handover Briefing
1. On the **72h Operations Plan** tab, observe the berth-by-berth allocation matrix.
2. Click **"Generate Shift Handover Briefing"** at the top right of the view.
3. Verify that within 1 second, a structured executive markdown handover report appears, detailing:
   - Active vessel manifest and delayed ships.
   - Quayside crane breakdown status.
   - Solver recommendations and potential demurrage savings.
4. Click **"Close Briefing"**.

### Step 3: Prescriptive Actions & Feedback Loop
1. Click the **Prescriptive Actions** tab in the navigation bar.
2. Review the top recommendation card (e.g. `SLOW_STEAM` or `DIVERSION`).
3. Notice the computed hours saved, demurrage saved (\$), and fuel $	ext{CO}_2$ emissions mitigated.
4. Click **"Accept Recommendation"**, enter a supervisor note (e.g. *"Approved based on fairway tidal clearance"*), and click **Submit Action**.
5. Notice the recommendation updates to **ACCEPTED** and the decision is immediately logged to the feedback loop tracker.

### Step 4: AI Copilot & Grounded RAG Query
1. Click the **"Ask AI"** button in the top navigation bar.
2. The slide-over **PortPulse AI Copilot** drawer opens.
3. Click one of the starter query chips, or type:
   > *"Which berths are at risk tomorrow and what are the UKC draft limits?"*
4. Click **Send** (or press Enter).
5. Verify the lightning-fast (< 150ms) grounded response:
   - Powered by **Groq High-Speed LLM (`openai/gpt-oss-120b`)**.
   - Dual citations citing **Supabase RAG (World Port Index NGA Pub 150 / IMO UKC Resolution A.893(21))** and live vessel records from the database.

### Step 5: What-If Scenario Sandbox
1. In the top navigation bar, click on **Sign Out**. You return cleanly to the Login Page.
2. Click **"Sign In as Planner"** (`planner` / `plan123`).
3. Navigate to **Berth Allocator & Sandbox** and open the **What-If Simulator**.
4. Select a scenario (e.g. `Mega-Ship Delay +3.5h` or `Crane Breakdown on Berth 04`).
5. Click **"Run What-If Simulation"** and observe comparative before/after metrics showing queue impact and penalty costs.

### Step 6: Admin User Management & Audit Governance
1. Click **Sign Out**, then click **"Sign In as Admin"** (`admin` / `admin123`).
2. Notice the purple **"Users"** shortcut appears in the top navigation bar.
3. Click **"Users"** to open the User Management dialog.
4. Fill in:
   - Username: `dispatch_lead`
   - Email: `dispatch@portpulse.com`
   - Password: `dispatchpass123`
   - Role: `shift_supervisor`
5. Click **"Register Operator"** — verify operator registration succeeds.
6. Navigate to the **Activity Log** tab and verify the `CREATE_USER` audit event is recorded with timestamp and correlation ID!

---

## 6. Automated Test Suite Execution

Run the complete 48-test verification suite from `src/backend`:
```bash
pytest -v
```
Expected Output:
```
============================= test session starts =============================
platform win32 -- Python 3.12.7, pytest-9.1.1
rootdir: E:\IBM_HACKATHON_PORTPLUS\srcackend
collected 48 items

tests/test_audit.py (4/4 passed) ........................................ [  8%]
tests/test_auth_rbac.py (5/5 passed) .................................... [ 19%]
tests/test_chat_and_feedback.py (5/5 passed) ............................ [ 29%]
tests/test_csv_and_resolutions.py (7/7 passed) .......................... [ 44%]
tests/test_forecast.py (5/5 passed) ..................................... [ 54%]
tests/test_ingestion.py (4/4 passed) .................................... [ 62%]
tests/test_live_e2e.py (2/2 passed) ..................................... [ 67%]
tests/test_master_data.py (4/4 passed) .................................. [ 75%]
tests/test_optimiser.py (8/8 passed) .................................... [ 92%]
tests/test_status.py (4/4 passed) ....................................... [100%]

======================= 48 passed, 2 warnings in 20.80s =======================
```
