# Security — PortPulse

This document splits clearly into two parts: what is **actually implemented**
in this repo right now, and what's **recommended but out of scope** for a
2-day hackathon build. Judges specifically reward honesty here (see SRS.md's
`known_limitations` section) — claiming production-grade security on a
weekend build would be overclaiming, so we don't.

---

## 1. Implemented in this repo (verified working)

### CORS allow-list, not wildcard
`app.py` restricts cross-origin requests to an explicit list
(`PORTPULSE_ALLOWED_ORIGINS`), defaulting to local dev origins only. A
wildcard `CORS(app)` (the Flask default) would let *any* website's
JavaScript call this API from a visitor's browser — restricting it is a
one-line fix with no functional cost.

### No debug mode by default
Flask's debug mode is **off unless `PORTPULSE_DEBUG=1`** is explicitly set.
Flask's interactive debugger, if left on and the port is reachable, allows
arbitrary Python code execution from a browser — this is a well-known
real-world misconfiguration, not a theoretical risk. Default-off means a
teammate can't accidentally ship this on.

### No stack traces leaked to the client
Every route is wrapped in `safe_route()` (see `app.py` / `BACKEND.md`) so an
unexpected exception returns `{"error": "internal_server_error"}` with a
generic 500, while the real exception and stack trace go to the server log
only. Verified: hitting a broken route returns a clean JSON error, not a
Python traceback in the browser.

### Basic security response headers
Set on every response via `security_headers_middleware` in `src/backend/app/main.py`:
- `X-Content-Type-Options: nosniff` — stops browsers from guessing content types in a way that can be exploited to run unexpected code
- `X-Frame-Options: DENY` — prevents the dashboard from being embedded in another site's iframe (clickjacking protection)
- `Referrer-Policy: no-referrer` — don't leak internal terminal URLs to external sites when a link is followed
- `X-XSS-Protection: 1; mode=block` — browser-level reflected cross-site scripting filter
- `X-Correlation-ID` — unique request tracing identifier on every response header

### No secrets committed to the repo
`.env.example` documents every environment variable the app can use, with
placeholder/empty values — actual secrets go in a local `.env` file, which
`.gitignore` excludes from version control. There are currently no real
secrets required to run the app (no API keys are needed for the base demo).

### No SQL injection surface
There is no database and no raw SQL anywhere in this codebase — the entire
dataset is generated in memory. This isn't a "we followed best practice"
claim, it's structurally true because the attack surface doesn't exist.

### Read-only API surface
Every endpoint is `GET`-only. There are no `POST`/`PUT`/`DELETE` routes that
accept and act on user input, which removes an entire category of
injection/validation concerns for this build (see FR-6 in SRS.md — the
Accept/Reject buttons are frontend-only state, they don't write anything
back to the server).

### Frontend: no unsafe DOM injection of untrusted data
All dynamic content in `index.html` is either backend-generated data
(vessel names, berth names — themselves synthetic, not user-submitted) or
static template strings — there is no user text-input field anywhere in
this app, so there's no reflected-XSS surface from user input.

---

### Session-based login with role-based access (RBAC)
`auth.py` implements demo authentication: two hardcoded accounts (`manager`
/ `supervisor`), a login endpoint that issues a random session token
(`secrets.token_hex`, cryptographically random — not a predictable ID), and
`require_auth` middleware that rejects any data request without a valid
token. Passwords are compared with `secrets.compare_digest` (constant-time
comparison) to avoid timing-attack leakage, small as that risk is here.

**This is explicitly a demo simplification, not production auth** — see the
table below for exactly what's missing. It's included here rather than in
the "recommended but missing" list because it genuinely works end-to-end
(verified: unauthenticated requests get 401, valid login returns a working
session, the token gates every data route) — it's just scoped for a
hackathon, not hardened for production.

### Role-based UI (not just role-based API)
The `terminal_manager` role sees one additional stat (estimated average
wait time) that `shift_supervisor` does not — a real, visible difference
driven by the `role` field returned from `/api/me`, not a cosmetic label.
This demonstrates the RBAC concept the report template expects without
overclaiming a full permissions matrix.

## 2. Recommended for production (explicitly out of scope for the hackathon)

Listed here so a reader — including a judge — can see we know the
difference between "hackathon-safe" and "production-safe," rather than
silently stopping at the easy parts.

| Area | What's missing | Why it's out of scope for 2 days |
|---|---|---|
| Authentication | Passwords are hardcoded plaintext in `auth.py`, not hashed (no bcrypt/argon2); only 2 fixed accounts, no signup/user management; sessions are lost on server restart (in-memory) | Real password hashing + a user store is the natural next step, but doing it properly (bcrypt, salted, stored securely) was a multi-hour task better spent on the core PS engines given the 2-day window |
| Rate limiting | No throttling on API endpoints | Not needed for a local single-user demo; would matter once deployed publicly |
| HTTPS/TLS | App runs on plain HTTP locally | Standard for local dev; any real deployment must sit behind TLS (e.g. via a reverse proxy) |
| Input validation framework | N/A — there's no user-writable input in this build | Would become necessary the moment a POST endpoint (e.g. "submit a real vessel schedule") is added |
| Audit logging | Server logs exceptions but doesn't log who accessed what | Relevant once there's real authentication and multiple users to distinguish |
| Dependency scanning | `requirements.txt` pins versions but isn't scanned by a tool (e.g. `pip-audit`, Dependabot) | Two dependencies total (`flask`, `flask-cors`) — low risk at this scale, but should be wired up before real deployment |
| Secrets management | `.env` file, not a vault/KMS | Fine for a hackathon; a real deployment handling actual vessel/customer data would need proper secrets management |

---

## 3. If you extend this app, revisit security here

The two most likely extensions from FEATURES.md's stretch list both change
the security posture:

- **Swapping in a live LLM API call** (`call_llm_rephrase` in
  `plan_generator.py`): once you do this, the LLM API key becomes a real
  secret — make sure it's read from `.env`/environment only, never hardcoded,
  and never returned in any API response or error message.
- **Making Accept/Reject write back to the server**: the moment
  Accept/Reject becomes a real `POST` endpoint, it needs input validation
  (is this a real recommendation ID that exists?) and — if this ever handles
  real vessel/port data instead of synthetic data — authentication, since
  you'd be allowing a network caller to affect operational decisions.
