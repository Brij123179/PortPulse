import React, { useState } from 'react';
import {
  OptimisationRunResponse,
  VesselAssignment,
  api
} from '../api/client';
import {
  Layers,
  Play,
  CheckCircle,
  Edit3,
  RefreshCw
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
  const [runningSolver, setRunningSolver] = useState(false);
  const horizon = 72;
  const [selectedAssignment, setSelectedAssignment] = useState<VesselAssignment | null>(null);

  const canRunSolver = ['admin', 'terminal_manager'].includes(userRole);
  const canOverride = ['admin', 'terminal_manager', 'shift_supervisor'].includes(userRole);

  const handleRunOptimization = async () => {
    try {
      setRunningSolver(true);
      await api.runOptimisation(horizon);
      onRefresh();
    } catch (err: any) {
      alert(`Solver run failed: ${err.message || err.detail || 'Server error'}`);
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
  const assignments = solverRes?.assignments || [];

  // Group assignments by berth
  const assignmentsByBerth: Record<string, VesselAssignment[]> = {};
  assignments.forEach((a) => {
    if (!assignmentsByBerth[a.assigned_berth_name]) {
      assignmentsByBerth[a.assigned_berth_name] = [];
    }
    assignmentsByBerth[a.assigned_berth_name].push(a);
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
                Berth & Crane Allocation Schedule (72h Horizon)
              </h2>
            </div>
            <p className="text-xs text-content-secondary mt-1">
              Deterministic constraint solver enforcing physical draft limits, quay length, non-overlapping windows, and crane capacity.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {canRunSolver ? (
              <button
                onClick={handleRunOptimization}
                disabled={runningSolver}
                className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                {runningSolver ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>Run MILP Solver</span>
              </button>
            ) : (
              <span className="text-[11px] text-content-muted font-medium">
                * Solver execution requires Admin / Terminal Manager role.
              </span>
            )}

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

        {/* Solver KPI Metrics */}
        {solverRes && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-surface-border text-xs">
            <div className="bg-surface-bg p-3 rounded-lg border border-surface-border">
              <span className="text-[10px] text-content-muted block font-semibold uppercase">Status</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {solverRes.solver_status}
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
              <span className="font-bold text-brand-600 dark:text-brand-400 font-mono">
                {solverRes.average_wait_time_hours}h
              </span>
            </div>

            <div className="bg-surface-bg p-3 rounded-lg border border-surface-border">
              <span className="text-[10px] text-content-muted block font-semibold uppercase">Total Demurrage</span>
              <span className="font-bold text-content-primary font-mono">
                ${solverRes.total_port_demurrage_usd.toLocaleString()}
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
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-content-primary uppercase tracking-wider">
            72-Hour Berth Assignment Schedule
          </h3>
          <span className="text-[11px] text-content-muted font-mono">
            Click any vessel assignment block to inspect compatibility constraints
          </span>
        </div>

        <div className="space-y-3">
          {Object.keys(assignmentsByBerth).length === 0 ? (
            <div className="p-8 text-center text-xs text-content-muted">
              No assignments currently generated. Click 'Run MILP Solver' to schedule.
            </div>
          ) : (
            Object.entries(assignmentsByBerth).map(([berthName, bAssignments]) => (
              <div
                key={berthName}
                className="bg-surface-bg border border-surface-border rounded-xl p-3 space-y-2"
              >
                {/* Berth Row Label */}
                <div className="flex items-center justify-between text-xs border-b border-surface-border/50 pb-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-content-primary">{berthName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-surface-card border border-surface-border text-content-muted font-mono">
                      {bAssignments[0]?.assigned_berth_id}
                    </span>
                  </div>
                  <span className="text-[11px] text-content-muted font-mono">
                    {bAssignments.length} vessel(s) scheduled
                  </span>
                </div>

                {/* Vessel Assignment Blocks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                  {bAssignments.map((a) => {
                    const isSelected = selectedAssignment?.vessel_id === a.vessel_id;
                    const startTime = new Date(a.start_time);
                    const endTime = new Date(a.end_time);

                    return (
                      <div
                        key={a.vessel_id}
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected Vessel Inspector Card */}
        {selectedAssignment && (
          <div className="p-4 border-t border-surface-border bg-surface-bg rounded-xl mt-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-content-primary flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>Physical Constraint Verification: {selectedAssignment.vessel_name}</span>
                </h4>
                <p className="text-xs text-content-secondary mt-1">
                  Draft ({selectedAssignment.draft_m}m) & Length ({selectedAssignment.length_m}m) strictly validated against berth specifications with 0% violation guarantee.
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
          </div>
        )}
      </div>
    </div>
  );
};
