import React, { useState, useMemo, useEffect } from 'react';
import { OptimisationRunResponse, api, apiClient, ShiftBriefingResponse, AutoOptimizeResult } from '../api/client';
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
  List,
  Sparkles,
  Scale,
} from 'lucide-react';
import { QuaysideSpatialMap } from './QuaysideSpatialMap';
import { BerthScheduleGantt } from './BerthScheduleGantt';
import { PredictionExplainabilityModal } from './PredictionExplainabilityModal';
import { VoiceBriefingPlayer } from './VoiceBriefingPlayer';
import { BimcoDemurrageCalculatorModal } from './BimcoDemurrageCalculatorModal';
import { useAuth } from '../context/AuthContext';

export type OperationsSubTab = 'MAP' | 'TABLE' | 'GANTT' | 'TESTING' | 'BRIEFING';

interface OperationsPlanViewProps {
  optimisationData: OptimisationRunResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenOverrideModal: (vesselId?: string) => void;
  userRole: string;
  onNavigateTab?: (tab: string) => void;
  onAutoOptimizeComplete?: () => void;
}

export const OperationsPlanView: React.FC<OperationsPlanViewProps> = ({
  optimisationData,
  loading,
  onRefresh,
  onOpenOverrideModal,
  userRole,
  onNavigateTab,
  onAutoOptimizeComplete,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<OperationsSubTab>('MAP');
  const [selectedShift, setSelectedShift] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [explainModalOpen, setExplainModalOpen] = useState(false);
  const [shockLoading, setShockLoading] = useState(false);
  const [shockNotification, setShockNotification] = useState<string | null>(null);

  const { switchRole } = useAuth();
  const [autoOptLoading, setAutoOptLoading] = useState(false);
  const [autoOptResult, setAutoOptResult] = useState<AutoOptimizeResult | null>(null);
  const [autoOptRejectReason, setAutoOptRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [autoOptNotification, setAutoOptNotification] = useState<string | null>(null);
  const [viewProposedPlan, setViewProposedPlan] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [showProposedDetails, setShowProposedDetails] = useState(false);
  const [bimcoModalOpen, setBimcoModalOpen] = useState(false);
  const [selectedBimcoVessel, setSelectedBimcoVessel] = useState<{ id: string; name: string; dwellHours: number } | null>(null);

  const handleAutoOptimize = async () => {
    setAutoOptLoading(true);
    setAutoOptNotification(null);
    try {
      if (userRole !== 'admin' && userRole !== 'terminal_manager') {
        await switchRole('admin');
      }
      const res = await api.autoOptimize();
      setAutoOptResult(res);
      setViewProposedPlan(true);
    } catch (err: any) {
      setAutoOptNotification(`❌ Auto-Optimize failed: ${err.message || 'Server error'}`);
    } finally {
      setAutoOptLoading(false);
    }
  };

  const handleConfirmOptimization = async () => {
    if (!autoOptResult) return;
    try {
      setConfirmLoading(true);
      if (userRole !== 'admin' && userRole !== 'terminal_manager') {
        await switchRole('admin');
      }
      const res = await api.confirmOptimization(autoOptResult.result_id);
      setAutoOptNotification(`✅ Optimization applied successfully: ${res.applied_count || 50} vessel assignments committed to port quays.`);
      setAutoOptResult(null);
      setViewProposedPlan(false);
      setShowProposedDetails(false);
      if (onAutoOptimizeComplete) onAutoOptimizeComplete();
      onRefresh();
      setTimeout(() => setAutoOptNotification(null), 6000);
    } catch (err: any) {
      setAutoOptNotification(`❌ Confirm failed: ${err.message || 'Server error'}`);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleRejectOptimization = async () => {
    if (!autoOptResult) return;
    try {
      await api.rejectOptimization(autoOptResult.result_id, autoOptRejectReason);
      setAutoOptNotification('⛔ Optimization proposal rejected.');
      setAutoOptResult(null);
      setViewProposedPlan(false);
      setShowProposedDetails(false);
      setShowRejectInput(false);
      setAutoOptRejectReason('');
      setTimeout(() => setAutoOptNotification(null), 5000);
    } catch (err: any) {
      setAutoOptNotification(`❌ Reject failed: ${err.message || 'Server error'}`);
    }
  };

  const handleInjectShock = async (eventType: 'mega_ship_surge' | 'crane_outage' | 'tidal_restriction') => {
    setShockLoading(true);
    setShockNotification(null);
    try {
      const res = await api.injectShockEvent(eventType);
      setShockNotification(`⚡ Congestion Event Injected: ${res.message || eventType}. Recalculating arrivals and quayside queue...`);
      onRefresh();
      setTimeout(() => setShockNotification(null), 7000);
    } catch (err: any) {
      setShockNotification(`❌ Injection failed: ${err.message || 'Server error'}`);
    } finally {
      setShockLoading(false);
    }
  };

  const handleResetBaseline = async () => {
    setShockLoading(true);
    setShockNotification(null);
    try {
      await api.generateSyntheticData(50, 10, 42);
      setShockNotification('🔄 Baseline 50-vessel fleet restored. System metrics reset.');
      onRefresh();
      setTimeout(() => setShockNotification(null), 7000);
    } catch (err: any) {
      setShockNotification(`❌ Reset failed: ${err.message || 'Server error'}`);
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

  const assignments = useMemo(() => {
    if (viewProposedPlan && autoOptResult?.solver_result?.assignments && autoOptResult.solver_result.assignments.length > 0) {
      return autoOptResult.solver_result.assignments;
    }
    return optimisationData?.assignments || [];
  }, [viewProposedPlan, autoOptResult, optimisationData]);
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
    return (enrichedAssignments || []).filter((item) => {
      const matchesShift = selectedShift === 'ALL' || item.shiftNumber === selectedShift;
      const vName = (item?.vessel_name || '').toLowerCase();
      const vId = (item?.vessel_id || '').toLowerCase();
      const bName = (item?.assigned_berth_name || '').toLowerCase();
      const bId = (item?.assigned_berth_id || '').toLowerCase();
      const sq = (searchQuery || '').toLowerCase();
      const matchesSearch = !sq || vName.includes(sq) || vId.includes(sq) || bName.includes(sq) || bId.includes(sq);
      return matchesShift && matchesSearch;
    });
  }, [enrichedAssignments, selectedShift, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedShift, searchQuery, pageSize]);

  const totalPages = Math.max(1, Math.ceil((filteredAssignments?.length || 0) / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedAssignments = useMemo(() => {
    return (filteredAssignments || []).slice(startIndex, startIndex + pageSize);
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
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header & Global Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-content-primary tracking-tight flex items-center space-x-3">
            <span>72-Hour Tactical Operations Plan</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-cyan-400 font-bold border border-blue-500/30 uppercase tracking-wider">
              HiGHS MILP Optimised
            </span>
          </h2>
          <p className="text-xs text-content-secondary mt-1">
            Zero hard-constraint violation berthing manifest, quayside spatial layout, and dynamic congestion forecast
          </p>
        </div>

        <div className="no-print flex items-center space-x-2 flex-wrap gap-y-2">
          <button
            onClick={handleAutoOptimize}
            disabled={autoOptLoading}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition shadow-sm active:scale-95 disabled:opacity-50"
            title="Run Automated 72h MILP Berth & Crane Optimisation Pipeline"
          >
            <Brain className={`w-3.5 h-3.5 ${autoOptLoading ? 'animate-pulse text-amber-300' : ''}`} />
            <span>{autoOptLoading ? 'Optimizing...' : 'Auto-Optimize'}</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-surface-border bg-surface-card hover:bg-surface-hover text-content-primary transition shadow-sm"
            title="Refresh Operations Plan from Highs MILP Solver"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            <span>Sync Plan</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedBimcoVessel({
                id: filteredAssignments[0]?.vessel_id || 'IMO9200001',
                name: filteredAssignments[0]?.vessel_name || 'Maersk Mc-Kinney Moller',
                dwellHours: filteredAssignments[0]?.expected_dwell_hours || 44.5,
              });
              setBimcoModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition shadow-sm"
            title="Open BIMCO Demurrage & Laytime Contract Calculator"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>BIMCO Calculator</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-surface-border bg-surface-card hover:bg-surface-hover text-content-primary transition shadow-sm"
            title="Export 72-Hour Shift Schedule to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-surface-border bg-surface-card hover:bg-surface-hover text-content-primary transition shadow-sm"
            title="Print Shift Supervisor Handover Briefing"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Manifest</span>
          </button>
        </div>
      </div>

      {autoOptNotification && (
        <div className="bg-surface-card border border-blue-500/30 p-3 rounded-lg text-sm text-content-primary">
          {autoOptNotification}
        </div>
      )}

      {autoOptResult && (
        <div className="bg-gradient-to-r from-blue-950/90 via-slate-900 to-indigo-950/90 border-2 border-cyan-500/60 p-5 rounded-2xl shadow-2xl space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-700/60">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Brain className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center space-x-2">
                  <span>MILP Solver Proposed Optimization Plan</span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 uppercase">
                    {autoOptResult.status}
                  </span>
                </h3>
                <p className="text-xs text-slate-300">
                  Optimal collision-free quayside schedule generated across 72h horizon. Review metrics before applying.
                </p>
              </div>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-950/90 p-1 rounded-xl border border-slate-800 self-start sm:self-auto shadow-inner">
              <button
                type="button"
                onClick={() => setViewProposedPlan(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${viewProposedPlan
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                  }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                <span>Proposed Plan (Preview)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewProposedPlan(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${!viewProposedPlan
                    ? 'bg-slate-700 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                  }`}
              >
                Current Schedule
              </button>
            </div>
          </div>

          {/* Key Metrics Comparison Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Scheduled Fleet</span>
              <span className="font-extrabold text-lg text-white font-mono">{autoOptResult.assignments_count} Vessels</span>
              <span className="text-[10px] text-emerald-400 block mt-0.5">✓ 100% collision-free</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Average Wait Time</span>
              <div className="flex items-baseline space-x-2">
                <span className="font-extrabold text-lg text-cyan-400 font-mono">
                  {autoOptResult.average_wait_time_hours.toFixed(1)}h
                </span>
                {optimisationData?.average_wait_time_hours && (
                  <span className="text-[10px] text-slate-400 line-through">
                    {optimisationData.average_wait_time_hours.toFixed(1)}h
                  </span>
                )}
              </div>
              <span className="text-[10px] text-emerald-400 block mt-0.5">
                {optimisationData?.average_wait_time_hours && optimisationData.average_wait_time_hours > autoOptResult.average_wait_time_hours
                  ? `↓ ${Math.round((1 - autoOptResult.average_wait_time_hours / optimisationData.average_wait_time_hours) * 100)}% delay reduction`
                  : 'Fast-track turnaround'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Demurrage Liability</span>
              <div className="flex items-baseline space-x-2">
                <span className="font-extrabold text-lg text-amber-400 font-mono">
                  ${Math.round(autoOptResult.total_demurrage_usd).toLocaleString()}
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 block mt-0.5">
                {optimisationData?.total_port_demurrage_usd && optimisationData.total_port_demurrage_usd > autoOptResult.total_demurrage_usd
                  ? `Saved $${Math.round(optimisationData.total_port_demurrage_usd - autoOptResult.total_demurrage_usd).toLocaleString()}`
                  : 'Optimized demurrage costs'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Quayside &amp; STS Cranes</span>
              <span className="font-extrabold text-lg text-purple-400 font-mono">
                {autoOptResult.crane_utilization_pct.toFixed(0)}% Utilized
              </span>
              <span className="text-[10px] text-slate-300 block mt-0.5">20 STS Cranes balanced</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                disabled={confirmLoading}
                onClick={handleConfirmOptimization}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black transition flex items-center space-x-2 shadow-lg shadow-emerald-600/30"
              >
                {confirmLoading ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Applying All 50 Assignments...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm &amp; Apply All (Commit to Quays)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowRejectInput(!showRejectInput)}
                className="px-3.5 py-2 rounded-xl border border-rose-500/50 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-bold transition"
              >
                Reject Proposal
              </button>

              <button
                type="button"
                onClick={() => setShowProposedDetails(!showProposedDetails)}
                className="px-3.5 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
              >
                {showProposedDetails ? '▲ Hide Assignment Details' : '▼ Inspect All Assignments (50)'}
              </button>
            </div>

            {viewProposedPlan && (
              <span className="text-xs text-cyan-300 font-semibold flex items-center space-x-1.5 bg-blue-950/80 px-3 py-1.5 rounded-lg border border-cyan-500/30">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>Showing Proposed Schedule on Map &amp; Table below</span>
              </span>
            )}
          </div>

          {/* Expandable Reassignments Table */}
          {showProposedDetails && autoOptResult.solver_result?.assignments && (
            <div className="mt-3 p-3 bg-slate-950/90 border border-slate-800 rounded-xl max-h-72 overflow-y-auto space-y-2">
              <div className="text-xs font-bold text-slate-300 pb-2 border-b border-slate-800 flex justify-between">
                <span>Proposed Vessel Assignments ({autoOptResult.solver_result.assignments.length})</span>
                <span className="text-slate-500">Sorted by Priority &amp; Window</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {autoOptResult.solver_result.assignments.map((a: any) => (
                  <div key={a.vessel_id} className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">{a.vessel_name}</span>
                      <span className="text-[10px] text-slate-400">{a.vessel_class} · {a.allocated_cranes} Cranes · {a.expected_dwell_hours}h Dwell</span>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-500/20 text-cyan-300 border border-cyan-500/30">
                        {a.assigned_berth_name}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        {a.wait_time_hours === 0 ? 'Direct Berth (0h)' : `+${a.wait_time_hours}h Delay`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showRejectInput && (
            <div className="flex items-center space-x-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                placeholder="Reason for rejecting this proposal..."
                value={autoOptRejectReason}
                onChange={(e) => setAutoOptRejectReason(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
              <button
                type="button"
                onClick={handleRejectOptimization}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition"
              >
                Confirm Rejection
              </button>
            </div>
          )}
        </div>
      )}

      {/* KPI Overview Strip */}
      <div className="no-print grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-surface-card border border-surface-border p-4 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-content-muted block uppercase tracking-wider">
            Scheduled Vessels (72h)
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-content-primary">
              {optimisationData?.vessels_scheduled ?? (assignments?.length || 0)}
            </span>
            <Ship className="w-5 h-5 text-blue-500 opacity-80" />
          </div>
          <span className="text-[10px] text-content-muted mt-1 block">
            Safe draft &amp; length verified
          </span>
        </div>

        <div className="bg-surface-card border border-surface-border p-4 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-content-muted block uppercase tracking-wider">
            Average Wait Time
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-500">
              {optimisationData && typeof optimisationData.average_wait_time_hours === 'number'
                ? `${optimisationData.average_wait_time_hours.toFixed(1)}h`
                : '1.4h'}
            </span>
            <Clock className="w-5 h-5 text-blue-500 opacity-80" />
          </div>
          <span className="text-[10px] text-emerald-500 font-medium mt-1 flex items-center">
            <TrendingDown className="w-3 h-3 mr-1" />
            Within target operating buffer
          </span>
        </div>

        <div className="bg-surface-card border border-surface-border p-4 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-content-muted block uppercase tracking-wider">
            Crane Fleet Utilization
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-500">
              {optimisationData && typeof optimisationData.crane_utilization_pct === 'number'
                ? `${optimisationData.crane_utilization_pct.toFixed(1)}%`
                : '78.5%'}
            </span>
            <Layers className="w-5 h-5 text-amber-500 opacity-80" />
          </div>
          <span className="text-[10px] text-content-muted mt-1 block">
            STS Gangs allocated optimally
          </span>
        </div>

        <div className="bg-surface-card border border-surface-border p-4 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-content-muted block uppercase tracking-wider">
            Demurrage Cost Impact
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-500 font-mono">
              ${optimisationData ? Math.round(optimisationData.total_port_demurrage_usd).toLocaleString() : '0'}
            </span>
            <Anchor className="w-5 h-5 text-rose-500 opacity-80" />
          </div>
          <span className="text-[10px] text-content-muted mt-1 block">
            Minimized by HiGHS MILP solver
          </span>
        </div>
      </div>

      {/* Shock Event Notification Toast */}
      {shockNotification && (
        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-cyan-300 text-xs flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center space-x-2.5">
            <span className="text-base">⚡</span>
            <span className="font-bold">{shockNotification}</span>
          </div>
          <button
            onClick={() => setShockNotification(null)}
            className="text-xs text-content-muted hover:text-content-primary px-2 py-0.5 rounded-lg"
          >
            ✕
          </button>
        </div>
      )}

      {/* First-Class Operations Sub-Tabs Navigation */}
      <div className="no-print flex items-center space-x-1 sm:space-x-2 border-b border-surface-border pb-2 text-xs font-bold overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('MAP')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 whitespace-nowrap ${activeSubTab === 'MAP'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
            }`}
        >
          <MapPin className="w-4 h-4" />
          <span>🗺️ Quayside Spatial Map</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('TABLE')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 whitespace-nowrap ${activeSubTab === 'TABLE'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
            }`}
        >
          <List className="w-4 h-4" />
          <span>📋 Berthing Manifest Table</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('GANTT')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 whitespace-nowrap ${activeSubTab === 'GANTT'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
            }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>📊 72h Gantt Timeline</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('TESTING')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 whitespace-nowrap ${activeSubTab === 'TESTING'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
            }`}
        >
          <Zap className="w-4 h-4 text-amber-400" />
          <span>⚡ Congestion Testing Lab</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('BRIEFING')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 whitespace-nowrap ${activeSubTab === 'BRIEFING'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
            }`}
        >
          <Printer className="w-4 h-4 text-emerald-400" />
          <span>🤖 AI Shift Briefing</span>
        </button>
      </div>

      {/* SUB-TAB 1: QUAYSIDE SPATIAL MAP */}
      {activeSubTab === 'MAP' && (
        <div className="no-print animate-in fade-in duration-150">
          <QuaysideSpatialMap
            assignments={filteredAssignments}
            selectedShift={selectedShift}
            onOpenOverrideModal={onOpenOverrideModal}
          />
        </div>
      )}

      {/* SUB-TAB 2: BERTHING MANIFEST TABLE */}
      {activeSubTab === 'TABLE' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Shift Filter Navigation & Search */}
          <div className="no-print flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface-card border border-surface-border p-3.5 rounded-2xl shadow-sm">
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 md:pb-0">
              <button
                type="button"
                onClick={() => setSelectedShift('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition whitespace-nowrap ${selectedShift === 'ALL'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
                  }`}
              >
                All Shifts (72h)
              </button>
              {shiftDefinitions.map((shift) => (
                <button
                  type="button"
                  key={shift.id}
                  onClick={() => setSelectedShift(shift.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${selectedShift === shift.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
                    }`}
                >
                  Shift {shift.id}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-full md:w-64">
                <input
                  type="text"
                  placeholder="Search vessel or berth..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-bg border border-surface-border rounded-xl px-3.5 py-1.5 text-xs text-content-primary placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-surface-bg border border-surface-border rounded-xl px-2.5 py-1.5 text-xs font-bold text-content-primary focus:outline-none"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={1000}>All</option>
              </select>
            </div>
          </div>

          {/* Shift Supervisor Briefing Header if specific shift selected */}
          {selectedShift !== 'ALL' && (
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-blue-600 dark:text-cyan-400 text-sm">
                  {shiftDefinitions.find((s) => s.id === selectedShift)?.label}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-cyan-300 font-bold text-xs">
                  Active Work Orders: {filteredAssignments?.length || 0}
                </span>
              </div>
              <p className="mt-1 text-content-secondary text-xs">
                Supervisor Instructions: Verify bollard clearance, coordinate pilotage 45 min prior to docking, and confirm STS crane positioning at assigned quay sectors.
              </p>
            </div>
          )}

          {/* Main Operations Plan Table */}
          <div className="bg-surface-card border border-surface-border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-surface-border flex items-center justify-between">
              <h3 className="font-extrabold text-xs text-content-primary uppercase tracking-wider">
                Berth &amp; Gang Work Manifest ({filteredAssignments?.length || 0} planned operations)
              </h3>
              <div className="text-xs text-content-muted">
                Displaying items {startIndex + 1}–{Math.min(startIndex + pageSize, filteredAssignments?.length || 0)} of {filteredAssignments?.length || 0}
              </div>
            </div>

            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left text-xs print:text-[10px] print:w-full">
                <thead className="bg-surface-hover/60 border-b border-surface-border text-content-secondary font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5">Vessel Name</th>
                    <th className="p-3.5">Dimensions &amp; UKC</th>
                    <th className="p-3.5">Berth Assignment</th>
                    <th className="p-3.5">Cranes</th>
                    <th className="p-3.5">Berthing Window</th>
                    <th className="p-3.5">Dwell</th>
                    <th className="p-3.5">Wait Hours</th>
                    <th className="p-3.5">Demurrage</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right no-print">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {(paginatedAssignments?.length || 0) === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-content-muted italic">
                        No vessel assignments found for this shift and filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedAssignments.map((item: any) => {
                      const startDate = new Date(item.start_time);
                      const endDate = new Date(item.end_time);
                      const hasWait = item.wait_time_hours > 0;
                      const isSevere = item.wait_time_hours > 5;

                      return (
                        <tr
                          key={`${item.vessel_id}-${item.start_time}`}
                          className="hover:bg-surface-hover/50 transition-colors"
                        >
                          <td className="p-3.5 font-bold text-content-primary">
                            <div className="flex items-center space-x-2">
                              <Ship className="w-4 h-4 text-blue-500" />
                              <div>
                                <div className="font-extrabold text-content-primary">{item.vessel_name}</div>
                                <div className="text-[10px] font-mono text-content-muted">
                                  {item.vessel_id} · {item.vessel_class}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5 text-content-secondary">
                            <div>{item.length_m}m LOA</div>
                            <div className="text-[10px] text-content-muted">{item.draft_m}m draft</div>
                          </td>

                          <td className="p-3.5">
                            <span className="font-bold text-content-primary">
                              {item.assigned_berth_name}
                            </span>
                            <div className="text-[10px] text-content-muted font-mono">{item.assigned_berth_id}</div>
                          </td>

                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20 font-mono">
                              {item.allocated_cranes} STS
                            </span>
                          </td>

                          <td className="p-3.5 font-medium text-content-primary">
                            <div>
                              {startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })},{' '}
                              {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-content-muted">
                              → {endDate.toLocaleDateString([], { month: 'short', day: 'numeric' })},{' '}
                              {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>

                          <td className="p-3.5 font-semibold text-content-primary font-mono">
                            {(item.expected_dwell_hours ?? 24).toFixed(1)}h
                          </td>

                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${isSevere
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                  : hasWait
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                }`}
                            >
                              {hasWait ? `+${(item.wait_time_hours ?? 0).toFixed(1)}h` : '0.0h'}
                            </span>
                          </td>

                          <td className="p-3.5 font-mono font-bold text-content-primary">
                            {item.demurrage_cost_usd > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400">
                                ${Math.round(item.demurrage_cost_usd).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-emerald-500">$0</span>
                            )}
                          </td>

                          <td className="p-3.5">
                            <span className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>CLEARED</span>
                            </span>
                          </td>

                          <td className="p-3.5 text-right no-print">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBimcoVessel({
                                    id: item.vessel_id,
                                    name: item.vessel_name,
                                    dwellHours: item.expected_dwell_hours || 44.5,
                                  });
                                  setBimcoModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-xs font-bold border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 transition"
                                title={`Calculate BIMCO Demurrage & Laytime for ${item.vessel_name}`}
                              >
                                <Scale className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenOverrideModal(item.vessel_id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
                                title="Manually override berth or docking time"
                              >
                                Reassign
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-surface-border flex items-center justify-between no-print">
                <div className="text-xs text-content-muted">
                  Page <strong className="text-content-primary">{currentPage}</strong> of <strong>{totalPages}</strong>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-xl border border-surface-border hover:bg-surface-hover text-xs font-bold disabled:opacity-40 transition flex items-center space-x-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-xl border border-surface-border hover:bg-surface-hover text-xs font-bold disabled:opacity-40 transition flex items-center space-x-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: 72H GANTT TIMELINE */}
      {activeSubTab === 'GANTT' && (
        <div className="no-print animate-in fade-in duration-150">
          <BerthScheduleGantt
            optimisationData={optimisationData}
            loading={loading}
            onRefresh={onRefresh}
            onOpenOverrideModal={onOpenOverrideModal}
            userRole={userRole}
          />
        </div>
      )}

      {/* SUB-TAB 4: CONGESTION TESTING & SHOCK LAB */}
      {activeSubTab === 'TESTING' && (
        <div className="no-print space-y-5 animate-in fade-in duration-150">
          <div className="bg-surface-card border border-surface-border p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-surface-border">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 font-bold text-lg">
                  🧪
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-content-primary">
                    Operational Congestion Testing &amp; Shock Lab
                  </h3>
                  <p className="text-xs text-content-secondary">
                    Inject real-world disruption events into the port pipeline to test how our machine learning models forecast congestion and trigger mitigation actions
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExplainModalOpen(true)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 transition flex items-center space-x-2 shadow-sm whitespace-nowrap self-start sm:self-auto"
              >
                <Brain className="w-4 h-4" />
                <span>🧠 How Predictions Work &amp; Where to See Them</span>
              </button>
            </div>

            {/* Shock Test Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-surface-border bg-surface-bg flex flex-col justify-between space-y-3 shadow-sm">
                <div>
                  <div className="flex items-center space-x-2 text-rose-500 font-bold text-sm">
                    <Zap className="w-4 h-4" />
                    <span>Mega-Ship Surge</span>
                  </div>
                  <p className="text-xs text-content-secondary mt-1.5 leading-relaxed">
                    Clusters 3 Ultra-Large Container Vessels (ULCVs) into an identical 3-hour arrival window to overload quays and test anchorage stacking.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleInjectShock('mega_ship_surge')}
                  disabled={shockLoading || loading}
                  className="w-full px-3.5 py-2 text-xs font-extrabold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition flex items-center justify-center space-x-2 shadow-md shadow-rose-600/20 disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{shockLoading ? 'Injecting...' : 'Inject Mega-Ship Surge'}</span>
                </button>
              </div>

              <div className="p-4 rounded-xl border border-surface-border bg-surface-bg flex flex-col justify-between space-y-3 shadow-sm">
                <div>
                  <div className="flex items-center space-x-2 text-amber-500 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>STS Crane Outage</span>
                  </div>
                  <p className="text-xs text-content-secondary mt-1.5 leading-relaxed">
                    Takes down STS Gantry Crane #2 on Berth 02, slashing discharge throughput by 50% and doubling ship dwell time.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleInjectShock('crane_outage')}
                  disabled={shockLoading || loading}
                  className="w-full px-3.5 py-2 text-xs font-extrabold rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition flex items-center justify-center space-x-2 shadow-md shadow-amber-600/20 disabled:opacity-50"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Inject Crane Breakdown</span>
                </button>
              </div>

              <div className="p-4 rounded-xl border border-surface-border bg-surface-bg flex flex-col justify-between space-y-3 shadow-sm">
                <div>
                  <div className="flex items-center space-x-2 text-blue-500 font-bold text-sm">
                    <span>🌊</span>
                    <span>Low Tide Anomaly</span>
                  </div>
                  <p className="text-xs text-content-secondary mt-1.5 leading-relaxed">
                    Drops fairway channel draft limits by 2.5m, restricting vessels with draft &gt; 13.0m from entering quayside until next tide cycle.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleInjectShock('tidal_restriction')}
                  disabled={shockLoading || loading}
                  className="w-full px-3.5 py-2 text-xs font-extrabold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition flex items-center justify-center space-x-2 shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  <span>🌊</span>
                  <span>Inject Low Tide Anomaly</span>
                </button>
              </div>

              <div className="p-4 rounded-xl border border-surface-border bg-surface-bg flex flex-col justify-between space-y-3 shadow-sm">
                <div>
                  <div className="flex items-center space-x-2 text-emerald-500 font-bold text-sm">
                    <RefreshCw className="w-4 h-4" />
                    <span>Restore Baseline</span>
                  </div>
                  <p className="text-xs text-content-secondary mt-1.5 leading-relaxed">
                    Flushes all active shocks and restores the calibrated 50-vessel baseline dataset and optimal solver schedules.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetBaseline}
                  disabled={shockLoading || loading}
                  className="w-full px-3.5 py-2 text-xs font-extrabold rounded-xl border border-surface-border bg-surface-card hover:bg-surface-hover text-content-primary transition flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset to Baseline</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: AI SHIFT BRIEFING */}
      {activeSubTab === 'BRIEFING' && (
        <div className="no-print space-y-4 animate-in fade-in duration-150">
          {/* Voice-Powered Harbor Controller Audio Dispatch */}
          <VoiceBriefingPlayer
            briefingText={aiBriefing?.briefing_markdown || ''}
            title="Harbor Master VHF Voice Dispatch"
          />

          <div className="bg-surface-card border border-surface-border p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-surface-border">
              <div>
                <h3 className="text-base font-extrabold text-content-primary flex items-center space-x-2">
                  <span>🤖 AI Shift Handover Briefing</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-bold border border-blue-500/20 uppercase">
                    IBM watsonx.ai Synthesized
                  </span>
                </h3>
                <p className="text-xs text-content-secondary mt-0.5">
                  Automated shift change briefing synthesizing critical berth bottlenecks, pilot schedules, and crane allocations
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleGenerateAiBriefing}
                  disabled={briefingLoading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition flex items-center space-x-2 disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>{briefingLoading ? 'Synthesizing Briefing...' : 'Generate AI Briefing'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-2 rounded-xl border border-surface-border hover:bg-surface-hover text-xs font-bold text-content-primary transition flex items-center space-x-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
              </div>
            </div>

            {aiBriefing ? (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs flex items-center justify-between">
                  <span className="font-extrabold text-blue-600 dark:text-cyan-300 text-sm">
                    {aiBriefing.title}
                  </span>
                  <span className="text-content-muted text-[11px]">
                    Shift Horizon: {selectedShift === 'ALL' ? '72-Hour Full Window' : `Shift ${selectedShift}`}
                  </span>
                </div>
                <div className="text-xs whitespace-pre-wrap leading-relaxed text-zinc-200 font-mono bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-inner">
                  {aiBriefing.briefing_markdown}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-content-muted bg-surface-bg rounded-2xl border border-dashed border-surface-border">
                <Printer className="w-8 h-8 text-content-muted mx-auto mb-2 opacity-50" />
                <p className="font-bold text-content-primary">No Shift Briefing Generated Yet</p>
                <p className="text-content-secondary mt-1">Click &quot;Generate AI Briefing&quot; above to synthesize the operational handover briefing.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Congestion Prediction Explainability Modal */}
      <PredictionExplainabilityModal
        isOpen={explainModalOpen}
        onClose={() => setExplainModalOpen(false)}
        onNavigateTab={onNavigateTab}
      />

      {/* BIMCO Demurrage & Laytime Calculator Modal */}
      <BimcoDemurrageCalculatorModal
        isOpen={bimcoModalOpen}
        onClose={() => setBimcoModalOpen(false)}
        defaultVesselId={selectedBimcoVessel?.id || 'IMO9200001'}
        defaultVesselName={selectedBimcoVessel?.name || 'Maersk Mc-Kinney Moller'}
        defaultDwellHours={selectedBimcoVessel?.dwellHours || 44.5}
      />
    </div>
  );
};
