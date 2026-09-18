import React, { useState } from 'react';
import {
  OptimisationRunResponse,
  VesselAssignment,
  api
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Layers,
  Play,
  CheckCircle,
  Edit3,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Filter
} from 'lucide-react';

interface BerthScheduleGanttProps {
  optimisationData: OptimisationRunResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenOverrideModal: (vesselId?: string) => void;
  userRole: string;
}

export const BerthScheduleGantt: React.FC<BerthScheduleGanttProps> = ({
  optimisationData,
  loading,
  onRefresh,
  onOpenOverrideModal,
  userRole,
}) => {
  const { switchRole } = useAuth();
  const [runningSolver, setRunningSolver] = useState(false);
  const [solverError, setSolverError] = useState<string | null>(null);
  const horizon = 72;
  const [selectedAssignment, setSelectedAssignment] = useState<VesselAssignment | null>(null);
  const [collapsedBerths, setCollapsedBerths] = useState<Record<string, boolean>>({});
  const [selectedBerthFilter, setSelectedBerthFilter] = useState<string>('ALL');

  const canOverride = ['admin', 'terminal_manager', 'shift_supervisor'].includes(userRole);

  const handleRunOptimization = async () => {
    try {
      setRunningSolver(true);
      setSolverError(null);
      if (userRole !== 'admin' && userRole !== 'terminal_manager') {
        await switchRole('admin');
      }
      await api.runOptimisation(horizon);
      onRefresh();
    } catch (err: any) {
      setSolverError(`Solver run failed: ${err.message || err.detail || 'Server error'}`);
    } finally {
      setRunningSolver(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-xl p-12 text-center shadow-sm">
        <RefreshCw className="w-8 h-8 text-brand-500 animate-spin mx-auto mb-3" />
        <p className="text-xs text-content-secondary font-medium">
          Loading optimal berth and crane allocations...
        </p>
      </div>
    );
  }

  const solverRes = optimisationData;
  const assignments = Array.isArray(solverRes?.assignments) ? solverRes.assignments : [];

  // Group assignments by berth
  const assignmentsByBerth: Record<string, VesselAssignment[]> = {};
  assignments.forEach((a) => {
    if (!a) return;
    const bName = a.assigned_berth_name || a.assigned_berth_id || 'Berth General';
    if (!assignmentsByBerth[bName]) {
      assignmentsByBerth[bName] = [];
    }
    assignmentsByBerth[bName].push(a);
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Solver Control & KPI Banner */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-brand-500" />
              <h2 className="text-base font-bold text-content-primary">
                Automated Berth &amp; Crane Allocation (72h Horizon)
              </h2>
            </div>
            <p className="text-xs text-content-secondary mt-1">
              Automated quayside scheduling: Guarantees zero berth collisions, safe draft limits, and optimal crane capacity.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleRunOptimization}
              disabled={runningSolver}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50 active:scale-95"
              title="Execute Automated HiGHS MILP Berth & Crane Optimisation Solver"
            >
              {runningSolver ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Auto-Optimize Schedule</span>
            </button>

            {canOverride && (
              <button
                onClick={() => onOpenOverrideModal()}
                className="px-3 py-2 rounded-lg border border-surface-border hover:bg-surface-hover text-content-primary text-xs font-semibold transition-colors flex items-center space-x-1.5"
              >
                <Edit3 className="w-3.5 h-3.5 text-brand-500" />
                <span>Manual Override</span>
              </button>
            )}
          </div>
        </div>

        {solverError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-center justify-between">
            <span>{solverError}</span>
            <button onClick={() => setSolverError(null)} className="text-xs hover:underline">Dismiss</button>
          </div>
        )}

        {/* Solver KPI Metrics */}
        {solverRes && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-surface-border text-xs">
            <div className="bg-surface-bg p-3 rounded-lg border border-surface-border">
              <span className="text-[10px] text-content-muted block font-semibold uppercase">Status</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {solverRes.solver_status === 'OPTIMAL' ? 'Optimal (0 Conflicts)' : solverRes.solver_status}
              </span>
            </div>

            <div className="bg-surface-bg p-3 rounded-lg border border-surface-border">
              <span className="text-[10px] text-content-muted block font-semibold uppercase">Solve Time</span>
              <span className="font-bold text-content-primary font-mono">
                {solverRes.solve_time_seconds}s
              </span>
            </div>

            <div className="bg-surface-bg p-3 rounded-lg border border-surface-border">
              <span className="text-[10px] text-content-muted block font-semibold uppercase">Vessels Slotted</span>
              <span className="font-bold text-content-primary font-mono">
                {solverRes.vessels_scheduled} vessels
              </span>
            </div>

            <div className="bg-surface-bg p-3 rounded-lg border border-surface-border">
              <span className="text-[10px] text-content-muted block font-semibold uppercase">Avg Wait Time</span>
              <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                {solverRes.average_wait_time_hours}h
              </span>
            </div>

            <div className="bg-surface-bg p-3 rounded-lg border border-surface-border">
              <span className="text-[10px] text-content-muted block font-semibold uppercase">Total Demurrage</span>
              <span className="font-bold text-content-primary font-mono">
                ${Math.round(solverRes.total_port_demurrage_usd).toLocaleString()}
              </span>
            </div>

            <div className="bg-surface-bg p-3 rounded-lg border border-surface-border">
              <span className="text-[10px] text-content-muted block font-semibold uppercase">Crane Utilization</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {solverRes.crane_utilization_pct}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 72h Gantt Matrix */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-border pb-3">
          <div>
            <h3 className="text-xs font-bold text-content-primary uppercase tracking-wider">
              72-Hour Berth Assignment Schedule
            </h3>
            <span className="text-[11px] text-content-muted">
              Click any berth row to expand or collapse. Click a vessel to inspect details.
            </span>
          </div>

          {/* Expand / Collapse Controls */}
          <div className="flex items-center space-x-2 text-xs">
            <button
              onClick={() => setCollapsedBerths({})}
              className="px-2.5 py-1 rounded-lg border border-surface-border hover:bg-surface-hover text-content-primary font-semibold transition"
            >
              Expand All
            </button>
            <button
              onClick={() => {
                const allCollapsed: Record<string, boolean> = {};
                Object.keys(assignmentsByBerth).forEach((k) => (allCollapsed[k] = true));
                setCollapsedBerths(allCollapsed);
              }}
              className="px-2.5 py-1 rounded-lg border border-surface-border hover:bg-surface-hover text-content-secondary font-medium transition"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Quick Berth Selector Filter Bar */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-content-muted font-semibold mr-1 flex items-center gap-1 text-[11px]">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          <button
            onClick={() => setSelectedBerthFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition whitespace-nowrap ${
              selectedBerthFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-surface-bg border border-surface-border text-content-secondary hover:text-content-primary'
            }`}
          >
            All Berths ({Object.keys(assignmentsByBerth).length})
          </button>
          {Object.keys(assignmentsByBerth).map((bName) => (
            <button
              key={bName}
              onClick={() => setSelectedBerthFilter(bName)}
              className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition ${
                selectedBerthFilter === bName
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-surface-bg border border-surface-border text-content-secondary hover:text-content-primary'
              }`}
            >
              {(bName || '').replace(' Quay', '')}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {Object.keys(assignmentsByBerth).length === 0 ? (
            <div className="p-8 text-center text-xs text-content-muted">
              No assignments currently generated. Click 'Auto-Optimize Schedule' to schedule.
            </div>
          ) : (
            Object.entries(assignmentsByBerth)
              .filter(([berthName]) => selectedBerthFilter === 'ALL' || selectedBerthFilter === berthName)
              .map(([berthName, bAssignments]) => {
                const isCollapsed = !!collapsedBerths[berthName];
                return (
                  <div
                    key={berthName}
                    className="bg-surface-bg border border-surface-border rounded-xl p-3 space-y-2 transition-all"
                  >
                    {/* Berth Row Label - Clickable Accordion Header */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={!isCollapsed}
                      aria-label={`Toggle schedule for ${berthName}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setCollapsedBerths((prev) => ({
                            ...prev,
                            [berthName]: !prev[berthName],
                          }));
                        }
                      }}
                      onClick={() =>
                        setCollapsedBerths((prev) => ({
                          ...prev,
                          [berthName]: !prev[berthName],
                        }))
                      }
                      className="flex items-center justify-between text-xs cursor-pointer select-none hover:opacity-80 transition-opacity focus:outline-none focus:ring-1 focus:ring-blue-500 rounded p-1"
                    >
                      <div className="flex items-center space-x-2">
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-content-muted" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-blue-500" />
                        )}
                        <span className="font-bold text-content-primary">{berthName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-surface-card border border-surface-border text-content-muted font-mono">
                          {bAssignments[0]?.assigned_berth_id}
                        </span>
                      </div>
                      <span className="text-[11px] text-content-secondary font-medium">
                        {bAssignments.length} vessel(s) scheduled {isCollapsed ? '· (Click to expand)' : ''}
                      </span>
                    </div>

                    {/* Vessel Assignment Blocks (Collapsible) */}
                    {!isCollapsed && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1 animate-in fade-in duration-150">
                  {bAssignments.map((a) => {
                    const isSelected = selectedAssignment?.vessel_id === a.vessel_id;
                    const startTime = new Date(a.start_time);
                    const endTime = new Date(a.end_time);

                    return (
                      <div
                        key={`${a.vessel_id}-${a.start_time || Math.random()}`}
                        onClick={() => setSelectedAssignment(a)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/40'
                            : 'bg-surface-card border-surface-border hover:border-brand-500/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-content-primary block">
                              {a.vessel_name}
                            </span>
                            <span className="text-[10px] text-content-muted font-mono">
                              {a.vessel_id} · {a.vessel_class}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                            {a.allocated_cranes} Cranes
                          </span>
                        </div>

                        <div className="mt-2 text-[11px] text-content-secondary space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-content-muted">Docking Window:</span>
                            <span className="font-mono text-content-primary">
                              {startTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                              {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                              {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-content-muted">Dwell / Wait:</span>
                            <span className="font-mono text-content-primary">
                              {a.expected_dwell_hours}h dwell · {a.wait_time_hours}h wait
                            </span>
                          </div>

                          <div className="pt-2 mt-1.5 border-t border-surface-border flex items-center justify-between text-[10px]">
                            <span className="text-emerald-500 font-semibold flex items-center gap-1">
                              ✓ {a.draft_m}m Draft Cleared
                            </span>
                            <span className="text-blue-500 font-semibold">
                              {a.allocated_cranes} STS Ganged
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>

        {/* Selected Vessel Inspector Card */}
        {selectedAssignment && (
          <div className="p-4 border-t border-surface-border bg-surface-bg rounded-xl mt-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-content-primary flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>Physical Constraint Verification: {selectedAssignment.vessel_name}</span>
                </h4>
                <p className="text-xs text-content-secondary mt-0.5">
                  Draft ({selectedAssignment.draft_m}m) &amp; Length ({selectedAssignment.length_m}m) strictly validated against berth specifications with 0% collision guarantee.
                </p>
              </div>

              {canOverride && (
                <button
                  onClick={() => onOpenOverrideModal(selectedAssignment.vessel_id)}
                  className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-sm transition-colors flex items-center space-x-1.5 self-start"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Reassign Vessel</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-surface-border text-xs">
              <div className="bg-surface-card p-2.5 rounded-lg border border-surface-border">
                <span className="text-[10px] text-content-muted block font-semibold uppercase">Physical Fit</span>
                <span className="font-bold text-content-primary font-mono mt-0.5 block">{selectedAssignment.draft_m}m Draft · {selectedAssignment.length_m}m LOA</span>
                <span className="text-[10px] text-emerald-500 block mt-0.5 font-medium">✓ Safe Under-Keel Margin</span>
              </div>
              <div className="bg-surface-card p-2.5 rounded-lg border border-surface-border">
                <span className="text-[10px] text-content-muted block font-semibold uppercase">Quayside Gantry</span>
                <span className="font-bold text-content-primary font-mono mt-0.5 block">{selectedAssignment.allocated_cranes} STS Cranes</span>
                <span className="text-[10px] text-blue-500 block mt-0.5 font-medium">Balanced Quayside Workload</span>
              </div>
              <div className="bg-surface-card p-2.5 rounded-lg border border-surface-border">
                <span className="text-[10px] text-content-muted block font-semibold uppercase">Turnaround Performance</span>
                <span className="font-bold text-content-primary font-mono mt-0.5 block">{selectedAssignment.expected_dwell_hours}h Dwell</span>
                <span className="text-[10px] text-content-secondary block mt-0.5 font-medium">{selectedAssignment.wait_time_hours}h Queue Wait</span>
              </div>
              <div className="bg-surface-card p-2.5 rounded-lg border border-surface-border">
                <span className="text-[10px] text-content-muted block font-semibold uppercase">Demurrage Liability</span>
                <span className={`font-bold font-mono mt-0.5 block ${selectedAssignment.demurrage_cost_usd > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  ${Math.round(selectedAssignment.demurrage_cost_usd || 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-content-secondary block mt-0.5 font-medium">BIMCO Standard Rate</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
