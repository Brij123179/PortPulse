# Frontend Architecture — PortPulse
### Supervisor Cockpit UI/UX

Built **after** the backend contract for each increment is frozen (see `05_backend.md` and `02_srs.md §2.5`). The frontend never invents data shapes — it consumes exactly what the API contract defines, so there is never a "the backend isn't ready so I mocked something and forgot to fix it" bug class.

---

## 1. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | React (function components + hooks) | Matches the architecture doc; large ecosystem for dashboards |
| Styling | Tailwind CSS, with IBM Carbon Design System tokens layered in for an IBM-consistent look | Carbon gives instant visual credibility for an IBM hackathon; Tailwind speeds iteration |
| Charts | Recharts (Gantt-style views can be built on top of it) or a dedicated Gantt lib if time allows | Recharts is already available and well-supported in this stack |
| State management | React Context + hooks for global state (theme, auth, role); local component state elsewhere | Avoids over-engineering with Redux for a hackathon-scale app |
| Data fetching | A single typed API client module (`src/api/client.ts`) wrapping fetch, with one function per backend endpoint | Guarantees frontend and backend never silently drift — one place to update if a contract changes |
| Realtime | WebSocket/SSE client for heatmap and Gantt live updates | Matches `02_srs.md §4.4` |
| Testing | Jest + React Testing Library (unit/component), Playwright or Cypress (end-to-end) | Standard, agent-friendly (IBM Bob can generate and run these) |

## 2. Light/Dark Mode — Design Requirement, Not a Toggle Afterthought

Port control rooms run 24/7; night-shift readability is a genuine usability requirement (`02_srs.md §5`), not cosmetic polish.

- **Implementation**: CSS custom properties (design tokens) for every color used anywhere in the app — no component ever hardcodes a hex value. Two token sets (`--color-*` in `:root` for light, `[data-theme="dark"]` override block) are defined once, in one file.
- **Persistence**: theme choice stored client-side and respected on reload; defaults to the OS/browser `prefers-color-scheme` on first visit.
- **Coverage checklist per component** (part of Definition of Done, `02_srs.md §8`):
  - Text contrast ratio ≥ 4.5:1 in both modes (WCAG AA).
  - The congestion heatmap's red/amber/green states remain distinguishable in dark mode (do not rely on hue alone — pair color with an icon/label for colorblind accessibility, a specific requirement given this system's decisions have safety implications).
  - Charts, Gantt bars, and map/heatmap overlays all re-theme, not just page chrome.
  - Screenshots for the hackathon submission (`demo/screenshots/`) are taken in **both** modes to prove this actually works, not just that a toggle exists.

## 3. Screens / Views (mapped to Feature IDs from `01_features_list.md`)

| Screen | Features | Primary Role(s) |
|---|---|---|
| Live Status Table | F-105 | All roles |
| Congestion Heatmap (map + timeline) | F-203, F-206, F-207 | Supervisor, Terminal Manager |
| 72h Gantt View | F-402 | Supervisor, Terminal Manager |
| Recommendation Feed (Accept/Modify/Reject) | F-301–F-308, F-407 | Supervisor |
| What-If Simulator panel | F-308 | Supervisor, Vessel Planner |
| Shift Briefing (generated document view) | F-401, F-403, F-404 | All roles |
| Chat Assistant (docked panel) | F-406 | All roles |
| Admin Console (berth/crane/user config) | F-104, F-106 | Admin |
| Mobile Floor View (cut-down cockpit) | F-409 | Supervisor |

## 4. Component Architecture (high level)

```
src/
├── api/
│   └── client.ts              # one function per backend endpoint, typed
├── theme/
│   ├── tokens.css              # light + dark CSS variables, single source of truth
│   └── ThemeProvider.tsx
├── components/
│   ├── heatmap/
│   ├── gantt/
│   ├── recommendation-feed/
│   ├── chat-assistant/
│   ├── shift-briefing/
│   └── shared/                 # buttons, tables, badges — all theme-token based
├── pages/
│   ├── Cockpit.tsx
│   ├── AdminConsole.tsx
│   └── MobileFloorView.tsx
├── hooks/
│   ├── useLiveData.ts           # WebSocket/SSE subscription
│   └── useRole.ts
└── tests/
```

## 5. Frontend–Backend Connection (no ambiguity, no bugs)

- **Single contract source of truth**: the backend's OpenAPI spec (`05_backend.md §API Contracts`) is the only place request/response shapes are defined. The frontend's `api/client.ts` is generated or hand-written directly against that spec — never guessed.
- **Environment config**: API base URL, WebSocket URL, and feature flags come from a single `.env` (mirrored in `.env.example` per the submission template requirement) — never hardcoded per-component.
- **Error handling contract**: every API call has three explicit UI states — loading, error (with the backend's structured error message shown, not a generic "something went wrong"), and success. No screen silently fails.
- **Auth flow**: token acquired at login, attached to every request via the API client (never per-component), refreshed automatically before expiry; a 401 anywhere triggers one centralized re-auth/redirect, not a scattered per-page handler.
- **Role-based UI gating**: the frontend hides/disables actions a role can't perform (good UX), but this is explicitly documented as a convenience layer only — the backend is the enforcement point (`03_security.md §2`), so a hidden button is never the only thing standing between a role and an unauthorized action.

## 6. Build Order (matches Incremental Plan in `02_srs.md §7`)

1. **I1**: Live Status Table + theme system (light/dark) scaffolded first — cheapest way to prove the API client and theming work before anything AI-driven exists.
2. **I2**: Heatmap with real risk scores + explanation tooltips + confidence bands.
3. **I3**: Recommendation feed, What-If simulator, manual override with live constraint-violation flags.
4. **I4**: Gantt view, Shift Briefing view, Chat Assistant — assembled into the full Cockpit.
5. **I5**: Mobile Floor View, Admin Console polish.

No screen in a later increment is started until the API it depends on has passed its backend integration tests (`05_backend.md §Testing Protocol`) — this is the mechanism that prevents the "frontend built against an imagined API" bug class entirely.

## 7. Testing

| Level | Tool | What it covers |
|---|---|---|
| Unit | Jest + RTL | Individual components render correctly in both themes, given fixed props |
| Integration | RTL + mocked API client (mocking the client, never the fetch layer directly) | A screen correctly handles loading/error/success states |
| End-to-end | Playwright/Cypress | A full user journey: log in → view heatmap → accept a recommendation → see Gantt update |
| Visual/manual | Human + agent | Light/dark screenshot pass on every screen, every increment, before it's marked done |
| Accessibility | axe-core (automated) + manual keyboard-nav pass | WCAG AA per `02_srs.md §5` |

Every increment's frontend work is tested twice before merge: once by the developer/agent (IBM Bob) running the automated suite, once by a human clicking through the actual user journey — matching the "detailed testing by me and the agent" requirement end-to-end.

## 8. Business/Creative Framing for the Pitch
The cockpit's job is to replace a wall of spreadsheets with **one screen that answers three questions at a glance**: *What's about to break? What do I do about it? What happened when I did it?* That's the heatmap, the recommendation feed, and the audit trail — in that order, on one screen, in a color scheme that still works at 3am.
