# Software Requirements Specification (SRS)
### PortPulse — L1 Container Congestion Predictor & Port Operations Optimiser
### IBM BoB AI Hackathon 2026

Version 1.0 · Companion documents: `01_features_list.md`, `03_security.md`, `04_frontend.md`, `05_backend.md`, `06_ml_engineering.md`

---

## 1. Introduction

### 1.1 Purpose
This SRS defines the functional and non-functional requirements for PortPulse, a predictive-and-prescriptive port operations system built for the IBM Bob AI Hackathon 2026, addressing Industry Problem Statement **L1**. It is written to be buildable **incrementally** — every requirement is tagged with the increment it belongs to (see §7), so the team can ship a working product at every checkpoint rather than a single big-bang release.

### 1.2 Scope
PortPulse ingests vessel schedule, berth/crane, yard capacity, and weather/tide data; forecasts congestion 72 hours ahead; recommends routing and berth/crane assignments; and generates a supervisor-facing operations plan via an IBM Bob / watsonx.ai-grounded language model. It is a **decision-support** system — it recommends, a human approves. It does not autonomously reroute vessels or commit terminal resources without explicit human action (see F-307, F-407).

### 1.3 Definitions
| Term | Meaning |
|---|---|
| TEU | Twenty-foot Equivalent Unit — standard container size measure |
| ETA / ETD | Estimated Time of Arrival / Departure |
| Dwell time | Time a vessel occupies a berth |
| MILP | Mixed-Integer Linear Programming (used for berth/crane optimisation) |
| RAG | Retrieval-Augmented Generation — grounding an LLM's answer in real documents/data |
| BLUF | Bottom Line Up Front (not used in L1, referenced for consistency with other problem statements) |
| SLA | Service Level Agreement |
| Increment | A self-contained, demoable build phase (I1–I5, see `01_features_list.md`) |

### 1.4 References
- `Industry_Problem_Statements_2026.pdf` — Problem L1 definition
- `BOB_AI_User_Guide.pdf` — IBM Bob capabilities (modes, subagents, MCP, Bob Shell)
- `Bobathon_Submission_Template_Guide.pdf` — submission structure and evaluation rubric
- `01_features_list.md` — full feature breakdown by increment

---

## 2. Overall Description

### 2.1 Product Perspective
PortPulse is a new, standalone system for the hackathon, architected so its engines are **API-first** (F-505) and could plug into a real Terminal Operating System (e.g., Navis N4) in a future phase. Within the hackathon it runs against synthetic data (F-101) rather than a live paid AIS feed.

### 2.2 Product Functions (Summary)
1. Ingest and normalize port operations data (F-101–F-103)
2. Forecast berth occupancy, congestion hotspots, and offshore queue (F-201–F-207)
3. Recommend routing, speed, and sequencing changes with cost/impact estimates (F-301–F-304)
4. Optimise berth/crane assignment under real-world constraints (F-305–F-308)
5. Generate a human-readable 72-hour operations plan and shift handover (F-401–F-405)
6. Provide a conversational, grounded chat assistant (F-406)
7. Maintain full human-in-the-loop control and audit trail (F-307, F-407, F-501)

### 2.3 User Classes and Characteristics
| Role | Description | Primary Screens |
|---|---|---|
| Shift Supervisor | Primary user; acts on recommendations in real time | Cockpit, Gantt, recommendation feed, chat |
| Terminal Manager | Reviews plans, approves higher-impact diversions, reads reports | Cockpit (read-heavy), exported reports |
| Vessel Planner | Configures upcoming schedules, reviews routing suggestions | Schedule import, routing recommender |
| Admin | Configures berth/crane master data, manages users/roles | Admin console |

### 2.4 Operating Environment
- Web application, deployed containerized (Docker; Kubernetes/OpenShift optional for scaling demo — see `05_backend.md`)
- Modern evergreen browsers (Chrome, Edge, Firefox, Safari — last 2 versions)
- Backend: Python (FastAPI) microservices
- AI: IBM watsonx.ai foundation model + IBM Bob for development workflow itself

### 2.5 Design and Implementation Constraints
- Hackathon timeline: real AIS feeds are out of scope; synthetic data generator is the system of record for the demo (F-101).
- Must remain demoable at the end of **every** increment (see §7) — no requirement may be built in a way that leaves the system in a broken state between increments.
- Backend-first build order: no frontend feature is started until its backing API contract is implemented and tested (see `05_backend.md` §API Contracts and `04_frontend.md` §Build Order).
- All AI recommendations must be explainable (F-206) and overridable (F-307) — this is a hard constraint, not a nice-to-have, given the safety/compliance context of real port operations.

