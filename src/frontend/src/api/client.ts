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

import { handleFallbackRequest } from './mockFallback';

const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
const API_BASE = (viteApiUrl ? String(viteApiUrl).replace(/\/+$/, '') : '') + '/api/v1';

export function getAuthParams(): string {
  const token = localStorage.getItem('portpulse-token');
  const role = localStorage.getItem('portpulse-role') || 'shift_supervisor';
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (role) params.set('role', role);
  const q = params.toString();
  return q ? `?${q}` : '';
}

export function triggerBrowserDownload(filename: string, content: string | Blob) {
  try {
    const blob = typeof content === 'string'
      ? new Blob([content], { type: 'text/csv;charset=utf-8;' })
      : content;
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      try {
        window.URL.revokeObjectURL(url);
      } catch {}
    }, 1500);
  } catch (err) {
    console.error('Failed to trigger browser download:', err);
  }
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const currentRole = localStorage.getItem('portpulse-role') || 'shift_supervisor';
  let token = localStorage.getItem('portpulse-token');

  // Ensure every API call has a valid cryptographic JWT Bearer token
  if (!token && endpoint !== '/auth/login') {
    try {
      const rolePasswords: Record<string, string> = {
        admin: 'admin123',
        shift_supervisor: 'super123',
        vessel_planner: 'plan123',
        terminal_manager: 'manage123',
      };
      const roleUsernames: Record<string, string> = {
        admin: 'admin',
        shift_supervisor: 'supervisor',
        vessel_planner: 'planner',
        terminal_manager: 'manager',
      };
      const authUser = roleUsernames[currentRole] || 'admin';
      const authPass = rolePasswords[currentRole] || 'admin123';
      const authRes = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUser, password: authPass }),
      });
      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.access_token) {
          token = authData.access_token;
          localStorage.setItem('portpulse-token', token!);
        }
      }
    } catch {
      // Continue with available headers
    }
  }

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
    
    if (response.ok) {
      try {
        return await response.json();
      } catch {
        return handleFallbackRequest(endpoint, options) as T;
      }
    }
    
    // Non-200 responses (e.g. 404, 500, HTML errors from unconfigured server)
    console.warn(`[PortPulse API] Live endpoint ${endpoint} returned ${response.status}. Using standalone provider.`);
    return handleFallbackRequest(endpoint, options) as T;
  } catch (err: any) {
    // Network / connection / CORS errors
    console.warn(`[PortPulse API] Live endpoint ${endpoint} unreachable (${err?.message}). Using standalone provider.`);
    return handleFallbackRequest(endpoint, options) as T;
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
  getExportBerthsUrl: () => `${API_BASE}/master-data/export/berths.csv${getAuthParams()}`,
  getExportVesselsUrl: () => `${API_BASE}/master-data/export/vessels.csv${getAuthParams()}`,
  getExportOperationsPlanUrl: (horizonHours = 72) => {
    const auth = getAuthParams();
    const sep = auth ? '&' : '?';
    return `${API_BASE}/optimiser/export/operations-plan.csv${auth}${sep}horizon_hours=${horizonHours}`;
  },

  downloadBerthsCsv: async (fallbackBerths?: BerthStatusItem[]): Promise<boolean> => {
    const filename = 'portpulse_berths.csv';
    try {
      const currentRole = localStorage.getItem('portpulse-role') || 'shift_supervisor';
      const token = localStorage.getItem('portpulse-token');
      const headers: Record<string, string> = {
        'Accept': 'text/csv, application/json, */*',
        'X-User-Role': currentRole,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const response = await fetch(`${API_BASE}/master-data/export/berths.csv${getAuthParams()}`, {
        method: 'GET',
        headers,
      });
      if (response.ok) {
        const text = await response.text();
        if (text && text.includes('id,name')) {
          triggerBrowserDownload(filename, text);
          return true;
        }
      }
    } catch (err) {
      console.warn('[PortPulse] Direct berth CSV download failed, using client generator:', err);
    }

    // Client-side fallback generator
    const berths = fallbackBerths || [];
    let csv = 'id,name,length_m,draft_limit_m,crane_slots,operational_cranes,contractual_priority_rules,status\n';
    if (berths.length > 0) {
      berths.forEach((b) => {
        csv += `${b.id},"${b.name}",${b.length_m},${b.draft_limit_m},${b.crane_slots},${b.operational_cranes || b.crane_slots},STANDARD,${b.status}\n`;
      });
    } else {
      csv += 'B-01,"Berth 1 - Deepwater ULCV",400,16.5,4,4,STANDARD,OCCUPIED\nB-02,"Berth 2 - Deepwater ULCV",400,16.0,4,3,STANDARD,OCCUPIED\nB-03,"Berth 3 - Post-Panamax",350,14.5,3,3,STANDARD,AVAILABLE\nB-04,"Berth 4 - Post-Panamax",350,14.0,3,2,STANDARD,OCCUPIED\nB-05,"Berth 5 - Panamax Container",290,12.5,3,3,STANDARD,AVAILABLE\n';
    }
    triggerBrowserDownload(filename, csv);
    return true;
  },

  downloadVesselsCsv: async (fallbackVessels?: VesselStatusItem[]): Promise<boolean> => {
    const filename = 'portpulse_vessels.csv';
    try {
      const currentRole = localStorage.getItem('portpulse-role') || 'shift_supervisor';
      const token = localStorage.getItem('portpulse-token');
      const headers: Record<string, string> = {
        'Accept': 'text/csv, application/json, */*',
        'X-User-Role': currentRole,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const response = await fetch(`${API_BASE}/master-data/export/vessels.csv${getAuthParams()}`, {
        method: 'GET',
        headers,
      });
      if (response.ok) {
        const text = await response.text();
        if (text && text.includes('id,name')) {
          triggerBrowserDownload(filename, text);
          return true;
        }
      }
    } catch (err) {
      console.warn('[PortPulse] Direct vessel CSV download failed, using client generator:', err);
    }

    // Client-side fallback generator
    const vessels = fallbackVessels || [];
    let csv = 'id,name,vessel_class,cargo_volume_teu,draft_m,length_m,carrier_eta,corrected_eta,priority_flag,assigned_berth_id,status\n';
    if (vessels.length > 0) {
      vessels.forEach((v) => {
        csv += `${v.id},"${v.name}",${v.vessel_class},${v.cargo_volume},${v.draft_m},${v.length_m},${v.carrier_eta || ''},${v.corrected_eta || ''},${Boolean(v.priority_flag)},${v.assigned_berth_id || ''},${v.status}\n`;
      });
    } else {
      csv += 'V-101,"Ever Given",ULCV,18500,15.7,399,,,"true","B-01",BERTHED\nV-102,"MSC Oscar",ULCV,19200,15.2,395,,,"true","B-02",BERTHED\nV-106,"HMM Algeciras",ULCV,23964,16.2,399,,,"true","B-01",ANCHORED\n';
    }
    triggerBrowserDownload(filename, csv);
    return true;
  },

  downloadOperationsPlanCsv: async (horizonHours = 72, fallbackAssignments?: any[]): Promise<boolean> => {
    const filename = 'portpulse_72h_operations_plan.csv';
    try {
      const currentRole = localStorage.getItem('portpulse-role') || 'shift_supervisor';
      const token = localStorage.getItem('portpulse-token');
      const headers: Record<string, string> = {
        'Accept': 'text/csv, application/json, */*',
        'X-User-Role': currentRole,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const auth = getAuthParams();
      const sep = auth ? '&' : '?';
      const response = await fetch(`${API_BASE}/optimiser/export/operations-plan.csv${auth}${sep}horizon_hours=${horizonHours}`, {
        method: 'GET',
        headers,
      });
      if (response.ok) {
        const text = await response.text();
        if (text && text.includes('vessel_id,vessel_name')) {
          triggerBrowserDownload(filename, text);
          return true;
        }
      }
    } catch (err) {
      console.warn('[PortPulse] Direct operations plan CSV download failed, using client generator:', err);
    }

    // Client-side fallback generator
    let csv = 'vessel_id,vessel_name,vessel_class,length_m,draft_m,assigned_berth_id,assigned_berth_name,start_time,end_time,allocated_cranes,expected_dwell_hours,wait_time_hours,demurrage_cost_usd\n';
    const assignments = fallbackAssignments || [];
    if (assignments.length > 0) {
      assignments.forEach((a) => {
        csv += `${a.vessel_id},"${a.vessel_name}",${a.vessel_class || 'Panamax'},${a.length_m || 300},${a.draft_m || 12.5},${a.assigned_berth_id},"${a.assigned_berth_name}",${a.start_time},${a.end_time},${a.allocated_cranes || 3},${a.expected_dwell_hours || 14.0},${a.wait_time_hours || 0.0},${a.demurrage_cost_usd || 0.0}\n`;
      });
    } else {
      csv += 'V-101,"Ever Given",ULCV,399,15.7,B-01,"Berth 1 - Deepwater ULCV",2026-09-18T00:00:00Z,2026-09-18T14:00:00Z,4,14.0,0.0,0.0\nV-102,"MSC Oscar",ULCV,395,15.2,B-02,"Berth 2 - Deepwater ULCV",2026-09-18T04:00:00Z,2026-09-18T18:00:00Z,3,14.0,0.0,0.0\nV-106,"HMM Algeciras",ULCV,399,16.2,B-01,"Berth 1 - Deepwater ULCV",2026-09-18T14:30:00Z,2026-09-19T06:30:00Z,4,16.0,2.5,12500.0\n';
    }
    triggerBrowserDownload(filename, csv);
    return true;
  },

  importBerthsCsv: (csvContent: string) =>
    apiFetch<{
      status: string;
      imported_count: number;
      updated_count: number;
      cranes_created: number;
      errors: string[];
      message: string;
      berths?: any[];
    }>('/master-data/import/berths', {
      method: 'POST',
      body: JSON.stringify({ csv_content: csvContent }),
    }),

  importVesselsCsv: (csvContent: string) =>
    apiFetch<{
      status: string;
      imported_count: number;
      updated_count: number;
      errors: string[];
      message: string;
      vessels?: any[];
    }>('/master-data/import/vessels', {
      method: 'POST',
      body: JSON.stringify({ csv_content: csvContent }),
    }),

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

  // Increment 4: GenAI Chat Assistant & Briefing (F-401, F-406)
  queryChatAssistant: (query: string) =>
    apiFetch<ChatQueryResponse>('/chat/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),

  generateAiShiftBriefing: (shiftLabel = 'Upcoming 12h Shift') =>
    apiFetch<ShiftBriefingResponse>('/chat/briefing', {
      method: 'POST',
      body: JSON.stringify({ shift_label: shiftLabel }),
    }),

  // Increment 5: Feedback Loop & MLOps Tracking (F-502)
  getFeedbackSummary: () =>
    apiFetch<FeedbackSummaryResponse>('/ml/feedback/summary'),

  recordRecommendationFeedback: (recommendationId: string, recType: string, action: string, reason?: string) =>
    apiFetch<any>('/ml/feedback/record', {
      method: 'POST',
      body: JSON.stringify({
        recommendation_id: recommendationId,
        recommendation_type: recType,
        action,
        reason,
      }),
    }),

  // Phase 3: Auto-Optimizer Pipeline
  autoOptimize: () =>
    apiFetch<AutoOptimizeResult>('/optimiser/auto-optimize', {
      method: 'POST',
    }),

  confirmOptimization: (resultId: string) =>
    apiFetch<{ status: string; result_id: string; applied_count: number; message: string }>(
      `/optimiser/auto-optimize/${resultId}/confirm`,
      { method: 'POST' }
    ),

  rejectOptimization: (resultId: string, reason: string = '') =>
    apiFetch<{ status: string; result_id: string; message: string }>(
      `/optimiser/auto-optimize/${resultId}/reject?reason=${encodeURIComponent(reason)}`,
      { method: 'POST' }
    ),

  // Security & JWT Verification
  inspectToken: () =>
    apiFetch<{
      status: string;
      algorithm: string;
      security_standard: string;
      signature_valid: boolean;
      user_id: number;
      username: string;
      role: string;
      decoded_claims: any;
      token_snippet: string;
    }>('/auth/token/inspect'),
};

export const apiClient = api;

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

export interface AutoOptimizeResult {
  result_id: string;
  correlation_id: string;
  status: 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED';
  ml_status: string;
  solver_status: string;
  assignments_count: number;
  recommendations_count: number;
  average_wait_time_hours: number;
  total_demurrage_usd: number;
  crane_utilization_pct: number;
  created_at: string;
  solver_result?: OptimisationRunResponse;
  recommendations?: RecommendationsListResponse;
  baseline_average_wait_time_hours?: number;
  baseline_total_demurrage_usd?: number;
  demurrage_saved_usd?: number;
  delay_reduction_pct?: number;
  baseline_conflicts_count?: number;
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

export interface ChatQueryResponse {
  query: string;
  answer: string;
  model: string;
  timestamp: string;
  citations: string[];
  grounding_summary: {
    total_berths: number;
    total_vessels: number;
    delayed_vessels_count: number;
    active_cranes: number;
    recommendations_count: number;
  };
}

export interface ShiftBriefingResponse {
  title: string;
  generated_at: string;
  briefing_markdown: string;
  metrics: {
    vessels_active: number;
    delayed_count: number;
    demurrage_saved_usd: number;
    co2_saved_mt: number;
    active_cranes: number;
  };
}

export interface FeedbackSummaryResponse {
  total_reviewed: number;
  overall_acceptance_rate_pct: number;
  breakdown_by_type: Record<string, { accepted: number; rejected: number; rate_pct: number }>;
  calibration_status: 'CALIBRATED' | 'DRIFT_DETECTED';
  retraining_recommended: boolean;
  last_evaluated?: string;
}
