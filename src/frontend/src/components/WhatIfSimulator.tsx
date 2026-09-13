import React, { useState } from 'react';
import {
  VesselStatusItem,
  BerthStatusItem,
  WhatIfResponse,
  api
} from '../api/client';
import {
  Play,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Clock,
  FlaskConical
} from 'lucide-react';

interface WhatIfSimulatorProps {
  vessels: VesselStatusItem[];
  berths: BerthStatusItem[];
}

export const WhatIfSimulator: React.FC<WhatIfSimulatorProps> = ({ vessels, berths }) => {
  const [scenarioName, setScenarioName] = useState<string>('Peak Congestion Clearance Sandbox');
  const [targetVesselId, setTargetVesselId] = useState<string>(
    vessels.length > 0 ? vessels[0].id : ''
  );
  const [targetBerthId, setTargetBerthId] = useState<string>(
    berths.length > 1 ? berths[1].id : ''
  );
  const [speedReduction, setSpeedReduction] = useState<number>(3.5);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<WhatIfResponse | null>(null);

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetVesselId) return;

    try {
      setSimulating(true);
      const res = await api.runWhatIf({
        scenario_name: scenarioName,
        interventions: [
          {
            intervention_type: 'DIVERT',
            vessel_id: targetVesselId,
            target_berth_id: targetBerthId || undefined,
          },
          {
            intervention_type: 'SLOW_STEAM',
            vessel_id: targetVesselId,
            speed_reduction_knots: speedReduction,
          },
        ],
      });
      setSimulationResult(res);
    } catch (err: any) {
      alert(`Simulation failed: ${err.message || 'Server error'}`);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-border pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <FlaskConical className="w-5 h-5 text-brand-500" />
            <h3 className="text-sm font-bold text-content-primary">
              What-If Operational Sandbox
            </h3>
          </div>
          <p className="text-xs text-content-secondary mt-1">
            Test hypothetical diversions and speed advisories in an isolated sandbox to evaluate instant KPI shifts.
          </p>
        </div>

        <span className="text-xs px-2.5 py-1 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-semibold self-start sm:self-auto">
          Non-Destructive Simulation
        </span>
      </div>

      {/* Control Form */}
      <form onSubmit={handleRunSimulation} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-content-secondary mb-1">
            Scenario Label
          </label>
          <input
            type="text"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-content-secondary mb-1">
            Test Vessel Intervention
          </label>
          <select
            value={targetVesselId}
            onChange={(e) => setTargetVesselId(e.target.value)}
            className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.id})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-content-secondary mb-1">
            Simulated Alternative Berth
          </label>
          <select
            value={targetBerthId}
            onChange={(e) => setTargetBerthId(e.target.value)}
            className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {berths.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.draft_limit_m}m D)
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-surface-border">
          <div className="flex items-center space-x-3 text-xs">
            <span className="text-content-muted font-medium">Slow-steam speed trim:</span>
            <input
              type="range"
              min="1.0"
              max="6.0"
              step="0.5"
              value={speedReduction}
              onChange={(e) => setSpeedReduction(parseFloat(e.target.value))}
              className="w-32 accent-brand-500"
            />
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              -{speedReduction} knots
            </span>
          </div>

          <button
            type="submit"
            disabled={simulating}
            className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50"
          >
            {simulating ? (
              <Clock className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Simulate Scenario</span>
          </button>
        </div>
      </form>

      {/* Simulation Results View */}
      {simulationResult && (
        <div className="space-y-4 pt-4 border-t border-surface-border animate-in slide-in-from-top-2 duration-150">
          <div className="p-4 rounded-xl bg-surface-bg border border-surface-border flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-content-primary block">
                {simulationResult.scenario_name}
              </span>
              <p className="text-xs text-content-secondary mt-1">
                {simulationResult.summary}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-content-muted block font-semibold uppercase">
                Net Projected Savings
              </span>
              <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                +${simulationResult.total_demurrage_saved_usd.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Side-by-Side Comparison Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {simulationResult.comparisons.map((c, idx) => {
              return (
                <div
                  key={idx}
                  className="bg-surface-bg p-3.5 rounded-xl border border-surface-border space-y-2"
                >
                  <span className="text-[11px] font-semibold text-content-muted block truncate">
                    {c.metric_name}
                  </span>

                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] text-content-muted block">Before</span>
                      <span className="text-xs font-mono font-semibold text-content-secondary">
                        {c.baseline_value} {c.unit}
                      </span>
                    </div>

                    <ArrowRight className="w-3.5 h-3.5 text-content-muted mx-1" />

                    <div>
                      <span className="text-[10px] text-content-muted block">Simulated</span>
                      <span className="text-xs font-mono font-bold text-content-primary">
                        {c.simulated_value} {c.unit}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-surface-border/50 flex items-center justify-between text-[11px]">
                    <span className="text-content-muted">Impact:</span>
                    <span
                      className={`font-mono font-bold flex items-center space-x-1 ${
                        c.improvement
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {c.improvement ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : (
                        <TrendingUp className="w-3 h-3" />
                      )}
                      <span>
                        {c.delta > 0 ? `+${c.delta}` : c.delta} {c.unit}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
