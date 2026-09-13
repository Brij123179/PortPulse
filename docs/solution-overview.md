# Solution Overview — PortPulse

## Vision
PortPulse acts as an operational twin and prescriptive decision-support engine for container terminals. Rather than merely observing ongoing delays, PortPulse projects congestion 72 hours into the future, calculates optimal berth and crane allocations, and presents human operators with verified recommendations and automated shift briefings.

## Core Capabilities

### 1. Ingestion & Operational Normalization (Increment 1)
- Ingests vessel schedules, berth configurations (length, draft limit, crane slots), yard utilization, and environmental constraints (weather/tide).
- Normalizes data into a unified schema stored in SQLite (for lightweight local execution) or PostgreSQL (for production scaling).
- Provides an immediate, read-only Live Status Table for terminal personnel.

### 2. Predictive Congestion Heatmap (Increment 2)
- Regresses corrected arrival times based on historical carrier bias.
- Models hour-by-hour berth occupancy using Prophet and LightGBM.
- Generates risk tiers (Green/Amber/Red) accompanied by SHAP explainability factors and confidence intervals.

### 3. Prescriptive Interventions & MILP Optimization (Increment 3)
- Generates diversion, slow-steaming, and priority re-sequencing advisories with transparent side-by-side cost and time metrics.
- Computes mathematically optimal berth and crane assignments using Mixed-Integer Linear Programming (MILP via OR-Tools / PuLP), guaranteeing zero hard constraint violations.
- Supports supervisor manual overrides with real-time constraint guardrails and What-If simulation.

### 4. Generative AI Cockpit & Shift Briefings (Increment 4)
- Uses RAG grounded strictly on live data with IBM Bob / watsonx.ai to generate 72-hour shift briefings and shift handover notes.
- Delivers a conversational, natural-language operational assistant.
- Presents a unified single-screen cockpit with Gantt visual schedules, risk heatmaps, recommendation feeds, and light/dark theming.

### 5. Governance, Audit & Continuous Learning (Increment 5)
- Preserves an append-only audit trail capturing every AI recommendation and human accept/modify/reject decision.
- Enables historical backtest replay scenarios (such as the 2021 LA/Long Beach disruption).
