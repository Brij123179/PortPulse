# Software Requirements Specification — PortPulse

**Problem Statement:** L1 — Container Congestion Predictor & Port Operations Optimiser
**Event:** IBM Bob AI Innovation Hackathon 2026
**Scope:** 2-day hackathon MVP (not a production system)

---

## 1. Introduction

### 1.1 Purpose
PortPulse predicts port congestion before it happens and gives a shift supervisor a
concrete, prioritised operating plan to avoid it — replacing manual, reactive
spreadsheet-based berth/crane allocation with a predictive, prescriptive workflow.

### 1.2 Problem Being Solved
Port operators currently allocate berths, cranes, and yard space manually, reacting to
congestion only after vessels are already queuing. PortPulse fuses vessel schedules
with berth/crane capacity to surface congestion risk up to 72 hours in advance, and
converts that risk into an assignment plan and a plain-English shift briefing.

### 1.3 Intended Users
- Shift supervisors (primary) — need a fast, readable 72h plan at the start of a shift
- Terminal/vessel planners — need to see why a berth is at risk and what changes fix it

### 1.4 Out of Scope (explicitly, for honesty in `known_limitations`)
- Live AIS vessel tracking feeds (paid access — out of hackathon budget)
- Integration with real Terminal Operating Systems (Navis N4, etc.)
- Multi-port / multi-tenant deployment
- Streaming infrastructure (Kafka/Event Streams) — batch processing is sufficient for
  a 72-hour planning horizon
- Model retraining from supervisor feedback

---

## 2. System Overview

Four sequential engines behind one dashboard:

| # | Engine | Question it answers |
|---|--------|---------------------|
| 1 | Congestion Predictor | Where/when will berths be overloaded in the next 72h? |
| 2 | Routing Recommender | Which vessels should be diverted, slowed, or reordered? |
| 3 | Berth/Crane Optimiser | What's the best assignment given the forecast? |
| 4 | Plan Generator | What does the supervisor actually do, in plain English? |

Data flows one-way through the pipeline: **synthetic schedule data → risk scoring →
recommendation → assignment → generated briefing.** Each stage's output is the next
stage's input, and each stage is independently testable and demoable.

---

## 3. Functional Requirements

### FR-1 Data Ingestion (synthetic, for hackathon feasibility)
- FR-1.1 Generate 50–150 vessels with randomised ETA, ETD, cargo volume (TEU), and class
- FR-1.2 Define 10–20 berths with length, draft limit, and crane count
- FR-1.3 Support "shock events" — manually injectable scenarios (e.g., three mega-ships
  arriving the same day, one crane outage) to produce genuine congestion for the demo

### FR-2 Congestion Prediction
- FR-2.1 Compute a per-berth, per-hour risk score over a rolling 72-hour window
- FR-2.2 Risk formula (documented, not a black box):
  `risk = overlapping_vessel_count × (berth_demand_TEU / berth_capacity_TEU)`
- FR-2.3 Classify each berth-hour as LOW / MEDIUM / HIGH risk against fixed thresholds
- FR-2.4 Return a human-readable reason per HIGH-risk slot (e.g., "3 vessels with
  overlapping ETA windows")

### FR-3 Routing Recommendation
- FR-3.1 For each HIGH-risk slot, propose one of: divert vessel to an alternate berth,
  slow-steam advisory (delay ETA), or re-sequence vessel priority
- FR-3.2 Estimate the queue-time impact of each recommendation (hours saved)
- FR-3.3 Support a "what-if" re-run: apply a recommendation and recompute risk scores

### FR-4 Berth/Crane Assignment Optimisation
- FR-4.1 Assign vessels to berths for the planning window, respecting:
  - berth length/draft compatibility
  - crane availability per berth
- FR-4.2 Minimise total vessel wait time as the primary objective
- FR-4.3 Re-run automatically when a recommendation from FR-3 is accepted

### FR-5 Shift Plan Generation
- FR-5.1 Generate a structured shift briefing: risk summary, recommended actions
  (next 24h), hour-by-hour allocation, handover notes
- FR-5.2 Plan text is generated from the actual optimiser/risk output (grounded),
  not freely invented — the generator fills a template with real numbers
- FR-5.3 Export the briefing as Markdown/PDF

### FR-6 Supervisor Dashboard
- FR-6.1 Congestion heatmap (berth × time, colour-coded LOW/MEDIUM/HIGH)
- FR-6.2 Hour-by-hour Gantt-style allocation view
- FR-6.3 Recommendation feed with Accept/Reject actions (human-in-the-loop)
- FR-6.4 Shift briefing panel (rendered from FR-5 output)

---

## 4. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Usability | Dashboard readable by a non-technical shift supervisor without training |
| Performance | Full pipeline (generate → score → optimise → plan) completes in under 5 seconds for 150 vessels / 20 berths |
| Explainability | Every risk score and recommendation has a stated reason, not just a number |
| Reproducibility | `.env.example` + setup guide let a judge run the full demo from a clean clone |
| Honesty | `known_limitations` in the README explicitly states synthetic data and simplified optimisation approach |

---

## 5. Data Model (minimum viable)

**Vessel**: id, name, eta, etd, cargo_teu, vessel_class, draft
**Berth**: id, name, length, draft_limit, crane_count, capacity_teu
**Assignment**: vessel_id, berth_id, start_time, end_time
**RiskSlot**: berth_id, hour, risk_score, risk_level, reason
**Recommendation**: vessel_id, type (divert/slow/resequence), target, impact_hours_saved

---

## 6. Assumptions & Constraints
- All data is synthetic, generated at app start with a fixed random seed for
  reproducible demos
- The optimiser uses a greedy/heuristic assignment (not a full MILP solver) for
  reliability within the hackathon timeframe — documented as a simplification, not
  hidden
- The plan generator template can be swapped for a live LLM call if an API key is
  available, but the demo does not depend on external API access to run

---

## 7. Evaluation Mapping (against the hackathon rubric)

| Rubric criterion | How PortPulse addresses it |
|---|---|
| Technical Implementation (25) | Working end-to-end pipeline, real (if synthetic) data, documented formulas |
| Innovation & Differentiation (25) | Cross-stage grounding — the LLM briefing is generated *from* the optimiser's real output, not a free-form summary |
| Problem Depth & Vision (15) | Explicit shock-event scenarios modelling the 2021 LA/Long Beach backlog |
| Working Demo (15) | Full pipeline runs locally with one command, no external dependencies required |
| Bob Integration (10) | Bob used in Plan mode for architecture, Agent mode for implementation — documented in architecture.md |
| Documentation (10) | This SRS + FEATURES.md + setup guide |
