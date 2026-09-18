import React, { useState, useMemo, useEffect } from 'react';
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
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Download,
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
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [injectingEvent, setInjectingEvent] = useState<string | null>(null);
  const [activeShockLabel, setActiveShockLabel] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const safeVessels = Array.isArray(vessels) ? vessels : [];
  const safeBerths = Array.isArray(berths) ? berths : [];

  // Status and Priority counts for quick filter pills
  const counts = useMemo(() => {
    return {
      all: safeVessels.length,
      anchored: safeVessels.filter((v) => v.status === 'ANCHORED').length,
      berthed: safeVessels.filter((v) => v.status === 'BERTHED').length,
      scheduled: safeVessels.filter((v) => v.status === 'SCHEDULED').length,
      priority: safeVessels.filter((v) => Boolean(v.priority_flag)).length,
    };
  }, [safeVessels]);

  // Filter vessels
  const filteredVessels = useMemo(() => {
    return safeVessels.filter((v) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (v.name && v.name.toLowerCase().includes(q)) ||
        (v.id && v.id.toLowerCase().includes(q)) ||
        (v.assigned_berth_id && v.assigned_berth_id.toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
      const matchesClass = classFilter === 'ALL' || v.vessel_class === classFilter;
      const matchesPriority = !priorityOnly || Boolean(v.priority_flag);
      return matchesSearch && matchesStatus && matchesClass && matchesPriority;
    });
  }, [safeVessels, searchQuery, statusFilter, classFilter, priorityOnly]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, classFilter, priorityOnly, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredVessels.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedVessels = useMemo(() => {
    return filteredVessels.slice(startIndex, startIndex + pageSize);
  }, [filteredVessels, startIndex, pageSize]);

  const handleShockEvent = async (
    eventType: 'crane_outage' | 'mega_ship_surge' | 'tidal_restriction',
    label: string
  ) => {
    try {
      setInjectingEvent(eventType);
      const res = await api.injectShockEvent(eventType);
      setActiveShockLabel(label);
      onTriggerEvent(`Operational Shock Injected: ${res.message || label}. ML delay predictions & risk curves updated.`);
      onRefresh();
    } catch (err: any) {
      onTriggerEvent(`Error injecting shock event: ${err.message || 'Action failed'}`);
    } finally {
      setInjectingEvent(null);
    }
  };

  const handleResetBaseline = async () => {
    try {
      setInjectingEvent('reset');
      await api.generateSyntheticData(50, 10, 42);
      setActiveShockLabel(null);
      onTriggerEvent('Baseline restored (50 vessels, 10 berths). Active shock scenarios cleared.');
      onRefresh();
    } catch (err: any) {
      onTriggerEvent(`Error resetting baseline: ${err.message || 'Action failed'}`);
    } finally {
      setInjectingEvent(null);
    }
  };

  const [exportingCsv, setExportingCsv] = useState(false);

  const handleExportTableCsv = async () => {
    setExportingCsv(true);
    try {
      if (activeTab === 'vessels') {
        const toExport = filteredVessels.length > 0 ? filteredVessels : safeVessels;
        await api.downloadVesselsCsv(toExport);
        onTriggerEvent(`Exported ${toExport.length} vessels to CSV.`);
      } else {
        await api.downloadBerthsCsv(safeBerths);
        onTriggerEvent(`Exported ${safeBerths.length} berths to CSV.`);
      }
    } catch (err: any) {
      onTriggerEvent(`Failed to export CSV: ${err?.message || 'Download failed'}`);
    } finally {
      setExportingCsv(false);
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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold text-content-primary uppercase tracking-wider">
              Inject Delay Shock Event (Dynamic Scenario):
            </span>
            {activeShockLabel && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-bold animate-pulse">
                Active: {activeShockLabel}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleShockEvent('crane_outage', 'Crane Breakdown')}
              disabled={injectingEvent !== null}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-bg hover:bg-surface-hover border border-surface-border text-content-primary transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>Crane Breakdown</span>
            </button>

            <button
              onClick={() => handleShockEvent('mega_ship_surge', 'Mega-Ship Surge')}
              disabled={injectingEvent !== null}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-bg hover:bg-surface-hover border border-surface-border text-content-primary transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Ship className="w-3.5 h-3.5 text-blue-500" />
              <span>Mega-Ship Clustering</span>
            </button>

            <button
              onClick={() => handleShockEvent('tidal_restriction', 'Tidal Restriction')}
              disabled={injectingEvent !== null}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-bg hover:bg-surface-hover border border-surface-border text-content-primary transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Tidal Restriction</span>
            </button>

            <button
              onClick={handleResetBaseline}
              disabled={injectingEvent !== null}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-bg hover:bg-surface-hover border border-dashed border-surface-border text-content-muted hover:text-content-primary transition-colors flex items-center space-x-1.5 disabled:opacity-50"
              title="Reset terminal baseline to 50 vessels, 10 berths"
            >
              <RotateCcw className="w-3.5 h-3.5 text-content-muted" />
              <span>Reset Baseline</span>
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
              Vessel Schedule ({safeVessels.length})
            </button>
            <button
              onClick={() => setActiveTab('berths')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'berths'
                  ? 'bg-surface-card text-brand-500 shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              Berth Infrastructure ({safeBerths.length})
            </button>
          </div>

          {/* Search, Filters & Top Pagination */}
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
                <option value="ALL">All Classes</option>
                <option value="Feeder">Feeder</option>
                <option value="Panamax">Panamax</option>
                <option value="Post-Panamax">Post-Panamax</option>
                <option value="ULCV">ULCV</option>
              </select>

              {/* Top Pagination Controls */}
              <div className="flex items-center space-x-2 pl-2 border-l border-surface-border text-xs">
                <span className="text-content-secondary hidden xl:inline font-mono">
                  {filteredVessels.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + pageSize, filteredVessels.length)} of {filteredVessels.length}
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-surface-border bg-surface-bg hover:bg-surface-hover text-content-primary disabled:opacity-40 disabled:cursor-not-allowed transition"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 font-mono text-xs font-bold text-content-primary">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-surface-border bg-surface-bg hover:bg-surface-hover text-content-primary disabled:opacity-40 disabled:cursor-not-allowed transition"
                    title="Next Page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Export CSV Button for Vessels */}
              <button
                type="button"
                onClick={handleExportTableCsv}
                disabled={exportingCsv}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-surface-bg hover:bg-surface-hover text-content-primary transition text-xs font-semibold shadow-sm disabled:opacity-50 cursor-pointer"
                title="Download vessel schedule manifest as CSV"
              >
                <Download className={`w-3.5 h-3.5 ${exportingCsv ? 'animate-bounce text-blue-500' : 'text-emerald-500'}`} />
                <span>{exportingCsv ? 'Exporting...' : 'Export CSV'}</span>
              </button>
            </div>
          )}

          {activeTab === 'berths' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportTableCsv}
                disabled={exportingCsv}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-surface-bg hover:bg-surface-hover text-content-primary transition text-xs font-semibold shadow-sm disabled:opacity-50 cursor-pointer"
                title="Download quay berth infrastructure specifications as CSV"
              >
                <Download className={`w-3.5 h-3.5 ${exportingCsv ? 'animate-bounce text-blue-500' : 'text-emerald-500'}`} />
                <span>{exportingCsv ? 'Exporting...' : 'Export CSV'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Quick Filter Status Pills */}
        {activeTab === 'vessels' && (
          <div className="px-4 py-2 bg-surface-bg/50 border-b border-surface-border flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mr-1">
              Quick Filter:
            </span>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setPriorityOnly(false);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'ALL' && !priorityOnly
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-surface-card border border-surface-border text-content-secondary hover:text-content-primary hover:bg-surface-hover'
              }`}
            >
              All ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ANCHORED');
                setPriorityOnly(false);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'ANCHORED' && !priorityOnly
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-surface-card border border-surface-border text-amber-700 dark:text-amber-300 hover:bg-surface-hover'
              }`}
            >
              Anchored ({counts.anchored})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('BERTHED');
                setPriorityOnly(false);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'BERTHED' && !priorityOnly
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-surface-card border border-surface-border text-emerald-700 dark:text-emerald-300 hover:bg-surface-hover'
              }`}
            >
              Berthed ({counts.berthed})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('SCHEDULED');
                setPriorityOnly(false);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'SCHEDULED' && !priorityOnly
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-surface-card border border-surface-border text-blue-700 dark:text-blue-300 hover:bg-surface-hover'
              }`}
            >
              Scheduled ({counts.scheduled})
            </button>
            <button
              type="button"
              onClick={() => setPriorityOnly(!priorityOnly)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                priorityOnly
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-surface-card border border-surface-border text-purple-700 dark:text-purple-300 hover:bg-surface-hover'
              }`}
            >
              Priority Flagged ({counts.priority})
            </button>
          </div>
        )}

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
                  <th className="py-3 px-4">Projected ETA (Terminal Forecast)</th>
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
                  paginatedVessels.map((v) => (
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

                      {/* Projected ETA (Terminal ML Forecast) */}
                      <td className="py-3 px-4">
                        {v.status === 'BERTHED' ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-content-primary font-semibold">
                                At Berth ({v.assigned_berth_id || 'Quay'})
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Active Ops
                              </span>
                            </div>
                            <span className="text-[10px] text-content-muted block">
                              Quayside operations · 100% confidence
                            </span>
                          </div>
                        ) : v.status === 'ANCHORED' ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-content-primary font-medium">
                                ETB: {new Date(v.corrected_eta || v.carrier_eta).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                +{(v.predicted_delay_hours ?? 1.5).toFixed(1)}h queue wait
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold"
                                title="Fairway Queue Clearance Confidence"
                              >
                                {Math.round((v.eta_confidence ?? 0.88) * 100)}% ML conf
                              </span>
                              <span className="text-[10px] text-content-muted font-medium truncate max-w-[150px]">
                                {v.delay_factors?.join(' · ') || 'Fairway Queue Wait'}
                              </span>
                            </div>
                          </div>
                        ) : v.corrected_eta ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-content-primary font-medium">
                                {new Date(v.corrected_eta).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {(() => {
                                const delay =
                                  v.predicted_delay_hours !== undefined && v.predicted_delay_hours !== null
                                    ? v.predicted_delay_hours
                                    : (new Date(v.corrected_eta).getTime() - new Date(v.carrier_eta).getTime()) / 3600000;
                                if (delay > 1.5) {
                                  return (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                      +{delay.toFixed(1)}h delay
                                    </span>
                                  );
                                } else if (delay > 0.2) {
                                  return (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                      +{delay.toFixed(1)}h delay
                                    </span>
                                  );
                                } else {
                                  return (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                      On-Time
                                    </span>
                                  );
                                }
                              })()}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold"
                                title="GradientBoosting ML Model Confidence"
                              >
                                {Math.round((v.eta_confidence ?? 0.92) * 100)}% ML conf
                              </span>
                              {Array.isArray(v.delay_factors) && v.delay_factors.length > 0 && (
                                <span
                                  className="text-[10px] text-content-muted font-medium truncate max-w-[160px]"
                                  title={v.delay_factors.join(' · ')}
                                >
                                  {v.delay_factors.join(' · ')}
                                </span>
                              )}
                            </div>
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

            {/* Pagination Controls */}
            <div className="p-3.5 border-t border-surface-border bg-surface-bg flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-1.5 text-content-secondary">
                <span>Showing</span>
                <span className="font-bold text-content-primary">
                  {filteredVessels.length === 0 ? 0 : startIndex + 1}
                </span>
                <span>to</span>
                <span className="font-bold text-content-primary">
                  {Math.min(startIndex + pageSize, filteredVessels.length)}
                </span>
                <span>of</span>
                <span className="font-bold text-content-primary">{filteredVessels.length}</span>
                <span>vessels</span>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1.5">
                  <span className="text-content-muted">Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-surface-card border border-surface-border rounded-lg px-2 py-1 text-xs font-semibold text-content-primary focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-surface-border bg-surface-card hover:bg-surface-hover text-content-primary disabled:opacity-40 disabled:cursor-not-allowed transition text-xs font-semibold"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>

                  <span className="px-2.5 py-1 text-xs font-bold text-content-primary">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-surface-border bg-surface-card hover:bg-surface-hover text-content-primary disabled:opacity-40 disabled:cursor-not-allowed transition text-xs font-semibold"
                    title="Next Page"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Berth Infrastructure Grid */}
        {activeTab === 'berths' && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {safeBerths.map((b) => (
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
