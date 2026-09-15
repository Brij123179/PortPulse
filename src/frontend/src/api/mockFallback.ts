/**
 * PortPulse High-Fidelity Standalone / Cloud Fallback Engine
 * Provides realistic operational state, MILP allocations, and AI Copilot responses
 * whenever the backend server is starting up, unreachable, or in cloud demo mode.
 */

import {
  LiveStatusSummary,
  VesselStatusItem,
  BerthStatusItem,
  HeatmapResponse,
  AnchorageForecastResponse,
  CascadeSimulationResponse,
  MLMetricsResponse,
  RecommendationsListResponse,
  OptimisationRunResponse,
  OverrideValidationResult,
  WhatIfResponse,
  AuditLogListResponse,
  AuditLogEntryItem,
  ChatQueryResponse,
  ShiftBriefingResponse,
} from './client';

export const INITIAL_FALLBACK_BERTHS: BerthStatusItem[] = [
  { id: "B-01", name: "Berth 1 - Deepwater ULCV", length_m: 400, draft_limit_m: 16.5, crane_slots: 4, operational_cranes: 4, status: "OCCUPIED", current_vessel_id: "V-101", current_vessel_name: "Ever Given", utilization_pct: 88 },
  { id: "B-02", name: "Berth 2 - Deepwater ULCV", length_m: 400, draft_limit_m: 16.0, crane_slots: 4, operational_cranes: 3, status: "OCCUPIED", current_vessel_id: "V-102", current_vessel_name: "MSC Oscar", utilization_pct: 75 },
  { id: "B-03", name: "Berth 3 - Post-Panamax", length_m: 350, draft_limit_m: 14.5, crane_slots: 3, operational_cranes: 3, status: "AVAILABLE", current_vessel_id: null, current_vessel_name: null, utilization_pct: 0 },
  { id: "B-04", name: "Berth 4 - Post-Panamax", length_m: 350, draft_limit_m: 14.0, crane_slots: 3, operational_cranes: 2, status: "OCCUPIED", current_vessel_id: "V-103", current_vessel_name: "CMA CGM Rivoli", utilization_pct: 66 },
  { id: "B-05", name: "Berth 5 - Panamax Container", length_m: 290, draft_limit_m: 12.5, crane_slots: 3, operational_cranes: 3, status: "AVAILABLE", current_vessel_id: null, current_vessel_name: null, utilization_pct: 0 },
  { id: "B-06", name: "Berth 6 - Panamax Container", length_m: 290, draft_limit_m: 12.0, crane_slots: 2, operational_cranes: 2, status: "MAINTENANCE", current_vessel_id: null, current_vessel_name: null, utilization_pct: 0 },
  { id: "B-07", name: "Berth 7 - Feeder North", length_m: 200, draft_limit_m: 10.5, crane_slots: 2, operational_cranes: 2, status: "OCCUPIED", current_vessel_id: "V-104", current_vessel_name: "Madrid Maersk", utilization_pct: 82 },
  { id: "B-08", name: "Berth 8 - Feeder North", length_m: 200, draft_limit_m: 10.0, crane_slots: 2, operational_cranes: 2, status: "AVAILABLE", current_vessel_id: null, current_vessel_name: null, utilization_pct: 0 },
  { id: "B-09", name: "Berth 9 - Feeder South", length_m: 180, draft_limit_m: 9.5, crane_slots: 2, operational_cranes: 1, status: "OCCUPIED", current_vessel_id: "V-105", current_vessel_name: "ONE Apus", utilization_pct: 70 },
  { id: "B-10", name: "Berth 10 - Feeder South", length_m: 180, draft_limit_m: 9.0, crane_slots: 2, operational_cranes: 2, status: "AVAILABLE", current_vessel_id: null, current_vessel_name: null, utilization_pct: 0 }
];

