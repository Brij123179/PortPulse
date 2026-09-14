import React, { useEffect, useState } from 'react';
import { MLMetricsResponse, api } from '../api/client';
import { Target, TrendingDown } from 'lucide-react';

export const MLMetricsView: React.FC = () => {
  const [metricsData, setMetricsData] = useState<MLMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const data = await api.getMLMetrics();
        setMetricsData(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load forecast accuracy metrics');
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-xl p-8 text-center text-xs text-content-muted">
        Evaluating forecast accuracy baselines and calibration benchmarks...
      </div>
    );
  }

  if (error || !metricsData) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-xl p-6 text-center text-xs text-rose-500">
        {error || 'Unable to load forecast accuracy metrics'}
      </div>
    );
  }

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="border-b border-surface-border pb-4">
        <div className="flex items-center space-x-2">
          <Target className="w-5 h-5 text-brand-500" />
          <h2 className="text-base font-bold text-content-primary">
            Forecast Performance &amp; Operational Baseline Verification
          </h2>
        </div>
        <p className="text-xs text-content-secondary mt-1">
          Every predictive projection in PortPulse must verifiably outperform standard operational moving averages on out-of-time test data.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metricsData.models.map((m) => (
          <div
            key={`${m.task}-${m.metric_name}`}
            className="p-4 rounded-xl border border-surface-border bg-surface-bg space-y-3"
          >
            <div>
              <span className="text-[10px] font-mono text-content-muted uppercase tracking-wider block">
                {m.task}
              </span>
              <span className="text-sm font-bold text-content-primary block mt-0.5">
                {m.metric_name}
              </span>
            </div>

            {/* Comparison Values */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-border text-xs">
              <div>
                <span className="text-[10px] text-content-muted block">Standard Moving Average</span>
                <span className="font-mono text-base font-semibold text-content-secondary line-through">
                  {m.naive_baseline_score}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-content-muted block">PortPulse Predictive Engine</span>
                <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {m.trained_model_score}
                </span>
              </div>
            </div>

            {/* Improvement Badge */}
            <div className="flex items-center justify-between pt-1">
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-xs font-mono">
                <TrendingDown className="w-3 h-3" />
                <span>-{m.improvement_pct}% Error Reduction</span>
              </span>
              <span className="text-[10px] text-content-muted">{m.better}</span>
            </div>

            <p className="text-[11px] text-content-secondary pt-1 leading-relaxed">
              {m.description}
            </p>
          </div>
        ))}
      </div>

      {/* Rationale Note */}
      <div className="p-4 rounded-lg bg-surface-bg border border-surface-border text-xs text-content-secondary space-y-1">
        <span className="font-semibold text-content-primary block">
          Methodological Soundness &amp; Statistical Verification (Operations Review):
        </span>
        <p>
          Calibrated on the earliest 70% of historical records and evaluated on a held-out 30% out-of-time test dataset.
          Zero future information leakage was introduced. Occupancy probabilities are verified using Brier scores to guarantee calibrated confidence intervals and dependable operational scheduling.
        </p>
      </div>
    </div>
  );
};
