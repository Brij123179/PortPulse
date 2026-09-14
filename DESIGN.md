---
name: PortPulse Maritime OS
colors:
  surface: '#0b1322'
  surface-dim: '#080d18'
  surface-bright: '#16253e'
  surface-container-lowest: '#060a12'
  surface-container-low: '#080d18'
  surface-container: '#0f1b2e'
  surface-container-high: '#16253e'
  surface-container-highest: '#1a2a44'
  on-surface: '#f1f5f9'
  on-surface-variant: '#94a3b8'
  inverse-surface: '#f8fafc'
  inverse-on-surface: '#0f172a'
  outline: '#1e3252'
  outline-variant: '#334155'
  surface-tint: '#0ea5e9'
  primary: '#0ea5e9'
  on-primary: '#ffffff'
  primary-container: '#0284c7'
  on-primary-container: '#ffffff'
  inverse-primary: '#38bdf8'
  secondary: '#38bdf8'
  on-secondary: '#082f49'
  secondary-container: '#0369a1'
  on-secondary-container: '#e0f2fe'
  tertiary: '#6366f1'
  on-tertiary: '#ffffff'
  tertiary-container: '#4338ca'
  on-tertiary-container: '#e0e7ff'
  error: '#ef4444'
  on-error: '#ffffff'
  error-container: '#7f1d1d'
  on-error-container: '#fee2e2'
  primary-fixed: '#bae6fd'
  primary-fixed-dim: '#7dd3fc'
  on-primary-fixed: '#082f49'
  on-primary-fixed-variant: '#0369a1'
  secondary-fixed: '#e0f2fe'
  secondary-fixed-dim: '#bae6fd'
  on-secondary-fixed: '#082f49'
  on-secondary-fixed-variant: '#0369a1'
  tertiary-fixed: '#e0e7ff'
  tertiary-fixed-dim: '#c7d2fe'
  on-tertiary-fixed: '#1e1b4b'
  on-tertiary-fixed-variant: '#3730a3'
  background: '#060a12'
  on-background: '#f1f5f9'
  surface-variant: '#1e293b'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-label:
    fontFamily: 'JetBrains Mono'
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  mono-kpi:
    fontFamily: 'JetBrains Mono'
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.625rem
  lg: 0.75rem
  xl: 1rem
  full: 9999px
spacing:
  unit: 4px
  container-padding-mobile: 16px
  container-padding-desktop: 24px
  gutter: 16px
  sidebar-width: 240px
  topbar-height: 56px
---

## Brand & Style
The design system is a high-performance **Maritime Tactical Operating Cockpit** designed specifically for port superintendents, harbor pilots, and container terminal planners. It delivers ultra-high information density without visual clutter, engineered to sustain 24/7 mission-critical operations in port control rooms with zero eye fatigue.

The visual style is **Cyber-Maritime Tactical Glassmorphism**. It combines deep oceanic midnight backgrounds with crisp electric cyan accents, high-contrast semantic indicators (Emerald for clear flow, Amber for caution, and Coral Red for critical congestion), and tactical radar telemetry. Monospaced typography is strictly enforced for all maritime identifiers (IMO numbers, container TEUs, geographic coordinates, drafts, and UTC timestamps).

