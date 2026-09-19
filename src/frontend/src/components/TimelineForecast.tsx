import React, { useState } from 'react';
import { BerthHeatmapTrack, BerthHourRiskItem } from '../api/client';

interface TimelineForecastProps {
  berths: BerthHeatmapTrack[];
  generatedAt?: string;
}

function fmtTimeline(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}
function fmtHour(iso: string): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Aggregate per-berth hour items into 6h port-wide buckets
interface PortBucket {
  startTime: string;
  endTime: string;
  bucketIdx: number;
  redCount: number;
  amberCount: number;
  greenCount: number;
  avgOccupancy: number;
  tier: 'RED' | 'AMBER' | 'GREEN';
  topBerths: string[];
  topFactors: Array<{ feature_name: string; impact_pct: number }>;
}

function buildBuckets(berths: BerthHeatmapTrack[]): PortBucket[] {
  const BUCKET_H = 6;
  const HORIZON = 72;
  const N = Math.floor(HORIZON / BUCKET_H);
  const now = new Date();

  return Array.from({ length: N }, (_, b) => {
    const startH = b * BUCKET_H;
    const endH = startH + BUCKET_H;
    const startTime = new Date(now.getTime() + startH * 3600000).toISOString();
    const endTime   = new Date(now.getTime() + endH   * 3600000).toISOString();

    let red = 0, amber = 0, green = 0, totalOcc = 0, count = 0;
    const criticalBerths: string[] = [];
    const allFactors: Array<{ feature_name: string; impact_pct: number }> = [];

    (berths || []).forEach(berth => {
      (berth?.timeline || [])
        .filter(h => h.hour_offset >= startH && h.hour_offset < endH)
        .forEach((h: BerthHourRiskItem) => {
          if (h.risk_tier === 'RED') { red++; if (!criticalBerths.includes(berth.berth_name)) criticalBerths.push(berth.berth_name); }
          else if (h.risk_tier === 'AMBER') amber++;
          else green++;
          totalOcc += (h.occupancy_probability || 0);
          count++;
          (h.top_factors || []).forEach(f => allFactors.push(f));
        });
    });

    const avgOcc = count > 0 ? totalOcc / count : 0;
    const tier: 'RED' | 'AMBER' | 'GREEN' = red >= 2 ? 'RED' : amber >= 4 ? 'AMBER' : 'GREEN';

    // Aggregate top factors
    const factorMap: Record<string, number> = {};
    allFactors.forEach(f => { factorMap[f.feature_name] = (factorMap[f.feature_name] || 0) + f.impact_pct; });
    const topFactors = Object.entries(factorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([feature_name, impact_pct]) => ({ feature_name, impact_pct: Math.round(impact_pct) }));

    return { startTime, endTime, bucketIdx: b, redCount: red, amberCount: amber, greenCount: green, avgOccupancy: avgOcc, tier, topBerths: criticalBerths.slice(0, 3), topFactors };
  });
}

interface TooltipState {
  x: number;
  y: number;
  bucket: PortBucket;
}