export const INITIAL_FALLBACK_VESSELS: VesselStatusItem[] = [
  { id: "V-101", name: "Ever Given", vessel_class: "ULCV", cargo_volume: 18500, carrier_eta: new Date(Date.now() - 3600000 * 6).toISOString(), corrected_eta: new Date(Date.now() - 3600000 * 4).toISOString(), eta_confidence: 94, priority_flag: true, length_m: 399, draft_m: 15.7, status: "BERTHED", assigned_berth_id: "B-01", assigned_berth_name: "Berth 1 - Deepwater ULCV", quay_fit: true, draft_fit: true, predicted_delay_hours: 0, delay_factors: ["On-time quayside berthing"] },
  { id: "V-102", name: "MSC Oscar", vessel_class: "ULCV", cargo_volume: 19200, carrier_eta: new Date(Date.now() - 3600000 * 2).toISOString(), corrected_eta: new Date(Date.now() - 3600000 * 1).toISOString(), eta_confidence: 91, priority_flag: true, length_m: 395, draft_m: 15.2, status: "BERTHED", assigned_berth_id: "B-02", assigned_berth_name: "Berth 2 - Deepwater ULCV", quay_fit: true, draft_fit: true, predicted_delay_hours: 0.8, delay_factors: ["Crane 2 maintenance slowdown"] },
  { id: "V-103", name: "CMA CGM Rivoli", vessel_class: "Post-Panamax", cargo_volume: 9800, carrier_eta: new Date(Date.now() - 3600000 * 8).toISOString(), corrected_eta: new Date(Date.now() - 3600000 * 7).toISOString(), eta_confidence: 96, priority_flag: false, length_m: 335, draft_m: 13.8, status: "BERTHED", assigned_berth_id: "B-04", assigned_berth_name: "Berth 4 - Post-Panamax", quay_fit: true, draft_fit: true, predicted_delay_hours: 0, delay_factors: [] },
  { id: "V-104", name: "Madrid Maersk", vessel_class: "Feeder", cargo_volume: 2100, carrier_eta: new Date(Date.now() - 3600000 * 3).toISOString(), corrected_eta: new Date(Date.now() - 3600000 * 2).toISOString(), eta_confidence: 92, priority_flag: false, length_m: 185, draft_m: 9.8, status: "BERTHED", assigned_berth_id: "B-07", assigned_berth_name: "Berth 7 - Feeder North", quay_fit: true, draft_fit: true, predicted_delay_hours: 0, delay_factors: [] },
  { id: "V-105", name: "ONE Apus", vessel_class: "Feeder", cargo_volume: 1800, carrier_eta: new Date(Date.now() - 3600000 * 1).toISOString(), corrected_eta: new Date(Date.now()).toISOString(), eta_confidence: 89, priority_flag: false, length_m: 175, draft_m: 8.9, status: "BERTHED", assigned_berth_id: "B-09", assigned_berth_name: "Berth 9 - Feeder South", quay_fit: true, draft_fit: true, predicted_delay_hours: 0.5, delay_factors: ["Wind gusts in channel"] },
  { id: "V-106", name: "HMM Algeciras", vessel_class: "ULCV", cargo_volume: 23964, carrier_eta: new Date(Date.now() + 3600000 * 2).toISOString(), corrected_eta: new Date(Date.now() + 3600000 * 4.5).toISOString(), eta_confidence: 87, priority_flag: true, length_m: 399, draft_m: 16.2, status: "ANCHORED", assigned_berth_id: "B-01", assigned_berth_name: "Berth 1 - Deepwater ULCV", quay_fit: true, draft_fit: true, predicted_delay_hours: 2.5, delay_factors: ["Waiting for Ever Given departure", "Malacca Strait tidal delay"] },
  { id: "V-107", name: "OOCL Hong Kong", vessel_class: "ULCV", cargo_volume: 21413, carrier_eta: new Date(Date.now() + 3600000 * 5).toISOString(), corrected_eta: new Date(Date.now() + 3600000 * 7).toISOString(), eta_confidence: 85, priority_flag: false, length_m: 399, draft_m: 15.8, status: "ANCHORED", assigned_berth_id: "B-02", assigned_berth_name: "Berth 2 - Deepwater ULCV", quay_fit: true, draft_fit: true, predicted_delay_hours: 2.0, delay_factors: ["Preceding vessel crane outage"] },
  { id: "V-108", name: "COSCO Universe", vessel_class: "Post-Panamax", cargo_volume: 14500, carrier_eta: new Date(Date.now() + 3600000 * 8).toISOString(), corrected_eta: new Date(Date.now() + 3600000 * 9).toISOString(), eta_confidence: 90, priority_flag: false, length_m: 345, draft_m: 14.1, status: "SCHEDULED", assigned_berth_id: "B-03", assigned_berth_name: "Berth 3 - Post-Panamax", quay_fit: true, draft_fit: true, predicted_delay_hours: 1.0, delay_factors: ["Bunker refueling window"] },
  { id: "V-109", name: "Yang Ming Wellhead", vessel_class: "Panamax", cargo_volume: 4800, carrier_eta: new Date(Date.now() + 3600000 * 12).toISOString(), corrected_eta: new Date(Date.now() + 3600000 * 12).toISOString(), eta_confidence: 95, priority_flag: false, length_m: 260, draft_m: 11.8, status: "SCHEDULED", assigned_berth_id: "B-05", assigned_berth_name: "Berth 5 - Panamax Container", quay_fit: true, draft_fit: true, predicted_delay_hours: 0, delay_factors: [] },
  { id: "V-110", name: "Ever Ace", vessel_class: "ULCV", cargo_volume: 23992, carrier_eta: new Date(Date.now() + 3600000 * 16).toISOString(), corrected_eta: new Date(Date.now() + 3600000 * 19).toISOString(), eta_confidence: 82, priority_flag: true, length_m: 400, draft_m: 16.4, status: "SCHEDULED", assigned_berth_id: "B-01", assigned_berth_name: "Berth 1 - Deepwater ULCV", quay_fit: true, draft_fit: true, predicted_delay_hours: 3.0, delay_factors: ["Cascade delay from HMM Algeciras"] }
];

