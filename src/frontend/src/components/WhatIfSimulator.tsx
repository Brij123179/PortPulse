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
  FlaskConical,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface WhatIfSimulatorProps {
  vessels: VesselStatusItem[];
  berths: BerthStatusItem[];
}

export const WhatIfSimulator: React.FC<WhatIfSimulatorProps> = ({ vessels, berths }) => {
  const safeVessels = Array.isArray(vessels) ? vessels : [];
  const safeBerths = Array.isArray(berths) ? berths : [];
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [scenarioName, setScenarioName] = useState<string>('Peak Congestion Clearance Sandbox');
  const [targetVesselId, setTargetVesselId] = useState<string>(
    safeVessels.length > 0 ? safeVessels[0].id : ''
  );
  const [targetBerthId, setTargetBerthId] = useState<string>(
    safeBerths.length > 1 ? safeBerths[1].id : (safeBerths[0]?.id || '')
  );
  const [speedReduction, setSpeedReduction] = useState<number>(3.5);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<WhatIfResponse | null>(null);

  const formatMetricVal = (val: number, unit: string) => {
    if (unit.toUpperCase() === 'USD' || unit === '$') {
      return `$${Math.round(val).toLocaleString()}`;
    }
    if (Number.isInteger(val)) return `${val.toLocaleString()} ${unit}`;
    return `${Number(val.toFixed(1)).toLocaleString()} ${unit}`;
  };

  const formatDelta = (delta: number, unit: string) => {
    const sign = delta > 0 ? '+' : '';
    if (unit.toUpperCase() === 'USD' || unit === '$') {
      return `${sign}$${Math.round(delta).toLocaleString()}`;
    }
    const formatted = Number.isInteger(delta) ? delta.toLocaleString() : Number(delta.toFixed(1)).toLocaleString();
    return `${sign}${formatted} ${unit}`;
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetVesselId) return;

    try {
      setSimulating(true);
      setSimError(null);
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
      setSimError(`Simulation failed: ${err.message || 'Server error'}`);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-5 animate-in fade-in duration-200">
      {/* Header with Expand / Collapse */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-4">
        <div 
          onClick={() => setIsExpanded(!isExpanded)} 
          className="flex items-start space-x-3 cursor-pointer group select-none"
        >
          <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 group-hover:scale-105 transition-transform mt-0.5">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-content-primary group-hover:text-brand-500 transition-colors">
                What-If Operational Sandbox
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-bg border border-surface-border text-content-secondary font-mono">
                {isExpanded ? 'Active' : 'Collapsed'}
              </span>
            </div>
            <p className="text-xs text-content-secondary mt-0.5">
              Simulate hypothetical diversions and slow-steaming speed advisories to test instant impact on port delays & demurrage.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <span className="text-xs px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 font-semibold border border-brand-200/50 dark:border-brand-900/50">
            Non-Destructive
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-surface-border bg-surface-bg hover:bg-surface-border/50 text-xs font-semibold text-content-primary transition-colors"
          >
            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
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
            {safeVessels.map((v) => (
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
            {safeBerths.map((b) => (
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

      {simError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-center justify-between">
          <span>{simError}</span>
          <button onClick={() => setSimError(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

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
                +${(simulationResult.total_demurrage_saved_usd ?? 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Side-by-Side Comparison Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(simulationResult.comparisons || []).map((c) => {
              return (
                <div
                  key={c.metric_name}
                  className="bg-surface-bg p-3.5 rounded-xl border border-surface-border space-y-2"
                >
                  <span className="text-[11px] font-semibold text-content-muted block truncate">
                    {c.metric_name}
                  </span>

                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] text-content-muted block">Before</span>
                      <span className="text-xs font-mono font-semibold text-content-secondary">
                        {formatMetricVal(c.baseline_value, c.unit)}
                      </span>
                    </div>

                    <ArrowRight className="w-3.5 h-3.5 text-content-muted mx-1" />

                    <div>
                      <span className="text-[10px] text-content-muted block">Simulated</span>
                      <span className="text-xs font-mono font-bold text-content-primary">
                        {formatMetricVal(c.simulated_value, c.unit)}
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
                        {formatDelta(c.delta, c.unit)}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
