/**
 * PortPulse Typed API Client (Single Contract Source of Truth)
 * Conforms to 04_frontend.md §5 and 05_backend.md §3.
 */

export interface VesselStatusItem {
  id: string;
  name: string;
  vessel_class: string;
  cargo_volume: number;
  carrier_eta: string;
  corrected_eta: string | null;
  eta_confidence: number;
  priority_flag: boolean;
  length_m: number;
  draft_m: number;
  status: 'SCHEDULED' | 'ANCHORED' | 'BERTHED' | 'DEPARTED';
  assigned_berth_id: string | null;
  assigned_berth_name: string | null;
  quay_fit: boolean;
  draft_fit: boolean;
  predicted_delay_hours?: number;
  delay_factors?: string[];
}

export interface BerthStatusItem {
  id: string;
  name: string;
  length_m: number;
  draft_limit_m: number;
  crane_slots: number;
  operational_cranes: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  current_vessel_id: string | null;
  current_vessel_name: string | null;
  utilization_pct: number;
}

export interface LiveStatusSummary {
  total_vessels: number;
  scheduled_vessels: number;
  anchored_vessels: number;
  berthed_vessels: number;
  total_berths: number;
  available_berths: number;
  occupied_berths: number;
  maintenance_berths: number;
  total_quay_length_m: number;
  yard_teu_capacity: number;
  yard_teu_used: number;
  yard_utilization_pct: number;
  last_updated: string;
}

export interface LiveStatusTableResponse {
  correlation_id: string;
  summary: LiveStatusSummary;
  vessels: VesselStatusItem[];
  berths: BerthStatusItem[];
}

// --- Increment 2: Forecast & Risk Interfaces ---

export interface FactorAttribution {
  feature_name: string;
  impact_pct: number;
  direction: 'INCREASE' | 'DECREASE';
  description: string;
}

export interface BerthHourRiskItem {
  hour_offset: number;
  forecast_time: string;
  occupancy_probability: number;
  confidence_low: number;
  confidence_high: number;
  risk_tier: 'GREEN' | 'AMBER' | 'RED';
  expected_vessel_id: string | null;
  expected_vessel_name: string | null;
  top_factors: FactorAttribution[];
}

export interface BerthHeatmapTrack {
  berth_id: string;
  berth_name: string;
  length_m: number;
  draft_limit_m: number;
  crane_slots: number;
  timeline: BerthHourRiskItem[];
}

export interface HeatmapSummary {
  red_tier_count: number;
  amber_tier_count: number;
  green_tier_count: number;
  critical_berths: string[];
  peak_congestion_window: string;
}

export interface HeatmapResponse {
  correlation_id: string;
  model_version: string;
  generated_at: string;
  horizon_hours: number;
  summary: HeatmapSummary;
  berths: BerthHeatmapTrack[];
}

export interface AnchorageHourItem {
  hour_offset: number;
  forecast_time: string;
  predicted_queue: number;
  confidence_low: number;
  confidence_high: number;
}

export interface AnchorageForecastResponse {
  correlation_id: string;
  horizon_hours: number;
  current_queue: number;
  peak_predicted_queue: number;
  timeline: AnchorageHourItem[];
}

export interface CascadeImpactedVessel {
  vessel_id: string;
  vessel_name: string;
  berth_id: string;
  original_eta: string;
  new_projected_berth_time: string;
  cascade_delay_hours: number;
  conflict_type: string;
}

export interface CascadeSimulationResponse {
  correlation_id: string;
  trigger_vessel_id: string;
  trigger_delay_hours: number;
  total_ripple_delay_hours: number;
  impacted_vessels_count: number;
  impacted_vessels: CascadeImpactedVessel[];
  summary_explanation: string;
}

export interface ModelEvaluationMetric {
  task: string;
  metric_name: string;
  naive_baseline_score: number;
  trained_model_score: number;
  improvement_pct: number;
  better: string;
  description: string;
}

export interface MLMetricsResponse {
  correlation_id: string;
  evaluated_at: string;
  models: ModelEvaluationMetric[];
}

export interface ApiError {
  error_code: string;
  message: string;
  correlation_id: string;
  details?: any;
}

const API_BASE = '/api/v1';

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const currentRole = localStorage.getItem('portpulse-role') || 'shift_supervisor';
  const token = localStorage.getItem('portpulse-token');
  const correlationId = `ui-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Correlation-ID': correlationId,
    'X-User-Role': currentRole,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const url = `${API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('portpulse-token');
      }
      let errBody: ApiError;
      try {
        errBody = await response.json();
      } catch {
        errBody = {
          error_code: `HTTP_${response.status}`,
          message: response.statusText || 'Unknown server error',
          correlation_id: correlationId,
        };
      }
      throw errBody;
    }

    return await response.json();
  } catch (err: any) {
    if (err.error_code && err.message) {
      throw err;
    }
    throw {
      error_code: 'NETWORK_ERROR',
      message: err.message || 'Failed to connect to PortPulse backend. Verify server is running at http://127.0.0.1:8000.',
      correlation_id: correlationId,
    } as ApiError;
  }
}

