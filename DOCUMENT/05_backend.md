# Backend Architecture — PortPulse
### Built first, contract-frozen, then handed to frontend

Per `02_srs.md §2.5`, no frontend feature starts until its backing API is implemented and integration-tested. This document is the contract everything else is built against.

---

## 1. Service Decomposition

| Service | Responsibility | Maps to Features |
|---|---|---|
| `ingestion-service` | Synthetic data generation, normalization, historical store writes | F-101–F-103 |
| `master-data-service` | Berth/crane/yard/user CRUD, RBAC-scoped | F-104, F-106 |
| `forecast-service` | ETA correction, berth occupancy forecast, anchorage queue, cascading delay simulation | F-201, F-202, F-204, F-205 |
| `risk-service` | Risk tiering, explainability payloads, confidence intervals (consumes `forecast-service` output) | F-203, F-206, F-207 |
| `recommendation-service` | Diversion, slow-steam, re-sequencing, cost/impact estimation | F-301–F-304 |
| `optimiser-service` | MILP berth/crane assignment, re-optimisation triggers, override validation | F-305–F-307 |
| `plan-service` | LLM-grounded 72h briefing, handover notes, PDF/Word export, alerting | F-401–F-405 |
| `chat-service` | RAG-grounded natural-language Q&A | F-406 |
| `audit-service` | Immutable log of every recommendation and human action | F-407, F-501 |
| `gateway` | Auth, routing, rate limiting, WebSocket/SSE fan-out to frontend | Cross-cutting |

Each service is independently deployable and independently testable — a service boundary is a testable boundary (`02_srs.md §5` maintainability requirement). For the hackathon these can run as separate FastAPI apps in one docker-compose file; the architecture doc's Kubernetes/OpenShift path is the "how this scales" story for the pitch, not a hackathon-week requirement.

## 2. Data Models (core entities — full DDL lives in the repo's `src/` migrations)

```
Vessel(id, name, class, cargo_volume, carrier_eta, corrected_eta, eta_confidence, priority_flag)
Berth(id, name, length_m, draft_limit_m, crane_slots, contractual_priority_rules)
Crane(id, berth_id, type, maintenance_windows[])
YardCapacity(id, teu_capacity, teu_used, reefer_plugs_available)
TurnaroundRecord(id, vessel_id, berth_id, actual_dwell_hours, delay_cause, shift_id, recorded_at)
RiskScore(id, berth_id, hour_window, tier, confidence_low, confidence_high, top_factors[], model_version)
Recommendation(id, type, target_vessel_id, target_berth_id, cost_estimate, time_estimate, status, created_at)
RecommendationAction(id, recommendation_id, actor_user_id, action, rationale_snapshot, acted_at)
AuditLogEntry(id, correlation_id, actor, action, entity_type, entity_id, payload_snapshot, at)
User(id, name, email, role)
```

Note the `RiskScore.model_version` and `Recommendation.cost_estimate` fields exist specifically so a judge (or a real supervisor) can ask "why did the system say this" months later and get the exact model version and inputs that produced it — this is the backbone of F-206/F-501.

## 3. API Contracts (representative — full OpenAPI spec generated from code)

All endpoints versioned under `/api/v1`. Auth via bearer token (see `03_security.md §2`).

```
GET  /api/v1/status/vessels                → list current vessel positions/ETAs
GET  /api/v1/status/berths                 → list current berth occupancy
GET  /api/v1/forecast/berths?horizon=72h   → hourly occupancy probability per berth
GET  /api/v1/risk/heatmap?horizon=72h      → risk tier + confidence + explanation per berth-hour
POST /api/v1/simulate/what-if              → { action } → recalculated heatmap (F-308)
GET  /api/v1/recommendations               → pending recommendations with cost/impact
POST /api/v1/recommendations/{id}/action   → { action: accept|modify|reject, note? }
POST /api/v1/optimiser/run                 → triggers re-optimisation, returns new assignment
POST /api/v1/optimiser/override            → manual reassignment; returns constraint check result
GET  /api/v1/plan/briefing?window=72h      → generated shift briefing (F-401)
POST /api/v1/chat/query                    → { message } → grounded natural-language answer
GET  /api/v1/audit?entity_id=...           → audit trail for a given entity
WS   /api/v1/live                          → push channel for heatmap/Gantt updates
```

