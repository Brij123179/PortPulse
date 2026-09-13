# Backend — Detailed Documentation

Flask API, four engines, in-memory data (no database needed for the hackathon
scope — see SRS.md for why). This doc explains *what each file does and why*,
so a teammate or judge reading the code knows the reasoning without asking you.

---

## File-by-file

### `data_generator.py` — synthetic data
Generates the vessel and berth dataset the whole app runs on.

- **Why synthetic:** real AIS vessel-tracking feeds require paid access, out
  of budget for a 2-day build. This is stated openly, not hidden.
- **Fixed random seed (`random.seed(42)`):** every run of the app produces
  the exact same dataset. This matters for a demo — you want the same
  congestion story every time you present, not a random one.
- **Hardcoded "shock event":** three mega-ships are deliberately scheduled
  to arrive within a 6-hour window, on top of the randomised vessels. Without
  this, random generation might not reliably produce a visible congestion
  spike — the shock event guarantees the demo has something to show.
- **Output shape:**
  ```json
  {
    "generated_at": "2026-09-18T00:00:00",
    "berths": [{ "id": "B1", "name": "Berth 1", "length_m": 300,
                 "draft_limit_m": 14.2, "crane_count": 3, "capacity_teu": 6000 }],
    "vessels": [{ "id": "V1", "name": "Vessel-001", "vessel_class": "Panamax",
                  "eta": "...", "etd": "...", "cargo_teu": 2100, "draft_m": 11.4 }]
  }
  ```

### `congestion.py` — risk scoring engine
Answers: "which berths will be overloaded, and when?"

- **Formula (deliberately simple, not a black box):**
  `risk = overlapping_vessel_count × min(demand_TEU / berth_capacity_TEU, 1.0)`
  - `overlapping_vessel_count`: how many vessels have overlapping time windows
    at that berth in that hour
  - the demand ratio is **capped at 1.0** — once a berth is already "full",
    additional cargo volume shouldn't keep inflating the score; vessel count
    is what drives *additional* congestion past that point
- **Round-robin berth assignment for prediction:** before optimisation runs,
  vessels are distributed round-robin across their draft-compatible berths.
  This was a real bug we caught and fixed during build — the first version
  gave every berth the *entire* compatible vessel list, which made almost
  every berth look HIGH-risk simultaneously (unrealistic). Round-robin
  models "if nobody actively manages assignment, ships roughly spread out."
- **Thresholds:** LOW < 1.0, MEDIUM < 2.2, else HIGH — tuned by running the
  generator and checking the resulting distribution looks like a real port
  (mostly LOW/MEDIUM, a handful of genuine HIGH spikes), not tuned to a
  formula from a textbook.
- **`summarize_high_risk()`:** collapses consecutive hourly HIGH slots per
  berth into a single readable window (e.g. "HIGH from Fri 18:00 to Sat
  02:00") instead of dumping 8 separate hourly rows at the user.

### `optimizer.py` — recommendations + berth assignment
Two separate jobs in one file:

1. **`recommend_actions()`** — for each HIGH-risk window, proposes one
   concrete fix (divert the latest-arriving vessel, or slow-steam the
   second-latest). `estimated_hours_saved` is a **bounded** estimate
   (capped at 18h for diverts, 10h for slow-steam) — an earlier version let
   this scale unbounded with the risk score and produced absurd values like
   "4,929 hours saved," which would have embarrassed the demo. Capping it
   to a plausible single-service-window range was a deliberate fix, not an
   oversight.
2. **`assign_berths()`** — a **greedy heuristic**, not a MILP solver: sort
   vessels by ETA, assign each to the first berth that's draft-compatible
   and has no time conflict. This is a documented simplification — a real
   MILP solve (e.g. Google OR-Tools) would find a better global assignment,
   but greedy is deterministic, fast, and easy to explain live in a demo.
   Vessels that don't fit anywhere in the 72h window are returned as
   `unassigned_vessel_ids` — this is the system's honest signal that the
   port is over capacity, not a bug to hide.

### `plan_generator.py` — shift briefing
Fills a template with real numbers from the other three engines — it does
**not** call an LLM to freely generate content. This is a deliberate choice:
a templated, grounded briefing is guaranteed to be accurate; an LLM-generated
one risks inventing a number that doesn't match the dashboard. Only the top
5 highest-priority risk windows and recommendations are shown in the
briefing (with a "+N more" note) — a real supervisor doesn't want a 26-item
list at the start of a shift.

`call_llm_rephrase()` is left as a clearly-marked stub: if you want the "wow"
moment of an LLM turning this into looser prose, wire in your provider there.
The app runs completely without it.

---

### `auth.py` — demo authentication
Session-based login with two hardcoded roles (`terminal_manager`,
`shift_supervisor`). See SECURITY.md for exactly what's real (working
session tokens, 401 enforcement on every data route) versus what's
simplified for the hackathon (no password hashing, in-memory sessions).
`app.py`'s `require_auth` decorator is what actually enforces this on
every route except `/api/health` and `/api/login`.

## API Reference

| Endpoint | Method | Auth required | Returns |
|---|---|---|---|
| `/api/health` | GET | No | `{"status": "ok"}` — liveness check |
| `/api/login` | POST | No | `{token, user}` on valid credentials, 401 otherwise |
| `/api/logout` | POST | Yes | Invalidates the session token |
| `/api/me` | GET | Yes | Current user's username, role, display name |
| `/api/vessels` | GET | Yes | Full synthetic vessel list |
| `/api/berths` | GET | Yes | Full synthetic berth list |
| `/api/congestion` | GET | Yes | `{slots: [...], high_risk_summary: [...]}` |
| `/api/recommendations` | GET | Yes | List of recommended actions |
| `/api/optimize` | GET | Yes | `{assignments, unassigned_vessel_ids, berths_used, estimated_avg_wait_hours}` |
| `/api/plan` | GET | Yes | `{"briefing": "<plain text shift briefing>"}` |

"Auth required" routes return 401 with `{"error": "unauthorized"}` if the
`Authorization: Bearer <token>` header is missing or invalid.

All read-only, no request body needed — this is a demo/read pipeline, not a
CRUD app, so there are intentionally no POST/PUT/DELETE routes (see
SECURITY.md for why that matters).

---

## Why no database
The full dataset (≈100 vessels, ≈15 berths) regenerates in memory in well
under a second at app startup. A database would add setup complexity
(install, migrate, connection config) that a judge running `setup-guide.md`
on a clean machine would have to fight through, for zero benefit at this
data size. This is stated as a scope decision in SRS.md, not an oversight.
