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

    berths.forEach(berth => {
      berth.timeline
        .filter(h => h.hour_offset >= startH && h.hour_offset < endH)
        .forEach((h: BerthHourRiskItem) => {
          if (h.risk_tier === 'RED') { red++; if (!criticalBerths.includes(berth.berth_name)) criticalBerths.push(berth.berth_name); }
          else if (h.risk_tier === 'AMBER') amber++;
          else green++;
          totalOcc += h.occupancy_probability;
          count++;
          h.top_factors.forEach(f => allFactors.push(f));
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

  if (!berths || berths.length === 0) {
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
    <div>
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
                  className={`timeline-bucket${isSelected ? ' selected' : ''}`}
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
              <div key={i} className="timeline-label">{fmtTimeline(b.startTime)}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected bucket detail */}
      {selectedIdx !== null && buckets[selectedIdx] && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: 'var(--bg-card, #1a2236)',
          border: '1px solid var(--border-accent, rgba(56,189,248,0.3))',
          borderRadius: 8, fontSize: '0.78rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' }}>
              Window +{buckets[selectedIdx].bucketIdx * 6}h — +{(buckets[selectedIdx].bucketIdx + 1) * 6}h
            </span>
            <span style={{
              padding: '2px 8px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700,
              background: buckets[selectedIdx].tier === 'RED' ? 'rgba(239,68,68,0.15)' : buckets[selectedIdx].tier === 'AMBER' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.12)',
              color: tierColor[buckets[selectedIdx].tier],
            }}>
              {buckets[selectedIdx].tier} RISK
            </span>
          </div>
          <div style={{ display: 'flex', gap: 20, color: 'var(--text-secondary, #94a3b8)', fontSize: '0.72rem' }}>
            <span>🔴 Red berth-hrs: <strong style={{ color: '#ef4444' }}>{buckets[selectedIdx].redCount}</strong></span>
            <span>🟡 Amber: <strong style={{ color: '#f59e0b' }}>{buckets[selectedIdx].amberCount}</strong></span>
            <span>Avg occupancy: <strong style={{ color: 'var(--text-primary, #e2e8f0)' }}>{Math.round(buckets[selectedIdx].avgOccupancy * 100)}%</strong></span>
          </div>
          {buckets[selectedIdx].topBerths.length > 0 && (
            <div style={{ marginTop: 6, color: 'var(--text-muted, #64748b)', fontSize: '0.68rem' }}>
              Critical berths: <strong style={{ color: '#ef4444' }}>{buckets[selectedIdx].topBerths.join(', ')}</strong>
            </div>
          )}
          {buckets[selectedIdx].topFactors.length > 0 && (
            <div style={{ marginTop: 4, color: 'var(--text-muted, #64748b)', fontSize: '0.68rem' }}>
              Top factor: <strong style={{ color: 'var(--accent-blue, #38bdf8)' }}>
                {buckets[selectedIdx].topFactors[0].feature_name.replace(/_/g, ' ')}
              </strong> (+{buckets[selectedIdx].topFactors[0].impact_pct}%)
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
            <span>🔴 Critical hrs</span>
            <span style={{ color: '#ef4444' }}>{tooltip.bucket.redCount}</span>
          </div>
          <div className="timeline-tooltip-row">
            <span>🟡 Elevated hrs</span>
            <span style={{ color: '#f59e0b' }}>{tooltip.bucket.amberCount}</span>
          </div>
          {tooltip.bucket.topBerths.length > 0 && (
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
