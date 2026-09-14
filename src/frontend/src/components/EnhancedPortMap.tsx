import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api, LiveStatusTableResponse, VesselStatusItem, HeatmapResponse } from '../api/client';
import { Ship, MapPin, RefreshCw, X } from 'lucide-react';

interface EnhancedPortMapProps {
  onSelectVessel?: (vesselId: string) => void;
  onOpenOverride?: (vesselId?: string, berthId?: string) => void;
}

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  BERTHED:   '#22c55e',
  ANCHORED:  '#f59e0b',
  SCHEDULED: '#38bdf8',
  DEPARTED:  '#64748b',
};

// ── Tiny geo helpers (for SVG positioning relative to port bounds) ────────────
const PORT_LAT = 33.754;
const PORT_LON = -118.216;
const BOUNDS = { latSpan: 0.35, lonSpan: 0.55 };

function geoToSvg(lat: number, lon: number, svgW: number, svgH: number) {
  const x = ((lon - (PORT_LON - BOUNDS.lonSpan / 2)) / BOUNDS.lonSpan) * svgW;
  const y = svgH - ((lat - (PORT_LAT - BOUNDS.latSpan / 2)) / BOUNDS.latSpan) * svgH;
  return { x: Math.round(x), y: Math.round(y) };
}

function geoDist(a: [number, number], b: [number, number]) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

// ── Berth static positions (approximate lat/lon for SVG layout) ──────────────
// Generated from a realistic LA/LB port grid
const BERTH_POSITIONS: Record<string, [number, number]> = {
  'B-01': [33.7558, -118.2780], 'B-02': [33.7550, -118.2740],
  'B-03': [33.7542, -118.2700], 'B-04': [33.7534, -118.2660],
  'B-05': [33.7526, -118.2620], 'B-06': [33.7518, -118.2580],
  'B-07': [33.7510, -118.2540], 'B-08': [33.7502, -118.2500],
  'B-09': [33.7494, -118.2460], 'B-10': [33.7486, -118.2420],
};

// Vessel approach positions (simulate offshore AIS tracks)
function getVesselPos(v: VesselStatusItem, idx: number): [number, number] {
  if (v.status === 'BERTHED' && v.assigned_berth_id) {
    const bp = BERTH_POSITIONS[v.assigned_berth_id];
    if (bp) return [bp[0] + 0.001, bp[1] + 0.001];
  }
  if (v.status === 'ANCHORED') {
    const angle = (idx * 42) % 360;
    const rad = (angle * Math.PI) / 180;
    return [
      PORT_LAT - 0.08 + Math.cos(rad) * 0.05,
      PORT_LON - 0.15 + Math.sin(rad) * 0.07,
    ];
  }
  // SCHEDULED — approaching from south/west
  const angle = (idx * 37 + 180) % 360;
  const rad = (angle * Math.PI) / 180;
  return [
    PORT_LAT - 0.18 + Math.cos(rad) * 0.06,
    PORT_LON - 0.25 + Math.sin(rad) * 0.08,
  ];
}