const localBerths = [...INITIAL_FALLBACK_BERTHS];
const localVessels = [...INITIAL_FALLBACK_VESSELS];

export function handleFallbackRequest(endpoint: string, options: RequestInit = {}): any {
  const method = options.method || 'GET';
  const cleanEndpoint = endpoint.split('?')[0];

  // 1. Authentication (/auth/login)
  if (cleanEndpoint === '/auth/login' && method === 'POST') {
    let parsed: any = {};
    try {
      parsed = JSON.parse(String(options.body || '{}'));
    } catch {
      parsed = {};
    }
    const username = (parsed.username || 'supervisor').trim().toLowerCase();
    const roleMap: Record<string, string> = {
      admin: 'admin',
      supervisor: 'shift_supervisor',
      planner: 'vessel_planner',
      manager: 'terminal_manager',
    };
    const role = roleMap[username] || 'shift_supervisor';

    return {
      access_token: `mock_jwt_${btoa(JSON.stringify({ sub: username, role, exp: Date.now() + 86400000 }))}`,
      token_type: 'bearer',
      user: {
        id: username === 'admin' ? 1 : username === 'supervisor' ? 2 : username === 'planner' ? 3 : 4,
        username,
        email: `${username}@portpulse.local`,
        role,
      },
    };
  }

  // 2. Users list
  if (cleanEndpoint === '/auth/users') {
    return [
      { id: 1, username: 'admin', email: 'admin@portpulse.local', role: 'admin', is_active: true },
      { id: 2, username: 'supervisor', email: 'supervisor@portpulse.local', role: 'shift_supervisor', is_active: true },
      { id: 3, username: 'planner', email: 'planner@portpulse.local', role: 'vessel_planner', is_active: true },
      { id: 4, username: 'manager', email: 'manager@portpulse.local', role: 'terminal_manager', is_active: true },
    ];
  }

  // 3. Live Status & Table
  if (cleanEndpoint === '/status/summary' || cleanEndpoint === '/status/dashboard') {
    const summary: LiveStatusSummary = {
      total_vessels: 50,
      scheduled_vessels: 28,
      anchored_vessels: 12,
      berthed_vessels: 10,
      total_berths: 10,
      available_berths: 4,
      occupied_berths: 5,
      maintenance_berths: 1,
      total_quay_length_m: 2940,
      yard_teu_capacity: 125000,
      yard_teu_used: 91250,
      yard_utilization_pct: 73.0,
      last_updated: new Date().toISOString(),
    };
    return summary;
  }

  if (cleanEndpoint === '/status/vessels' || cleanEndpoint === '/master-data/vessels') {
    return localVessels;
  }

  if (cleanEndpoint === '/status/berths' || cleanEndpoint === '/master-data/berths') {
    return localBerths;
  }

  if (cleanEndpoint === '/status/table') {
    return {
      correlation_id: `mock-${Date.now()}`,
      summary: {
        total_vessels: 50,
        scheduled_vessels: 28,
        anchored_vessels: 12,
        berthed_vessels: 10,
        total_berths: 10,
        available_berths: 4,
        occupied_berths: 5,
        maintenance_berths: 1,
        total_quay_length_m: 2940,
        yard_teu_capacity: 125000,
        yard_teu_used: 91250,
        yard_utilization_pct: 73.0,
        last_updated: new Date().toISOString(),
      },
      vessels: localVessels,
      berths: localBerths,
    };
  }

  // 4. Congestion Heatmap
  if (cleanEndpoint === '/risk/heatmap') {
    const berthsHeatmap = localBerths.map((b) => ({
      berth_id: b.id,
      berth_name: b.name,
      length_m: b.length_m,
      draft_limit_m: b.draft_limit_m,
      crane_slots: b.crane_slots,
      timeline: Array.from({ length: 72 }, (_, i) => {
        const prob = i > 18 && i < 42 && (b.id === 'B-01' || b.id === 'B-02') ? 0.92 : 0.2 + (i % 12) * 0.04;
        const tier = prob > 0.8 ? 'RED' : prob > 0.5 ? 'AMBER' : 'GREEN';
        return {
          hour_offset: i,
          forecast_time: new Date(Date.now() + i * 3600000).toISOString(),
          occupancy_probability: Number(prob.toFixed(2)),
          confidence_low: Number(Math.max(0, prob - 0.1).toFixed(2)),
          confidence_high: Number(Math.min(1, prob + 0.1).toFixed(2)),
          risk_tier: tier as any,
          expected_vessel_id: prob > 0.5 ? (b.id === 'B-01' ? 'V-106' : 'V-107') : null,
          expected_vessel_name: prob > 0.5 ? (b.id === 'B-01' ? 'HMM Algeciras' : 'OOCL Hong Kong') : null,
          top_factors: [
            { feature_name: 'Carrier Arrival Density', impact_pct: 42, direction: 'INCREASE' as any, description: 'Consecutive ULCV scheduled arrivals' },
            { feature_name: 'Quayside Crane Availability', impact_pct: 28, direction: 'INCREASE' as any, description: 'Crane 2 offline on Berth 2' },
          ],
        };
      }),
    }));

    const response: HeatmapResponse = {
      correlation_id: `hm-${Date.now()}`,
      model_version: 'GBM-V3.4-Ensemble',
      generated_at: new Date().toISOString(),
      horizon_hours: 72,
      summary: {
        red_tier_count: 14,
        amber_tier_count: 26,
        green_tier_count: 32,
        critical_berths: ['B-01', 'B-02'],
        peak_congestion_window: 'T+24h to T+42h',
      },
      berths: berthsHeatmap,
    };
    return response;
  }

  // 5. Anchorage Forecast
  if (cleanEndpoint === '/forecast/anchorage') {
    const timeline = Array.from({ length: 72 }, (_, i) => ({
      hour_offset: i,
      forecast_time: new Date(Date.now() + i * 3600000).toISOString(),
      predicted_queue: Math.round(12 + Math.sin(i / 6) * 4 + (i > 24 && i < 48 ? 6 : 0)),
      confidence_low: Math.max(0, Math.round(10 + Math.sin(i / 6) * 3)),
      confidence_high: Math.round(16 + Math.sin(i / 6) * 4),
    }));

    const response: AnchorageForecastResponse = {
      correlation_id: `anc-${Date.now()}`,
      horizon_hours: 72,
      current_queue: 12,
      peak_predicted_queue: 19,
      timeline,
    };
    return response;
  }

  // 6. ML Metrics
  if (cleanEndpoint === '/forecast/metrics') {
    const metrics: MLMetricsResponse = {
      correlation_id: `ml-${Date.now()}`,
      evaluated_at: new Date().toISOString(),
      models: [
        { task: 'ETA Delay Correction', metric_name: 'MAE (Hours)', naive_baseline_score: 4.8, trained_model_score: 1.15, improvement_pct: 76.0, better: 'LOWER', description: 'Gradient Boosting Regressor over historical AIS & carrier notices' },
        { task: 'Berth Dwell Duration', metric_name: 'RMSE (Hours)', naive_baseline_score: 6.2, trained_model_score: 1.82, improvement_pct: 70.6, better: 'LOWER', description: 'Random Forest Regressor trained on crane productivity and draft specifications' },
        { task: 'Anchorage Queue Congestion', metric_name: 'F1 Score', naive_baseline_score: 0.61, trained_model_score: 0.93, improvement_pct: 52.4, better: 'HIGHER', description: 'Binary congestion spike classifier at 24h/48h horizons' },
      ],
    };
    return metrics;
  }

  // 7. Cascade Delay Simulation
  if (cleanEndpoint === '/simulate/cascade' && method === 'POST') {
    let delay = 4;
    let vesselId = 'V-106';
    try {
      const parsed = JSON.parse(String(options.body || '{}'));
      delay = Number(parsed.delay_hours || 4);
      vesselId = parsed.vessel_id || 'V-106';
    } catch {}

    const response: CascadeSimulationResponse = {
      correlation_id: `cas-${Date.now()}`,
      trigger_vessel_id: vesselId,
      trigger_delay_hours: delay,
      total_ripple_delay_hours: Number((delay * 1.8).toFixed(1)),
      impacted_vessels_count: 2,
      impacted_vessels: [
        {
          vessel_id: 'V-107',
          vessel_name: 'OOCL Hong Kong',
          berth_id: 'B-02',
          original_eta: new Date(Date.now() + 18000000).toISOString(),
          new_projected_berth_time: new Date(Date.now() + 18000000 + delay * 3600000).toISOString(),
          cascade_delay_hours: Number((delay * 0.75).toFixed(1)),
          conflict_type: 'BERTH_HEADWAY_VIOLATION',
        },
        {
          vessel_id: 'V-110',
          vessel_name: 'Ever Ace',
          berth_id: 'B-01',
          original_eta: new Date(Date.now() + 57600000).toISOString(),
          new_projected_berth_time: new Date(Date.now() + 57600000 + delay * 3600000 * 0.8).toISOString(),
          cascade_delay_hours: Number((delay * 0.8).toFixed(1)),
          conflict_type: 'QUAYSIDE_SLOT_COLLISION',
        },
      ],
      summary_explanation: `Simulated delay of ${delay}h on ${vesselId} creates a secondary ripple of ${(delay * 1.8).toFixed(1)}h across 2 downstream ULCVs.`,
    };
    return response;
  }

  // 8. Prescriptive Recommendations
  if (cleanEndpoint === '/recommendations') {
    const response: RecommendationsListResponse = {
      correlation_id: `rec-${Date.now()}`,
      total_recommendations: 3,
      active_count: 3,
      recommendations: [
        {
          id: 'REC-2026-081',
          recommendation_type: 'DIVERSION',
          vessel_id: 'V-106',
          vessel_name: 'HMM Algeciras',
          source_berth_id: 'B-01',
          source_berth_name: 'Berth 1 - Deepwater ULCV',
          target_berth_id: 'B-02',
          target_berth_name: 'Berth 2 - Deepwater ULCV',
          action_summary: 'Reassign HMM Algeciras from Berth 1 to Berth 2',
          rationale: 'Berth 2 draft of 16.0m comfortably accommodates HMM Algeciras at high-tide entry.',
          original_eta: new Date(Date.now() + 7200000).toISOString(),
          recommended_eta: new Date(Date.now() + 7200000).toISOString(),
          impact: {
            hours_saved: 3.5,
            demurrage_saved_usd: 24000,
            bunker_fuel_saved_usd: 4800,
            co2_saved_mt: 11.2,
            operational_cost_usd: 1200,
            net_benefit_usd: 27600,
          },
          confidence_score: 0.94,
          status: 'PENDING',
        },
        {
          id: 'REC-2026-082',
          recommendation_type: 'SLOW_STEAM',
          vessel_id: 'V-107',
          vessel_name: 'OOCL Hong Kong',
          target_berth_id: 'B-02',
          target_berth_name: 'Berth 2 - Deepwater ULCV',
          action_summary: 'Virtual Arrival: Reduce Sea Speed for OOCL Hong Kong to 13.5 kts',
          rationale: 'Slow steam to absorb quayside berth queue at sea, slashing bunker fuel burn.',
          speed_adjustment_knots: -2.5,
          original_eta: new Date(Date.now() + 18000000).toISOString(),
          recommended_eta: new Date(Date.now() + 25200000).toISOString(),
          impact: {
            hours_saved: 0,
            demurrage_saved_usd: 12500,
            bunker_fuel_saved_usd: 9200,
            co2_saved_mt: 5.6,
            operational_cost_usd: 0,
            net_benefit_usd: 21700,
          },
          confidence_score: 0.91,
          status: 'PENDING',
        },
        {
          id: 'REC-2026-083',
          recommendation_type: 'PRIORITY_RESEQUENCE',
          vessel_id: 'V-102',
          vessel_name: 'MSC Oscar',
          target_berth_id: 'B-02',
          target_berth_name: 'Berth 2 - Deepwater ULCV',
          action_summary: 'Deploy Floating Crane FC-01 to Berth 2',
          rationale: 'Compensate for Crane 2 downtime to maintain 28 moves/hr quayside throughput.',
          original_eta: new Date(Date.now() - 7200000).toISOString(),
          recommended_eta: new Date(Date.now() - 7200000).toISOString(),
          impact: {
            hours_saved: 2.0,
            demurrage_saved_usd: 6000,
            bunker_fuel_saved_usd: 0,
            co2_saved_mt: 1.6,
            operational_cost_usd: 1500,
            net_benefit_usd: 4500,
          },
          confidence_score: 0.88,
          status: 'PENDING',
        },
      ],
    };
    return response;
  }

  if (cleanEndpoint.startsWith('/recommendations/') && cleanEndpoint.endsWith('/action')) {
    return {
      correlation_id: `act-${Date.now()}`,
      recommendation_id: 'REC-2026-081',
      status: 'ACCEPTED',
      action_by: 'supervisor',
      action_timestamp: new Date().toISOString(),
      message: 'Prescriptive action applied to operational plan.',
    };
  }

  // 9. Optimiser Plan & Solver
  if (cleanEndpoint === '/optimiser/plan' || cleanEndpoint === '/optimiser/run' || cleanEndpoint === '/optimiser/recompute') {
    const response: OptimisationRunResponse = {
      correlation_id: `opt-${Date.now()}`,
      solver_status: 'OPTIMAL',
      solve_time_seconds: 0.42,
      horizon_hours: 72,
      vessels_scheduled: 50,
      average_wait_time_hours: 1.42,
      total_port_demurrage_usd: 4800,
      crane_utilization_pct: 78.5,
      assignments: localVessels.map((v, i) => ({
        vessel_id: v.id,
        vessel_name: v.name,
        vessel_class: v.vessel_class,
        length_m: v.length_m,
        draft_m: v.draft_m,
        assigned_berth_id: v.assigned_berth_id || `B-0${(i % 10) + 1}`,
        assigned_berth_name: v.assigned_berth_name || `Berth ${(i % 10) + 1}`,
        start_time: new Date(Date.now() + i * 7200000).toISOString(),
        end_time: new Date(Date.now() + i * 7200000 + 28800000).toISOString(),
        allocated_cranes: v.length_m > 300 ? 3 : 2,
        expected_dwell_hours: 24,
        wait_time_hours: 0.5,
        demurrage_cost_usd: 0,
      })),
      violated_constraints: [],
    };
    return response;
  }

  if (cleanEndpoint === '/optimiser/override' && method === 'POST') {
    const result: OverrideValidationResult = {
      correlation_id: `ovr-${Date.now()}`,
      is_valid: true,
      status: 'APPROVED',
      vessel_id: 'V-106',
      vessel_name: 'HMM Algeciras',
      berth_id: 'B-02',
      berth_name: 'Berth 2 - Deepwater ULCV',
      constraint_violations: [],
      warnings: [],
      message: 'Tactical override executed successfully with certified UKC clearance.',
    };
    return result;
  }

  if (cleanEndpoint === '/optimiser/whatif' && method === 'POST') {
    const result: WhatIfResponse = {
      correlation_id: `wif-${Date.now()}`,
      scenario_name: 'What-If Scenario Sandbox',
      simulated_at: new Date().toISOString(),
      summary: 'Reallocating 2 cranes from Berth 5 to Berth 2 resolves the peak queue.',
      comparisons: [
        { metric_name: 'Average Vessel Wait Time', baseline_value: 3.8, simulated_value: 1.4, delta: -2.4, unit: 'hours', improvement: true },
        { metric_name: 'Total Demurrage Incurred', baseline_value: 48000, simulated_value: 12500, delta: -35500, unit: 'USD', improvement: true },
        { metric_name: 'Terminal CO2 Footprint', baseline_value: 84.2, simulated_value: 68.5, delta: -15.7, unit: 'MT', improvement: true },
      ],
      red_tier_berth_hours_before: 14,
      red_tier_berth_hours_after: 2,
      total_demurrage_saved_usd: 35500,
    };
    return result;
  }

  // 10. Audit Logs
  if (cleanEndpoint === '/audit/logs' || cleanEndpoint === '/audit/events') {
    const items: AuditLogEntryItem[] = [
      { id: 101, correlation_id: 'CORR-2026-901', timestamp: new Date(Date.now() - 1200000).toISOString(), actor: 'supervisor', action: 'RECOMMENDATION_ACCEPTED', entity_type: 'RECOMMENDATION', entity_id: 'REC-2026-081', payload_snapshot: JSON.stringify({ berth: 'Berth 2 - Deepwater ULCV', vessel: 'HMM Algeciras', demurrage_saved: '$24,000', co2_avoided_mt: 11.2 }) },
      { id: 102, correlation_id: 'CORR-2026-902', timestamp: new Date(Date.now() - 3600000).toISOString(), actor: 'planner', action: 'SOLVER_EXECUTION', entity_type: 'SCHEDULE', entity_id: '72H-WINDOW', payload_snapshot: JSON.stringify({ solver: 'HiGHS MILP', status: 'OPTIMAL', duration_ms: 240, objective_demurrage_usd: 41200, berths_scheduled: 10 }) },
      { id: 103, correlation_id: 'CORR-2026-903', timestamp: new Date(Date.now() - 7200000).toISOString(), actor: 'admin', action: 'SECURITY_LOGIN', entity_type: 'SESSION', entity_id: 'AUTH-ADMIN', payload_snapshot: JSON.stringify({ ip: '127.0.0.1', method: 'JWT', role: 'admin', terminal: 'Operations Center' }) },
      { id: 104, correlation_id: 'CORR-2026-904', timestamp: new Date(Date.now() - 14400000).toISOString(), actor: 'supervisor', action: 'BERTH_OVERRIDE', entity_type: 'BERTH_ASSIGNMENT', entity_id: 'V-106', payload_snapshot: JSON.stringify({ vessel: 'HMM Algeciras', assigned_berth: 'B-02', reason: 'Tidal draft window UKC clearance' }) },
      { id: 105, correlation_id: 'CORR-2026-905', timestamp: new Date(Date.now() - 21600000).toISOString(), actor: 'planner', action: 'BERTH_MAINTENANCE_UPDATE', entity_type: 'BERTH', entity_id: 'B-06', payload_snapshot: JSON.stringify({ status: 'MAINTENANCE', crane_slots: 2, estimated_resume: '2026-09-17T08:00:00Z' }) },
      { id: 106, correlation_id: 'CORR-2026-906', timestamp: new Date(Date.now() - 28800000).toISOString(), actor: 'supervisor', action: 'RECOMMENDATION_REJECTED', entity_type: 'RECOMMENDATION', entity_id: 'REC-2026-079', payload_snapshot: JSON.stringify({ vessel: 'CMA CGM Rivoli', reason: 'Bunkering refueling scheduled concurrently at Berth 4' }) },
      { id: 107, correlation_id: 'CORR-2026-907', timestamp: new Date(Date.now() - 36000000).toISOString(), actor: 'admin', action: 'MASTER_DATA_IMPORT', entity_type: 'VESSEL_REGISTRY', entity_id: 'WPI-NGA-2026', payload_snapshot: JSON.stringify({ imported_vessels: 50, deepwater_ulcv: 4, feeder_classes: 2, berths_updated: 10 }) },
      { id: 108, correlation_id: 'CORR-2026-908', timestamp: new Date(Date.now() - 43200000).toISOString(), actor: 'planner', action: 'WHAT_IF_SIMULATION', entity_type: 'SCENARIO', entity_id: 'SCEN-CRANE-OUTAGE', payload_snapshot: JSON.stringify({ crane_outages: 2, delay_impact_hours: 4.2, net_cost_usd: 31000 }) }
    ];
    const logs: AuditLogListResponse & { events: AuditLogEntryItem[] } = {
      total: items.length,
      items,
      events: items,
    };
    return logs;
  }

  // 11. GenAI Chat Assistant
  if (cleanEndpoint === '/chat/query' && method === 'POST') {
    let queryText = 'What is the port status?';
    try {
      const parsed = JSON.parse(String(options.body || '{}'));
      queryText = parsed.query || queryText;
    } catch {}

    const chatResp: ChatQueryResponse = {
      query: queryText,
      answer: `### Quayside Status Report\n- **Deepwater Berths**: Berth 1 (Ever Given) and Berth 2 (MSC Oscar) are operating at 88% and 75% capacity.\n- **Queue Advisory**: 12 vessels anchored in waiting roadstead. High-tide window at 14:00 UTC allows safe entry for **HMM Algeciras** (16.2m draft).\n- **Prescriptive Action**: Recommendation REC-2026-081 is pending to shift HMM Algeciras to Berth 2, preventing **$24,000 USD** in demurrage penalties.`,
      model: 'llama-3.3-70b-versatile',
      timestamp: new Date().toISOString(),
      citations: [
        'World Port Index (NGA Pub 150): Deepwater Berth Constraints',
        'BIMCO Demurrage & Laytime Standard 2026: Clause 8',
      ],
      grounding_summary: {
        total_berths: 10,
        total_vessels: 50,
        delayed_vessels_count: 3,
        active_cranes: 22,
        recommendations_count: 3,
      },
    };
    return chatResp;
  }

  if (cleanEndpoint === '/chat/briefing') {
    const briefing: ShiftBriefingResponse = {
      title: 'Upcoming 12h Quayside Shift Briefing',
      generated_at: new Date().toISOString(),
      briefing_markdown: `### ⚓ Quayside Shift Handover Briefing\n\n**Current Status**: Congestion risk is **AMBER** between T+6h and T+14h due to consecutive ULCV calls.\n\n#### Key Priorities:\n1. Expedite departure of **Ever Given** from Berth 1 by 11:30 UTC.\n2. Ensure high-tide UKC clearance for **HMM Algeciras** entering Berth 2 at 14:00 UTC.\n3. Crane 2 on Berth 2 is undergoing maintenance; floating crane FC-01 recommended to maintain throughput.`,
      metrics: {
        vessels_active: 10,
        delayed_count: 2,
        demurrage_saved_usd: 42500,
        co2_saved_mt: 18.4,
        active_cranes: 22,
      },
    };
    return briefing;
  }

  // 12. Master data CSV Imports
  if (cleanEndpoint === '/master-data/import/berths' && method === 'POST') {
    return {
      status: 'SUCCESS',
      imported_count: 10,
      updated_count: 0,
      cranes_created: 28,
      message: 'Successfully imported 10 berths and 28 cranes.',
      errors: [],
    };
  }

  if (cleanEndpoint === '/master-data/import/vessels' && method === 'POST') {
    return {
      status: 'SUCCESS',
      imported_count: 50,
      updated_count: 0,
      message: 'Successfully imported 50 scheduled vessels into manifest.',
      errors: [],
    };
  }

  // 13. Shock event & synthetic generation
  if (cleanEndpoint.startsWith('/ingestion/shock-event')) {
    return { status: 'SUCCESS', message: 'Shock event injected into operational stream.', data: {} };
  }

  if (cleanEndpoint.startsWith('/ingestion/generate')) {
    return { status: 'SUCCESS', message: 'Synthetic dataset regenerated (50 vessels, 10 berths).', data: {} };
  }

  // 14. Feedback
  if (cleanEndpoint === '/ml/feedback/summary') {
    return {
      total_reviewed: 42,
      overall_acceptance_rate_pct: 88,
      breakdown_by_type: {
        DIVERSION: { accepted: 24, rejected: 3, rate_pct: 89 },
        SLOW_STEAM: { accepted: 12, rejected: 1, rate_pct: 92 },
        PRIORITY_RESEQUENCE: { accepted: 6, rejected: 1, rate_pct: 86 },
      },
      calibration_status: 'CALIBRATED',
      retraining_recommended: false,
    };
  }

  if (cleanEndpoint === '/ml/feedback/record') {
    return { status: 'SUCCESS', message: 'Recommendation feedback recorded.' };
  }

  // Default fallback
  return { status: 'SUCCESS', message: 'Operation executed successfully.' };
}
