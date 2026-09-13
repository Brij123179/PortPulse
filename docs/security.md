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

- **Authentication**: OAuth2 / OIDC-based login (IBM Cloud IAM as the reference integration per the architecture doc). In the local prototype, a standard Bearer token scheme with Argon2id password hashing is provided.
- **Authorization**: Role-Based Access Control (RBAC) matching the four roles in `docs/architecture.md`:
  - **Admin**: full read/write, including master data and user management.
  - **Terminal Manager**: read all; write on approvals for high-impact recommendations.
  - **Vessel Planner**: read all; write on schedule import and routing suggestions.
  - **Shift Supervisor**: read all; write on accept/modify/reject actions and manual overrides.
- Every API endpoint declares its minimum required role; enforcement happens server-side (never trust a frontend role check alone — client-side UX gating is a convenience layer only).
- Session tokens are short-lived (access token ≤ 15 min) with refresh tokens rotated on use.

## 3. Data Protection

| Layer | Control |
|---|---|
| In transit | TLS 1.2+ enforced on all external endpoints. No plaintext HTTP in production. |
| At rest | Database encryption at rest (native Postgres/Db2 encryption or disk-level encryption). |
| Secrets | No secrets in source control. `.env` files gitignored. Secrets injected via environment variables (`src/.env.example`). |
| PII | User account data (names, emails) treated as PII: minimal retention, access-logged. |
| LLM grounding data | SOP documents and operational data fed to the RAG pipeline are treated as internal-confidential; system prompts and internal raw configs are never echoed verbatim in transcripts. |

## 4. API & Application Security

- **Input validation** on every endpoint — reject malformed vessel/berth records rather than silently coercing them (Pydantic models validate constraints at boundary).
- **Rate limiting** on public endpoints and chat assistant queries.
- **Prompt-injection defense** (F-401/F-406): any user- or data-supplied text inserted into LLM prompts is treated as untrusted content, delimited from system instructions. The LLM cannot execute actions directly.
- **Output validation**: LLM-generated briefings are validated against live database entities (e.g. berth/vessel IDs must exist) before display.
- **CORS**: locked to known frontend origin; no wildcard `*` in production.
- **Dependency hygiene**: pinned dependencies scanned for vulnerabilities.

## 5. Audit & Logging

- Every AI recommendation (F-301–F-308, F-401) and human decision (F-407) is recorded in an append-only audit log: actor, action, timestamp, and rationale snapshot (F-501).
- Logs never contain secrets or credentials.
- Logs are structured JSON with correlation IDs (`X-Correlation-ID`) across hops.

## 6. Secure SDLC Practices

| Increment | Security Activity |
|---|---|
| I1 | RBAC scaffolding and server-side role enforcement; secrets management via `.env.example`; input validation |
| I2 | Input validation on prediction endpoints; ensure no sensitive data leaks into model logs |
| I3 | Guardrail logic for manual overrides (F-307) treated as safety/security control; prevent hard constraint violations |
| I4 | Prompt-injection adversarial tests on chat assistant and shift briefing; CORS and rate limiting |
| I5 | Immutable audit trail hardening; dependency security scanning |
