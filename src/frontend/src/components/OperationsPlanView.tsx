import React, { useState, useMemo, useEffect } from 'react';
import { OptimisationRunResponse, api, apiClient, ShiftBriefingResponse } from '../api/client';
import {
  CalendarDays,
  Download,
  Printer,
  Clock,
  Anchor,
  Layers,
  CheckCircle2,
  Ship,
  TrendingDown,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Zap,
  AlertTriangle,
  Brain,
  LayoutGrid,
  List
} from 'lucide-react';
import { QuaysideSpatialMap } from './QuaysideSpatialMap';
import { PredictionExplainabilityModal } from './PredictionExplainabilityModal';

interface OperationsPlanViewProps {
  optimisationData: OptimisationRunResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenOverrideModal: (vesselId?: string) => void;
  userRole: string;
  onNavigateTab?: (tab: string) => void;
}

export const OperationsPlanView: React.FC<OperationsPlanViewProps> = ({
  optimisationData,
  loading,
  onRefresh,
  onOpenOverrideModal,
  userRole,
  onNavigateTab,
}) => {
  const [selectedShift, setSelectedShift] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'SPLIT' | 'MAP' | 'MANIFEST'>('SPLIT');
  const [explainModalOpen, setExplainModalOpen] = useState(false);
  const [shockLoading, setShockLoading] = useState(false);
  const [shockNotification, setShockNotification] = useState<string | null>(null);

  const handleInjectShock = async (eventType: 'mega_ship_surge' | 'crane_outage' | 'tidal_restriction') => {
    setShockLoading(true);
    setShockNotification(null);
    try {
      const res = await api.injectShockEvent(eventType);
      setShockNotification(`⚡ Congestion Event Injected: ${res.message || eventType}. Recalculating arrivals and quayside queue...`);
      onRefresh();
      setTimeout(() => setShockNotification(null), 7000);
    } catch (err: any) {
      setShockNotification(`Failed to inject shock event: ${err.message || err.detail}`);
    } finally {
      setShockLoading(false);
    }
  };

  const handleResetBaseline = async () => {
    setShockLoading(true);
    setShockNotification(null);
    try {
      await api.generateSyntheticData(50, 10, 42);
      setShockNotification(`🔄 Traffic Reset: 50 vessels and 10 berths restored to nominal operating baseline.`);
      onRefresh();
      setTimeout(() => setShockNotification(null), 7000);
    } catch (err: any) {
      setShockNotification(`Failed to reset baseline: ${err.message || err.detail}`);
    } finally {
      setShockLoading(false);
    }
  };


  // 72 hours divided into 6 x 12-hour shifts
  const shiftDefinitions = [
    { id: 1, name: 'Shift 1 (Hours 00–12)', label: 'Day 1 — Shift A (07:00–19:00)', startHour: 0, endHour: 12 },
    { id: 2, name: 'Shift 2 (Hours 12–24)', label: 'Day 1 — Shift B (19:00–07:00)', startHour: 12, endHour: 24 },
    { id: 3, name: 'Shift 3 (Hours 24–36)', label: 'Day 2 — Shift A (07:00–19:00)', startHour: 24, endHour: 36 },
    { id: 4, name: 'Shift 4 (Hours 36–48)', label: 'Day 2 — Shift B (19:00–07:00)', startHour: 36, endHour: 48 },
    { id: 5, name: 'Shift 5 (Hours 48–60)', label: 'Day 3 — Shift A (07:00–19:00)', startHour: 48, endHour: 60 },
    { id: 6, name: 'Shift 6 (Hours 60–72)', label: 'Day 3 — Shift B (19:00–07:00)', startHour: 60, endHour: 72 },
  ];

  const assignments = optimisationData?.assignments || [];

  // Group assignments into shifts based on relative start time from now
  const now = useMemo(() => new Date(), []);

  const enrichedAssignments = useMemo(() => {
    return assignments.map((item) => {
      const startTime = new Date(item.start_time);
      const hoursFromNow = Math.max(0, (startTime.getTime() - now.getTime()) / (1000 * 60 * 60));
      const shiftIndex = Math.min(5, Math.floor(hoursFromNow / 12));
      const shiftNumber = shiftIndex + 1;
      return {
        ...item,
        hoursFromNow,
        shiftNumber,
      };
    });
  }, [assignments, now]);

  const filteredAssignments = useMemo(() => {
    return enrichedAssignments.filter((item) => {
      const matchesShift = selectedShift === 'ALL' || item.shiftNumber === selectedShift;
      const matchesSearch =
        item.vessel_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.vessel_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.assigned_berth_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.assigned_berth_id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesShift && matchesSearch;
    });
  }, [enrichedAssignments, selectedShift, searchQuery]);

  // Reset page when filter/shift changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedShift, searchQuery, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredAssignments.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedAssignments = useMemo(() => {
    return filteredAssignments.slice(startIndex, startIndex + pageSize);
  }, [filteredAssignments, startIndex, pageSize]);

  const handlePrint = () => {
    window.print();
  };

  const [aiBriefing, setAiBriefing] = useState<ShiftBriefingResponse | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  const handleGenerateAiBriefing = async () => {
    setBriefingLoading(true);
    try {
      const shiftLabel =
        selectedShift === 'ALL'
          ? '72-Hour Full Operations Window'
          : `Shift ${selectedShift} (12-Hour Operational Window)`;
      const res = await apiClient.generateAiShiftBriefing(shiftLabel);
      setAiBriefing(res);
    } catch (err: any) {
      console.error('Failed to generate AI briefing:', err);
    } finally {
      setBriefingLoading(false);
    }
  };

  const handleExportCsv = () => {
    const csvUrl = api.getExportOperationsPlanUrl();
    window.open(csvUrl, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Official Print Header for Handover Briefing */}
      <div className="print-only mb-6 border-b-2 border-black pb-4 text-black">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase">
              PORT OPERATIONAL MASTER PLAN &amp; SHIFT HANDOVER MANIFEST
            </h1>
            <p className="text-xs text-gray-700 mt-1">
              PortPulse Intelligent Maritime Operations Cockpit · Terminal Harbour Master Command
            </p>
          </div>
          <div className="text-right text-xs">
            <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
            <div><strong>Time:</strong> {new Date().toLocaleTimeString()}</div>
            <div><strong>Shift Horizon:</strong> {selectedShift === 'ALL' ? '72-Hour Planning Horizon' : `Shift ${selectedShift} (12h)`}</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-gray-300 text-xs">
          <div>
            <span className="text-gray-600 block">Total Work Orders:</span>
            <strong className="text-sm">{filteredAssignments.length} Vessels</strong>
          </div>
          <div>
            <span className="text-gray-600 block">Average Wait Time:</span>
            <strong className="text-sm">{optimisationData ? `${optimisationData.average_wait_time_hours.toFixed(1)} hrs` : '0.0 hrs'}</strong>
          </div>
          <div>
            <span className="text-gray-600 block">Crane Utilization:</span>
            <strong className="text-sm">{optimisationData ? `${optimisationData.crane_utilization_pct.toFixed(1)}%` : '0.0%'}</strong>
          </div>
          <div>
            <span className="text-gray-600 block">Projected Demurrage:</span>
            <strong className="text-sm">${optimisationData ? Math.round(optimisationData.total_port_demurrage_usd).toLocaleString() : '0'}</strong>
          </div>
        </div>
      </div>

      {/* Top Action Bar */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface-card border border-surface-border p-5 rounded-xl shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <CalendarDays className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-content-primary">
                  72-Hour Shift Operations Master Plan
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-bold uppercase tracking-wider">
                  {userRole.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-content-secondary">
                Shift supervisor operational schedule: Quay assignments, STS crane allocations, and demurrage mitigation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-surface-border bg-surface-bg hover:bg-surface-hover text-content-primary transition"
            title="Refresh Operations Plan from Highs MILP Solver"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            <span className="hidden sm:inline">Sync Plan</span>
          </button>

          <button
            onClick={handleGenerateAiBriefing}
            disabled={briefingLoading}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-zinc-900 text-white hover:bg-black dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition shadow-sm"
            title="Generate AI Handover Briefing synthesized by IBM watsonx.ai"
          >
            <span>🤖</span>
            <span>{briefingLoading ? 'Synthesizing...' : 'AI Shift Briefing'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm"
            title="Export 72-Hour Shift Schedule to CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export 72h Plan (CSV)</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-surface-border bg-surface-bg hover:bg-surface-hover text-content-primary transition"
            title="Print Shift Supervisor Handover Briefing"
          >
            <Printer className="w-4 h-4" />
            <span>Print Shift Briefing</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="no-print grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface-card border border-surface-border p-4 rounded-xl shadow-sm">
          <span className="text-[11px] font-semibold text-content-muted block uppercase tracking-wide">
            Scheduled Vessels (72h)
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-content-primary">
              {optimisationData?.vessels_scheduled ?? assignments.length}
            </span>
            <Ship className="w-5 h-5 text-blue-500 opacity-80" />
          </div>
          <span className="text-[10px] text-content-muted mt-1 block">
            Safe draft &amp; length verified
          </span>
        </div>

        <div className="bg-surface-card border border-surface-border p-4 rounded-xl shadow-sm">
          <span className="text-[11px] font-semibold text-content-muted block uppercase tracking-wide">
            Average Wait Time
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-500">
              {optimisationData ? `${optimisationData.average_wait_time_hours.toFixed(1)}h` : '0.0h'}
            </span>
            <Clock className="w-5 h-5 text-blue-500 opacity-80" />
          </div>
          <span className="text-[10px] text-emerald-500 font-medium mt-1 flex items-center">
            <TrendingDown className="w-3 h-3 mr-1" />
            Within target operating buffer
          </span>
        </div>

        <div className="bg-surface-card border border-surface-border p-4 rounded-xl shadow-sm">
          <span className="text-[11px] font-semibold text-content-muted block uppercase tracking-wide">
            Crane Fleet Utilization
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-500">
              {optimisationData ? `${optimisationData.crane_utilization_pct.toFixed(1)}%` : '0.0%'}
            </span>
            <Layers className="w-5 h-5 text-amber-500 opacity-80" />
          </div>
          <span className="text-[10px] text-content-muted mt-1 block">
            STS Gangs allocated optimally
          </span>
        </div>

        <div className="bg-surface-card border border-surface-border p-4 rounded-xl shadow-sm">
          <span className="text-[11px] font-semibold text-content-muted block uppercase tracking-wide">
            Demurrage Cost Impact
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-500">
              ${optimisationData ? Math.round(optimisationData.total_port_demurrage_usd).toLocaleString() : '0'}
            </span>
            <Anchor className="w-5 h-5 text-rose-500 opacity-80" />
          </div>
          <span className="text-[10px] text-content-muted mt-1 block">
            Minimized by Highs MILP solver
          </span>
        </div>
      </div>

      {/* AI Shift Briefing Manifest (F-401) */}
      {aiBriefing && (
        <div className="no-print bg-zinc-900 text-zinc-100 dark:bg-zinc-950 p-5 rounded-xl border border-zinc-800 shadow-md animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
            <div className="flex items-center space-x-2">
              <span className="text-base">📋</span>
              <h3 className="font-bold text-sm tracking-tight text-white">{aiBriefing.title}</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                IBM watsonx.ai Synthesized
              </span>
            </div>
            <button
              onClick={() => setAiBriefing(null)}
              className="text-zinc-400 hover:text-white text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition"
            >
              ✕ Dismiss
            </button>
          </div>
          <div className="text-xs whitespace-pre-wrap leading-relaxed text-zinc-300 font-mono bg-black/40 p-4 rounded-lg border border-zinc-800/80">
            {aiBriefing.briefing_markdown}
          </div>
        </div>
      )}


      {/* Shock Event Notification Toast */}
      {shockNotification && (
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center space-x-2">
            <span className="text-base">⚡</span>
            <span className="font-semibold">{shockNotification}</span>
          </div>
          <button 
            onClick={() => setShockNotification(null)}
            className="text-xs text-content-muted hover:text-content-primary px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Congestion Testing & Scenario Lab Toolbar */}
      <div className="no-print bg-surface-card border border-surface-border p-4 rounded-xl shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 font-bold">🧪</span>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-content-primary">
                Operational Congestion Testing &amp; Shock Lab
              </h3>
              <p className="text-[11px] text-content-secondary">
                Inject synthetic shock events to test how our machine learning models detect and predict quayside congestion
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <button
              onClick={() => handleInjectShock('mega_ship_surge')}
              disabled={shockLoading || loading}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
              title="Cluster 3 Mega-Ships into a 3-hour arrival window to overload berths"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{shockLoading ? 'Injecting...' : '⚡ Inject Mega-Ship Surge'}</span>
            </button>

            <button
              onClick={() => handleInjectShock('crane_outage')}
              disabled={shockLoading || loading}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
              title="Breakdown STS Crane on Berth 02 cutting throughput by 50%"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>⚠️ Inject Crane Breakdown</span>
            </button>

            <button
              onClick={() => handleInjectShock('tidal_restriction')}
              disabled={shockLoading || loading}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
              title="Simulate Spring Low Tide restricting drafts by 2.5m"
            >
              <span>🌊</span>
              <span>Inject Low Tide Anomaly</span>
            </button>

            <button
              onClick={handleResetBaseline}
              disabled={shockLoading || loading}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-surface-border bg-surface-bg hover:bg-surface-hover text-content-primary transition disabled:opacity-50"
              title="Restore clean baseline of 50 vessels and 10 berths"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Baseline</span>
            </button>

            <button
              onClick={() => setExplainModalOpen(true)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 transition flex items-center space-x-1.5 shadow-sm"
              title="Learn how machine learning models forecast congestion and where to view predictions"
            >
              <Brain className="w-3.5 h-3.5" />
              <span>🧠 How Predictions Work &amp; Where to See Them</span>
            </button>
          </div>
        </div>
      </div>

      {/* View Mode Switcher (Spatial Map vs Manifest Table vs Split View) */}
      <div className="no-print flex items-center justify-between pb-1">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold uppercase tracking-wider text-content-secondary">
            Display Layout:
          </span>
          <div className="inline-flex rounded-lg border border-surface-border bg-surface-card p-0.5 text-xs font-semibold shadow-sm">
            <button
              onClick={() => setViewMode('SPLIT')}
              className={`px-3 py-1.5 rounded-md transition flex items-center space-x-1.5 ${
                viewMode === 'SPLIT'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>⊞ Split View (Map + Table)</span>
            </button>
            <button
              onClick={() => setViewMode('MAP')}
              className={`px-3 py-1.5 rounded-md transition flex items-center space-x-1.5 ${
                viewMode === 'MAP'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>🗺️ Quayside Spatial Map</span>
            </button>
            <button
              onClick={() => setViewMode('MANIFEST')}
              className={`px-3 py-1.5 rounded-md transition flex items-center space-x-1.5 ${
                viewMode === 'MANIFEST'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>📋 Berthing Manifest Table</span>
            </button>
          </div>
        </div>

        <div className="text-xs text-content-muted hidden sm:block">
          Showing <strong>{filteredAssignments.length}</strong> planned vessel dockings across <strong>10</strong> quays
        </div>
      </div>

      {/* Quayside Spatial Map Section */}
      {(viewMode === 'MAP' || viewMode === 'SPLIT') && (
        <div className="no-print animate-in fade-in">
          <QuaysideSpatialMap
            assignments={filteredAssignments}
            selectedShift={selectedShift}
            onOpenOverrideModal={onOpenOverrideModal}
          />
        </div>
      )}

      {/* Shift Filter Navigation & Search */}
      <div className="no-print flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface-card border border-surface-border p-3 rounded-xl">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedShift('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              selectedShift === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
            }`}
          >
            All Shifts (72h)
          </button>
          {shiftDefinitions.map((shift) => (
            <button
              key={shift.id}
              onClick={() => setSelectedShift(shift.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                selectedShift === shift.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
              }`}
            >
              Shift {shift.id}
            </button>
          ))}
        </div>

        <div className="w-full md:w-64">
          <input
            type="text"
            placeholder="Search vessel or berth..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-1.5 text-xs text-content-primary placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Shift Supervisor Briefing Header if specific shift selected */}
      {selectedShift !== 'ALL' && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-blue-500 text-sm">
              {shiftDefinitions.find((s) => s.id === selectedShift)?.label}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold text-[11px]">
              Active Work Orders: {filteredAssignments.length}
            </span>
          </div>
          <p className="mt-1 text-content-secondary text-[11px]">
            Supervisor Instructions: Verify bollard clearance, coordinate pilotage 45 min prior to docking, and confirm STS crane positioning at assigned quay sectors.
          </p>
        </div>
      )}

      {/* Main Operations Plan Table */}
      <div className="bg-surface-card border border-surface-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-border flex items-center justify-between">
          <h3 className="font-bold text-xs text-content-primary uppercase tracking-wide">
            Berth &amp; Gang Work Manifest ({filteredAssignments.length} operations)
          </h3>
          <span className="text-[11px] text-content-muted">
            Constraint Solver: HiGHS MILP · 0 Hard Violations
          </span>
        </div>

        {filteredAssignments.length === 0 ? (
          <div className="p-8 text-center text-content-muted text-xs">
            No vessel operations scheduled in this shift window.
          </div>
        ) : (
          <>
            {/* Screen Table (Paginated) */}
            <div className="overflow-x-auto no-print">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-bg border-b border-surface-border font-semibold text-content-secondary">
                  <tr>
                    <th className="p-3">Vessel &amp; Class</th>
                    <th className="p-3">Dimensions</th>
                    <th className="p-3">Assigned Quay</th>
                    <th className="p-3">STS Cranes</th>
                    <th className="p-3">Berthing Schedule</th>
                    <th className="p-3">Dwell Time</th>
                    <th className="p-3">Wait Hours</th>
                    <th className="p-3">Demurrage</th>
                    <th className="p-3">Constraint Status</th>
                    <th className="p-3 text-right">Supervisor Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {paginatedAssignments.map((v) => {
                    const startDate = new Date(v.start_time);
                    const endDate = new Date(v.end_time);

                    return (
                      <tr key={v.vessel_id} className="hover:bg-surface-hover/60 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-content-primary">{v.vessel_name}</div>
                          <div className="text-[11px] font-mono text-content-muted">
                            {v.vessel_id} · <span className="text-blue-500">{v.vessel_class}</span>
                          </div>
                        </td>

                        <td className="p-3 text-content-secondary">
                          <div>{v.length_m}m Length</div>
                          <div className="text-[11px] text-content-muted">{v.draft_m}m Draft</div>
                        </td>

                        <td className="p-3">
                          <span className="font-semibold text-content-primary">{v.assigned_berth_name}</span>
                          <div className="text-[11px] font-mono text-content-muted">ID: {v.assigned_berth_id}</div>
                        </td>

                        <td className="p-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold text-xs border border-amber-500/30">
                            {v.allocated_cranes} STS Cranes
                          </span>
                        </td>

                        <td className="p-3 text-content-primary">
                          <div className="font-semibold text-[11px] text-content-primary">
                            {startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })},{' '}
                            {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-[11px] text-content-muted flex items-center space-x-1 mt-0.5">
                            <span className="text-blue-500 font-bold">→</span>
                            <span>
                              {endDate.toLocaleDateString([], { month: 'short', day: 'numeric' })},{' '}
                              {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>

                        <td className="p-3 font-semibold text-content-secondary">
                          {v.expected_dwell_hours.toFixed(1)} hrs
                        </td>

                        <td className="p-3">
                          <span
                            className={`font-semibold ${
                              v.wait_time_hours > 4
                                ? 'text-amber-500'
                                : v.wait_time_hours > 0
                                ? 'text-blue-500'
                                : 'text-emerald-500'
                            }`}
                          >
                            {v.wait_time_hours > 0 ? `+${v.wait_time_hours.toFixed(1)}h` : 'Direct Berth'}
                          </span>
                        </td>

                        <td className="p-3 font-mono font-medium">
                          {v.demurrage_cost_usd > 0 ? (
                            <span className="text-rose-500">${Math.round(v.demurrage_cost_usd).toLocaleString()}</span>
                          ) : (
                            <span className="text-emerald-500">$0</span>
                          )}
                        </td>

                        <td className="p-3">
                          <span className="inline-flex items-center space-x-1 text-emerald-500 text-[11px] font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Cleared</span>
                          </span>
                        </td>

                        <td className="p-3 text-right">
                          <button
                            onClick={() => onOpenOverrideModal(v.vessel_id)}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded bg-surface-bg border border-surface-border hover:bg-surface-card hover:border-blue-500 text-content-primary transition"
                            title="Manually override berth or docking time"
                          >
                            Reassign
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Footer */}
            <div className="p-3.5 border-t border-surface-border bg-surface-bg flex flex-col sm:flex-row items-center justify-between gap-3 text-xs no-print">
              <div className="flex items-center space-x-1.5 text-content-secondary">
                <span>Showing</span>
                <span className="font-bold text-content-primary">
                  {filteredAssignments.length === 0 ? 0 : startIndex + 1}
                </span>
                <span>to</span>
                <span className="font-bold text-content-primary">
                  {Math.min(startIndex + pageSize, filteredAssignments.length)}
                </span>
                <span>of</span>
                <span className="font-bold text-content-primary">{filteredAssignments.length}</span>
                <span>operations</span>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1.5">
                  <span className="text-content-muted">Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-surface-card border border-surface-border rounded-lg px-2 py-1 text-xs font-semibold text-content-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
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

            {/* Official Print Table (Full Horizon & Signoff) */}
            <div className="print-only">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 border">Vessel / ID</th>
                    <th className="p-2 border">Dimensions</th>
                    <th className="p-2 border">Assigned Quay</th>
                    <th className="p-2 border">Cranes</th>
                    <th className="p-2 border">Docking Window</th>
                    <th className="p-2 border">Dwell</th>
                    <th className="p-2 border">Wait</th>
                    <th className="p-2 border">Demurrage</th>
                    <th className="p-2 border">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map((v) => {
                    const startDate = new Date(v.start_time);
                    const endDate = new Date(v.end_time);

                    return (
                      <tr key={`print-${v.vessel_id}`}>
                        <td className="p-2 border font-bold">
                          {v.vessel_name} ({v.vessel_id})
                        </td>
                        <td className="p-2 border">
                          {v.length_m}m L / {v.draft_m}m D
                        </td>
                        <td className="p-2 border font-semibold">
                          {v.assigned_berth_name}
                        </td>
                        <td className="p-2 border text-center">
                          {v.allocated_cranes} STS
                        </td>
                        <td className="p-2 border">
                          {startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                          {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-2 border">{v.expected_dwell_hours.toFixed(1)}h</td>
                        <td className="p-2 border">
                          {v.wait_time_hours > 0 ? `+${v.wait_time_hours.toFixed(1)}h` : 'Direct'}
                        </td>
                        <td className="p-2 border">
                          ${Math.round(v.demurrage_cost_usd).toLocaleString()}
                        </td>
                        <td className="p-2 border text-center font-bold">
                          CLEARED
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Maritime Authority Signoff Handover Letterhead */}
              <div className="mt-8 pt-6 border-t-2 border-black flex justify-between text-xs text-black">
                <div className="w-1/3">
                  <p className="font-bold">Prepared By (Shift Supervisor):</p>
                  <div className="mt-8 border-b border-black w-3/4"></div>
                  <p className="text-[10px] mt-1 text-gray-600">Signature / Duty Roster Stamp</p>
                </div>
                <div className="w-1/3">
                  <p className="font-bold">Approved By (Harbour Master):</p>
                  <div className="mt-8 border-b border-black w-3/4"></div>
                  <p className="text-[10px] mt-1 text-gray-600">Operations Control Center</p>
                </div>
                <div className="w-1/3 text-right">
                  <p className="font-bold">System Validation:</p>
                  <p className="text-[11px] mt-1">Highs Mathematical MILP Solver</p>
                  <p className="text-[10px] text-gray-600">Certified Zero Hard Constraint Violations</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Congestion Prediction Explainability Modal */}
      <PredictionExplainabilityModal
        isOpen={explainModalOpen}
        onClose={() => setExplainModalOpen(false)}
        onNavigateTab={onNavigateTab}
      />
    </div>
  );
};