export const EnhancedPortMap: React.FC<EnhancedPortMapProps> = ({ onSelectVessel, onOpenOverride }) => {
  const [data, setData] = useState<LiveStatusTableResponse | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVessel, setSelectedVessel] = useState<VesselStatusItem | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'occupied' | 'available' | 'high_risk'>('all');

  // Map control toggles
  const [showTrails, setShowTrails]       = useState(true);
  const [showHeatmap, setShowHeatmap]     = useState(true);
  const [showLabels, setShowLabels]       = useState(true);

  // Vessel position history for trails (in-memory, updates on each fetch)
  const trailHistory = useRef<Record<string, Array<[number, number]>>>({});

  const SVG_W = 700;
  const SVG_H = 420;

  const fetchData = async () => {
    try {
      setLoading(true);
      const [liveRes, heatRes] = await Promise.all([
        api.getLiveStatusTable(),
        api.getHeatmap(72),
      ]);
      setData(liveRes);
      setHeatmapData(heatRes);

      // Update trail history
      liveRes.vessels.forEach((v, idx) => {
        const pos = getVesselPos(v, idx);
        const prev = trailHistory.current[v.id] || [];
        const last = prev[prev.length - 1];
        if (!last || last[0] !== pos[0] || last[1] !== pos[1]) {
          trailHistory.current[v.id] = [...prev, pos].slice(-5);
        }
      });
    } catch (err) {
      console.error('Failed to load map data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Compute port-wide heatmap overlay opacity from current hour risk
  const heatmapOpacity = useMemo(() => {
    if (!heatmapData) return 0;
    const allTimeline = heatmapData.berths.flatMap(b => b.timeline);
    const current = allTimeline.filter(h => h.hour_offset < 6);
    const redCount = current.filter(h => h.risk_tier === 'RED').length;
    const amberCount = current.filter(h => h.risk_tier === 'AMBER').length;
    if (redCount >= 3) return 0.28;
    if (amberCount >= 6) return 0.16;
    return 0.07;
  }, [heatmapData]);

  const heatmapColor = useMemo(() => {
    if (!heatmapData) return '#22c55e';
    const allTimeline = heatmapData.berths.flatMap(b => b.timeline);
    const current = allTimeline.filter(h => h.hour_offset < 6);
    const redCount = current.filter(h => h.risk_tier === 'RED').length;
    const amberCount = current.filter(h => h.risk_tier === 'AMBER').length;
    if (redCount >= 3) return '#ef4444';
    if (amberCount >= 6) return '#f59e0b';
    return '#22c55e';
  }, [heatmapData]);

  // Berth risk color from heatmap
  const getBerthRiskColor = (berthId: string) => {
    const track = heatmapData?.berths.find(t => t.berth_id === berthId);
    if (!track) return null;
    const next24 = track.timeline.slice(0, 24);
    const red = next24.filter(h => h.risk_tier === 'RED').length;
    const amber = next24.filter(h => h.risk_tier === 'AMBER').length;
    if (red >= 3) return '#ef4444';
    if (amber >= 6) return '#f59e0b';
    return '#22c55e';
  };

  const berths = data?.berths || [];
  const vessels = data?.vessels || [];
  const activeVessels = vessels.filter(v => v.status !== 'DEPARTED');

  // Clustering (distance threshold in lat/lon degrees)
  const CLUSTER_DIST = 0.025;
  const visited = new Set<string>();
  const clusters: VesselStatusItem[][] = [];
  activeVessels.forEach((v, i) => {
    if (visited.has(v.id)) return;
    const posA = getVesselPos(v, i);
    const members = [v];
    activeVessels.forEach((u, j) => {
      if (i === j || visited.has(u.id)) return;
      const posB = getVesselPos(u, j);
      if (geoDist(posA, posB) < CLUSTER_DIST) {
        members.push(u);
        visited.add(u.id);
      }
    });
    visited.add(v.id);
    clusters.push(members);
  });

  const filteredBerths = berths.filter(b => {
    if (filterMode === 'occupied') return b.status === 'OCCUPIED';
    if (filterMode === 'available') return b.status === 'AVAILABLE';
    if (filterMode === 'high_risk') {
      const track = heatmapData?.berths.find(t => t.berth_id === b.id);
      return track?.timeline.slice(0, 24).some(h => h.risk_tier === 'RED');
    }
    return true;
  });

  if (loading && !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center gap-3">
        <Ship className="w-8 h-8 text-primary animate-pulse" />
        <p className="text-sm text-slate-400 font-medium">Loading Enhanced Port Map...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-white">Enhanced Port Terminal Map</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-status-safe border border-status-safe/30">
            Live · {activeVessels.length} Active Vessels
          </span>
        </div>

        {/* Map controls */}
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white transition" id="toggle-trails">
            <input type="checkbox" checked={showTrails} onChange={e => setShowTrails(e.target.checked)} className="accent-blue-500" />
            Trails
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white transition" id="toggle-heatmap">
            <input type="checkbox" checked={showHeatmap} onChange={e => setShowHeatmap(e.target.checked)} className="accent-blue-500" />
            Heatmap
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white transition" id="toggle-labels">
            <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} className="accent-blue-500" />
            Labels
          </label>
          <button
            onClick={fetchData}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition text-[11px]"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 text-[11px]">
          {(['all', 'occupied', 'available', 'high_risk'] as const).map(m => (
            <button
              key={m}
              onClick={() => setFilterMode(m)}
              className={`px-2 py-0.5 rounded-md capitalize font-semibold transition ${
                filterMode === m
                  ? 'bg-primary-container text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
              }`}
            >
              {m === 'high_risk' ? '🔴 Risk' : m}
            </button>
          ))}
        </div>
      </div>

      {/* Main layout: SVG map + vessel info panel */}
      <div className="flex gap-4">
        {/* SVG Map */}
        <div className="flex-1 relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden" style={{ minHeight: SVG_H }}>
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full h-full"
            style={{ fontFamily: 'monospace' }}
          >
            {/* Ocean background */}
            <defs>
              <radialGradient id="oceanGrad" cx="50%" cy="50%" r="75%">
                <stop offset="0%" stopColor="#0c1a2e" />
                <stop offset="100%" stopColor="#050d1a" />
              </radialGradient>
              <radialGradient id="heatGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={heatmapColor} stopOpacity={heatmapOpacity} />
                <stop offset="100%" stopColor={heatmapColor} stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width={SVG_W} height={SVG_H} fill="url(#oceanGrad)" />

            {/* Heatmap overlay */}
            {showHeatmap && (
              <ellipse
                cx={SVG_W * 0.45} cy={SVG_H * 0.4}
                rx={SVG_W * 0.45} ry={SVG_H * 0.45}
                fill="url(#heatGrad)"
                style={{ transition: 'all 0.8s ease' }}
              />
            )}

            {/* Port quay line */}
            <line x1={60} y1={SVG_H * 0.25} x2={SVG_W - 60} y2={SVG_H * 0.25}
              stroke="#1e3a5f" strokeWidth={3} strokeDasharray="8 4" />
            <text x={SVG_W / 2} y={SVG_H * 0.25 - 8} textAnchor="middle"
              fill="#334155" fontSize={9} fontWeight="600">PORT OF LOS ANGELES — QUAY LINE</text>

            {/* Berths */}
            {filteredBerths.map((b) => {
              const pos = BERTH_POSITIONS[b.id];
              if (!pos) return null;
              const { x, y } = geoToSvg(pos[0], pos[1], SVG_W, SVG_H);
              const riskColor = getBerthRiskColor(b.id);
              const bColor = b.status === 'OCCUPIED'
                ? (riskColor || '#22c55e')
                : b.status === 'MAINTENANCE' ? '#64748b' : '#38bdf8';

              return (
                <g key={b.id} style={{ cursor: 'pointer' }}>
                  <rect
                    x={x - 14} y={y - 8}
                    width={28} height={16}
                    rx={4}
                    fill={bColor}
                    fillOpacity={b.status === 'OCCUPIED' ? 0.6 : 0.15}
                    stroke={bColor}
                    strokeWidth={b.status === 'OCCUPIED' ? 1.5 : 1}
                    strokeOpacity={0.9}
                  />
                  {showLabels && (
                    <text x={x} y={y + 3} textAnchor="middle"
                      fill={bColor} fontSize={7} fontWeight="700">
                      {b.id}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Vessel trails */}
            {showTrails && clusters.flat().filter(v => v.status === 'ANCHORED' || v.status === 'SCHEDULED').map((v, _unused) => {
              const hist = trailHistory.current[v.id] || [];
              if (hist.length < 2) return null;
              const pts = hist.map(([lat, lon]) => {
                const { x, y } = geoToSvg(lat, lon, SVG_W, SVG_H);
                return `${x},${y}`;
              }).join(' ');
              return (
                <polyline
                  key={`trail-${v.id}`}
                  points={pts}
                  fill="none"
                  stroke={STATUS_COLOR[v.status] || '#64748b'}
                  strokeWidth={1}
                  strokeOpacity={0.35}
                  strokeDasharray="3 5"
                />
              );
            })}

            {/* Vessel clusters / markers */}
            {clusters.map((members, ci) => {
              const rep = members[0];
              const idx = vessels.findIndex(v => v.id === rep.id);
              const pos = getVesselPos(rep, idx);
              const { x, y } = geoToSvg(pos[0], pos[1], SVG_W, SVG_H);
              const isCluster = members.length > 1;
              const color = isCluster ? '#a78bfa' : (STATUS_COLOR[rep.status] || '#64748b');
              const r = isCluster ? 10 + members.length * 0.8 : (rep.priority_flag ? 7 : 5);

              return (
                <g
                  key={isCluster ? `cluster-${ci}` : rep.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (!isCluster) {
                      setSelectedVessel(rep);
                      if (onSelectVessel) onSelectVessel(rep.id);
                    }
                  }}
                >
                  <circle cx={x} cy={y} r={r + 3} fill={color} fillOpacity={0.15} />
                  <circle cx={x} cy={y} r={r} fill={color} fillOpacity={0.9}
                    stroke={rep.priority_flag ? '#fff' : color}
                    strokeWidth={rep.priority_flag ? 1.5 : 0.5} />
                  {isCluster && (
                    <text x={x} y={y + 3.5} textAnchor="middle"
                      fill="white" fontSize={8} fontWeight="800">{members.length}</text>
                  )}
                  {rep.priority_flag && !isCluster && (
                    <text x={x} y={y - r - 3} textAnchor="middle"
                      fill="#f59e0b" fontSize={8}>⚑</text>
                  )}
                  {showLabels && !isCluster && (
                    <text x={x} y={y + r + 9} textAnchor="middle"
                      fill={color} fontSize={7} fillOpacity={0.8}>{rep.name.split(' ').slice(-1)[0]}</text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Vessel count badge */}
          <div
            id="vessel-count-badge"
            className="absolute bottom-3 left-3 px-3 py-1 rounded-full text-[11px] font-bold text-blue-300 border border-blue-500/40"
            style={{ background: 'rgba(10,14,26,0.85)', backdropFilter: 'blur(6px)' }}
          >
            {activeVessels.length} Active Vessels
          </div>

          {/* Legend */}
          <div
            className="absolute bottom-3 right-3 flex flex-col gap-1 text-[10px] text-slate-400 p-2 rounded-lg border border-slate-800"
            style={{ background: 'rgba(10,14,26,0.85)', backdropFilter: 'blur(6px)' }}
          >
            {[
              { color: STATUS_COLOR.BERTHED,   label: 'Berthed' },
              { color: STATUS_COLOR.ANCHORED,  label: 'Anchored' },
              { color: STATUS_COLOR.SCHEDULED, label: 'Scheduled' },
              { color: '#a78bfa',              label: 'Cluster' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Vessel Info Panel — slide in when a vessel is selected */}
        <div
          id="vessel-info-panel"
          className={`transition-all duration-300 overflow-hidden ${selectedVessel ? 'w-56 opacity-100' : 'w-0 opacity-0'}`}
        >
          {selectedVessel && (
            <div className="w-56 bg-slate-900 border border-slate-700 rounded-xl p-4 text-xs space-y-3 h-full relative overflow-y-auto">
              <button
                id="vessel-info-close-btn"
                onClick={() => setSelectedVessel(null)}
                className="absolute top-3 right-3 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div>
                <div className="text-sm font-bold text-white pr-6">{selectedVessel.name}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{selectedVessel.id}</div>
              </div>

              {/* Status dot */}
              <div className="flex items-center gap-2">
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: STATUS_COLOR[selectedVessel.status] || '#64748b',
                  display: 'inline-block', flexShrink: 0,
                }} />
                <span className="text-slate-200 font-semibold">{selectedVessel.status}</span>
              </div>

              {selectedVessel.priority_flag && (
                <div className="px-2 py-1 rounded-lg bg-status-warning-bg border border-amber-500/30 text-status-warning font-bold text-[10px]">
                  ⚑ PRIORITY VESSEL
                </div>
              )}

              <div className="space-y-2 text-[11px]">
                {[
                  { label: 'Class', value: selectedVessel.vessel_class },
                  { label: 'TEU', value: selectedVessel.cargo_volume.toLocaleString() },
                  { label: 'Length', value: `${selectedVessel.length_m}m` },
                  { label: 'Draft', value: `${selectedVessel.draft_m}m` },
                  { label: 'Carrier ETA', value: new Date(selectedVessel.carrier_eta).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                  ...(selectedVessel.predicted_delay_hours
                    ? [{ label: 'Pred. Delay', value: `${selectedVessel.predicted_delay_hours}h`, warn: true }]
                    : []),
                  ...(selectedVessel.assigned_berth_name
                    ? [{ label: 'Assigned Berth', value: selectedVessel.assigned_berth_name, accent: true }]
                    : []),
                ].map(({ label, value, warn, accent }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
                    <span className={`font-semibold ${warn ? 'text-status-critical' : accent ? 'text-primary' : 'text-slate-200'}`}>{value}</span>
                  </div>
                ))}
              </div>

              {onOpenOverride && (
                <button
                  onClick={() => { setSelectedVessel(null); onOpenOverride(selectedVessel.id); }}
                  className="w-full mt-2 px-3 py-1.5 rounded-lg bg-primary-container hover:bg-blue-500 text-white text-[11px] font-bold transition"
                >
                  Manual Override →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes vesselPulse {
          0%, 100% { r: 5; opacity: 0.9; }
          50%       { r: 7; opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default EnhancedPortMap;



