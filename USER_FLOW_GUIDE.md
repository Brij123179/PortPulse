# PortPulse — Complete User Flow Guide
## From Login to End Results: Frontend + Backend

**Document Purpose**: Step-by-step walkthrough of every user journey through PortPulse, detailing what happens on screen (Frontend) and what processes execute behind the scenes (Backend) at each step.

---

## Table of Contents
1. [System Startup & Initialization](#1-system-startup--initialization)
2. [Login & Authentication](#2-login--authentication)
3. [Dashboard Landing & Live Data Loading](#3-dashboard-landing--live-data-loading)
4. [72h Operations Plan](#4-72h-operations-plan)
5. [Auto-Optimizer Pipeline](#5-auto-optimizer-pipeline)
6. [Manual Vessel Reassignment](#6-manual-vessel-reassignment)
7. [Congestion Heatmap](#7-congestion-heatmap)
8. [Prescriptive Actions](#8-prescriptive-actions)
9. [Berth Allocator & Sandbox](#9-berth-allocator--sandbox)
10. [Terminal Map](#10-terminal-map)
11. [Live Queue](#11-live-queue)
12. [Delay Simulation](#12-delay-simulation)
13. [Activity Log](#13-activity-log)
14. [Forecast Benchmarks](#14-forecast-benchmarks)
15. [AI Chat Assistant](#15-ai-chat-assistant)
16. [Master Data Management](#16-master-data-management)
17. [CSV Import & Export](#17-csv-import--export)
18. [Role-Based Access Control Matrix](#18-role-based-access-control-matrix)

---

## 1. System Startup & Initialization

### What Happens (Backend)
When the Uvicorn server starts (`python -m uvicorn app.main:app`):

1. **Configuration Loading** (`config.py`):
   - Reads `.env` file for Supabase credentials (`SUPABASE_HOST`, `SUPABASE_PORT=6543`, `SUPABASE_USER`, `SUPABASE_PASS`), Groq API key, and JWT secret.
   - Constructs the PostgreSQL connection URI: `postgresql+psycopg2://user:pass@host:port/db`.

2. **Database Connection Pool** (`database.py`):
   - Creates a SQLAlchemy engine with PgBouncer-optimized pool settings: `pool_size=5`, `max_overflow=10`, `pool_pre_ping=True`, `pool_recycle=1800`.
   - Runs `Base.metadata.create_all()` to ensure all 8 tables exist in Supabase (vessels, berths, cranes, yard_capacity, turnaround_records, weather_events, users, audit_log).

3. **Data Seeding** (`ingestion.py`):
   - If the database is empty, seeds 10 berths (B-01 to B-10), 50 vessels, 20 STS cranes, 600 historical turnaround records, and 4 default user accounts.
   - Berths range from 180m feeder quays (B-06..B-10) to 420m deep-water mega-berths (B-01..B-03).

4. **ML Model Pre-Training** (`risk_engine.py`):
   - Fits the Gradient Boosting ETA correction model on 600 historical turnaround logs (70/30 train/test split).
   - Logs benchmark: Model MAE ~1.18h vs Baseline MAE ~1.59h (26.1% improvement).

5. **Event Bus Registration** (`event_bus.py`):
   - Subscribes the ML risk engine to `DATA_CHANGED` and `ASSIGNMENT_CHANGED` events so models auto-invalidate when port data changes.

6. **Server Ready**:
   - Uvicorn begins accepting requests on `http://127.0.0.1:8000`.
   - Health check: `GET /health` returns `{ "status": "healthy" }`.

```
Server Boot Timeline (~12 seconds):
[0.0s] Load config & connect to Supabase PostgreSQL
[0.5s] Create/verify database schema (8 tables)
[1.0s] Seed berths, vessels, cranes, users (if fresh)
[8.0s] Train ML ETA model (600 samples, GradientBoosting)
[8.5s] Register event bus subscribers
[9.0s] Application startup complete
[9.0s] Uvicorn running on http://127.0.0.1:8000
```

---

## 2. Login & Authentication

### Step 2.1: User Opens the App
**Frontend**: Browser navigates to `http://localhost:5173`. React app loads. `AuthContext` checks `localStorage` for an existing JWT token (`portpulse-token`). If no token is found, `isAuthenticated = false`, and the app renders `LoginPage` instead of the main dashboard.

### Step 2.2: User Sees the Login Page
**Frontend** (`LoginPage.tsx`): The login page displays:
- **Left Panel**: 4 interactive demo profile cards (Admin, Shift Supervisor, Vessel Planner, Terminal Manager). Each shows the username, password, and role permissions. Two buttons per card:
  - **"Fill Form"**: Copies credentials into the manual login form.
  - **"Sign In as [Role]"**: Instantly authenticates with one click.
- **Right Panel**: Manual username/password form with a "Sign In to Operations Cockpit" button.

### Step 2.3: User Submits Credentials
**Frontend**: Sends `POST /api/v1/auth/login` with `{ username, password }`.

**Backend** (`routers/auth.py`):
1. Queries the `users` table for the username.
2. Verifies the password against the bcrypt hash using constant-time comparison.
3. If valid, generates a signed JWT token (HS256, 60-minute expiry) containing `{ sub: username, role: user.role, user_id: user.id }`.
4. Returns `{ access_token, token_type: "bearer", user: { id, username, email, role } }`.

**Frontend** (on success):
1. Stores `access_token` in `localStorage['portpulse-token']`.
2. Stores `role` in `localStorage['portpulse-role']`.
3. Sets `isAuthenticated = true`, which triggers React to unmount `LoginPage` and mount the main dashboard.
4. Immediately calls `fetchLiveStatus()` and `fetchPrescriptiveData()` to populate the dashboard.

```
Login Sequence:
Browser ──POST /auth/login──> FastAPI
                                ├─ Query users table (Supabase)
                                ├─ bcrypt.checkpw(password, hash)
                                ├─ jwt.encode({sub, role, user_id})
                                └─ Return { access_token, user }
Browser <── 200 OK + JWT ──── FastAPI
  ├─ Store token in localStorage
  ├─ Store role in localStorage
  ├─ Render main dashboard
  └─ Fire parallel data fetches
```

---

## 3. Dashboard Landing & Live Data Loading

### Step 3.1: Initial Data Fetch
**Frontend** (`App.tsx`): Immediately after login, two parallel data pipelines fire:

| Pipeline | API Calls | Backend Processing |
| :--- | :--- | :--- |
| **Live Status** | `GET /status/table` | Queries all vessels + berths from Supabase, computes summary metrics (total vessels, occupied berths, yard utilization, active cranes) |
| **Live Status** | `GET /risk/heatmap?horizon=72` | Runs 72h occupancy simulation: for each berth x each hour, computes probability of congestion using ML-fitted occupancy model. Categorizes into GREEN/AMBER/RED tiers. Caches result for 25 seconds. |
| **Live Status** | `GET /forecast/anchorage?horizon=72` | Simulates offshore anchorage queue depth over 72 hours. Returns current queue count, peak projected queue, and hourly timeline. |
| **Prescriptive** | `GET /recommendations?horizon=72` | Generates prescriptive interventions (diversions, slow-steaming, priority resequencing) based on predicted bottlenecks. Calculates financial impact per recommendation. |
| **Prescriptive** | `GET /optimiser/plan?horizon=72` | Runs the MILP solver to produce the optimal 72h berth allocation schedule. Returns vessel-to-berth assignments, dwell hours, crane allocations, and cost metrics. |

### Step 3.2: Dashboard Renders
**Frontend**: Once data arrives, the user sees:

1. **Orientation Banner** (dismissible): Explains the GREEN/AMBER/RED color coding system.
2. **5 Operational Headline Cards**:
   - **High-Risk Bottlenecks**: Count of RED-tier berth-hours from the heatmap.
   - **Prescriptive Actions**: Number of pending recommendations.
   - **Offshore Queue**: Current anchorage vessels and peak projection.
   - **Quayside In Use**: Occupied berths / total berths, active STS cranes.
   - **Est. Avg Wait** (Manager/Admin only): Average vessel wait time in hours and total demurrage in USD.
3. **Tab Navigation Bar**: Displays only tabs the users role permits (see Section 18).

### Step 3.3: Background Auto-Refresh
**Frontend**: A 60-second polling loop silently calls `fetchLiveStatus()` to keep all displayed data current. Users can toggle auto-refresh on/off from the navbar.

---

## 4. 72h Operations Plan

**Tab**: `plan` | **Roles**: All 4 roles | **Component**: `OperationsPlanView.tsx`

This is the primary operational workspace. It has 5 internal sub-tabs:

### Sub-Tab: MAP (Quayside Spatial Map)
**What the user sees**:
- **Left Column — Offshore Anchorage Basin**: Lists vessels waiting at anchor, sorted by delay severity. Each card shows vessel name, class, LOA, draft, wait time, demurrage penalty, and assigned berth. Color-coded: Red (>5h delay), Amber (1-5h), Green (<=1h).
- **Right Column — Terminal Shoreline**: 10 berth cards (B-01 to B-10) showing quay length, draft limit, crane count, and the currently occupying vessel with its berthing window, dwell time, and a "Reassign" button.
- **Vessel Dossier Drawer**: Clicking any vessel opens a floating panel with UKC clearance, dwell forecast, ML delay prediction, and a direct "Reassign Quay" button.

**Backend data source**: `GET /status/table` provides vessel assignments and berth occupancy. `GET /optimiser/plan` provides the solver schedule.

### Sub-Tab: TABLE (Berthing Manifest)
**What the user sees**: A paginated, filterable table of all 50 vessels across the 72h window, divided into 6 x 12-hour shifts. Columns include Vessel Name/IMO, Dimensions, Assigned Berth, Cranes, Berthing Window, Dwell, Wait Time, Demurrage, and a Reassign action button.

**User actions**: Filter by shift, search by name/IMO, export as CSV, or print for shift handover.

### Sub-Tab: GANTT (72h Timeline)
**What the user sees**: Visual berth-by-berth Gantt chart showing vessel occupancy blocks across the 72-hour horizon.

### Sub-Tab: TESTING (Congestion Lab)
**What the user sees**: Shock injection controls to stress-test the system.
**User actions**: Click "Mega Ship Surge", "Crane Outage", or "Tidal Restriction" buttons.
**Backend**: `POST /ingestion/shock-event?event_type=crane_outage` → Modifies vessel/berth data → Publishes `DATA_CHANGED` on event bus → ML models invalidate → Next heatmap/forecast request re-predicts with updated state.

### Sub-Tab: BRIEFING (AI Shift Briefing)
**User action**: Click "Generate AI Briefing" for the current shift.
**Backend**: `POST /chat/briefing` → Queries live port state from Supabase → Constructs domain-grounded prompt → Sends to Groq LLM → Returns structured Markdown briefing covering critical bottlenecks, crane allocations, and priority vessels.

---

## 5. Auto-Optimizer Pipeline

**Roles**: Admin & Terminal Manager only

This is the flagship ML + Operations Research workflow:

### Step 5.1: User Triggers Auto-Optimize
**Frontend**: User clicks the "Auto-Optimize Schedule" button in the Operations Plan view.
**API**: `POST /api/v1/optimiser/auto-optimize`

### Step 5.2: Backend Executes the Pipeline (~6 seconds)
**Backend** (`auto_optimizer.py`):
1. **ML Model Fit**: Re-trains the ETA correction model if invalidated. Fits the occupancy forecaster.
2. **MILP Solver Execution** (`solver.py`):
   - Formulates the Berth Allocation Problem (BAP) as a Mixed-Integer Linear Program.
   - Decision variables: Binary assignment of each vessel to each berth at each time slot.
   - Hard constraints: Draft safety, length safety, zero time-overlap collisions, active berth locking.
   - Objective: Minimize total weighted cost (wait time penalty + demurrage + class-berth mismatch penalty).
   - Dynamic dwell calculation: Feeders 8-14h, Panamax 16-28h, ULCVs 34-50h (scaled by TEU and crane count).
   - Solved via COIN-OR CBC branch-and-cut solver.
3. **Prescriptive Recommendations**: Generates 3-5 actionable interventions based on the optimized schedule.
4. **Result Staging**: Stores the solution in memory with status `PENDING_APPROVAL` — does NOT write to the database yet.

### Step 5.3: Frontend Displays Proposal Banner
**Frontend**: An illuminated banner appears showing:
- **Status**: `PENDING_APPROVAL`
- **Before vs After Metrics**: Average Wait Time reduction %, Demurrage savings $, Crane Utilization %, Collision-free guarantee.
- **View Mode Switcher**: Toggle between "Proposed Plan (Preview)" and "Current Schedule". In preview mode, the spatial map and manifest table show the proposed solver plan.
- **"Inspect All Assignments"**: Expandable drawer listing all 50 vessel-to-berth assignments with dwell hours and crane counts.

### Step 5.4: User Confirms or Rejects

**If Confirmed**:
- **Frontend**: Clicks "Confirm & Apply All (Commit to Quays)" with loading spinner.
- **API**: `POST /api/v1/optimiser/auto-optimize/{resultId}/confirm`
- **Backend** (`auto_optimizer.py`):
  1. Executes a fast batch SQL update using a single `CASE` expression:
     ```sql
     UPDATE vessels SET
       assigned_berth_id = CASE id WHEN 'IMO1' THEN 'B-01' WHEN 'IMO2' THEN 'B-03' ... END,
       status = CASE id WHEN 'IMO1' THEN 'BERTHED' ... END
     WHERE id IN ('IMO1', 'IMO2', ...);
     ```
  2. Publishes `ASSIGNMENT_CHANGED` on the event bus → ML models invalidate → forecast cache clears.
  3. Records audit log entry: `{ action: "AUTO_OPTIMIZE_APPLY", actor, count: 50 }`.
  4. Returns success with assignment count.
- **Frontend**: Shows success toast, refreshes all live data, clears the proposal banner.

**If Rejected**:
- **Frontend**: Clicks "Reject Proposal", enters a reason, clicks "Confirm Rejection".
- **API**: `POST /api/v1/optimiser/auto-optimize/{resultId}/reject?reason=...`
- **Backend**: Marks the result as `REJECTED`. No database changes occur.

```
Auto-Optimizer Flow:
User clicks "Auto-Optimize"
  │
  ▼
POST /optimiser/auto-optimize
  │
  ├─ [1] Re-fit ML models (if stale)
  ├─ [2] Formulate MILP: 50 vessels × 10 berths × 72h
  ├─ [3] Solve via CBC (~3-5 seconds)
  ├─ [4] Generate prescriptive recommendations
  └─ [5] Return result (PENDING_APPROVAL)
  │
  ▼
Frontend shows proposal banner with Before/After metrics
  │
  ├─ User clicks "Preview" → Map & Table show proposed schedule
  ├─ User clicks "Inspect" → See all 50 assignments
  │
  ▼
User clicks "Confirm & Apply All"
  │
  ▼
POST /optimiser/auto-optimize/{id}/confirm
  │
  ├─ Batch SQL CASE update (50 vessels in ~4.5s)
  ├─ Publish ASSIGNMENT_CHANGED → ML models invalidate
  ├─ Record audit log
  └─ Return success
  │
  ▼
Frontend refreshes all data → Schedule is live
```

---

## 6. Manual Vessel Reassignment

**Roles**: Admin, Terminal Manager, Shift Supervisor

### Step 6.1: User Opens Override Modal
**Frontend**: User clicks "Reassign" on any vessel card in the Operations Plan, Live Queue, or Terminal Map. The `ManualOverrideModal` opens.

### Step 6.2: Client-Side Pre-Flight Checks
**Frontend** (`ManualOverrideModal.tsx`): As the user selects a vessel and target berth, instant validation runs:
- **Draft Check**: `vessel.draft_m <= berth.draft_limit_m` — if violated: "HARD CONSTRAINT VIOLATION: Grounding risk!"
- **Length Check**: `vessel.length_m <= berth.length_m` — if violated: "Vessel exceeds quay length!"
- **Occupancy Check**: Flags if another vessel is currently berthed.
- If any hard violation exists, the Submit button is disabled.

### Step 6.3: AI Quick-Fix Banner
**Frontend**: Automatically scans all berths to find the best unoccupied, draft-safe, length-compatible berth. Displays:
- "Suggested Optimal Quay: Berth 03 Quay (B-03) — Safe UKC Clearance · 0 Collisions"
- **"⚡ Reassign Directly to B-03"** button for 1-click execution.
- Compatible berth pills with **"⚡ Direct"** buttons for instant reassignment.

### Step 6.4: User Submits Override
**Frontend**: Fills in Vessel, Target Berth, Revised Start Time, and Operational Justification. Clicks "Submit Override".
**API**: `POST /api/v1/optimiser/override`

### Step 6.5: Backend Validates & Processes
**Backend** (`override_guard.py`):
1. **Draft Safety Check**: Rejects if `vessel.draft > berth.draft_limit`.
2. **Length Safety Check**: Rejects if `vessel.length > berth.length`.
3. **Temporal Collision Detection**: Queries all vessels assigned to the target berth and checks for time-window overlaps with the proposed docking period.
4. **If Valid**: Updates the vessel record in Supabase (`assigned_berth_id`, `status = BERTHED`). Publishes `ASSIGNMENT_CHANGED`. Records audit log. Returns `{ is_valid: true, status: "APPROVED" }`.
5. **If Invalid**: Returns `{ is_valid: false, status: "REJECTED_HARD_CONSTRAINT", violations: [...], suggested_resolutions: [...] }`.

### Step 6.6: Conflict Resolution (If Rejected)
**Frontend**: If rejected, the modal automatically switches to the **RESOLUTIONS tab** showing backend-generated alternatives:
- **ALTERNATIVE_BERTH**: "Schedule at Berth 06 Quay starting 2026-09-19 16:00"
- **DEFERRED_TIME_WINDOW**: "Delay to 2026-09-20 08:00 when Berth 04 is clear"

Each resolution has two buttons:
- **"⚡ Accept & Reassign Directly"**: Immediately executes the suggestion via the API.
- **"Edit in Form"**: Populates the form with suggested values for fine-tuning.

```
Manual Override Flow:
User clicks "Reassign" on vessel card
  │
  ▼
ManualOverrideModal opens
  ├─ Client-side draft/length/occupancy checks
  ├─ AI Quick-Fix banner suggests best berth
  ├─ User fills form or clicks "⚡ Direct Reassign"
  │
  ▼
POST /optimiser/override
  │
  ├─ Backend validates draft, length, collisions
  │
  ├─ IF VALID:
  │   ├─ Update vessel in Supabase
  │   ├─ Publish ASSIGNMENT_CHANGED
  │   ├─ Record audit log
  │   └─ Return APPROVED
  │
  └─ IF INVALID:
      ├─ Return violations + suggested_resolutions
      └─ Frontend shows RESOLUTIONS tab
           ├─ "⚡ Accept & Reassign Directly"
           └─ "Edit in Form"
```

---

## 7. Congestion Heatmap

**Tab**: `heatmap` | **Roles**: Terminal Manager, Admin | **Component**: `CongestionHeatmap.tsx`

### What the User Sees
A 72-hour probabilistic occupancy matrix: 10 berths (rows) × 24 hourly time slots (columns). Each cell is color-coded:
- **GREEN [L]**: Normal operations (<60% occupancy probability)
- **AMBER [M]**: Elevated risk (60-85%)
- **RED [H]**: Critical bottleneck (>=85%, Sev-1)

Summary cards show: total RED hours, total AMBER hours, peak risk window, and calibration status.

### User Actions
- Toggle horizon: 24h, 48h, or 72h.
- Click any cell to open an **Explainability Drawer** showing: point probability, 80% confidence interval, expected vessel, and SHAP-style factor attributions (e.g., "fairway_queue_depth: +18%", "crane_availability: +12%").

### Backend Processing
**API**: `GET /api/v1/risk/heatmap?horizon=72`
**Backend** (`risk_engine.py` + `occupancy_model.py`):
1. Checks in-memory TTL cache (25s). If fresh, returns cached result instantly (~11ms).
2. If stale: runs a 720-step hourly simulation. For each berth at each hour, evaluates the probability of vessel overlap using the fitted occupancy model.
3. Categorizes each cell into GREEN/AMBER/RED tiers with confidence intervals.
4. Computes summary statistics (critical berths, peak window).
5. Caches result and returns.

---

## 8. Prescriptive Actions

**Tab**: `recommendations` | **Roles**: Shift Supervisor, Terminal Manager, Admin | **Component**: `RecommendationFeed.tsx`

### What the User Sees
A feed of AI-generated intervention cards, each containing:
- **Action Type**: DIVERSION, SLOW_STEAM, or PRIORITY_RESEQUENCE.
- **Summary**: "Divert vessel MSC Oscar from B-01 to B-06 to relieve congestion".
- **Grounded Rationale**: Explains why this action is recommended based on current port state.
- **Financial Impact Box**: Demurrage saved ($), Bunker fuel saved ($), CO2 avoided (mt), Net benefit ($).
- **Confidence Score**: ML model certainty (e.g., 87%).

### User Actions
- Filter by status: ALL, PENDING, ACCEPTED, REJECTED.
- **"Accept & Re-route"**: Approves the recommendation.
- **"Reject"**: Dismisses the recommendation with notes.
- **Vessel Planner**: Sees the feed in read-only mode with a "View Only" badge.

### Backend Processing
**API**: `POST /api/v1/recommendations/{id}/action` with `{ action: "ACCEPT"|"REJECT", notes: "..." }`
**Backend** (`routers/recommendations.py`):
1. Updates the recommendation status in the solver result cache.
2. If accepted, may trigger berth reassignment logic.
3. Records audit log entry with actor, role, and action payload.
4. Publishes `DATA_CHANGED` on the event bus.

---

## 9. Berth Allocator & Sandbox

**Tab**: `optimiser` | **Roles**: Vessel Planner (view-only), Terminal Manager, Admin

### Gantt Schedule (`BerthScheduleGantt.tsx`)
Displays the MILP solver output as a visual berth-by-berth Gantt chart. Shows solver status, solve time, scheduled vessel count, average wait, total demurrage, and crane utilization.

**Actions**:
- **"Auto-Optimize Schedule"** (Admin/Manager only): Triggers `POST /optimiser/run`.
- **"Manual Override"**: Opens the ManualOverrideModal.
- Click any vessel block to see physical constraint verification (draft and length compliance).

### What-If Simulator (`WhatIfSimulator.tsx`)
A non-destructive sandbox for testing hypothetical scenarios without affecting the live schedule.

**User actions**: Select a vessel, alternative berth, and slow-steaming speed (1.0-6.0 knots). Click "Simulate Scenario".
**API**: `POST /api/v1/optimiser/whatif`
**Backend**: Runs the solver with modified parameters in an isolated copy. Returns Before vs Simulated metrics: wait time delta, demurrage delta, utilization delta, and clash count.

---

## 10. Terminal Map

**Tab**: `map` | **Roles**: All 4 roles | **Component**: `VesselMap.tsx`

### What the User Sees
Full-width interactive Leaflet radar map centered on Port of Los Angeles. Features:
- **Berth Markers**: 10 quay positions along the shoreline, color-coded by occupancy.
- **Vessel Markers**: Clustered ship icons color-coded by status (Green=Berthed, Amber=Anchored, Blue=Scheduled).
- **Vessel Trails**: Historical position breadcrumbs (last 5 positions) for anchored/scheduled ships.
- **Congestion Heat Zones**: Regional heat overlay showing high-risk areas.
- **Layer Toggles**: Enable/disable vessel trails, heatmap overlay, and berth labels.

### User Actions
Click any vessel marker to open a dossier panel showing IMO, class, dimensions, status, ETA, predicted delay, and a "Manual Override →" button.

---

## 11. Live Queue

**Tab**: `live` | **Roles**: All 4 roles | **Component**: `LiveStatusTable.tsx`

### What the User Sees
- **Top Metrics Bar**: Total vessels tracked (berthed/anchored/scheduled), berths occupied, yard TEU utilization, telemetry sync status.
- **Fleet Table**: Filterable by status, class, and text search. Columns: Vessel/IMO, Class, Cargo TEU, Dimensions, Carrier ETA, **ML-Predicted ETA** (with delay badge showing +hours), ML confidence %, delay factors, Status, and Berth Fit icon.
- **Berths Tab**: Grid of 10 berth infrastructure cards.

### Shock Injection
1-click buttons to inject operational shocks: "Crane Outage", "Mega Ship Surge", "Tidal Restriction", and "Reset to Baseline".

**Backend**: `POST /ingestion/shock-event?event_type=crane_outage` → modifies port data → publishes `DATA_CHANGED` → ML models re-predict on next request.

---

## 12. Delay Simulation

**Tab**: `cascade` | **Roles**: All 4 roles | **Component**: `CascadeDelaySimulator.tsx`

### What the User Sees
A sandbox for simulating how an upstream berth delay ripples through downstream scheduled vessels.

### User Actions
1. Select a target vessel from the dropdown.
2. Set the simulated delay slip (0.5 to 48 hours).
3. Click "Run Cascade Simulation".

### Backend Processing
**API**: `POST /api/v1/simulate/cascade` with `{ vessel_id, delay_hours }`
**Backend**: Propagates the delay through all downstream vessels sharing the same berth or dependent scheduling chain. Returns: impacted vessel count, total cumulative displacement hours, and per-vessel impact table (original ETA, new projected time, ripple slip, conflict type).

---

## 13. Activity Log

**Tab**: `audit` | **Roles**: Terminal Manager, Admin only | **Component**: `ActivityLogView.tsx`

### What the User Sees
Immutable audit trail of all operator actions. Columns: Timestamp, Operator (@admin, @supervisor), Action badge, Entity Target, Correlation ID, and human-readable description.

### Filtering & Scoping
- Filter by entity type (BERTH, VESSEL, RECOMMENDATION, SOLVER, OVERRIDE).
- Search by actor name or correlation ID.
- Click any row to open a Snapshot Drawer showing full JSON payload.
- **Admin** sees all system-wide logs. **Terminal Manager** sees only their own actions.

### Backend Processing
**API**: `GET /api/v1/audit/logs?limit=100&offset=0`
**Backend** (`routers/audit.py`):
- Admin query: `SELECT * FROM audit_log ORDER BY timestamp DESC`.
- Manager query: `SELECT * FROM audit_log WHERE actor = :username`.
- Vessel Planner: Access denied (403).

---

## 14. Forecast Benchmarks

**Tab**: `ml_metrics` | **Roles**: Terminal Manager, Admin only | **Component**: `MLMetricsView.tsx`

### What the User Sees
Model evaluation dashboard comparing PortPulse ML models against naive operational baselines:

| Model | Metric | Baseline | Trained Model | Improvement |
| :--- | :--- | :--- | :--- | :--- |
| ETA Correction | MAE (hours) | 1.59 | 1.18 | -26.1% |
| ETA Correction | RMSE (hours) | 1.95 | 1.69 | -13.5% |
| Occupancy Forecast | Brier Score | (baseline) | (trained) | (improvement) |

Includes methodology notes: 70/30 temporal split, zero future data leakage, Brier score calibration.

**API**: `GET /api/v1/forecast/metrics`

---

## 15. AI Chat Assistant

**Accessible via**: Navbar "Ask AI" button (all roles) | **Component**: `ChatAssistantDrawer.tsx`

### What the User Sees
A slide-in right drawer with the PortPulse AI Copilot. Features suggested starter questions like "Which berths are congested?" and an interactive chat thread.

### Backend Processing
**API**: `POST /api/v1/chat/query` with `{ query: "..." }`
**Backend** (`supabase_rag.py`):
1. **Domain Grounding**: Queries live Supabase tables (vessel queue, red-tier quays, crane status, active bottlenecks).
2. **Prompt Construction**: Injects live port state as context into a structured system prompt.
3. **LLM Inference**: Sends to Groq Cloud LLM (`openai/gpt-oss-120b`).
4. **Output Sanitization** (`sanitizer.py`): Strips HTML tags, scripts, iframes, and prompt injection attempts from the LLM response.
5. Returns the sanitized answer with grounding citations.

---

## 16. Master Data Management

**Accessible via**: Navbar "Master Data" button | **Roles**: Admin only (others see read-only) | **Component**: `MasterDataModal.tsx`

### Three Sub-Tabs

**Berths Master**:
- View all 10 berths in a table.
- Admin can add a new berth (ID, Name, Length, Draft Limit, Crane Slots) or delete existing berths.
- Client-side validation: Length and Draft must be > 0.
- **Backend**: `POST /master-data/berths` → creates berth in Supabase → publishes `DATA_CHANGED` → ML models invalidate.

**Vessel Manifest**:
- View all 50 vessels.
- Admin can register a new vessel (IMO, Name, Class, Cargo TEU, Length, Draft, Priority, Assigned Berth) or delete vessels.
- Real-time UKC compatibility pre-check against selected berth.
- **Backend**: `POST /master-data/vessels` → validates dimensions → creates vessel → publishes `DATA_CHANGED`.

**CSV Import/Export Engine**:
- See Section 17 below.

---

## 17. CSV Import & Export

### Export (All authorized roles)
- **Berths CSV**: `GET /master-data/export/berths.csv` → Downloads berth master data.
- **Vessels CSV**: `GET /master-data/export/vessels.csv` → Downloads vessel manifest.
- **Operations Plan CSV**: `GET /optimiser/export/operations-plan.csv` → Downloads the 72h berthing schedule.

### Import (Admin only)
- **Berths CSV Import**: Drag-and-drop or paste CSV content → `POST /master-data/import/berths`.
- **Vessels CSV Import**: Drag-and-drop or paste CSV content → `POST /master-data/import/vessels`.

**Backend** (`routers/csv_data.py`):
1. Parses and validates each CSV row against the entity schema.
2. Upserts valid rows into Supabase.
3. Returns success/error counts and row-level error details.
4. Publishes `DATA_CHANGED` → ML models invalidate and re-predict.

---

## 18. Role-Based Access Control Matrix

| Feature / Tab | Admin | Terminal Manager | Shift Supervisor | Vessel Planner |
| :--- | :---: | :---: | :---: | :---: |
| **72h Operations Plan** | Full | Full | Full | View Only |
| **Congestion Heatmap** | Full | Full | Hidden | Hidden |
| **Prescriptive Actions** | Accept/Reject | Accept/Reject | Accept/Reject | View Only |
| **Berth Allocator & Sandbox** | Full | Full | Hidden | View Only |
| **Terminal Map** | Full | Full | Full | Full |
| **Live Queue** | Full | Full | Full | Full |
| **Delay Simulation** | Full | Full | Full | Full |
| **Activity Log** | All Logs | Own Logs | Hidden | Hidden |
| **Forecast Benchmarks** | Full | Full | Hidden | Hidden |
| **Auto-Optimizer Run** | Yes | Yes | No | No |
| **Auto-Optimizer Confirm** | Yes | Yes | No | No |
| **Manual Override** | Yes | Yes | Yes | No |
| **Master Data CRUD** | Full | Read Only | Hidden | Hidden |
| **CSV Import** | Yes | No | No | No |
| **User Management** | Yes | No | No | No |
| **AI Chat Assistant** | Yes | Yes | Yes | Yes |

---

## Complete Request Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Browser)                           │
│                                                                 │
│  1. Login ──────────────> POST /auth/login ──> JWT Token        │
│  2. Dashboard Load ────> GET /status/table ──> Vessels, Berths  │
│                    ────> GET /risk/heatmap ──> 72h Heatmap      │
│                    ────> GET /forecast/anchorage ──> Queue      │
│                    ────> GET /recommendations ──> Actions       │
│                    ────> GET /optimiser/plan ──> Schedule        │
│  3. Auto-Optimize ────> POST /optimiser/auto-optimize           │
│     Confirm ──────────> POST /optimiser/auto-optimize/ID/confirm│
│  4. Manual Override ──> POST /optimiser/override                │
│  5. Accept Rec ───────> POST /recommendations/ID/action         │
│  6. What-If ──────────> POST /optimiser/whatif                  │
│  7. Cascade Sim ──────> POST /simulate/cascade                  │
│  8. AI Chat ──────────> POST /chat/query                        │
│  9. Master Data ──────> GET/POST/DELETE /master-data/*           │
│ 10. CSV Import ───────> POST /master-data/import/*              │
│ 11. Audit Logs ───────> GET /audit/logs                         │
│ 12. ML Metrics ───────> GET /forecast/metrics                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (Port 8000)                   │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Auth &   │  │  Status  │  │ Optimiser│  │   Chat   │       │
│  │   RBAC    │  │  Router  │  │  Router  │  │  Router  │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │              │              │              │             │
│       ▼              ▼              ▼              ▼             │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              Services Layer                          │       │
│  │                                                      │       │
│  │  ML Risk Engine ◄──── Event Bus ────► Audit Logger   │       │
│  │  (ETA Model,         (DATA_CHANGED,   (actor, role,  │       │
│  │   Occupancy Model,    ASSIGNMENT_      entity,        │       │
│  │   TTL Cache)          CHANGED)         payload)       │       │
│  │                                                      │       │
│  │  MILP Solver ◄───── Override Guard ──► Sanitizer     │       │
│  │  (PuLP/CBC,          (Collision        (XSS strip,   │       │
│  │   Batch SQL)          Detection)        clamp values) │       │
│  └──────────────────────┬───────────────────────────────┘       │
│                         │                                       │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────┐       │
│  │         Supabase PostgreSQL (Cloud)                  │       │
│  │         8 Tables, PgBouncer Pool, Port 6543          │       │
│  └──────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

*Generated for the IBM BoB AI Hackathon 2026 — PortPulse (PC Pirates)*