### 2.6 Assumptions and Dependencies
- IBM watsonx.ai (or an equivalent hosted foundation model) is available for the LLM plan generator and chat assistant.
- Synthetic data is an acceptable substitute for real AIS/TOS data for hackathon judging purposes (confirmed by problem statement's own "hackathon-feasible" guidance).
- The team has access to IBM Bob for development (per `BOB_AI_User_Guide.pdf`) — Bob integration itself is a judged criterion (10 pts), separate from the product's own AI features.

---

## 3. System Features (Functional Requirements)

Each feature below maps 1:1 to an ID in `01_features_list.md`. Format: **FR-<feature ID>**.

### 3.1 Data Ingestion (Increment 1)
- **FR-F101**: The system shall generate a configurable synthetic dataset of 50–150 vessels and 10–20 berths, including at least one injected shock event per scenario.
- **FR-F102**: The system shall normalize all ingested sources (vessel schedule, berth/crane master data, yard capacity, weather/tide) into one common internal schema before any downstream service consumes it.
- **FR-F103**: The system shall persist historical turnaround and delay data for a minimum of 1 synthetic "year" to support model training and backtesting.
- **FR-F105**: The system shall display current vessel and berth status in a table/list view, refreshed at a configurable interval (default 60s).

### 3.2 Prediction (Increment 2)
- **FR-F201**: The system shall produce a corrected ETA for every tracked vessel, with an associated confidence interval.
- **FR-F202**: The system shall produce an hour-by-hour occupancy probability for every berth across a 72-hour rolling horizon.
- **FR-F203**: The system shall classify each berth-hour into a risk tier (green/amber/red) using a documented, versioned threshold policy (see `06_ml_engineering.md` §Thresholding).
- **FR-F206**: Every risk score and forecast displayed to a user shall be accompanied by a human-readable explanation of its top contributing factors.
- **FR-F207**: Every point forecast shall be displayed with its uncertainty band; the UI shall never present a forecast without one.

### 3.3 Recommendation & Optimisation (Increment 3)
- **FR-F301**: When a berth-hour risk tier reaches "red," the system shall generate at least one diversion recommendation, if a feasible alternate berth/terminal exists.
- **FR-F304**: Every recommendation shall include an estimated cost/time impact, computed from a documented cost model (see `06_ml_engineering.md` / `05_backend.md`).
- **FR-F305**: The system shall compute a berth/crane assignment that satisfies all hard constraints (draft, length, crane compatibility, shift windows) and optimises a documented multi-objective score.
- **FR-F306**: The system shall re-run optimisation automatically within 30 seconds of receiving a new ETA update or delay event.
- **FR-F307**: A supervisor shall be able to manually override any assignment; the system shall flag any resulting constraint violation in real time and shall not silently auto-correct it.

### 3.4 Generative Plan & Cockpit (Increment 4)
- **FR-F401**: The system shall generate a natural-language 72-hour shift briefing grounded in the current optimiser output, risk scores, and configured SOPs, refreshed on demand and on a schedule (default every 6h).
- **FR-F402**: The cockpit shall render a Gantt view of berth/crane/vessel assignments for the full 72-hour horizon.
- **FR-F406**: The chat assistant shall answer natural-language operational questions using only grounded, current data — it shall not fabricate berth/vessel facts not present in the underlying data store.
- **FR-F407**: Every AI-generated recommendation shall present Accept / Modify / Reject actions; the chosen action shall be recorded with a timestamp and user ID.

### 3.5 Non-Functional-adjacent Functional Requirements
- **FR-X1**: Every feature above shall ship with an automated test (unit and/or integration) before being marked done in the increment's Definition of Done (see §8).
- **FR-X2**: Every service shall emit structured logs including a correlation ID that can trace a single request end-to-end.

---

## 4. External Interface Requirements

### 4.1 User Interfaces
See `04_frontend.md` for full detail. Summary: single-page web cockpit, light/dark theme-aware, role-scoped views, WCAG AA accessible.

### 4.2 API Interfaces
See `05_backend.md` §API Contracts for the full REST specification. Summary: all engines exposed as versioned REST endpoints (`/api/v1/...`), JSON request/response, OpenAPI-documented.

### 4.3 Software Interfaces
- IBM watsonx.ai (or equivalent) foundation model API for F-401/F-406.
- PostgreSQL (or IBM Db2) for structured data.
- Optional: Kafka / IBM Event Streams for simulated live AIS ingestion (stretch, I5).

### 4.4 Communications Interfaces
- HTTPS/TLS for all client-server traffic (see `03_security.md`).
- WebSocket (or Server-Sent Events) channel for live heatmap/Gantt updates without full page reload.

---

## 5. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Congestion heatmap shall render within 2s of a data refresh for the default 10–20 berth dataset. |
| Performance | Berth/crane re-optimisation (FR-F306) shall complete within 30s for the hackathon-scale dataset. |
| Reliability | The optimiser shall never return an assignment that violates a hard constraint (draft/length/crane compatibility) — this is treated as a Sev-1 bug (see §9). |
| Availability | Demo environment shall target 99% uptime during the judging window. |
| Scalability | Architecture shall be documented as horizontally scalable (containerized microservices) even though the hackathon deployment is single-instance. |
| Usability | Cockpit shall be usable by a non-technical shift supervisor with no training beyond a 5-minute walkthrough. |
| Accessibility | WCAG AA minimum across all shipped screens (X-4). |
| Maintainability | Every engine independently deployable and independently testable (microservice boundary = testable boundary). |
| Explainability | No AI-generated number or recommendation shall reach the UI without an accompanying rationale (FR-F206). |
| Auditability | Every accept/modify/reject action and every AI recommendation is logged immutably (F-407, F-501). |
| Theming | 100% of UI surfaces support light and dark mode with no unreadable/low-contrast combinations (see `04_frontend.md`). |

---

## 6. Data Requirements

| Entity | Key Attributes | Source |
|---|---|---|
| Vessel | ID, class, cargo volume, carrier ETA/ETD, priority flag | F-101 synthetic generator / (future) AIS feed |
| Berth | ID, length, draft limit, crane slots, contractual priority rules | F-104 admin config |
| Crane | ID, type, assigned berth, maintenance windows | F-104 admin config |
| Yard | TEU capacity, reefer plug availability, current utilization | F-101 / F-104 |
| Weather/Tide event | Window, severity, draft-restriction impact | External API or synthetic |
| Turnaround record (historical) | Vessel, berth, actual dwell time, delay cause, shift log | F-103 |
| Recommendation | Type, target berth/vessel, cost/impact estimate, status (pending/accepted/modified/rejected), timestamp, actor | F-301–F-308, F-407 |
| Risk score | Berth, hour, tier, confidence interval, top contributing factors | F-201–F-207 |

Full schema detail lives in `05_backend.md` §Data Models and `06_ml_engineering.md` §Feature Store.

---

## 7. Release Plan (Incremental Development)

| Increment | Theme | Exit Criteria (must be demoable) |
|---|---|---|
| I1 | Data foundation + read-only visibility | Synthetic data flows end-to-end into a live status table; no crashes on refresh |
| I2 | Prediction core | Heatmap shows real risk scores with explanations and confidence intervals, backed by a trained model, not hardcoded values |
| I3 | Recommend & optimise | Optimiser produces a constraint-valid assignment; recommendations show cost/impact; manual override works with guardrails |
| I4 | Generative plan & cockpit | Full cockpit assembled; LLM briefing and chat assistant both grounded in live data, not static text |
| I5 (stretch) | Platform & trust | Audit log complete; historical replay scenario runs against the 2021 LA/Long Beach-style shock event |

Each increment follows: **Backend implemented + unit/integration tested → API contract frozen → Frontend built against contract → End-to-end test pass → Demo checkpoint.** See `05_backend.md` and `04_frontend.md` for the detailed workflow.

---

## 8. Definition of Done (applies to every feature, every increment)
1. Feature implemented against its FR-ID above.
2. Unit tests written and passing.
3. Integration test covering the real API call (not mocked) passing.
4. Manual test performed by both a team member ("me") and the coding agent (IBM Bob), with results logged — see `05_backend.md` §Testing Protocol.
5. No known Sev-1 or Sev-2 bug open against the feature (see §9).
6. Light and dark mode both verified for any UI element.
7. Feature's rationale/explainability (if AI-driven) verified against FR-F206.

## 9. Severity Definitions (for bug triage across all docs)
| Severity | Definition | Example |
|---|---|---|
| Sev-1 | Incorrect result presented as correct; constraint violated silently; data loss | Optimiser assigns a vessel to a berth shorter than its length |
| Sev-2 | Feature fails or degrades under normal use | Heatmap fails to refresh after a new vessel is added |
| Sev-3 | Cosmetic/UX issue | Dark mode has a low-contrast label |
| Sev-4 | Nice-to-have polish | Loading spinner text could be clearer |