export const TimelineForecast: React.FC<TimelineForecastProps> = ({ berths }) => {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (!Array.isArray(berths) || berths.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.82rem', padding: '12px 0' }}>
        No forecast data yet. Loading heatmap...
      </div>
    );
  }

  const buckets = buildBuckets(berths);
  const maxScore = Math.max(...buckets.map(b => b.redCount * 3 + b.amberCount));
  const peakIdx = buckets.findIndex(b => b.redCount * 3 + b.amberCount === maxScore);
  const TRACK_HEIGHT = 80;

  const tierColor = { RED: '#ef4444', AMBER: '#f59e0b', GREEN: '#22c55e' };

  function handleClick(idx: number) {
    setSelectedIdx(idx === selectedIdx ? null : idx);
  }

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-surface-border pb-2.5 gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-cyan-400 font-bold text-[10px] tracking-wider uppercase border border-blue-500/20">
              SECTION: 72-Hour Demand Trajectory
            </span>
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-content-primary uppercase tracking-wider mt-1 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Quayside Risk Trajectory (6-Hour Aggregated Shift Windows)</span>
          </h3>
          <p className="text-xs text-content-secondary mt-0.5">
            <strong className="text-content-primary">Purpose:</strong> Provides a 72-hour macro forecast of port-wide congestion peaks grouped into 6-hour operational shifts to anticipate berth pressure before it happens.
          </p>
        </div>
        <span className="text-[11px] text-content-muted font-mono self-start sm:self-center">
          Click any bar to inspect risk breakdown
        </span>
      </div>

      <div className="timeline-scroll-wrapper">
        <div className="timeline-container" style={{ paddingTop: 28 }}>
          {/* Track */}
          <div className="timeline-track">
            {buckets.map((bucket, i) => {
              const score = bucket.redCount * 3 + bucket.amberCount * 1.5 + bucket.greenCount * 0.5;
              const maxPossible = berths.length * 6 * 3;
              const fillH = Math.max(6, Math.round((score / (maxPossible || 1)) * TRACK_HEIGHT));
              const isPeak = i === peakIdx;
              const isSelected = i === selectedIdx;
              const tierClass = bucket.tier === 'RED' ? 'HIGH' : bucket.tier === 'AMBER' ? 'MEDIUM' : 'LOW';

              return (
                <div
                  id={`timeline-bucket-${i}`}
                  key={i}
                  className={`timeline-bucket${isSelected ? ' selected ring-2 ring-blue-500' : ''}`}
                  style={{ animationDelay: `${i * 40}ms` }}
                  onMouseMove={(e) => setTooltip({ x: e.clientX + 14, y: e.clientY - 10, bucket })}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => handleClick(i)}
                >
                  {isPeak && <span className="timeline-peak-label">▲ PEAK</span>}
                  <div
                    className={`timeline-bucket-fill tier-${tierClass}`}
                    style={{ height: fillH }}
                  />
                </div>
              );
            })}
          </div>

          {/* Labels */}
          <div className="timeline-labels">
            {buckets.map((b, i) => (
              <div key={i} className="timeline-label text-[10px] text-content-muted">{fmtTimeline(b.startTime)}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected bucket detail */}
      {selectedIdx !== null && buckets[selectedIdx] && (
        <div className="p-3 bg-surface-bg border border-surface-border rounded-xl text-xs space-y-1.5 animate-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-content-primary">
                Window +{buckets[selectedIdx].bucketIdx * 6}h &mdash; +{(buckets[selectedIdx].bucketIdx + 1) * 6}h
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                buckets[selectedIdx].tier === 'RED'
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  : buckets[selectedIdx].tier === 'AMBER'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              }`}>
                {buckets[selectedIdx].tier} RISK
              </span>
            </div>
            <button
              onClick={() => setSelectedIdx(null)}
              className="text-[11px] text-content-muted hover:text-content-primary"
            >
              Dismiss
            </button>
          </div>
          <div className="flex flex-wrap gap-4 text-content-secondary text-[11px]">
            <span>Critical Hours: <strong className="text-rose-600 dark:text-rose-400">{buckets[selectedIdx].redCount}</strong></span>
            <span>Elevated Hours: <strong className="text-amber-600 dark:text-amber-400">{buckets[selectedIdx].amberCount}</strong></span>
            <span>Avg Quay Occupancy: <strong className="text-content-primary">{Math.round(buckets[selectedIdx].avgOccupancy * 100)}%</strong></span>
          </div>
          {(buckets[selectedIdx]?.topBerths?.length || 0) > 0 && (
            <div className="text-[11px] text-content-muted">
              Critical Berths: <strong className="text-rose-600 dark:text-rose-400">{buckets[selectedIdx].topBerths.join(', ')}</strong>
            </div>
          )}
          {(buckets[selectedIdx]?.topFactors?.length || 0) > 0 && (
            <div className="text-[11px] text-content-muted">
              Primary Risk Driver: <strong className="text-blue-500">
                {(buckets[selectedIdx].topFactors[0]?.feature_name || 'Carrier Density').replace(/_/g, ' ')}
              </strong> (+{buckets[selectedIdx].topFactors[0]?.impact_pct || 0}%)
            </div>
          )}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div className="timeline-tooltip" style={{ top: tooltip.y, left: tooltip.x }}>
          <div className="timeline-tooltip-title">
            {fmtTimeline(tooltip.bucket.startTime)} → {fmtHour(tooltip.bucket.endTime)}
          </div>
          <div className="timeline-tooltip-row">
            <span>Risk Tier</span>
            <span style={{ color: tierColor[tooltip.bucket.tier] }}>{tooltip.bucket.tier}</span>
          </div>
          <div className="timeline-tooltip-row">
            <span>Avg Occupancy</span>
            <span>{Math.round(tooltip.bucket.avgOccupancy * 100)}%</span>
          </div>
          <div className="timeline-tooltip-row">
            <span>Critical hrs</span>
            <span style={{ color: '#ef4444' }}>{tooltip.bucket.redCount}</span>
          </div>
          <div className="timeline-tooltip-row">
            <span>Elevated hrs</span>
            <span style={{ color: '#f59e0b' }}>{tooltip.bucket.amberCount}</span>
          </div>
          {(tooltip.bucket.topBerths?.length || 0) > 0 && (
            <div className="timeline-tooltip-row" style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border-primary, rgba(255,255,255,0.08))' }}>
              <span>Critical berths</span>
              <span style={{ color: '#ef4444', fontSize: '0.62rem' }}>{tooltip.bucket.topBerths.join(', ')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimelineForecast;
