import React from 'react';
import { AnchorageForecastResponse } from '../api/client';
import { Anchor } from 'lucide-react';

interface AnchorageQueueChartProps {
  anchorageData: AnchorageForecastResponse | null;
  loading: boolean;
}

export const AnchorageQueueChart: React.FC<AnchorageQueueChartProps> = ({
  anchorageData,
  loading,
}) => {
  if (loading || !anchorageData) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-xl p-6 text-center text-xs text-content-muted">
        Loading anchorage queue forecast...
      </div>
    );
  }

  const { current_queue, peak_predicted_queue, timeline } = anchorageData;
  // Sample 24 points across the horizon
  const sampledTimeline = timeline.filter((_, idx) => idx % 3 === 0);

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-surface-border pb-3">
        <div className="flex items-center space-x-2">
          <Anchor className="w-4 h-4 text-brand-500" />
          <h3 className="text-xs font-bold text-content-primary uppercase tracking-wider">
            Offshore Anchorage Queue Forecast (72h Look-Ahead)
          </h3>
        </div>

        <div className="flex items-center space-x-4 text-xs font-mono">
          <div>
            <span className="text-content-muted mr-1">Current Queue:</span>
            <span className="font-bold text-content-primary">{current_queue} vessels</span>
          </div>
          <div>
            <span className="text-content-muted mr-1">Peak Projected:</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {peak_predicted_queue} vessels
            </span>
          </div>
        </div>
      </div>

      {/* Queue Strip Visualization */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] text-content-muted">
          <span>T+0h (Now)</span>
          <span>T+24h</span>
          <span>T+48h</span>
          <span>T+72h</span>
        </div>

        <div className="grid grid-cols-24 gap-1 h-20 items-end bg-surface-bg p-2 rounded-lg border border-surface-border">
          {sampledTimeline.map((pt, idx) => {
            const maxScale = Math.max(15, peak_predicted_queue + 2);
            const heightPct = Math.min(100, Math.max(10, (pt.predicted_queue / maxScale) * 100));
            const isHigh = pt.predicted_queue >= 6;

            return (
              <div
                key={idx}
                className="h-full flex flex-col justify-end items-center group relative"
              >
                {/* Bar */}
                <div
                  style={{ height: `${heightPct}%` }}
                  className={`w-full rounded-t transition-all ${
                    isHigh
                      ? 'bg-rose-500 hover:bg-rose-600'
                      : pt.predicted_queue > 2
                      ? 'bg-amber-500 hover:bg-amber-600'
                      : 'bg-brand-500 hover:bg-brand-600'
                  }`}
                />

                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center bg-surface-card border border-surface-border text-content-primary p-2 rounded shadow-lg text-[10px] whitespace-nowrap z-20 pointer-events-none">
                  <span className="font-bold">+{pt.hour_offset}h Forecast</span>
                  <span>{pt.predicted_queue} vessels waiting</span>
                  <span className="text-content-muted">
                    CI: [{pt.confidence_low} – {pt.confidence_high}]
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] text-content-secondary">
          <span>Predicts bottleneck accumulation before vessels arrive at terminal quays.</span>
          <span className="font-mono text-content-muted">Confidence Interval: &plusmn;2 vessels</span>
        </div>
      </div>
    </div>
  );
};
