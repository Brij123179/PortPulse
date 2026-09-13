import React, { useState } from 'react';
import {
  HeatmapResponse,
  BerthHeatmapTrack,
  BerthHourRiskItem,
} from '../api/client';
import {
  AlertTriangle,
  Clock,
  Sparkles,
  TrendingUp,
  Layers,
  Info,
  Calendar,
} from 'lucide-react';

interface CongestionHeatmapProps {
  heatmapData: HeatmapResponse | null;
  loading: boolean;
  onRefresh: () => void;
}

export const CongestionHeatmap: React.FC<CongestionHeatmapProps> = ({
  heatmapData,
  loading,
  onRefresh,
}) => {
  const [horizon, setHorizon] = useState<24 | 48 | 72>(72);
  const [selectedCell, setSelectedCell] = useState<{
    berth: BerthHeatmapTrack;
    item: BerthHourRiskItem;
  } | null>(null);

  if (loading) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-xl p-12 text-center shadow-sm">
        <Clock className="w-8 h-8 text-brand-500 animate-spin mx-auto mb-3" />
        <p className="text-xs text-content-secondary font-medium">
          Computing 72-hour probabilistic occupancy models and SHAP attributions...
        </p>
      </div>
    );
  }

  if (!heatmapData) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-xl p-8 text-center">
        <p className="text-xs text-content-muted">No heatmap forecast data available.</p>
        <button
          onClick={onRefresh}
          className="mt-3 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-semibold"
        >
          Load Forecast
        </button>
      </div>
    );
  }

  const { summary, berths } = heatmapData;

  return (
    <div className="space-y-6">
      {/* KPI & Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Red Risk Hours */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
              Critical Congestion (Red)
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {summary.red_tier_count}
            </span>
            <span className="text-xs text-content-muted">berth-hours (P &ge; 85%)</span>
          </div>
          <p className="mt-2 text-xs text-content-secondary">
            Requires immediate diversion or re-sequencing action.
          </p>
        </div>

        {/* Amber Risk Hours */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
              Elevated Risk (Amber)
            </span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {summary.amber_tier_count}
            </span>
            <span className="text-xs text-content-muted">berth-hours (60% &le; P &lt; 85%)</span>
          </div>
          <p className="mt-2 text-xs text-content-secondary">
            Elevated turnaround dwell / schedule compression.
          </p>
        </div>

        {/* Peak Congestion Window */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
              Peak Risk Window
            </span>
            <Calendar className="w-4 h-4 text-brand-500" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-content-primary">
              {summary.peak_congestion_window}
            </span>
          </div>
          <p className="mt-2 text-xs text-content-secondary">
            Cluster of ULCV arrivals and crane maintenance.
          </p>
        </div>

        {/* Model Grounding Status */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
              ML Engine & Version
            </span>
            <Sparkles className="w-4 h-4 text-brand-500" />
          </div>
          <div className="mt-2">
            <span className="text-sm font-bold text-content-primary font-mono">
              {heatmapData.model_version}
            </span>
            <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-semibold">
              CALIBRATED
            </span>
          </div>
          <p className="mt-2 text-xs text-content-muted">
            Beats naive baseline · SHAP explainability active
          </p>
        </div>
      </div>

      {/* Main Heatmap Matrix Container */}
      <div className="bg-surface-card border border-surface-border rounded-xl shadow-sm overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 border-b border-surface-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface-bg">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-brand-500" />
            <h2 className="text-xs font-bold text-content-primary uppercase tracking-wider">
              Berth Congestion Heatmap Matrix (72h Look-Ahead)
            </h2>
          </div>

          <div className="flex items-center space-x-3">
            {/* Horizon selector */}
            <div className="flex items-center space-x-1 bg-surface-card border border-surface-border p-1 rounded-lg text-xs">
              <span className="text-[11px] text-content-muted px-2 font-medium">Horizon:</span>
              <button
                onClick={() => setHorizon(24)}
                className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                  horizon === 24
                    ? 'bg-brand-500 text-white'
                    : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                24h
              </button>
              <button
                onClick={() => setHorizon(48)}
                className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                  horizon === 48
                    ? 'bg-brand-500 text-white'
                    : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                48h
              </button>
              <button
                onClick={() => setHorizon(72)}
                className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                  horizon === 72
                    ? 'bg-brand-500 text-white'
                    : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                72h
              </button>
            </div>

            {/* Legend */}
            <div className="hidden lg:flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-1">
                <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                <span className="text-content-secondary text-[11px]">Green (&lt;60%)</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
                <span className="text-content-secondary text-[11px]">Amber (60-85%)</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-3 h-3 rounded bg-rose-500 inline-block" />
                <span className="text-content-secondary text-[11px]">Red (&ge;85%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="p-4 overflow-x-auto">
          <div className="min-w-[760px]">
            {/* Hour Timeline Header */}
            <div className="grid grid-cols-[140px_repeat(24,_1fr)] gap-1 text-[10px] text-content-muted font-mono pb-2 border-b border-surface-border">
              <div className="font-sans font-semibold text-content-primary">Berth Quay</div>
              {Array.from({ length: 24 }, (_, idx) => {
                const hourStep = Math.round((idx + 1) * (horizon / 24));
                return (
                  <div key={idx} className="text-center truncate">
                    +{hourStep}h
                  </div>
                );
              })}
            </div>

            {/* Berth Rows */}
            <div className="divide-y divide-surface-border">
              {berths.map((b) => (
                <div
                  key={b.berth_id}
                  className="grid grid-cols-[140px_repeat(24,_1fr)] gap-1 py-2 items-center hover:bg-surface-hover/50 transition-colors"
                >
                  {/* Berth Label */}
                  <div className="pr-2">
                    <div className="font-bold text-xs text-content-primary truncate">{b.berth_name}</div>
                    <div className="text-[10px] text-content-muted font-mono">
                      {b.length_m}m · {b.draft_limit_m}m D
                    </div>
                  </div>

                  {/* 24 Aggregated / Sampled Time Cells */}
                  {Array.from({ length: 24 }, (_, cellIdx) => {
                    const mappedHourIndex = Math.min(
                      b.timeline.length - 1,
                      Math.floor((cellIdx / 24) * horizon)
                    );
                    const item = b.timeline[mappedHourIndex] || b.timeline[0];

                    const isRed = item.risk_tier === 'RED';
                    const isAmber = item.risk_tier === 'AMBER';
                    const isSelected =
                      selectedCell?.berth.berth_id === b.berth_id &&
                      selectedCell?.item.hour_offset === item.hour_offset;

                    return (
                      <button
                        key={cellIdx}
                        onClick={() => setSelectedCell({ berth: b, item })}
                        className={`h-9 rounded flex flex-col items-center justify-center transition-all relative group focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                          isRed
                            ? 'bg-rose-500/90 text-white hover:bg-rose-600'
                            : isAmber
                            ? 'bg-amber-400 text-amber-950 hover:bg-amber-500'
                            : 'bg-emerald-500/80 text-white hover:bg-emerald-600'
                        } ${isSelected ? 'ring-2 ring-content-primary scale-105 z-10' : ''}`}
                        title={`${b.berth_name} @ +${item.hour_offset}h: ${Math.round(
                          item.occupancy_probability * 100
                        )}% [${Math.round(item.confidence_low * 100)}% - ${Math.round(
                          item.confidence_high * 100
                        )}%]`}
                      >
                        <span className="text-[10px] font-bold font-mono">
                          {Math.round(item.occupancy_probability * 100)}%
                        </span>

                        {/* Accessibility Icon Overlay */}
                        {isRed && <AlertTriangle className="w-2.5 h-2.5" />}
                        {isAmber && <span className="w-1.5 h-1.5 rounded-full bg-amber-950" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Cell Explainability Card (F-206 & F-207) */}
        {selectedCell ? (
          <div className="p-4 border-t border-surface-border bg-surface-bg animate-in slide-in-from-bottom-2 duration-150">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              {/* Left Column: Probability & Confidence Interval */}
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm text-content-primary">
                    {selectedCell.berth.berth_name}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded font-mono bg-surface-card border border-surface-border text-content-secondary">
                    +{selectedCell.item.hour_offset}h Window
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      selectedCell.item.risk_tier === 'RED'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                        : selectedCell.item.risk_tier === 'AMBER'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                    }`}
                  >
                    {selectedCell.item.risk_tier} RISK
                  </span>
                </div>

                {/* Point estimate with confidence interval (F-207) */}
                <div className="flex items-baseline space-x-3 pt-1">
                  <span className="text-2xl font-bold font-mono text-content-primary">
                    {Math.round(selectedCell.item.occupancy_probability * 100)}%
                  </span>
                  <span className="text-xs font-mono text-content-secondary">
                    Occupancy Probability (80% CI:{' '}
                    <span className="font-semibold text-content-primary">
                      {Math.round(selectedCell.item.confidence_low * 100)}% –{' '}
                      {Math.round(selectedCell.item.confidence_high * 100)}%
                    </span>
                    )
                  </span>
                </div>

                {selectedCell.item.expected_vessel_name && (
                  <p className="text-xs text-content-secondary">
                    Expected Vessel:{' '}
                    <span className="font-semibold text-content-primary">
                      {selectedCell.item.expected_vessel_name}
                    </span>{' '}
                    ({selectedCell.item.expected_vessel_id})
                  </p>
                )}
              </div>

              {/* Right Column: SHAP-style Explainability Breakdown (F-206) */}
              <div className="flex-1 max-w-xl">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-content-primary mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                  <span>Explainability Layer — Top Contributing Risk Drivers:</span>
                </div>

                <div className="space-y-1.5">
                  {selectedCell.item.top_factors.map((factor, fIdx) => (
                    <div
                      key={fIdx}
                      className="p-2 rounded-lg bg-surface-card border border-surface-border flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-content-primary mr-1.5">
                          {factor.feature_name}:
                        </span>
                        <span className="text-content-secondary">{factor.description}</span>
                      </div>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400 pl-2">
                        +{factor.impact_pct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 border-t border-surface-border bg-surface-bg text-center text-xs text-content-muted flex items-center justify-center space-x-1.5">
            <Info className="w-3.5 h-3.5 text-content-secondary" />
            <span>Click on any cell in the matrix to inspect its calibrated confidence band and SHAP explainability breakdown.</span>
          </div>
        )}
      </div>
    </div>
  );
};
