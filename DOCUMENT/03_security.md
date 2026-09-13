# Security Design — PortPulse
### L1: Container Congestion Predictor & Port Operations Optimiser

This document defines the security posture for PortPulse across every increment. Port operations software sits close to critical infrastructure — even a hackathon prototype should be designed as if it could one day run against a real terminal, because judges score "Problem Depth & Vision" partly on whether the team thought past the demo.

---

## 1. Threat Model (Summary)

| Asset | Threat | Impact if compromised |
|---|---|---|
| Vessel schedule & berth data | Unauthorized read | Competitive/commercial sensitivity (shipping schedules, cargo priority) |
| Optimiser/recommendation engine | Tampering with inputs to force a bad assignment | Physical safety risk (draft/length violation), financial loss |
| Supervisor accept/reject actions | Spoofed or repudiated actions | Breaks the audit trail required for port-authority compliance (F-501) |
| LLM chat assistant | Prompt injection via ingested data (e.g., a malicious "vessel name" field) | Assistant could leak internal data or fabricate an unsafe recommendation |
| Admin console | Privilege escalation | Full system compromise — berth/crane master data tampering |
| Credentials / API keys (watsonx.ai, DB) | Leakage via logs, repo, or client bundle | Full data or model access by a third party |

---

## 2. Identity, Authentication & Authorization

- **Authentication**: OAuth2 / OIDC-based login (IBM Cloud IAM as the reference integration per the architecture doc). No custom password storage in the hackathon build unless IAM integration isn't feasible in time — if so, use a well-vetted library (e.g., Argon2id-hashed passwords), never a homemade scheme.
- **Authorization**: Role-Based Access Control (RBAC) matching the four roles in `02_srs.md §2.3`:
  - **Admin**: full read/write, including master data and user management.
  - **Terminal Manager**: read all; write on approvals for high-impact recommendations.
  - **Vessel Planner**: read all; write on schedule import and routing suggestions.
  - **Shift Supervisor**: read all; write on accept/modify/reject actions and manual overrides.
- Every API endpoint declares its minimum required role; enforcement happens server-side (never trust a frontend role check alone — see `04_frontend.md` for the corresponding client-side UX gating, which is a convenience layer only).
- Session tokens are short-lived (access token ≤ 15 min) with refresh tokens rotated on use.

## 3. Data Protection

| Layer | Control |
|---|---|
| In transit | TLS 1.2+ enforced on every service-to-service and client-to-service connection. No plaintext HTTP, including internally. |
| At rest | Database encryption at rest (native Postgres/Db2 encryption or disk-level encryption in the container platform). |
| Secrets | No secrets in source control. `.env` files gitignored (per submission template rules). Secrets injected via environment variables or a secrets manager (e.g., IBM Cloud Secrets Manager / Kubernetes Secrets) — never hardcoded, never logged. |
| PII | This domain is largely non-PII (vessels, berths, cargo), but any user account data (names, emails) is treated as PII: minimal retention, access-logged. |
| LLM grounding data | SOP documents and live operational data fed to the RAG pipeline are treated as internal-confidential; the LLM prompt layer must not echo raw system prompts or internal document contents verbatim in a way that leaks configuration into a public-facing transcript. |

## 4. API & Application Security

- **Input validation** on every endpoint — reject malformed vessel/berth records rather than silently coercing them (a bad record must not be able to crash the optimiser or corrupt a forecast).
- **Rate limiting** on all public-facing endpoints, especially the chat assistant (F-406), to prevent abuse and to bound LLM API cost.
- **Prompt-injection defense** for F-401/F-406: any user- or data-supplied text that gets inserted into an LLM prompt is treated as untrusted content, clearly delimited from system instructions, and the model's output is never used to directly execute an action (e.g., the chat assistant cannot itself accept/reject a recommendation — F-407 only accepts a human, authenticated click).
- **Output validation**: LLM-generated shift briefings are validated against the underlying data (e.g., berth IDs referenced must exist) before being shown, reducing the risk of a fabricated fact reaching a supervisor.
- **CORS**: locked to the known frontend origin(s); no wildcard `*` in production/demo config.
- **Dependency hygiene**: no committed `node_modules/`, `__pycache__/`, `.venv/`, or build artifacts (also enforced by the submission template's `.gitignore`); dependencies pinned and periodically scanned (e.g., `pip-audit`, `npm audit`).

## 5. Audit & Logging

- Every AI recommendation (F-301–F-308, F-401) and every human action on it (F-407) is written to an **append-only audit log**: who, what, when, and the system's rationale at that moment (F-501, FR-X2 correlation IDs).
- Logs never contain secrets or raw credentials.
- Logs are structured (JSON) with a correlation ID that ties a single vessel/berth decision across every microservice it touched — this is both a security control (forensics) and an engineering one (debugging, per `05_backend.md`).

## 6. Secure SDLC Practices (matches the Incremental Build Plan)

| Increment | Security activity |
|---|---|
| I1 | RBAC scaffolding in place before any real data is exposed; secrets management wired up from day one, not retrofitted |
| I2 | Input validation on all new prediction endpoints; confirm no PII/sensitive data leaks into model training logs |
| I3 | Guardrail logic for manual overrides (F-307) reviewed as a security control, not just a UX feature — an override that silently bypasses a hard constraint is a Sev-1 security bug, not just a product bug |
| I4 | Prompt-injection test pass on chat assistant and briefing generator before demo; CORS and rate limiting finalized |
| I5 | Full audit trail review; dependency and secret scan across the whole repo before submission |

## 7. Testing the Security Controls

- **Manual adversarial test**: team member attempts to (a) access an Admin-only endpoint as a Supervisor role, (b) submit a malformed berth record, (c) inject an instruction into a vessel-name field and see if the chat assistant follows it instead of the system prompt.
- **Agent-assisted test**: use IBM Bob's `/review` mode to scan diffs for hardcoded secrets, missing input validation, and RBAC gaps before merging any increment (this doubles as evidence of genuine Bob integration for the judging rubric).
- Record every security test result in the same test log referenced in `05_backend.md §Testing Protocol` — security tests are not a separate, skippable checklist; they're part of each increment's Definition of Done (`02_srs.md §8`).

## 8. Known Limitations (be explicit about these in the submission — judges respect honesty per the submission guide)
- No live IAM integration if time-constrained — documented fallback auth noted above.
- No penetration test beyond the manual/agent-assisted pass above; this is a hackathon-scope security review, not a production audit.
- Synthetic data only — no real vessel/cargo data is ever handled, so real-world data-protection risk is currently theoretical, but the controls above are designed as if it weren't.
