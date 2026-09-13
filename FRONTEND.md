# Frontend — Detailed Documentation

Single HTML file, no build step, no framework. This was a deliberate choice
for a 2-day hackathon build: a judge can open `index.html` directly in a
browser with zero setup — no `npm install`, no bundler, nothing to break.

---

## Design philosophy: built for a shift supervisor, not a developer

The person using this dashboard at 2am is not a data scientist — they're a
shift supervisor deciding what to do about a berth that's about to jam up.
Every design decision follows from that:

0. **Login and role identity are visible, not hidden.** The navbar always
   shows who's signed in and what role they have (Terminal Manager /
   Shift Supervisor) — a supervisor handing off a shift should never have
   to wonder whose account is active on screen.

1. **Plain-language explainer at the top of the page.** Before any data
   loads, the page states in one paragraph what green/amber/red mean and
   what the page is for. No one should have to guess what a heatmap cell
   represents.

2. **Color is never the only signal.** Every risk cell shows both a color
   *and* a letter (L / M / H). This isn't decoration — roughly 1 in 12 men
   have some form of color vision deficiency, and a color-only heatmap would
   be unusable for them. It also makes the dashboard readable at a glance on
   a poorly-lit warehouse floor screen where color rendering may be off.

3. **Numbers are surfaced, not buried.** The four stat cards at the top
   (berths at HIGH risk, open recommendations, unassigned vessels, berths in
   use) give the headline answer before anyone has to read a single table
   row. A supervisor glancing at the screen for 3 seconds should already
   know if it's a bad shift.

4. **Recommendations are actionable, not just informative.** Each one has
   an Accept/Reject button, not just a description — the interface's job is
   to support a decision, not just display a forecast.

5. **The shift briefing reads like a handoff note**, because that's
   literally its job — it's meant to be copy-pasted or read aloud to the
   next shift, in the same plain, direct language a human supervisor would
   use, not a data dump.

---

## Visual system

**Palette:** deep navy background (`#0a1420`–`#16293d`) — chosen because a
control-room / cockpit dashboard is the actual subject matter (this mirrors
real port operations software and low-light monitoring displays), not a
generic dark-mode default. Risk levels use a green → amber → red scale,
which is the one color convention almost every user already knows from
traffic lights and safety signage — this is not the place to invent a novel
color language.

**Typography:** IBM Plex Sans for interface text (readable, neutral, and an
intentional nod to IBM Bob given the hackathon's branding), IBM Plex Mono for
data values and the heatmap grid — using a monospace face for numeric/tabular
data is a functional choice here, not a stylistic default, since it keeps
columns of numbers visually aligned.

**Layout:** two-column grid on desktop (heatmap + briefing on the left,
recommendations feed on the right, matching how a supervisor would actually
scan the page — overview first, then specific actions), collapsing to a
single column below 820px for tablet/mobile use on the terminal floor.

---

## Accessibility features actually implemented (not just claimed)

- `skip-link` to jump straight to main content for keyboard/screen-reader users
- Every heatmap cell has both `title` (hover tooltip) and `aria-label`
  (screen reader text) — e.g. "High risk", not just a colored square
- The status line uses `aria-live="polite"` so a screen reader announces
  connection status changes without the user having to poll for them
- Table markup uses proper `<th scope="col">` / `<th scope="row">` so screen
  readers can announce which berth and time block a cell belongs to
- Visible keyboard focus is preserved (no `outline: none` anywhere in the CSS)
- Responsive down to a single column — nothing is cut off or requires
  horizontal scrolling on a tablet

---

## Component reference

| Component | Purpose |
|---|---|
| Login screen | Session-based sign-in, two demo roles (see SECURITY.md) |
| Navbar | Brand identity, role pill, signed-in user, sign-out |
| Explainer banner | Plain-English orientation, shown before any data loads |
| Stat row (4–5 cards) | At-a-glance headline numbers; one card is manager-only |
| Congestion heatmap | Berth × time-block grid, color + letter risk encoding |
| Recommendations feed | Actionable list with Accept/Reject, sorted by impact |
| Shift briefing panel | Grounded plain-text summary, generated from real pipeline output |
| Status line | Live connection state to the backend, with manual refresh |

## How data flows (frontend side)
`loadAll()` fires once on page load, calling four backend endpoints in
parallel (`/congestion`, `/berths`, `/recommendations`, `/plan`), then
`/optimize` separately for the summary stats. There's no polling/websocket —
for a 72h planning horizon, a static snapshot refreshed on demand (the
"Refresh" link) is the right amount of freshness; a real-time feed would be
solving a problem this use case doesn't have.

Accept/Reject on a recommendation is currently **local UI state only** — it
fades the item and doesn't call the optimiser back. This is called out
explicitly as a known limitation (see FEATURES.md's stretch list) rather than
left silently unfinished.
