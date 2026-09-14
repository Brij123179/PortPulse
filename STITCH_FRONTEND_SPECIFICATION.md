# PortPulse: Google Stitch Frontend Design & Component Specification
### Master Blueprint for AI-Generated Maritime Operating System (PortPulse Cockpit)

> **Purpose**: This specification provides a comprehensive, component-by-component, screen-by-screen architectural and visual blueprint for **Google Stitch** (and UI generation engines). It details every layout, data token, interactive state, visual hierarchy, and telemetry display required to render the state-of-the-art **PortPulse Maritime Cockpit**.

---

# Table of Contents
1. [Stitch Design System Tokens (`DESIGN.md` Compatible)](#1-stitch-design-system-tokens)
2. [Global Application Shell & Navigation](#2-global-application-shell--navigation)
3. [Page 1: 72h Operations Plan & Shift Cockpit (`plan`)](#3-page-1-72h-operations-plan--shift-cockpit)
4. [Page 2: Terminal Vessel Map & Quayside GIS (`map`)](#4-page-2-terminal-vessel-map--quayside-gis)
5. [Page 3: 72h Congestion Heatmap & Timeline Forecast (`heatmap`)](#5-page-3-72h-congestion-heatmap--timeline-forecast)
6. [Page 4: Prescriptive AI Actions & Recommendation Feed (`recommendations`)](#6-page-4-prescriptive-ai-actions--recommendation-feed)
7. [Page 5: Berth Allocator & What-If Simulation Sandbox (`optimiser`)](#7-page-5-berth-allocator--what-if-simulation-sandbox)
8. [Page 6: Live Vessel Queue & Anchorage Telemetry (`live`)](#8-page-6-live-vessel-queue--anchorage-telemetry)
9. [Page 7: Cascade Delay Simulator (`cascade`)](#9-page-7-cascade-delay-simulator)
10. [Page 8: Activity Log & Compliance Audit Trail (`audit`)](#10-page-8-activity-log--compliance-audit-trail)
11. [Page 9: Forecast Benchmarks & ML Model Observatory (`ml_metrics`)](#11-page-9-forecast-benchmarks--ml-model-observatory)
12. [Page 10: Executive Shift Briefing Document (`briefing`)](#12-page-10-executive-shift-briefing-document)
13. [Page 11: Mobile Quayside Floor Companion (`mobile`)](#13-page-11-mobile-quayside-floor-companion)
14. [Global Modals, Drawers & Flyouts](#14-global-modals-drawers--flyouts)
15. [Copy-Paste Google Stitch Screen Prompts](#15-copy-paste-google-stitch-screen-prompts)

---

# 1. Stitch Design System Tokens

```yaml
---
name: PortPulse Maritime Cockpit
colors:
  # Base Surface Canvas (24/7 Control Room Deep Dark & High Contrast Slate)
  background: '#060a12'
  surface: '#0b1322'
  surface-low: '#080d18'
  surface-card: '#0f1b2e'
  surface-card-hover: '#16253e'
  surface-elevated: '#1a2a44'
  surface-border: '#1e3252'
  surface-border-accent: '#2563eb'

  # Core Brand & Primary Maritime
  primary: '#0ea5e9'            # Electric Maritime Cyan / Ocean Blue
  primary-glow: 'rgba(14, 165, 233, 0.25)'
  primary-container: '#0284c7'
  on-primary: '#ffffff'
  secondary: '#38bdf8'          # Bright Sky / Berth Available
  secondary-container: '#0369a1'

  # Status & Congestion Tiers (Strict Safety Tonal Mapping)
  status-low: '#10b981'         # Emerald 500 (Free flowing / Normal / Green)
  status-low-bg: 'rgba(16, 185, 129, 0.12)'
  status-medium: '#f59e0b'      # Amber 500 (Moderate Congestion / Attention / Amber)
  status-medium-bg: 'rgba(245, 158, 11, 0.12)'
  status-high: '#ef4444'        # Coral Red 500 (Severe Congestion / Urgent / Red)
  status-high-bg: 'rgba(239, 68, 68, 0.15)'
  status-info: '#6366f1'        # Indigo (AI Prediction / Prescriptive Intelligence)

  # Vessel State Semantic Markers
  vessel-moored: '#10b981'      # Moored at Berth
  vessel-transit: '#38bdf8'     # Inbound / Approach Transit
  vessel-anchorage: '#f59e0b'   # Waiting in Outer Anchorage
  vessel-delayed: '#ef4444'     # Critical Schedule Drift (>4h delay)
  vessel-priority: '#a855f7'    # Reefer / Hazardous / Priority Contract

  # Typography Colors
  text-primary: '#f1f5f9'       # Slate 100
  text-secondary: '#94a3b8'     # Slate 400
  text-muted: '#64748b'         # Slate 500
  text-highlight: '#38bdf8'     # Cyan highlight

typography:
  display-hero:
    fontFamily: Inter, -apple-system, sans-serif
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter, -apple-system, sans-serif
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter, -apple-system, sans-serif
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-md:
    fontFamily: Inter, -apple-system, sans-serif
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter, -apple-system, sans-serif
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  mono-data:
    fontFamily: 'JetBrains Mono', 'Geist Mono', monospace
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  mono-kpi:
    fontFamily: 'JetBrains Mono', 'Geist Mono', monospace
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 28px

rounded:
  sm: 4px
  DEFAULT: 8px
  md: 10px
  lg: 12px
  xl: 16px
  pill: 9999px

spacing:
  unit: 4px
  topbar-height: 56px
  sidebar-width: 240px
  panel-padding: 16px
  card-gap: 12px
  grid-gutter: 16px
---
```

### Aesthetic Reference & Rules:
1. **24/7 Port Control Room Ergonomics**: Pure black/navy slate base `#060a12` with subtle borders (`#1e3252`), preventing eye fatigue during night shifts while ensuring 100% readability under ambient glare.
2. **Dual Accessibility Principle**: Never use color alone to communicate state. Every status dot must be accompanied by an icon and an explicit text pill (e.g., `[● RED] High Congestion (0.84)`).
3. **Telemetry Density with Breathing Room**: Information-dense cards with structured tabular grids, sharp monospaced telemetry figures (coordinates, TEU, drafts, timestamps in `JetBrains Mono`), and clear visual hierarchy.
4. **Glassmorphism & Cyber-Maritime Glow**: Translucent card backdrops (`backdrop-filter: blur(12px)`), soft cyan/amber edge highlights on hovered cards, and tactical radar rings for map markers.

---

# 2. Global Application Shell & Navigation

## A. Master Topbar Header (`56px` height)
The topbar is pinned to the top of the viewport across all views. It anchors global operational state:
1. **Brand Identity**:
   - Animated PortPulse Radar Logo (dual rotating radar ring icon in Electric Cyan `#0ea5e9`).
   - Title: **PortPulse** `Maritime OS`.
   - Port Selector Dropdown: `Port of Los Angeles (Pier 400 / APM)` with quick switch to `Long Beach (LBCT)` and `Rotterdam (World Gateway)`.
2. **Simulation Clock & Replay HUD (Centered)**:
   - **Simulated Time Display**: `15 OCT 2025 • 14:30 UTC` (Local: `07:30 PDT`) in monospaced cyan text.
   - **Time Controller**:
     - Play / Pause toggle button with pulsating pulse ring when active.
     - Step Backward (`-30m`) and Step Forward (`+30m`) buttons.
     - Speed Multiplier Chips: `[1x]` `[2x]` `[5x]` `[10x]`.
     - Timeline scrub bar with elapsed time percentage indicator.
3. **ML Service Heartbeat Indicator**:
   - Status Pill: `[● LIVE] ML Inference Engine (v2.4-XGBoost) • Latency: 38ms • Horizon: 72h`.
   - Green beacon dot that blinks on every periodic inference tick.
4. **Active Shift & Role Selector Pill**:
   - Displays current shift: `Shift 2 (Day Shift: 07:00 - 19:00)`.
   - Role Switcher Modal Dropdown:
     - `Shift Supervisor` (Default cockpit, approvals, overrides)
     - `Vessel Planner` (Berth allocator, sandbox, what-if simulator)
     - `Terminal Manager` (Strategic heatmap, bottleneck analytics, executive briefing)
     - `Admin / Port Engineer` (Master data, crane calibration, telemetry API)
5. **Global Utility Actions (Right-aligned)**:
   - **Global Search (`Cmd+K`)**: Instant search dialog matching Vessel IMO, Vessel Name, Berth Code (`B1-B6`), Shipping Line, or Container Bill of Lading.
   - **Notification Bell**: Red badge indicator with counter (`3 Critical Alerts`) opening the Notifications Panel.
   - **Copilot Quick Trigger**: Purple gradient pill button: `Ask Copilot ✨`.
   - **User Profile Avatar**: Badge indicating operator initials (`NP`), role, and quick settings menu.

## B. Persistent Left Navigation Rail (`240px` expanded / `64px` collapsed)
1. **Primary Navigation Tabs**:
   - `[CalendarDays]` **72h Operations Plan** (Badge: `LIVE`) — Tab ID: `plan`
   - `[MapPin]` **Terminal Vessel Map** (Badge: `12 Active`) — Tab ID: `map`
   - `[Layers]` **72h Congestion Heatmap** (Badge: `Peak 18h`) — Tab ID: `heatmap`
   - `[Compass]` **Prescriptive Actions** (Badge: `3 Pending`, Red highlight) — Tab ID: `recommendations`
   - `[SlidersHorizontal]` **Berth Allocator & Sandbox** — Tab ID: `optimiser`
   - `[Activity]` **Live Queue & Telemetry** (Badge: `7 Anchored`) — Tab ID: `live`
   - `[GitPullRequest]` **Cascade Delay Simulator** — Tab ID: `cascade`
   - `[FileText]` **Activity Log & Audit** — Tab ID: `audit`
   - `[Target]` **Forecast Benchmarks & ML** — Tab ID: `ml_metrics`
2. **Bottom Utility Dock**:
   - `[FileSpreadsheet]` **Generate Shift Briefing** (Quick export button)
   - `[Database]` **Master Terminal Data** (Berths, cranes, pilots config)
   - `[HelpCircle]` **Guided Interactive Tour**
   - `[Sun/Moon]` **Light / Dark Theme Switcher**

---

# 3. Page 1: 72h Operations Plan & Shift Cockpit (`plan`)
*Target User: Shift Supervisor & Terminal Operations Manager*
*Goal: Complete 360-degree situational awareness of the port over the upcoming 72 hours.*

```
+----------------------------------------------------------------------------------------------------+
| TOPBAR: PortPulse | Port of LA | 15 OCT 14:30 UTC [> Play 2x] | ML Live (38ms) | Role: Supervisor  |
+----------------------------------------------------------------------------------------------------+
| NAV  | [ KPI RIBBON: 4 Key Metric Metric Tiles (Congestion, Berths, Queue, Turnaround)           ] |
| RAIL |---------------------------------------------------------------------------------------------|
|      | [ LEFT (70%): 72-HOUR BERTH SCHEDULE GANTT CHART                                          ] |
|      |   - Berth rows (B1 - B6) with timeline columns (Now -> +72h)                                |
|      |   - Drag-and-drop vessel schedule blocks with delay indicators & crane icons                |
|      |---------------------------------------------------------------------------------------------|
|      | [ RIGHT (30%): LIVE PRESCRIPTIVE DISPATCH FEED                                            ] |
|      |   - Urgent Action Cards (e.g., Swap Berth B2 -> B4 to save 3.5h delay)                      |
|      |   - Accept / Modify / Reject one-click buttons with simulated cost delta                    |
|      |---------------------------------------------------------------------------------------------|
|      | [ BOTTOM: QUAYSIDE SPATIAL FOOTPRINT & REAL-TIME VESSEL BERTHING OVERVIEW                  ] |
+----------------------------------------------------------------------------------------------------+
```

### Component Breakdown:
1. **Executive KPI Stat Ribbon (Top 4 Metric Cards)**:
   - **Card 1: Current Port Congestion Score**:
     - Large Monospace Value: `0.74` / `1.00`.
     - Visual Gauge: Color-coded progress bar (Green < 0.4, Amber 0.4-0.7, Red > 0.7).
     - Sub-text: `▲ +0.12 vs last shift • HIGH TIER PEAK EXPECTED IN 14H`.
   - **Card 2: Berth Utilization**:
     - Large Value: `83.3%` (`5 / 6 Berths Active`).
     - Sub-indicators: `B1 [Active]`, `B2 [Congested]`, `B3 [Maintenance]`, `B4-B6 [Active]`.
   - **Card 3: Anchorage Queue Depth**:
     - Large Value: `7 Vessels Waiting`.
     - Breakdown: `Avg Wait: 8.4 hrs • Demurrage Exposure: $142,000`.
   - **Card 4: 72h Predicted Turnaround Efficiency**:
     - Large Value: `26.4 hrs / vessel` (`Goal: < 24.0 hrs`).
     - Tag: `3 Schedule Clashes Detected`.

2. **72-Hour Berth Schedule Interactive Gantt View**:
   - **Header Controls**:
     - Time Zoom selector: `[12h]` `[24h]` `[48h]` `[72h (Default)]`.
     - Filter By Berth Type: `All Berths`, `Container Only`, `Ultra-Large (14k+ TEU)`.
     - "Show Maintenance Windows" & "Show Tide Restrictions" checkboxes.
   - **Gantt Matrix**:
     - Y-Axis: Berth Rows (`Berth 1 [Max 366m]`, `Berth 2 [Max 400m]`, `Berth 3 [Crane Repair]`, `Berth 4 [Max 300m]`, `Berth 5 [Max 350m]`, `Berth 6 [Max 400m]`).
     - X-Axis: 72-Hour Time Ruler with Day Dividers (`Today 15 Oct`, `Tomorrow 16 Oct`, `Thu 17 Oct`, `Fri 18 Oct`) and vertical red dashed "NOW" playhead.
     - **Vessel Booking Blocks**:
       - Solid blocks with rounded corners showing: Vessel Name (`EVER GIVEN`), Shipping Line badge (`Evergreen`), TEU count (`20,124 TEU`), and Assigned Cranes badge (`[4 Cranes]`).
       - Status color border: Green (On schedule), Amber (Risk of delay), Red (Delayed/Conflict).
       - Visual Hatching pattern for Crane Maintenance or Dredging outage windows.
       - Interactivity: Click on block opens Vessel Details Flyout; Hover shows detailed ETD, gang productivity (moves/hour), and assigned pilot.

3. **Live Prescriptive AI Dispatch Feed (Right Column)**:
   - Header with active count: `AI Recommendations (2 Urgent, 1 Advisory)`.
   - **Recommendation Cards**:
     - **Card A (High Priority Alert)**:
       - Header: `CRITICAL: Berth Conflict Detected at Berth 2`.
       - Message: `CMA CGM Antoine arrives 16:00 (+2h weather delay), overlapping with MSC Oscar departure window.`
       - Prescriptive Solution: `Reassign CMA CGM Antoine to Berth 4; Allocate 1 additional mobile crane.`
       - Impact Prediction: `Avoids 4.2h anchorage queue • Saves $48,500 demurrage • Port Congestion -0.14`.
       - Action Buttons: `[✓ Accept & Dispatch]` `[✎ Modify]` `[✕ Dismiss]`.
       - Link: `Explain Why (SHAP Analysis)`.

4. **Quayside Spatial Footprint (Bottom Pane)**:
   - Interactive miniature schematic showing the linear physical quay (Length: `2,200m`).
   - Visual vessel hulls scaled to actual LOA (Length Overall) berthed along the quayside.
   - Physical quay crane icons positioned over vessel cargo holds with live spreader moves counter.

---

# 4. Page 2: Terminal Vessel Map & Quayside GIS (`map`)
*Target User: Quayside Dispatcher, Harbor Pilot Coordinator & Shift Supervisor*
*Goal: Real-time geospatial tracking of all vessels in port, approach channels, and anchorage zones.*

```
+----------------------------------------------------------------------------------------------------+
| HUD CONTROLS: [Layers Toggle] [Trails: ON] [Heatmap Overlay: ON] [Labels: ON] [Recenter Port]      |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    ~ ~ ~ OUTER ANCHORAGE ~ ~ ~                     [ FLOATING VESSEL DETAIL DRAWER ]               |
|      (Cluster Badge: 5 Vessels)                    | Vessel: MAERSK MC-KINNEY MOLLER               |
|       [Amber Ring Marker]                          | IMO: 9619907 • Flag: Denmark                  |
|                                                    | TEU: 18,270 • Draft: 15.2m                    |
|             \                                      | Speed: 12.4 kts • Heading: 082°               |
|              \ Approach Channel                    | Status: APPROACHING (ETA: 16:45 UTC)          |
|               \  (AIS Trail Polyline)              | Target: Berth 2 • Wait Time: 0.0h             |
|                v                                   | Delay Risk: HIGH (Demurrage: $32k)            |
|       +-------------------------------+            | ML Driver: Berth 2 Crane 3 Outage             |
|       | QUAYSIDE BERTHS (B1 - B6)     |            | [ Reassign Berth ]  [ Radio Pilot ]           |
|       |  [B1: Green] [B2: Red Alert]  |            +-----------------------------------------------+
|       |  [B3: Sky]   [B4: Green]      |                                                            |
|       +-------------------------------+                                                            |
|             (Radial Congestion Heatmap)                                                            |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
| BOTTOM FILTER BAR: [ All (14) ] [ Moored (5) ] [ Anchorage (7) ] [ In-Transit (2) ] [ High Risk (3) ] |
+----------------------------------------------------------------------------------------------------+
```

### Component Breakdown:
1. **Interactive CartoDB / Leaflet Maritime GIS Canvas**:
   - Dark-mode nautical base tiles (`CartoDB DarkMatter` or custom vector nautical style).
   - Navigation channels, separation schemes, breakwaters, and berth boundaries clearly outlined in neon slate and cyan.

2. **Berth Geospatial Polygons & Circular Anchor Zones**:
   - Each berth (`B1` to `B6`) rendered as a distinct quayside polygon and circle marker.
   - **Color Logic**:
     - `Emerald (#10b981)`: Moored vessel operating on schedule.
     - `Coral Red (#ef4444)`: Berth with high congestion risk (> 0.70) or turnaround delay.
     - `Sky Blue (#38bdf8)`: Available berth ready for berthing.
     - `Muted Gray (#475569)`: Offline / Maintenance / Dredging.
   - Click opens Berth Telemetry Popup: Length, draft depth, current crane assignments, next scheduled arrival.

3. **Live AIS Vessel Markers & Dynamic Heading Arrows**:
   - Vessel icons shaped as directional ship silhouettes oriented according to actual AIS compass heading.
   - Visual size scaled to vessel class (Feeder: 12px, Panamax: 18px, Ultra-Large Container Vessel: 26px).
   - Color coded by operational status:
     - `Cyan`: In-Transit approaching port.
     - `Emerald`: Moored at berth.
     - `Amber`: In Outer Anchorage awaiting berth allocation.
     - `Purple`: Priority high-value cargo flag (Reefers/Pharma).
   - Priority Indicator: Pulsing purple beacon ring for expedited vessels.

4. **AIS Historical Motion Trails**:
   - Polyline breadcrumb trail showing the past 4 hours of GPS movement for vessels underway.
   - Fading gradient opacity behind vessel markers.

5. **Dynamic Anchorage Clustering Engine**:
   - Automatic clustering for dense anchorage coordinates.
   - Cluster badge displays vessel count (`[⚓ 5]`) with expanding radius on zoom.

6. **Real-Time Congestion Heatmap Radial Overlay**:
   - Semi-transparent radial gradient ellipse centered over the port's turning basin and quayside.
   - Dynamically color-shifts:
     - Calm Turquoise when congestion score < 0.40.
     - Warning Amber when congestion score between 0.40 and 0.70.
     - Intense Crimson Red with subtle breathing animation when congestion score > 0.70.

7. **Floating HUD Controls (Top Left & Top Right)**:
   - **HUD Layer Toggles**:
     - `[Trails: ON/OFF]`
     - `[Heatmap: ON/OFF]`
     - `[Berth Labels: ON/OFF]`
     - `[Weather Radar: ON/OFF]` (wind vectors, swell height, tidal current arrows).
   - **Map Navigation Tools**: Zoom in/out, Fullscreen toggle, "Center on Quayside" button.

8. **Slide-Out Vessel Telemetry Drawer (Right Panel)**:
   - Opens when any vessel on the map is clicked:
     - Vessel Photo / Silhouette banner.
     - Vessel Name, IMO Number, Flag State, Destination Port.
     - Technical Specifications: LOA (m), Beam (m), Current Draft (m), Total TEU Capacity.
     - Real-Time Navigation Telemetry: Speed Over Ground (kts), Course Over Ground, Distance to Pilot Station.
     - AI Scheduling Intelligence:
       - Assigned Berth & ETA window.
       - Forecasted Waiting Time in Queue.
       - Demurrage Risk Meter (USD accumulated vs limit).
       - Contributing Congestion Factors (SHAP feature drivers).
     - Operational Actions:
       - `[Direct Berth Reassignment]`
       - `[Contact Harbor Master / Pilot]`
       - `[Flag Priority Override]`.

9. **Bottom Vessel Quick-Filter Strip**:
   - Filter chips: `All Vessels (14)`, `Moored (5)`, `Outer Anchorage (7)`, `Approach Transit (2)`, `High Congestion Risk (3)`.

---

# 5. Page 3: 72h Congestion Heatmap & Timeline Forecast (`heatmap`)
*Target User: Terminal Director, Shift Planning Superintendent*
*Goal: Visual forecast of congestion peaks, bottleneck identification, and root-cause explanation across the full 72-hour planning horizon.*

```
+----------------------------------------------------------------------------------------------------+
| TIMELINE SCRUBBER: 72-HOUR AGGREGATED HORIZONTAL RISK BARS (6-HOUR BUCKETS)                       |
| [Peak Congestion: Thu 02:00-08:00 (Score 0.88)]               [Hover: Shows SHAP Feature Breakdown] |
|                                                                                                    |
|    06:00       12:00       18:00       00:00       06:00       12:00       18:00       00:00       |
|   +----+      +----+      +----+      +----+      +----+      +----+      +----+      +----+       |
|   | 34%|      | 48%|      | 72%|      | 88%|      | 82%|      | 61%|      | 42%|      | 28%|       |
|   |LOW |      |MED |      |HIGH|      |CRIT|      |HIGH|      |MED |      |LOW |      |LOW |       |
|   +----+      +----+      +----+      +----+      +----+      +----+      +----+      +----+       |
|   (Green)    (Amber)      (Red)     (Intense)     (Red)      (Amber)     (Green)     (Green)       |
+----------------------------------------------------------------------------------------------------+
| 72-HOUR BERTH-BY-HOUR RISK MATRIX (HEATMAP GRID)                                                   |
| Filter: [Horizon: 72h v] [Berths: All v]                                  Legend: [■ 0-0.4] [■ 0.4-0.7] [■ >0.7] |
|                                                                                                    |
| Berth   H00  H02  H04  H06  H08  H10  H12  H14  H16  H18  H20  H22  H24  ...  H70  H72            |
| Berth 1 [  ] [  ] [  ] [■■] [■■] [■■] [■■] [  ] [  ] [  ] [  ] [  ] [  ] ...  [  ] [  ]            |
| Berth 2 [■■] [■■] [■■] [██] [██] [██] [██] [██] [■■] [■■] [  ] [  ] [  ] ...  [  ] [  ]            |
| Berth 3 [ MAINT / CLOSED                                          ] [  ] ...  [  ] [  ]            |
| Berth 4 [  ] [  ] [  ] [  ] [  ] [■■] [■■] [■■] [■■] [  ] [  ] [  ] [  ] ...  [  ] [  ]            |
| Berth 5 [  ] [  ] [■■] [■■] [██] [██] [■■] [  ] [  ] [  ] [  ] [  ] [  ] ...  [  ] [  ]            |
| Berth 6 [  ] [  ] [  ] [  ] [  ] [  ] [  ] [  ] [■■] [■■] [■■] [■■] [■■] ...  [  ] [  ]            |
+----------------------------------------------------------------------------------------------------+
| BOTTLENECK ANALYSIS CARDS (3 Critical Windows)   | SHAP FEATURE IMPORTANCE CHART (Top Drivers)     |
| 1. Window: Thu 02:00 - 08:00 (Risk: 0.88)        | - Berth Utilization: ████████████ 45%           |
|    Root Cause: 3 ULCVs overlapping on B2 & B5    | - Anchorage Queue Length: ████████ 28%          |
| 2. Window: Fri 14:00 - 20:00 (Risk: 0.74)        | - Tide & Swell Restrictions: █████ 15%          |
|    Root Cause: High swell slows crane moves      | - Crane 3 Maintenance Downtime: ███ 12%         |
+----------------------------------------------------------------------------------------------------+
```

### Component Breakdown:
1. **Top Horizontal Gantt-Style 72h Timeline Scrubber**:
   - Formatted into 12 distinct 6-hour buckets covering the entire 72h prediction horizon.
   - **Visual Risk Bar Height**: Proportional to predicted congestion score (from 10px minimum to 80px maximum height).
   - **Color Fill**:
     - `Green (#10b981)` for Low risk (`0.00 - 0.39`).
     - `Amber (#f59e0b)` for Medium risk (`0.40 - 0.69`).
     - `Red (#ef4444)` for High risk (`0.70 - 1.00`).
   - Peak Congestion Callout Badge: Highlighted with an alert icon: `⚡ PEAK: Bucket 4 (+24h) - Risk 0.88`.
   - **Interactive Scrub Cursor**: Moving mouse across buckets syncs the active simulation timestamp.
   - **Interactive Hover Popover**: Displays:
     - Exact Time Window: e.g., `16 Oct 06:00 - 12:00 UTC`.
     - Congestion Score: `0.784 (HIGH RISK)`.
     - Forecasted Queue Length: `6 Vessels`.
     - Expected Berth Utilization: `91.6%`.
     - Top Contributing Factors: `Berth utilization (42%)`, `Tidal delay (28%)`.

2. **72-Hour Berth-by-Hour Heatmap Matrix**:
   - Y-Axis: All physical berths (`B1` to `B6`).
   - X-Axis: 72 individual 1-hour time slices labeled every 6 hours.
   - Matrix Cells:
     - Smooth color gradient matching individual berth hour risk.
     - Cell tooltip on hover: `Berth 2 @ +18h: 92% Congested. Assigned: CMA CGM Jean. Crane Rate: 28 moves/hr`.
     - Outage cells styled with diagonal caution stripes.

3. **Bottleneck Risk Cards (Bottom Left)**:
   - Ranked list of top 3 severe congestion periods.
   - Details: Time range, severity level, affected berths, affected shipping lines, expected delay cost in USD.

4. **Global Model Explainability Panel (Bottom Right)**:
   - Horizontal bar chart showing global SHAP feature importance for the active 72h forecast.
   - Factors: Berth Utilization, Queue Length, Vessel Draft vs Channel Depth, Quayside Crane Reliability, Meteorological Swell Index.

---

# 6. Page 4: Prescriptive AI Actions & Recommendation Feed (`recommendations`)
*Target User: Shift Supervisor, Vessel Planner*
*Goal: Review, evaluate, simulate, and execute AI-generated operational recommendations to prevent bottlenecks.*

### Component Breakdown:
1. **Prescriptive Action Queue**:
   - Filterable by: `All Actions`, `Berth Swaps`, `Crane Reallocations`, `Speed Adjustments (Just-In-Time Arrival)`.
   - Sort by: `Maximum Delay Saved`, `Demurrage Saved ($)`, `Urgency / Execution Window`.

2. **Detailed Recommendation Cards**:
   - Each card contains:
     - **Urgency Pill**: `[⚡ URGENT - Execute before 15:30 UTC]` or `[ADVISORY]`.
     - **Title**: e.g., `Early Berth Swap: Ever Golden (B2 -> B4)`.
     - **Before vs After Delta Comparison**:
       - *Current Plan*: Wait in anchorage: `4.5 hrs` • Total Dwell: `32.0 hrs` • Demurrage: `$54,000`.
       - *Recommended Plan*: Wait in anchorage: `0.5 hrs` • Total Dwell: `24.2 hrs` • Demurrage: `$6,000`.
       - *Net Benefit*: `▲ 7.8 hrs Saved • $48,000 Demurrage Prevented • Port Congestion -0.16`.
     - **Operational Rationale & Safety Feasibility**:
       - Verified constraints: Water depth check (`15.5m required vs 16.2m available at B4` - OK), Quay length (`366m LOA vs 400m berth` - OK), Crane outreach (OK).
     - **Action Triggers**:
       - `[✓ Accept & Apply Plan]` (Commits plan to live database, updates Gantt and informs pilots).
       - `[✎ Adjust / What-If]` (Opens the scenario directly in the Simulator).
       - `[✕ Reject with Reason]` (Opens operator feedback prompt for continuous learning).
       - `[🔍 Explain Prediction]` (Opens SHAP waterfall dialog).

---

# 7. Page 5: Berth Allocator & What-If Simulation Sandbox (`optimiser`)
*Target User: Vessel Planner & Operations Research Engineer*
*Goal: Test hypothetical port scenarios, shock events, and schedule modifications before committing changes to the terminal.*

```
+----------------------------------------------------------------------------------------------------+
| SIMULATION SANDBOX CONTROLS                                                                        |
| Preset Scenarios: [Normal] [Fog Disruption (12h)] [Crane 3 Breakdown] [High Wind Squall] [Create]  |
|                                                                                                    |
| Sliders & Parameters:                                                                              |
|  - Vessel Arrival Shock: Ever Given [ -4h ... 0 ... +8h ] (Selected: +3.5h Delay)                  |
|  - Crane Allocation: Berth 2 Cranes [ 1 ] [ 2 ] [ 3 ] [ 4 (Selected) ]                            |
|  - Weather Restriction: Channel Speed Limit [ Normal (14kts) v ]                                   |
|  - Berth Availability: Berth 3 Status [ Active | Forced Maintenance (Toggled) ]                    |
|                                                                                                    |
| [ ⚡ RUN WHAT-IF SIMULATION ]                                           [ Reset to Live Baseline ]  |
+----------------------------------------------------------------------------------------------------+
| SIDE-BY-SIDE SCENARIO COMPARISON MATRIX                                                            |
|                                                                                                    |
| Metric                          Current Baseline         Simulated Scenario         Delta          |
| Total Port Dwell Time           1,420 Hours              1,248 Hours                -172h (12% ▼)  |
| Peak Congestion Score           0.88 (HIGH)              0.68 (MEDIUM)              -0.20 (Safe)   |
| Estimated Demurrage Risk        $380,000                 $240,000                   -$140,000 ▼    |
| Berth Conflicts / Clashes       3 Clashes                0 Clashes (Resolved)       -3 Clashes     |
| Average Crane Moves/Hour        26.4 moves/hr            29.8 moves/hr              +3.4 moves/hr  |
+----------------------------------------------------------------------------------------------------+
| SIMULATED GANTT PREVIEW (Shows ghost overlays of previous vs proposed vessel schedule blocks)      |
| [ Commit Simulated Scenario to Live Production Schedule ]                                          |
+----------------------------------------------------------------------------------------------------+
```

### Component Breakdown:
1. **Interactive Scenario Builder Controls**:
   - Parameter adjustment sliders:
     - Vessel arrival variance slider (`-12h` to `+24h`).
     - Crane quantity assignment stepper per berth (`1` to `5` cranes).
     - Berth closure toggles (simulates oil spill, dredging, equipment failure).
     - Weather scenario dropdown (Clear, Dense Fog, Gusts > 35kts).
2. **Comparison Delta Scorecard**:
   - Clear side-by-side green/red delta chips displaying impact on congestion score, total turnaround hours, and operational expenses.
3. **Ghost Schedule Visualizer**:
   - Visual Gantt chart showing original vessel blocks as translucent grey "ghosts" and simulated positions as vibrant colored blocks.
4. **Production Commit Safeguard**:
   - "Commit Plan to Production" button requiring confirmation modal and role verification.

---

# 8. Page 6: Live Vessel Queue & Anchorage Telemetry (`live`)
*Target User: Quayside Dispatcher, Gate Coordinator*
*Goal: Granular tabular control and real-time telemetry tracking of all vessels in the port ecosystem.*

### Component Breakdown:
1. **Anchorage Queue Trend Chart (Top Left)**:
   - Real-time line chart showing queue depth (number of vessels waiting) over the past 48h and projected 72h.
   - Threshold dashed line indicating Port Maximum Waiting Capacity (12 vessels).
2. **Dwell Time Distribution Histogram (Top Right)**:
   - Bar chart showing distribution of vessel wait times: `< 4h`, `4-8h`, `8-12h`, `12-24h`, `> 24h (Critical Demurrage)`.
3. **Master Vessel Queue Data Grid**:
   - Filter bar: Text search, Status dropdown, Shipping Line filter, Hazard/Reefer filter.
   - Columns:
     1. `Priority`: Star icon toggle (High Priority Flag).
     2. `Vessel Name & IMO`: e.g., `MSC Isabella (IMO 9839284)`.
     3. `Shipping Line / Operator`: e.g., `Mediterranean Shipping Co (MSC)`.
     4. `Status`: Badge: `MOORED` (Green), `ANCHORAGE` (Amber), `APPROACHING` (Cyan), `DEPARTED` (Gray).
     5. `Target Berth`: Dropdown selector (`B1` to `B6`).
     6. `TEU Cargo`: Formatted number e.g., `23,656 TEU`.
     7. `Draft / Max Depth`: `15.8m / 16.5m`.
     8. `ETA / Arrival Timestamp`: `15 Oct 18:00 UTC (On Time)`.
     9. `Wait Duration in Port`: Monospace hours counter (e.g., `14.2h`).
     10. `Predicted Congestion Risk Tier`: Badge (`LOW`, `MEDIUM`, `HIGH`).
     11. `Actions Menu [•••]`: Quick reassign, Contact Pilot, Open AIS Track, Generate Cargo Manifest.

---

# 9. Page 7: Cascade Delay Simulator (`cascade`)
*Target User: Terminal Operations Planner, Risk Analyst*
*Goal: Model and visualize how a single delay in one vessel ripples across subsequent vessels, cranes, and berths.*

### Component Breakdown:
1. **Delay Injection Trigger**:
   - Select Trigger Vessel (e.g., `Maersk Mc-Kinney Moller`).
   - Select Delay Cause: `Engine Trouble`, `Customs Hold`, `Crane Gang Shortage`, `Severe Weather`.
   - Set Initial Delay: Slider (`+1h` to `+24h`).
2. **Domino Ripple Effect Network Flow Diagram**:
   - Node-link visual graph showing the propagation path:
     - `Vessel A (Delayed +6h)` ➔ `Blocks Berth 2` ➔ `Forces Vessel B to Wait in Anchorage (+4.5h)` ➔ `Delays Vessel C Departure (+3h)` ➔ `Gate Truck Congestion Spikes at 22:00`.
3. **Cascade Summary Impact Report**:
   - Total Knock-On Delay Incurred: `+18.5 Total Vessel Hours`.
   - Total Demurrage Penalty Incurred: `$214,000`.
   - Number of Affected Shipping Lines: `4 Lines`.
   - Automated Mitigation Suggestions: Split crane gang from Berth 5 to Berth 2 to accelerate turnaround by 2.2 hours.

---

# 10. Page 8: Activity Log & Compliance Audit Trail (`audit`)
*Target User: Compliance Officer, Terminal Director, System Auditor*
*Goal: 100% transparent, immutable record of all human overrides, AI recommendations, and system events.*

### Component Breakdown:
1. **Filter Controls**:
   - Date range picker, Actor filter (`All`, `AI Engine`, `Supervisor`, `Vessel Planner`, `System`), Action Type (`Berth Override`, `Recommendation Accepted`, `Manual Edit`, `Threshold Breach`).
2. **Audit Timeline Feed / Data Table**:
   - Column 1: `Timestamp (UTC & Local)`.
   - Column 2: `Actor & Role` (e.g., `John Doe (Shift Supervisor)` or `PortPulse Autonomous Dispatcher`).
   - Column 3: `Action & Event` (e.g., `MANUAL OVERRIDE: Swapped CMA CGM Antoine from Berth 2 to Berth 4`).
   - Column 4: `Justification / Reason Code` (e.g., `Code 104: Heavy Swell preventing safe mooring at Berth 2`).
   - Column 5: `AI Recommendation Overridden` (Shows original AI suggestion vs human decision).
   - Column 6: `Verification Status` (Cryptographic verification hash badge `✓ Verified`).
3. **Export Utilities**:
   - One-click export to `CSV`, `JSON`, and `Signed Compliance PDF`.

---

# 11. Page 9: Forecast Benchmarks & ML Model Observatory (`ml_metrics`)
*Target User: ML Engineer, Port Data Scientist*
*Goal: Monitor accuracy, calibration, and data drift of the predictive models powering PortPulse.*

### Component Breakdown:
1. **Benchmark Model Card Ribbon**:
   - **Active Production Model**: `XGBoost + NeuralProphet Hybrid v2.4`.
   - **Mean Absolute Error (MAE)**: `0.042` (Congestion Score scale 0-1).
   - **RMSE**: `0.058`.
   - **Prediction Horizon Accuracy**: `24h: 96.2%` • `48h: 91.8%` • `72h: 87.4%`.
2. **Model Calibration Curve & Confusion Matrix**:
   - Reliability diagram showing predicted congestion probability vs actual observed congestion.
   - 3x3 Confusion Matrix: `LOW`, `MEDIUM`, `HIGH` risk classifications.
3. **Feature Drift & AIS Telemetry Health**:
   - Drift scores for key input features: AIS Signal Frequency, Water Level Variance, Crane Productivities.
   - Flag indicator if sensor drift exceeds 5%.

---

# 12. Page 10: Executive Shift Briefing Document (`briefing`)
*Target User: Terminal Director, Incoming Shift Supervisor*
*Goal: AI-generated synthesized shift handover document ready for print, PDF export, or morning stand-up review.*

### Component Breakdown:
1. **Shift Handover Header**:
   - Date, Shift Title (`Shift Handover: Day Shift -> Night Shift`), Prepared by PortPulse AI.
2. **Executive Summary Narrative**:
   - LLM-generated operational brief: *"Over the upcoming 12 hours, Port of LA Pier 400 will operate at high utilization (88%). Peak congestion is forecasted for 02:00 UTC due to simultaneous arrival of two Ultra-Large Container Vessels. Recommend maintaining 4 cranes on Berth 2."*
3. **High-Risk Vessels Summary Table**:
   - Concise table listing vessels requiring immediate attention, pilot assignments, and hazmat considerations.
4. **Resource Allocation Summary**:
   - Crane gang deployments, pilot boat shifts, tugboat reservations.
5. **Export & Print Action Bar**:
   - `[Download PDF Briefing]` `[Send via Email to Superintendants]` `[Copy Markdown]`.

---

# 13. Page 11: Mobile Quayside Floor Companion (`mobile`)
*Target User: Dockside Superintendent, Gang Foreman on Rugged Tablet/Mobile*
*Goal: High-contrast, touch-optimized, pocket-friendly interface for quayside operators on foot.*

### Component Breakdown:
1. **Single-Column High-Contrast Cards**:
   - Giant font sizes (`24px+`) for visibility under direct sunlight.
   - Large touch targets (minimum `48px` button height).
2. **Berth Quick-Switch Tabs (`B1` to `B6`)**:
   - Instant tap to view current vessel moored at that specific berth.
3. **Live Crane Move Counter**:
   - Shows moves completed vs target for current shift (e.g., `Moves: 412 / 600 • 28 moves/hr`).
4. **One-Tap Emergency Alert / Incident Logger**:
   - Giant Red Action Button: `[Report Quayside Bottleneck / Crane Hold]`.

---

# 14. Global Modals, Drawers & Flyouts

### 1. Prediction Explainability Modal (`PredictionExplainabilityModal`)
- **Trigger**: Click "Explain Why" on any recommendation, heatmap bucket, or vessel card.
- **Content**:
  - **SHAP Waterfall Plot**: Explains exactly why the model predicted a high congestion score for this window:
    - Base Value: `0.32`
    - `+0.28` due to Berth 2 Overbooking
    - `+0.16` due to Anchorage Queue (> 5 vessels)
    - `+0.10` due to High Wind / Swell (> 25 kts)
    - `-0.06` due to Extra Crane Gang Assigned
    - Final Output Score: `0.80 (HIGH RISK)`.
  - Plain English explanation generated for human operators.

### 2. Manual Override Modal (`ManualOverrideModal`)
- **Trigger**: When an operator modifies an AI-assigned schedule or forces a berth change.
- **Content**:
  - Original Plan vs Overridden Plan summary.
  - Required Reason Code Dropdown (`Weather Precaution`, `Mechanical Crane Breakdown`, `Customs Inspection Hold`, `Direct Pilot Request`).
  - Free-form notes textarea.
  - Supervisor Signature field.
  - Audit Trail warning badge.

### 3. Master Terminal Data Modal (`MasterDataModal`)
- **Tabs**:
  - `Berth Specifications`: Physical lengths, channel depths, crane limits.
  - `Quayside Cranes`: Crane IDs, max outreach, container capacity, moves/hr ratings.
  - `Vessel Database`: IMO registry, LOA, beam, max TEU capacity.
  - `API & Telemetry Connections`: AIS receiver status, weather feed URL.

### 4. PortPulse AI Maritime Copilot Drawer (`ChatAssistantDrawer`)
- **Trigger**: Click `Ask Copilot ✨` in topbar or press `Cmd+J`.
- **Slide-out Width**: `420px` floating drawer on right side of screen.
- **Features**:
  - Conversational Maritime Intelligence LLM.
  - Quick Prompt Chips:
    - *"What is our biggest bottleneck today?"*
    - *"Show me all vessels waiting longer than 12 hours."*
    - *"What happens if Berth 3 remains closed until tomorrow?"*
    - *"Draft shift briefing for the night team."*
  - Interactive Action Previews (The AI can render executable action cards directly in chat with "Click to Apply" buttons).

### 5. Interactive Guided Tour Modal (`GuidedTourModal`)
- Step-by-step onboarding highlighting:
  1. *Global Simulation Clock & Replay*.
  2. *72h Operations Gantt*.
  3. *GIS Vessel Map & Real-time AIS Trails*.
  4. *72h Congestion Heatmap Matrix*.
  5. *Prescriptive Recommendations Engine*.

---

# 15. Copy-Paste Google Stitch Screen Prompts

Use the prompts below directly in Google Stitch to generate pristine screens matching this specification:

### Stitch Prompt 1: 72h Operations Plan & Shift Cockpit (`plan`)
```text
Design an ultra-premium, high-density 24/7 Maritime Operations Command Cockpit for PortPulse, an AI-powered port congestion and container terminal optimization platform. 

Layout & Theme:
- Deep dark slate maritime theme (Canvas: #060a12, Cards: #0b1322, Accent: #0ea5e9, Borders: #1e3252).
- Pinned top header (56px) with Port of Los Angeles selector, simulated clock "15 OCT 14:30 UTC" with playback scrubber (Play, 1x, 2x, 5x), ML Service status badge "ML Live: 98% • 38ms", and role badge "Shift Supervisor".
- Left navigation rail with tabs: Operations Plan (Active), Vessel Map, 72h Heatmap, Prescriptive Actions, What-If Simulator, Live Queue, Activity Log, ML Metrics.

Main Content Area:
1. Top KPI Ribbon: 4 sleek cards with monospace telemetry:
   - Port Congestion Score (0.74 / 1.00, Red alert tier, +0.12 trend)
   - Berth Utilization (83.3%, 5/6 Berths Active)
   - Anchorage Queue (7 Vessels Waiting, Avg wait 8.4h, $142k demurrage exposure)
   - 72h Turnaround Efficiency (26.4h / vessel, 3 schedule clashes)
2. Main Left Area (70% width): Interactive 72-Hour Berth Schedule Gantt Chart. Rows for Berths B1 to B6 with timeline columns for Today, Tomorrow, and Next Day. Colorful vessel booking blocks (Ever Given, MSC Oscar, CMA CGM) with assigned crane badges, delay warning borders, and drag-and-drop handles.
3. Right Column (30% width): Live Prescriptive AI Dispatch Feed with urgent action cards:
   - "Berth Conflict at B2: Swap CMA CGM Antoine to B4 to avoid 4.2h delay and save $48,500". Action buttons: [Accept & Dispatch], [Modify], [Dismiss].
4. Bottom Quayside Spatial schematic showing physical quay length with docked vessel silhouettes and crane positions.
Aesthetic: Modern enterprise SaaS, glowing cyan accents, JetBrains Mono data typography, crisp borders, WCAG AA contrast.
```

### Stitch Prompt 2: Terminal Vessel Map & Quayside GIS (`map`)
```text
Design a state-of-the-art Terminal Vessel Map and Quayside GIS Radar view for PortPulse, an enterprise maritime port optimization platform.

Layout & Theme:
- Fullscreen nautical GIS map canvas using dark-mode CartoDB DarkMatter nautical cartography. Deep ocean tones (#060a12) with cyan navigational channel markings.
- Global navigation topbar and collapsible left sidebar integrated seamlessly.

Map Features:
1. Quayside Berth Polygons (B1 to B6) along the terminal edge, color-coded by real-time status: B1 Emerald (Moored, on schedule), B2 Red (Congested / Delay), B3 Sky Blue (Available), B4 Green.
2. Live AIS Vessel Markers shaped as directional ship silhouettes with compass heading orientation. Fading cyan motion trail polylines behind moving vessels.
3. Outer Anchorage Zone with an aggregated cluster marker "[⚓ 5 Vessels Waiting]".
4. Dynamic Congestion Heatmap Overlay: A semi-transparent radial gradient ellipse over the port basin shifting into an amber-crimson congestion glow.
5. Floating HUD Controls on top right: Layer toggles ([Trails ON], [Heatmap ON], [Labels ON], [Weather Radar]), zoom buttons, and "Center Quayside".
6. Floating Vessel Detail Drawer on the right: Selected vessel "MAERSK MC-KINNEY MOLLER" (IMO 9619907, Denmark, 18,270 TEU, Draft 15.2m, Speed 12.4 kts, ETA 16:45 UTC, Target: Berth 2, Demurrage Risk: High, ML Driver: Berth 2 Crane Downtime). Action buttons: [Reassign Berth], [Radio Harbor Pilot].
7. Bottom Filter Bar: Pill chips [All (14)], [Moored (5)], [Anchorage (7)], [In-Transit (2)], [High Risk (3)].
Aesthetic: High-tech naval tactical radar meets sleek modern fintech dashboard.
```

### Stitch Prompt 3: 72h Congestion Heatmap & Timeline Forecast (`heatmap`)
```text
Design an advanced 72-Hour Congestion Heatmap and Predictive Timeline Forecast screen for PortPulse maritime operating system.

Theme & Aesthetics:
- 24/7 dark mode slate interface (#060a12 canvas, #0f1b2e card backgrounds, electric cyan #0ea5e9 primary, semantic green/amber/red status colors).

Page Components:
1. Top Section: 72-Hour Aggregated Timeline Forecast Scrubber.
   - 12 horizontal bars representing 6-hour forecast buckets across the next 3 days.
   - Bar heights dynamically scaled to congestion score (10px to 80px), color filled with Green (Low), Amber (Medium), or Crimson Red (High).
   - Prominent badge on peak window: "⚡ PEAK CONGESTION: Thu 02:00 - 08:00 (Risk: 0.88)".
   - Interactive scrub cursor and detailed hover popover showing score, queue length, and SHAP top factors.
2. Middle Section: 72-Hour Berth-by-Hour Heatmap Grid.
   - Y-Axis: Berths B1 through B6.
   - X-Axis: 72 individual 1-hour time blocks.
   - Cells filled with smooth heat-gradient from slate to bright red indicating congestion risk per berth per hour.
   - Outage stripes on Berth 3 for scheduled crane maintenance.
3. Bottom Section: Dual Analytics Panels:
   - Left: Bottleneck Root Cause Cards detailing the top 3 congestion windows with affected vessels and shipping lines.
   - Right: SHAP Global Feature Importance horizontal bar chart displaying drivers: Berth Utilization (45%), Queue Length (28%), Tide Restrictions (15%), Crane Reliability (12%).
Aesthetic: Dense, professional data visualization, clean typography, glassmorphic card borders.
```

### Stitch Prompt 4: Berth Allocator & What-If Simulation Sandbox (`optimiser`)
```text
Design an interactive Berth Allocation What-If Simulator and Scenario Modeling Sandbox for PortPulse maritime operations platform.

Theme & Layout:
- Dark operational cockpit theme (#060a12) with high-contrast tactical data panels.

Screen Elements:
1. Top Scenario Parameter Control Panel:
   - Preset Scenario Chips: [Normal Baseline], [Fog Disruption (12h)], [Crane 3 Breakdown], [High Wind Squall].
   - Parameter Controls:
     - Vessel Arrival Shock Slider: "Ever Given Delay: +3.5 Hours".
     - Crane Allocation Stepper: Berth 2 assigned 4 Cranes.
     - Berth Outage Toggle: "Berth 3 Forced Maintenance [ON]".
     - Primary Button: [⚡ Run What-If Simulation] and [Reset to Live Baseline].
2. Middle Section: Side-by-Side Scenario Comparison Scorecard:
   - Table comparing Baseline vs Simulated Plan across 5 key metrics with green/red delta tags:
     - Total Port Dwell Time: 1,420h vs 1,248h (-172h ▼ 12% improvement)
     - Peak Congestion Score: 0.88 (High) vs 0.68 (Medium - Safe)
     - Demurrage Risk: $380k vs $240k (-$140k saved)
     - Berth Schedule Clashes: 3 vs 0 (Resolved)
3. Bottom Section: Ghost Overlay Gantt Chart Preview showing previous schedule as translucent ghost bars and simulated schedule as vibrant colored blocks.
4. Floating Action Footer: [Commit Simulated Scenario to Live Production] with supervisor approval badge.
Aesthetic: Tactical simulation workspace, clean controls, monospaced metric deltas, enterprise clarity.
```

---

# 16. Anti-Generic UI Directives & Zero-Clutter Architecture

### The "Anti-AI-Slop" Manifesto (Bespoke Maritime Luxury)
To guarantee that Google Stitch produces a genuinely unique, human-crafted, high-end interface rather than a generic AI-generated SaaS template:
1. **Zero Decorative Gimmicks**:
   - Strictly NO purple/violet radial gradients, floating blur orbs, or rainbow accents.
   - NO uniform 12-card grids where every card has the same weight, padding, and drop shadow.
   - NO toy-like oversized rounded corners (`rounded-3xl`). Use purposeful `6px` to `8px` radii with razor-sharp 1px hairline borders (`rgba(255, 255, 255, 0.07)`).
2. **Inspiration Anchor**:
   - **Kongsberg Maritime Bridge Systems + Linear.app + Teenage Engineering Hardware + Dark-Mode Bloomberg Terminal**.
   - Highly functional, matte oceanic slate foundations, surgical laser accents, deeply calm and distraction-free.

### Progressive Disclosure: 3-Tier Cognitive Ergonomics
- **Tier 1 — Ambient Calm (Always Visible)**: At 3am in a quiet port control room, the interface is peaceful. 3 primary vitals, 1 calm congestion score dial, and the quayside silhouette.
- **Tier 2 — Contextual Focus (Revealed on Demand)**: Hovering over a berth or vessel reveals its historical transit vector, micro-sparkline, and immediate action triggers without shifting page layout.
- **Tier 3 — Diagnostic Precision (Slide-Over Drawers)**: Complex SHAP waterfalls, What-If simulation trees, and cascade networks slide in smoothly within 420px drawers on the right, keeping the main canvas grounded.

### De-Cluttering & Glanceability Mechanics:
- **The 3-Second Rule**: A supervisor must understand port health, identify the bottleneck, and see the single-click solution within 3 seconds.
- **Zen Deck Mode (`Z` Key)**: A single keyboard shortcut collapses all sidebars and secondary metrics, expanding the 72h Gantt or GIS map to 100% viewport.
- **Universal Command Palette (`Cmd+K`)**: Rapid keyboard execution (`swap B2 B4`, `filter ULCV`, `find Ever Given`).
- **Luminescent Breathing**: Critical conflicts emit a slow, rhythmic 2-second glow that dissolves into solid emerald relief the moment an operator accepts the AI recommendation.
