import React, { useState } from 'react';
import {
  VesselStatusItem,
  BerthStatusItem,
  LiveStatusSummary,
  api,
} from '../api/client';
import {
  Ship,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Activity,
  Search,
  Filter,
  Boxes,
} from 'lucide-react';

interface LiveStatusTableProps {
  summary: LiveStatusSummary | null;
  vessels: VesselStatusItem[];
  berths: BerthStatusItem[];
  onTriggerEvent: (msg: string) => void;
  onRefresh: () => void;
}

export const LiveStatusTable: React.FC<LiveStatusTableProps> = ({
  summary,
  vessels,
  berths,
  onTriggerEvent,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'vessels' | 'berths'>('vessels');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [injectingEvent, setInjectingEvent] = useState<string | null>(null);

  // Filter vessels
  const filteredVessels = vessels.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    const matchesClass = classFilter === 'ALL' || v.vessel_class === classFilter;
    return matchesSearch && matchesStatus && matchesClass;
  });

  const handleShockEvent = async (
    eventType: 'crane_outage' | 'mega_ship_surge' | 'tidal_restriction'
  ) => {
    try {
      setInjectingEvent(eventType);
      const res = await api.injectShockEvent(eventType);
      onTriggerEvent(`Shock Event Injected: ${res.message}`);
      onRefresh();
    } catch (err: any) {
      onTriggerEvent(`Error injecting shock event: ${err.message || 'Action failed'}`);
    } finally {
      setInjectingEvent(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Vessels Overview */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-content-secondary uppercase tracking-wider">
                Vessel Operations
              </span>
              <Ship className="w-4 h-4 text-brand-500" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-content-primary">{summary.total_vessels}</span>
              <span className="text-xs text-content-muted">tracked vessels</span>
            </div>
            <div className="mt-3 flex items-center space-x-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                {summary.berthed_vessels} Berthed
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-medium">
                {summary.anchored_vessels} Anchored
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-medium">
                {summary.scheduled_vessels} Scheduled
              </span>
            </div>
          </div>

          {/* Berths Overview */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-content-secondary uppercase tracking-wider">
                Berth Quays (Quay Length)
              </span>
              <Layers className="w-4 h-4 text-brand-500" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-content-primary">
                {summary.occupied_berths} / {summary.total_berths}
              </span>
              <span className="text-xs text-content-muted">occupied</span>
            </div>
            <div className="mt-3 text-xs text-content-secondary flex justify-between">
              <span>{summary.available_berths} available</span>
              <span>{Math.round(summary.total_quay_length_m)}m total quay</span>
            </div>
          </div>

          {/* Yard Utilization */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-content-secondary uppercase tracking-wider">
                Container Yard TEU
              </span>
              <Boxes className="w-4 h-4 text-brand-500" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-content-primary">
                {summary.yard_utilization_pct}%
              </span>
              <span className="text-xs text-content-muted">
                ({summary.yard_teu_used.toLocaleString()} / {summary.yard_teu_capacity.toLocaleString()} TEU)
              </span>
            </div>
            <div className="mt-3 w-full bg-surface-bg rounded-full h-2 overflow-hidden border border-surface-border">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  summary.yard_utilization_pct > 85
                    ? 'bg-rose-500'
                    : summary.yard_utilization_pct > 70
                    ? 'bg-amber-500'
                    : 'bg-brand-500'
                }`}
                style={{ width: `${Math.min(100, summary.yard_utilization_pct)}%` }}
              />
            </div>
          </div>

          {/* Ingestion & Refresh State */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-content-secondary uppercase tracking-wider">
                Connector Status
              </span>
              <Activity className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-content-primary">Telemetry Sync</span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                NORMALIZED
              </span>
            </div>
            <p className="mt-3 text-xs text-content-muted truncate">
              Last sync: {new Date(summary.last_updated).toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}

      {/* Shock Event Injection Bar (Scenario Testing Controls) */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-content-primary uppercase tracking-wider">
              Inject Delay Shock Event (Scenario Testing):
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleShockEvent('crane_outage')}
              disabled={injectingEvent !== null}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-bg hover:bg-surface-hover border border-surface-border text-content-primary transition-colors flex items-center space-x-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>Crane Breakdown</span>
            </button>

            <button
              onClick={() => handleShockEvent('mega_ship_surge')}
              disabled={injectingEvent !== null}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-bg hover:bg-surface-hover border border-surface-border text-content-primary transition-colors flex items-center space-x-1.5"
            >
              <Ship className="w-3.5 h-3.5 text-brand-500" />
              <span>Mega-Ship Clustering</span>
            </button>

            <button
              onClick={() => handleShockEvent('tidal_restriction')}
              disabled={injectingEvent !== null}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-bg hover:bg-surface-hover border border-surface-border text-content-primary transition-colors flex items-center space-x-1.5"
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Tidal Restriction</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-surface-card border border-surface-border rounded-xl shadow-sm overflow-hidden">
        {/* Navigation Tabs & Search Controls */}
        <div className="p-4 border-b border-surface-border flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center space-x-2 bg-surface-bg p-1 rounded-lg border border-surface-border">
            <button
              onClick={() => setActiveTab('vessels')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'vessels'
                  ? 'bg-surface-card text-brand-500 shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              Vessel Schedule ({vessels.length})
            </button>
            <button
              onClick={() => setActiveTab('berths')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'berths'
                  ? 'bg-surface-card text-brand-500 shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              Berth Infrastructure ({berths.length})
            </button>
          </div>

          {/* Search & Filters */}
          {activeTab === 'vessels' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted" />
                <input
                  type="text"
                  placeholder="Search vessel or IMO..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-surface-border bg-surface-bg text-content-primary focus:outline-none focus:ring-1 focus:ring-brand-500 w-48 sm:w-64"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-1 text-xs">
                <Filter className="w-3.5 h-3.5 text-content-muted" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-surface-bg border border-surface-border rounded-lg px-2 py-1.5 text-xs font-medium text-content-primary focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="ANCHORED">Anchored</option>
                  <option value="BERTHED">Berthed</option>
                </select>
              </div>

              {/* Class Filter */}
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="bg-surface-bg border border-surface-border rounded-lg px-2 py-1.5 text-xs font-medium text-content-primary focus:outline-none"
              >
                <option value="ALL">All Vessel Classes</option>
                <option value="Feeder">Feeder</option>
                <option value="Panamax">Panamax</option>
                <option value="Post-Panamax">Post-Panamax</option>
                <option value="ULCV">ULCV</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab 1: Vessel Schedule Table */}
        {activeTab === 'vessels' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-surface-bg text-content-secondary font-semibold">
                  <th className="py-3 px-4">Vessel / IMO</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Cargo (TEU)</th>
                  <th className="py-3 px-4">Dimensions</th>
                  <th className="py-3 px-4">Carrier ETA</th>
                  <th className="py-3 px-4">Corrected ETA (AI Forecast)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Berth Fit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filteredVessels.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-content-muted">
                      No vessels match the specified query or filters.
                    </td>
                  </tr>
                ) : (
                  filteredVessels.map((v) => (
                    <tr key={v.id} className="hover:bg-surface-hover transition-colors">
                      {/* Vessel / IMO */}
                      <td className="py-3 px-4 font-medium text-content-primary">
                        <div className="flex items-center space-x-2">
                          <div>
                            <div className="font-semibold flex items-center space-x-1.5">
                              <span>{v.name}</span>
                              {v.priority_flag && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-200 text-[10px] font-bold">
                                  PRIORITY
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-content-muted font-mono">{v.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-surface-bg border border-surface-border text-content-secondary font-medium">
                          {v.vessel_class}
                        </span>
                      </td>

                      {/* Cargo */}
                      <td className="py-3 px-4 font-mono">{v.cargo_volume.toLocaleString()} TEU</td>

                      {/* Dimensions */}
                      <td className="py-3 px-4 font-mono text-content-secondary">
                        {v.length_m}m L · {v.draft_m}m D
                      </td>

                      {/* Carrier ETA */}
                      <td className="py-3 px-4 text-content-primary">
                        {new Date(v.carrier_eta).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Corrected ETA */}
                      <td className="py-3 px-4">
                        {v.corrected_eta ? (
                          <div className="flex items-center space-x-1.5">
                            <span className="text-content-primary font-medium">
                              {new Date(v.corrected_eta).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 font-mono">
                              {Math.round(v.eta_confidence * 100)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-content-muted">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            v.status === 'BERTHED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : v.status === 'ANCHORED'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>

                      {/* Berth Fit */}
                      <td className="py-3 px-4">
                        {v.assigned_berth_id ? (
                          <div className="flex items-center space-x-1">
                            <span className="font-semibold text-content-primary">
                              {v.assigned_berth_id}
                            </span>
                            {v.quay_fit && v.draft_fit ? (
                              <span title="Valid Berth Fit">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              </span>
                            ) : (
                              <span title="Dimension Conflict Warning">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-content-muted">Unassigned</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Berth Infrastructure Grid */}
        {activeTab === 'berths' && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {berths.map((b) => (
              <div
                key={b.id}
                className="border border-surface-border rounded-lg p-4 bg-surface-bg hover:border-brand-500 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-content-primary">{b.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-surface-card border border-surface-border text-content-secondary font-mono">
                      {b.id}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      b.status === 'OCCUPIED'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : b.status === 'AVAILABLE'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {b.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-content-secondary">
                  <div>
                    <span className="text-content-muted block text-[10px]">Quay Length:</span>
                    <span className="font-medium text-content-primary">{b.length_m} meters</span>
                  </div>
                  <div>
                    <span className="text-content-muted block text-[10px]">Max Draft:</span>
                    <span className="font-medium text-content-primary">{b.draft_limit_m} meters</span>
                  </div>
                  <div>
                    <span className="text-content-muted block text-[10px]">Crane Slots:</span>
                    <span className="font-medium text-content-primary">
                      {b.operational_cranes} / {b.crane_slots} Active
                    </span>
                  </div>
                  <div>
                    <span className="text-content-muted block text-[10px]">Quay Utilization:</span>
                    <span className="font-medium text-content-primary">{b.utilization_pct}%</span>
                  </div>
                </div>

                {b.current_vessel_name && (
                  <div className="mt-3 p-2 rounded bg-surface-card border border-surface-border text-xs flex items-center space-x-2">
                    <Ship className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="truncate text-content-primary font-medium">
                      Berthed: {b.current_vessel_name}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