export interface UserItem {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at?: string;
}

export const api = {
  // Authentication & Session
  login: (credentials: { username: string; password: string }) =>
    apiFetch<{ access_token: string; token_type: string; user: { id: number; username: string; email: string; role: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  listUsers: () => apiFetch<UserItem[]>('/auth/users'),

  createUser: (userData: { username: string; email: string; password: string; role: string }) =>
    apiFetch<UserItem>('/auth/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  // Live Status (F-105)
  getLiveStatusTable: () => apiFetch<LiveStatusTableResponse>('/status/table'),
  getVesselsStatus: (statusFilter?: string) =>
    apiFetch<VesselStatusItem[]>(`/status/vessels${statusFilter ? `?status=${statusFilter}` : ''}`),
  getBerthsStatus: () => apiFetch<BerthStatusItem[]>('/status/berths'),
  getStatusSummary: () => apiFetch<LiveStatusSummary>('/status/summary'),

  // Shock Event Injection (F-101)
  injectShockEvent: (eventType: 'crane_outage' | 'mega_ship_surge' | 'tidal_restriction') =>
    apiFetch<{ status: string; message: string; data: any }>(`/ingestion/shock-event?event_type=${eventType}`, {
      method: 'POST',
    }),

  // Synthetic Data Regeneration (F-101 / F-102)
  generateSyntheticData: (vessels = 50, berths = 10, seed = 42) =>
    apiFetch<{ status: string; message: string; data: any }>(
      `/ingestion/generate?vessels=${vessels}&berths=${berths}&seed=${seed}`,
      { method: 'POST' }
    ),

  // Master Data CRUD (F-104 / F-106)
  listBerths: () => apiFetch<any[]>('/master-data/berths'),
  createBerth: (berthData: any) =>
    apiFetch<any>('/master-data/berths', {
      method: 'POST',
      body: JSON.stringify(berthData),
    }),
  deleteBerth: (berthId: string) =>
    apiFetch<any>(`/master-data/berths/${berthId}`, { method: 'DELETE' }),

  listVessels: (limit = 100) => apiFetch<any[]>(`/master-data/vessels?limit=${limit}`),
  createVessel: (vesselData: any) =>
    apiFetch<any>('/master-data/vessels', {
      method: 'POST',
      body: JSON.stringify(vesselData),
    }),
  deleteVessel: (vesselId: string) =>
    apiFetch<any>(`/master-data/vessels/${vesselId}`, { method: 'DELETE' }),

  // CSV Import & Export Operations
  getExportBerthsUrl: () => `${API_BASE}/master-data/export/berths.csv`,
  getExportVesselsUrl: () => `${API_BASE}/master-data/export/vessels.csv`,
  getExportOperationsPlanUrl: () => `${API_BASE}/optimiser/export/operations-plan.csv`,

  importBerthsCsv: (csvContent: string) =>
    apiFetch<{ status: string; imported_count: number; berths: any[]; cranes_created: number; message: string }>(
      '/master-data/import/berths',
      {
        method: 'POST',
        body: JSON.stringify({ csv_content: csvContent }),
      }
    ),

  importVesselsCsv: (csvContent: string) =>
    apiFetch<{ status: string; imported_count: number; vessels: any[]; message: string }>(
      '/master-data/import/vessels',
      {
        method: 'POST',
        body: JSON.stringify({ csv_content: csvContent }),
      }
    ),

  // Increment 2: Prediction Core & Heatmap (F-201 to F-207)
  getHeatmap: (horizon = 72) =>
    apiFetch<HeatmapResponse>(`/risk/heatmap?horizon=${horizon}`),

  getAnchorageQueue: (horizon = 72) =>
    apiFetch<AnchorageForecastResponse>(`/forecast/anchorage?horizon=${horizon}`),

  simulateCascadeDelay: (vesselId: string, delayHours: number) =>
    apiFetch<CascadeSimulationResponse>('/simulate/cascade', {
      method: 'POST',
      body: JSON.stringify({ vessel_id: vesselId, delay_hours: delayHours }),
    }),

  getMLMetrics: () =>
    apiFetch<MLMetricsResponse>('/forecast/metrics'),

  // Increment 3: Prescriptive Layer & Optimisation (F-301 to F-308)
  getRecommendations: (horizon = 72) =>
    apiFetch<RecommendationsListResponse>(`/recommendations?horizon=${horizon}`),

  actOnRecommendation: (recommendationId: string, action: 'ACCEPT' | 'MODIFY' | 'REJECT', notes?: string) =>
    apiFetch<RecommendationActionResponse>(`/recommendations/${recommendationId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, notes }),
    }),

  getOptimisationPlan: (horizon = 72) =>
    apiFetch<OptimisationRunResponse>(`/optimiser/plan?horizon=${horizon}`),

  runOptimisation: (horizon = 72) =>
    apiFetch<OptimisationRunResponse>('/optimiser/run', {
      method: 'POST',
      body: JSON.stringify({ horizon_hours: horizon }),
    }),

  recomputeOptimisation: () =>
    apiFetch<OptimisationRunResponse>('/optimiser/recompute', {
      method: 'POST',
    }),

  manualOverride: (overrideData: ManualOverrideRequest) =>
    apiFetch<OverrideValidationResult>('/optimiser/override', {
      method: 'POST',
      body: JSON.stringify(overrideData),
    }),

  runWhatIf: (whatIfData: WhatIfRequest) =>
    apiFetch<WhatIfResponse>('/optimiser/whatif', {
      method: 'POST',
      body: JSON.stringify(whatIfData),
    }),

  // Operational Activity & Audit Trail
  getAuditLogs: (params?: { limit?: number; offset?: number; entity_type?: string; action?: string; actor?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.offset) searchParams.append('offset', String(params.offset));
    if (params?.entity_type) searchParams.append('entity_type', params.entity_type);
    if (params?.action) searchParams.append('action', params.action);
    if (params?.actor) searchParams.append('actor', params.actor);
    const qs = searchParams.toString();
    return apiFetch<AuditLogListResponse>(`/audit/logs${qs ? `?${qs}` : ''}`);
  },
};

export interface AuditLogEntryItem {
  id: number;
  correlation_id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  payload_snapshot: string | null;
  timestamp: string;
}

export interface AuditLogListResponse {
  total: number;
  items: AuditLogEntryItem[];
}

// --- Increment 3 Interfaces ---

export interface CostImpactEstimate {
  hours_saved: number;
  demurrage_saved_usd: number;
  bunker_fuel_saved_usd: number;
  co2_saved_mt: number;
  operational_cost_usd: number;
  net_benefit_usd: number;
}

export interface PrescriptiveRecommendation {
  id: string;
  recommendation_type: 'DIVERSION' | 'SLOW_STEAM' | 'PRIORITY_RESEQUENCE';
  vessel_id: string;
  vessel_name: string;
  carrier?: string;
  source_berth_id?: string;
  source_berth_name?: string;
  target_berth_id?: string;
  target_berth_name?: string;
  action_summary: string;
  rationale: string;
  speed_adjustment_knots?: number;
  original_eta: string;
  recommended_eta: string;
  impact: CostImpactEstimate;
  confidence_score: number;
  status: 'PENDING' | 'ACCEPTED' | 'MODIFIED' | 'REJECTED';
  action_timestamp?: string;
  action_by_user?: string;
  action_notes?: string;
}

export interface RecommendationsListResponse {
  correlation_id: string;
  total_recommendations: number;
  active_count: number;
  recommendations: PrescriptiveRecommendation[];
}

export interface RecommendationActionResponse {
  correlation_id: string;
  recommendation_id: string;
  status: string;
  action_by: string;
  action_timestamp: string;
  message: string;
}

export interface VesselAssignment {
  vessel_id: string;
  vessel_name: string;
  vessel_class: string;
  length_m: number;
  draft_m: number;
  assigned_berth_id: string;
  assigned_berth_name: string;
  start_time: string;
  end_time: string;
  allocated_cranes: number;
  expected_dwell_hours: number;
  wait_time_hours: number;
  demurrage_cost_usd: number;
}

export interface OptimisationRunResponse {
  correlation_id: string;
  solver_status: 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE';
  solve_time_seconds: number;
  horizon_hours: number;
  vessels_scheduled: number;
  average_wait_time_hours: number;
  total_port_demurrage_usd: number;
  crane_utilization_pct: number;
  assignments: VesselAssignment[];
  violated_constraints: string[];
}

export interface ManualOverrideRequest {
  vessel_id: string;
  target_berth_id: string;
  new_start_time: string;
  override_reason: string;
}

export interface SuggestedResolution {
  resolution_type: 'ALTERNATIVE_BERTH' | 'DEFERRED_TIME_WINDOW';
  description: string;
  target_berth_id?: string;
  target_berth_name?: string;
  recommended_start_time?: string;
  reasoning: string;
}

export interface OverrideValidationResult {
  correlation_id: string;
  is_valid: boolean;
  status: 'APPROVED' | 'REJECTED_HARD_CONSTRAINT';
  vessel_id: string;
  vessel_name: string;
  berth_id: string;
  berth_name: string;
  constraint_violations: string[];
  warnings: string[];
  suggested_resolutions?: SuggestedResolution[];
  message: string;
}

export interface WhatIfIntervention {
  intervention_type: 'DIVERT' | 'SLOW_STEAM' | 'CRANE_BOOST';
  vessel_id: string;
  target_berth_id?: string;
  speed_reduction_knots?: number;
  additional_cranes?: number;
}

export interface WhatIfRequest {
  scenario_name: string;
  interventions: WhatIfIntervention[];
}

export interface WhatIfMetricComparison {
  metric_name: string;
  baseline_value: number;
  simulated_value: number;
  delta: number;
  unit: string;
  improvement: boolean;
}

export interface WhatIfResponse {
  correlation_id: string;
  scenario_name: string;
  simulated_at: string;
  summary: string;
  comparisons: WhatIfMetricComparison[];
  red_tier_berth_hours_before: number;
  red_tier_berth_hours_after: number;
  total_demurrage_saved_usd: number;
}