## Colors & Semantic Tiers
- **Background (#060A12):** Infinite deep ocean slate canvas that grounds all quayside and radar elements.
- **Surface (#0B1322) & Cards (#0F1B2E):** Elevated glassmorphic panels with subtle 1px outlines (`#1E3252`) and `backdrop-filter: blur(12px)`.
- **Primary Cyan (#0EA5E9):** Signifies maritime intelligence, active selections, and telemetry tracking.
- **Secondary Sky (#38BDF8):** Used for available berths and approach transit vectors.
- **Safety Semantic Hierarchy:**
  - **LOW Risk / Available:** Emerald (`#10B981`) with soft background tint (`rgba(16, 185, 129, 0.12)`).
  - **MEDIUM Risk / Attention:** Amber (`#F59E0B`) with soft background tint (`rgba(245, 158, 11, 0.12)`).
  - **HIGH Risk / Critical Congestion:** Crimson Coral (`#EF4444`) with soft background tint (`rgba(239, 68, 68, 0.15)`).
  - **AI Prescriptive Intelligence:** Indigo (`#6366F1`).

## Typography
- **Primary Typeface:** **Inter** for all UI labels, navigation, instructions, and general body copy.
- **Telemetry & Machine Typeface:** **JetBrains Mono** or **Geist Mono** for all numerical data, ETA clocks, coordinates, vessel specs, and audit hashes.
- **Rules:** Never communicate critical status through color alone. Pair every colored indicator with an icon and explicit text label to guarantee WCAG AA accessibility.

## Layout & Spatial System
- **Grid:** 12-column responsive layout built on a strict 4px baseline unit.
- **Master Header:** Fixed 56px topbar housing port selector, live UTC simulation clock, replay controls (1x, 2x, 5x), ML heartbeat, and role selector.
- **Left Navigation Rail:** Persistent 240px navigation sidebar with real-time alert badges.
- **Central Canvas:** Dynamic dashboard views accommodating the 72h Gantt chart, interactive Leaflet vessel map, 72h heatmap matrix, and What-If simulator.
- **Flyout Drawers:** 420px slide-over drawers for Vessel Telemetry inspection and the PortPulse AI Maritime Copilot.

---

## Anti-Generic Design Directive: Bespoke Maritime Luxury & Zero-Clutter Architecture

### 1. Rejecting "AI Template" Clichés (The Anti-Slop Manifesto)
To ensure the interface feels custom-engineered, prestigious, and purpose-built—rather than a generic, cookie-cutter AI dashboard:
- **NO Generic Purple Gradients or Neon Blobs:** Eliminate trendy purple/violet gradient cards and decorative floating blur circles that serve no operational purpose.
- **NO "Card Grid Syndrome":** Avoid laying out 12 identical rectangular cards that fight for visual attention. Information is presented in a cohesive, architectural cockpit with clear focal hierarchy.
- **NO Puffy, Toy-Like Rounding:** Restrict large border radii. Use crisp, purposeful rounding (`6px` to `8px`) with razor-sharp 1px hairline borders (`rgba(255, 255, 255, 0.07)` or `#1E3252`) to evoke high-precision naval avionics and luxury Swiss instruments.
- **Inspiration Anchor:** Think **Kongsberg Maritime Bridge Systems + Linear.app + Teenage Engineering Hardware + Dark-Mode Bloomberg Terminal**. Highly functional, deeply calm, undeniably beautiful.

---

### 2. Progressive Disclosure: The 3-Tier Calm Surface
Do not dump every single telemetry point on the operator at once. Structure the UI into three layers of disclosure:

```
+-------------------------------------------------------------------------------+
| TIER 1: Ambient Glance (Always Visible)                                       |
| - High-level port rhythm: 1 Calm Congestion Dial, 3 Primary Vitals, 72h Bar   |
| - If port is healthy, the interface is quiet, dark, and peaceful              |
+-------------------------------------------------------------------------------+
       | Hover / Click (Contextual Revelation)
       v
+-------------------------------------------------------------------------------+
| TIER 2: Contextual Focus (Revealed on Demand)                                |
| - Hovering a berth/vessel spotlights its trajectory & quick action chips      |
| - Zero layout shift: smooth micro-flyouts, inline sparklines, non-destructive |
+-------------------------------------------------------------------------------+
       | Deep Dive Trigger (Shortcut / Action)
       v
+-------------------------------------------------------------------------------+
| TIER 3: Diagnostic Precision (Slide-Over Sheets & Modals)                     |
| - SHAP Waterfall charts, Cascade Delay network trees, What-If simulation trees|
| - Contained within clean 420px slide-over drawers without leaving main canvas |
+-------------------------------------------------------------------------------+
```

---

### 3. Clutter-Free Cognitive Ergonomics (The 3-Second Rule)
In a high-stress 24/7 port control room, visual noise causes catastrophic fatigue. The design must pass the **3-Second Rule**:
*In 3 seconds, a supervisor must immediately recognize:*
1. **System Health:** Is the port flowing normally (Emerald) or choking (Amber/Red)?
2. **The Bottleneck:** Which berth or vessel has the critical clash?
3. **The Solution:** What single-click action eliminates the delay?

#### Key De-Cluttering Mechanics:
- **Intelligent Alert Quenching:** Routine updates (routine AIS pings, pilot boardings) remain silent in the background. Only actionable conflicts (>2h schedule drift, berth clashes, weather holds) elevate into view.
- **The "Zen Deck" Toggle (`Z` Key / Focus Mode):** An instant one-click toggle in the header that collapses the left sidebar and secondary metrics, granting 100% full-screen real estate to the interactive 72h Gantt or the Vessel Radar.
- **Command Palette (`Cmd+K` / `Ctrl+K`):** Powerful keyboard-first launcher allowing operators to type `swap B2 B4` or `find Ever Given` to execute complex actions in seconds without menu-diving.

---

### 4. Tactile Micro-Interactions & Sensory Feedback
- **Surgical Laser Accentuation:** 90% of the UI remains a quiet, matte dark slate (`#060A12` / `#0B1322`). Vibrancy is used exclusively as a surgical laser—only active vessels, critical bottlenecks, and user focus points illuminate.
- **Magnetic Timeline Scrubbing:** When scrubbing the 72h forecast timeline, the playhead magnetically snaps to forecasted peak congestion buckets with a subtle haptic visual cue.
- **Luminescent Breathing (Bottleneck Warning):** When a critical berth conflict is detected, the affected berth does not flash aggressively; it emits a slow, rhythmic 2-second luminescent pulse. Once the supervisor accepts the AI recommendation, the pulse seamlessly dissolves into solid emerald relief.
