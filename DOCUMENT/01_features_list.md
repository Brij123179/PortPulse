# PortPulse — Detailed Feature List
### L1: Container Congestion Predictor & Port Operations Optimiser — IBM BoB AI Hackathon 2026

**One-liner:** A predictive twin of the port that tells shift supervisors what will jam up in the next 72 hours — and hands them the fix, in one click, grounded by IBM Bob.

This document lists every feature the system will ship, tagged with:
- **ID** — stable reference used in SRS, backend, frontend, and test docs
- **Priority** — MoSCoW (Must / Should / Could / Won't-this-round)
- **Increment** — which build phase it ships in (see `02_srs.md §7` for the release plan)
- **Business value** — the operational/dollar outcome a port operator cares about, not the tech

---

## Increment 1 (I1) — Foundation: Data + Read-Only Visibility
Goal: prove the data pipeline and give a supervisor something real to look at. No AI yet — this is the "trust the plumbing" phase.

| ID | Feature | Description | Priority | Business Value |
|---|---|---|---|---|
| F-101 | Synthetic port data generator | Generates 50–150 vessels, 10–20 berths (length/draft/crane specs), yard TEU capacity, and injects "shock events" (mega-ship clustering, crane outage) for realistic demo scenarios | Must | Lets the team demo real dynamics without a paid AIS feed |
| F-102 | Unified data connector layer | Normalizes vessel schedule, berth master data, yard capacity, weather/tide into one common schema | Must | This is the integration "glue" — every other feature depends on it |
| F-103 | Historical turnaround store | Stores past dwell times, delay causes, and shift logs for model training | Must | Foundation for every prediction feature |
| F-104 | Berth/vessel master data CRUD | Admin screens to add/edit berths, cranes, vessel classes | Should | Lets a real port operator configure the system for their own terminal |
| F-105 | Live vessel & berth status view (read-only) | Table/list view of current vessel positions, ETAs, berth occupancy — no predictions yet | Must | Baseline situational awareness supervisors don't currently have in one screen |
| F-106 | Role-based access (Supervisor / Terminal Manager / Vessel Planner / Admin) | Three role types with scoped permissions | Should | Matches real org structure; needed before any write actions ship |

---

## Increment 2 (I2) — Prediction Core
Goal: the system starts telling supervisors what *will* happen, not just what *is* happening.

| ID | Feature | Description | Priority | Business Value |
|---|---|---|---|---|
| F-201 | Vessel ETA correction model | Corrects carrier-reported ETA using historical accuracy patterns (AIS speed/position trend when available) | Must | Carrier ETAs are notoriously optimistic; this is the input every downstream prediction depends on |
| F-202 | Berth occupancy forecast (72h horizon) | Hour-by-hour probability that each berth is occupied, next 72 hours | Must | This is the core "look-ahead" the whole pitch is built on |
| F-203 | Congestion hotspot heatmap engine | Risk score per berth × time-window, green/amber/red | Must | Turns raw probabilities into a decision supervisors can act on in 5 seconds |
| F-204 | Anchorage queue predictor | Forecasts number of vessels waiting offshore over the horizon | Should | Directly maps to the 2021 LA/Long Beach "100+ ships offshore" pain point |
| F-205 | Cascading delay simulator | Models how one delayed vessel ripples into downstream berth assignments | Should | Answers "if Berth 3 slips 4 hours, what breaks next" — the question planners can't currently answer |
| F-206 | Explainability layer (SHAP-style) | Every risk score ships with a "why" — top contributing factors | Must | Supervisors won't act on a black-box number; this is what earns trust and judge points on "IBM Bob load-bearing" criteria |
| F-207 | Confidence intervals on all forecasts | Every prediction ships with an uncertainty band, not a false-precision point estimate | Should | Prevents supervisors over-trusting noisy forecasts — an ML-engineering must-have, see `06_ml_engineering.md` |

---

## Increment 3 (I3) — Prescriptive Layer: Recommend & Optimise
Goal: move from "here's the problem" to "here's the fix," with a human still in the loop.

| ID | Feature | Description | Priority | Business Value |
|---|---|---|---|---|
| F-301 | Vessel diversion recommender | Suggests nearby berth/terminal when congestion risk exceeds threshold | Must | Directly reduces the offshore queue that cost $10B in 2021 |
| F-302 | Slow-steam advisory | Recommends speed adjustments so a vessel arrives after congestion clears instead of into it | Should | Cheaper than diversion; also a fuel/emissions win (ESG story) |
| F-303 | Priority re-sequencing engine | Reorders vessel service order by cargo urgency, perishables, contractual SLA | Should | Protects high-value/time-critical cargo automatically instead of by manual judgment call |
| F-304 | Cost/impact estimator per option | Shows estimated $ and time cost/saving for each recommended action, side by side | Must | This is what turns a recommendation into a business decision a manager will actually sign off on |
| F-305 | Berth & crane assignment optimiser (MILP) | Constraint-based solver: berth length/draft compatibility, crane availability, shift windows, contractual priority | Must | Replaces manual spreadsheet allocation — the single biggest stated pain point in the problem statement |
| F-306 | Dynamic re-optimisation on new events | Auto re-runs optimiser when a new ETA update or delay event lands | Must | Keeps the plan current without a supervisor manually re-triggering it |
| F-307 | Manual override with guardrails | Supervisor can drag-and-drop reassign; system flags constraint violations live | Must | Human-in-the-loop is non-negotiable in a safety/compliance-bound domain — AI proposes, human disposes |
| F-308 | What-if simulator | Supervisor tests a hypothetical ("divert Vessel X") and sees the heatmap recalculate instantly | Should | This is the "wow" interaction judges remember — makes the system feel alive, not a static report |

---

## Increment 4 (I4) — Generative Layer & Cockpit
Goal: package everything into the artifact a supervisor actually hands off at shift change, powered visibly by IBM Bob / watsonx.

| ID | Feature | Description | Priority | Business Value |
|---|---|---|---|---|
| F-401 | LLM-generated 72h shift briefing | Grounded (RAG) natural-language plan from optimiser output + risk scores + SOPs | Must | This is the single highest-visibility "AI-powered" moment in the demo |
| F-402 | Hour-by-hour Gantt view | Berth × Crane × Vessel × Time block visual schedule | Must | Standard port-ops artifact — must be recognizable to a real terminal manager |
| F-403 | Auto-generated shift handover notes | Summarized in plain language for the next shift's supervisor | Should | Solves a real, unglamorous, currently-manual task |
| F-404 | Exportable PDF/Word report | One-click export of the briefing for compliance/stakeholder distribution | Should | Ports are compliance-heavy; paper trail matters |
| F-405 | Alert & escalation rules | Auto-flags SLA-threshold breaches, pushes to Slack/Teams/email | Should | Moves the system from "pull" (someone checks the dashboard) to "push" (it finds you) |
| F-406 | Natural-language chat assistant | "Which berths are at risk tomorrow morning?" grounded via RAG on live data | Must | Judge-visible IBM Bob integration point; lowers the barrier for non-technical staff |
| F-407 | Recommendation feed with Accept/Modify/Reject | Every AI suggestion is an explicit human decision, logged | Must | Feeds both governance (audit trail) and the model feedback loop |
| F-408 | Supervisor cockpit — unified dashboard | Heatmap + Gantt + recommendation feed + chat in one screen | Must | The single pane of glass that replaces "reactive spreadsheets" |
| F-409 | Mobile-responsive floor view | Cut-down dashboard for supervisors on the floor, not at a desk | Could | Real operational users are rarely desk-bound |
| F-410 | Light/Dark mode | Full theming across the cockpit, not just a color swap — see `04_frontend.md` | Should | Port ops runs 24/7 in control rooms; night-shift usability is a real, not cosmetic, requirement |

---

## Increment 5 (I5, stretch) — Platform & Trust
Goal: features that make the system defensible as more than a hackathon demo.

| ID | Feature | Description | Priority | Business Value |
|---|---|---|---|---|
| F-501 | Audit trail & explainability log | Every AI recommendation logged with full rationale | Should | Required for port-authority compliance in any real deployment |
| F-502 | Feedback loop / continuous learning | Accept/reject actions from F-407 feed back into model retraining | Could | Closes the ML loop — see `06_ml_engineering.md` |
| F-503 | Simulation sandbox / historical replay | Replay 2021 LA/Long Beach-style scenario against the model | Should | This is your impact-slide proof: "here's what we'd have predicted" |
| F-504 | Multi-tenant configuration | Independent capacity configs per terminal/port | Won't (this round) | Real scaling feature; explicitly out of scope for hackathon timeline |
| F-505 | API-first integration layer | Every engine exposed as REST endpoint for plugging into real TOS (e.g., Navis N4) | Could | Shows the judges this isn't a dead-end prototype |

---

## Cross-Cutting (applies to every increment)
| ID | Feature | Description |
|---|---|---|
| X-1 | Automated test suite per feature | Unit + integration test written alongside the feature, not after — see `05_backend.md §Testing` and `04_frontend.md §Testing` |
| X-2 | Structured logging & observability | Every service logs to a common format from I1 onward |
| X-3 | Security baseline | IAM, input validation, secrets management from I1 onward — see `03_security.md` |
| X-4 | Accessibility (WCAG AA) | Applies to every screen shipped, not retrofitted at the end |

---

## Why This Ordering (Incremental Rationale)
Each increment is independently demoable — if you run out of time, you stop with a working product, not a broken one:
- **I1** proves data plumbing works — the least glamorous, highest-risk part, done first.
- **I2** proves the AI actually predicts something true — validated against historical/synthetic data before anyone sees a UI.
- **I3** proves the system can *recommend*, with a human always able to override — this is the safety-critical increment.
- **I4** is the demo layer — where IBM Bob/watsonx visibly does work a human would otherwise do.
- **I5** is what separates "hackathon toy" from "would survive a pilot conversation" — attempt only after I1–I4 are solid.
