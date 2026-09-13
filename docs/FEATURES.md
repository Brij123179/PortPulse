# PortPulse — Feature List

Organised by build priority. Sections 1–4 are the MVP; ship these first. Section 5 is
stretch — only attempt if 1–4 are done and demo-stable with time to spare.

---

## 1. Data Layer (build first — unblocks everything else)

- [ ] Synthetic vessel generator: 50–150 vessels, randomised ETA/ETD, cargo volume, class
- [ ] Synthetic berth/crane master data: 10–20 berths with length, draft limit, crane count
- [ ] Fixed random seed so every demo run is reproducible
- [ ] Scenario injector: hardcode one "shock event" (e.g. 3 mega-ships same day) so the
  demo reliably shows a real congestion spike — don't leave this to random chance

## 2. Congestion Prediction Engine

- [ ] Per-berth, per-hour risk score over a 72h rolling window
- [ ] Simple, stated formula: `overlapping_vessels × (demand_TEU / capacity_TEU)`
- [ ] LOW/MEDIUM/HIGH classification against fixed thresholds
- [ ] One-line reason per HIGH slot ("3 vessels overlap 18:00–02:00")

## 3. Recommendation + Optimisation Engine

- [ ] For each HIGH-risk slot: suggest divert / slow-steam / re-sequence
- [ ] Estimated hours-saved per recommendation (simple arithmetic, not ML)
- [ ] Greedy berth/crane assignment: sort vessels by ETA, assign to first compatible
  free berth — documented as a heuristic, not a full MILP solve
- [ ] Re-run optimiser after a recommendation is accepted (what-if loop)

## 4. Shift Plan Generator + Dashboard

- [ ] Template-based shift briefing, filled with real numbers from engines 2–3
- [ ] Congestion heatmap (colour-coded table: berth rows × hour columns)
- [ ] Hour-by-hour allocation view (simple table is fine — doesn't need a real Gantt lib)
- [ ] Recommendation feed with Accept/Reject buttons
- [ ] Briefing panel showing the generated shift plan text

---

## 5. Stretch (only if MVP is demo-stable with time left)

- [ ] Swap templated plan generator for a live LLM API call
- [ ] What-if simulator UI (drag to reassign, see heatmap update live)
- [ ] Export briefing as PDF
- [ ] Second synthetic scenario (weather delay) to show generality

---

## Explicitly cut from this build (do not attempt)

These appeared in early planning but are production scope, not hackathon scope. Cutting
them is a documented decision, not an oversight — say so in `known_limitations`:

- Live AIS vessel tracking feeds
- Kafka / IBM Event Streams
- Db2 / Kubernetes / OpenShift deployment
- Multi-tenant configuration, IAM, role-based access
- Model retraining from supervisor feedback
- Integration with real Terminal Operating Systems (Navis N4)

---

## Demo Script (rehearse this exact sequence)

1. Open dashboard — heatmap shows two berths flashing HIGH risk for Friday night
2. Click a HIGH cell — see the one-line reason (overlapping vessel ETAs)
3. Open Recommendations tab — see the diversion/slow-steam suggestions with hours-saved
4. Accept one recommendation — heatmap recalculates, HIGH cell turns MEDIUM/LOW
5. Click "Generate Shift Plan" — briefing appears, built from the real numbers on screen
6. Close with the impact framing: 2021 LA/Long Beach backlog, $10B+ cost, cite it as
   the motivating scenario your shock-event models
