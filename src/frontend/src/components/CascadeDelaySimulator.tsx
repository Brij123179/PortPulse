import React, { useState } from 'react';
import { VesselStatusItem, CascadeSimulationResponse, api } from '../api/client';
import { GitPullRequest, Play, AlertCircle, Clock } from 'lucide-react';

interface CascadeDelaySimulatorProps {
  vessels: VesselStatusItem[];
}

export const CascadeDelaySimulator: React.FC<CascadeDelaySimulatorProps> = ({ vessels }) => {
  const safeVessels = Array.isArray(vessels) ? vessels : [];
  const [selectedVesselId, setSelectedVesselId] = useState<string>(
    safeVessels.length > 0 ? safeVessels[0].id : ''
  );
  const [delayHours, setDelayHours] = useState<number>(4.0);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<CascadeSimulationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVesselId) return;

    try {
      setSimulating(true);
      setError(null);
      const res = await api.simulateCascadeDelay(selectedVesselId, delayHours);
      setSimulationResult(res);
    } catch (err: any) {
      setError(err.message || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-surface-border pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <GitPullRequest className="w-5 h-5 text-brand-500" />
            <h2 className="text-base font-bold text-content-primary">
              Cascading Delay Ripple Simulator
            </h2>
          </div>
          <p className="text-xs text-content-secondary mt-1">
            Simulate how an upstream berth delay ripples through subsequent scheduled vessel assignments.
          </p>
        </div>
      </div>

      {/* Simulator Input Form */}
      <form onSubmit={handleRunSimulation} className="bg-surface-bg border border-surface-border p-4 rounded-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="text-content-muted font-medium block mb-1">Target Vessel</label>
            <select
              value={selectedVesselId}
              onChange={(e) => setSelectedVesselId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-card text-content-primary focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {safeVessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.vessel_class} · {v.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-content-muted font-medium block mb-1">
              Simulated Delay Slip (Hours)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0.5"
                max="48"
                step="0.5"
                value={delayHours}
                onChange={(e) => setDelayHours(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-card text-content-primary font-mono"
              />
              <span className="text-content-secondary font-medium">hrs</span>
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={simulating}
              className="w-full py-2 px-4 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-sm"
            >
              <Play className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : ''}`} />
              <span>{simulating ? 'Simulating Ripple...' : 'Run Cascade Simulation'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Error Alert */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Simulation Results */}
      {simulationResult && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Summary Banner */}
          <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 space-y-1">
            <div className="flex items-center space-x-2 font-bold text-xs">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Cascade Simulation Result:</span>
            </div>
            <p className="text-xs leading-relaxed">{simulationResult.summary_explanation}</p>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-surface-border bg-surface-bg">
              <span className="text-xs text-content-muted block">Impacted Downstream Vessels</span>
              <span className="text-2xl font-bold text-content-primary font-mono">
                {simulationResult.impacted_vessels_count}
              </span>
            </div>
            <div className="p-4 rounded-lg border border-surface-border bg-surface-bg">
              <span className="text-xs text-content-muted block">Total Ripple Delay Incurred</span>
              <span className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono">
                +{simulationResult.total_ripple_delay_hours} hrs
              </span>
            </div>
          </div>

          {/* Impacted Vessels Table */}
          {Array.isArray(simulationResult.impacted_vessels) && simulationResult.impacted_vessels.length > 0 && (
            <div className="border border-surface-border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-surface-bg border-b border-surface-border font-semibold text-content-secondary">
                  <tr>
                    <th className="py-2.5 px-4">Impacted Vessel</th>
                    <th className="py-2.5 px-4">Berth</th>
                    <th className="py-2.5 px-4">Original ETA</th>
                    <th className="py-2.5 px-4">New Projected Berth Time</th>
                    <th className="py-2.5 px-4">Ripple Slip</th>
                    <th className="py-2.5 px-4">Conflict Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {(simulationResult.impacted_vessels || []).map((iv, idx) => (
                    <tr key={idx} className="hover:bg-surface-hover">
                      <td className="py-2.5 px-4 font-semibold text-content-primary">
                        {iv.vessel_name} ({iv.vessel_id})
                      </td>
                      <td className="py-2.5 px-4 font-mono">{iv.berth_id}</td>
                      <td className="py-2.5 px-4 text-content-secondary">
                        {new Date(iv.original_eta).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-4 text-rose-600 dark:text-rose-400 font-medium">
                        {new Date(iv.new_projected_berth_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-rose-600 dark:text-rose-400">
                        +{iv.cascade_delay_hours}h
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-surface-bg border border-surface-border text-[10px] font-semibold">
                          {iv.conflict_type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