Every response includes a `correlation_id` and, where relevant, `model_version` / `generated_at` — this is not optional decoration, it's what makes F-206 (explainability) and F-501 (audit) actually true rather than aspirational.

## 4. Orchestration Flow (the "predict → recommend → optimise → generate" pipeline)

```
ingestion-service → forecast-service → risk-service
                                          │
                                          ▼
                          recommendation-service ──┐
                                          │          │
                                          ▼          ▼
                                  optimiser-service   (cost/impact shown alongside)
                                          │
                                          ▼
                                   plan-service (LLM briefing)
                                          │
                                          ▼
                                gateway → frontend cockpit
```

`audit-service` listens to every step via events (or direct calls in the hackathon-simple version) rather than being bolted on at the end — auditability has to be structural, not retrofitted.

## 5. Error Handling Standard

- All errors return a structured body: `{ "error_code": "...", "message": "...", "correlation_id": "..." }` — never a bare 500 with no context, and never a stack trace leaked to the client.
- Every service validates its own inputs at the boundary (never trusts an upstream service blindly) — this is both a reliability control and a security control (`03_security.md §4`).
- The optimiser-service specifically: if it cannot find a feasible assignment, it returns an explicit "infeasible" result with the violated constraint named — it never silently returns a partial or best-effort assignment mislabeled as valid (this is the Sev-1 class named in `02_srs.md §9`).

## 6. Observability

- Structured JSON logs everywhere, correlation ID threaded through every hop (FR-X2).
- Basic metrics per service: request latency, error rate, optimiser solve time, forecast generation time — exposed for a simple dashboard (even a lightweight one) so judges/team can see the system is real, not scripted.

## 7. Testing Protocol (backend-first means backend is tested first, and hardest)

| Level | What |
|---|---|
| Unit | Each service's core logic (e.g., risk tiering thresholds, cost estimator math) tested in isolation with known inputs/expected outputs |
| Integration | Real HTTP calls between services in a docker-compose test environment — no mocking across service boundaries at this level |
| Contract | Every endpoint validated against its OpenAPI spec (request/response shape) — this is what the frontend team trusts instead of reading backend code |
| Constraint/property tests | Optimiser-service specifically: generate random valid inputs, assert the output *never* violates a hard constraint — this is a property test, not just example-based, because a hackathon demo dataset alone won't catch every edge case |
| Load (lightweight) | Confirm the 72h forecast and heatmap endpoints stay within the performance targets in `02_srs.md §5` at hackathon-scale data volumes |
| Human + agent double-check | For every increment: a team member manually exercises each new endpoint via a REST client (e.g., Postman/HTTPie) against the running service; separately, IBM Bob is asked to review the diff and run/generate the test suite. Both results are logged in a shared test log before the increment is marked done (`02_srs.md §8`) |

## 8. Build Order (backend increments, mirrors `02_srs.md §7`)
1. **I1**: `ingestion-service`, `master-data-service` — get real (synthetic) data flowing and queryable.
2. **I2**: `forecast-service`, `risk-service` — prove predictions are accurate against held-out historical data (see `06_ml_engineering.md`) before any UI consumes them.
3. **I3**: `recommendation-service`, `optimiser-service` — prove constraint-safety via property tests before exposing overrides to a human.
4. **I4**: `plan-service`, `chat-service` — wire in the LLM last, once every fact it will ground itself in is already correct and tested.
5. **I5**: `audit-service` hardening, API-first polish for external TOS integration story.
