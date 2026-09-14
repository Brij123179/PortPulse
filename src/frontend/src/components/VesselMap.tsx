import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api, LiveStatusTableResponse, VesselStatusItem, HeatmapResponse } from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────
interface VesselMapProps {
  onSelectVessel?: (vesselId: string) => void;
  onOpenOverride?: (vesselId?: string, berthId?: string) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────
const VESSEL_COLORS: Record<string, string> = {
  BERTHED:   '#22c55e',
  ANCHORED:  '#f59e0b',
  SCHEDULED: '#38bdf8',
  DEPARTED:  '#64748b',
};

// Port of Los Angeles approximate center
const PORT_LAT = 33.754;
const PORT_LON = -118.216;

// Berth positions (approximate lat/lon, quayside row)
const BERTH_GEO: Record<string, [number, number]> = {
  'B-01': [33.7558, -118.2780], 'B-02': [33.7550, -118.2740],
  'B-03': [33.7542, -118.2700], 'B-04': [33.7534, -118.2660],
  'B-05': [33.7526, -118.2620], 'B-06': [33.7518, -118.2580],
  'B-07': [33.7510, -118.2540], 'B-08': [33.7502, -118.2500],
  'B-09': [33.7494, -118.2460], 'B-10': [33.7486, -118.2420],
};

// Derive a stable lat/lon per vessel based on their status and idx
function vesselGeo(v: VesselStatusItem, idx: number): [number, number] {
  if ((v.status === 'BERTHED') && v.assigned_berth_id) {
    const pos = BERTH_GEO[v.assigned_berth_id];
    if (pos) return [pos[0] + 0.0008, pos[1] + 0.001];
  }
  if (v.status === 'ANCHORED') {
    const angle = ((idx * 42) % 360) * (Math.PI / 180);
    return [PORT_LAT - 0.06 + Math.cos(angle) * 0.04, PORT_LON - 0.12 + Math.sin(angle) * 0.05];
  }
  // SCHEDULED — approaching from south-west
  const angle = ((idx * 37 + 180) % 360) * (Math.PI / 180);
  return [PORT_LAT - 0.15 + Math.cos(angle) * 0.05, PORT_LON - 0.22 + Math.sin(angle) * 0.07];
}

function geoDistDeg(a: [number, number], b: [number, number]) {
  return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
}

// ── Sub-component: theme-aware tiles ──────────────────────────────────────
function DynamicTileLayer({ darkMode }: { darkMode: boolean }) {
  const url = darkMode
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  return (
    <TileLayer
      key={url}
      url={url}
      attribution='&copy; <a href="https://carto.com/">CARTO</a>'
    />
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export const VesselMap: React.FC<VesselMapProps> = ({ onSelectVessel, onOpenOverride }) => {
  const [data, setData] = useState<LiveStatusTableResponse | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Map control toggles
  const [showTrails, setShowTrails]   = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showLabels, setShowLabels]   = useState(false);

  // Vessel info panel
  const [selectedVessel, setSelectedVessel] = useState<VesselStatusItem | null>(null);

  // Position history for trails: vessel_id → [[lat, lon], ...]
  const historyRef = useRef<Record<string, Array<[number, number]>>>({});

  // Detect dark mode from document class / media query
  const [darkMode, setDarkMode] = useState(true);
  useEffect(() => {
    const check = () => setDarkMode(!document.documentElement.classList.contains('light'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

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
        if (v.status === 'DEPARTED') return;
        const pos = vesselGeo(v, idx);
        const prev = historyRef.current[v.id] || [];
        const last = prev[prev.length - 1];
        if (!last || last[0] !== pos[0] || last[1] !== pos[1]) {
          historyRef.current[v.id] = [...prev, pos].slice(-5);
        }
      });
    } catch (err) {
      console.error('VesselMap: fetch error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center gap-3">
        <div className="text-3xl animate-pulse">🛳️</div>
        <p className="text-sm text-slate-400 font-medium">Loading Port Terminal Radar &amp; Spatial Map...</p>
      </div>
    );
  }

  const berths  = data?.berths  || [];
  const vessels = data?.vessels || [];
  const activeVessels = vessels.filter(v => v.status !== 'DEPARTED');

  // Berth occupancy
  const occupiedBerthIds = new Set(
    berths.filter(b => b.status === 'OCCUPIED').map(b => b.id)
  );
  const congestionPct = berths.length > 0 ? occupiedBerthIds.size / berths.length : 0;

  // Heatmap color from current hour (first bucket)
  let heatColorHex = '#22c55e';
  if (heatmapData && heatmapData.berths.length > 0) {
    const redCount = heatmapData.summary.red_tier_count;
    const amberCount = heatmapData.summary.amber_tier_count;
    if (redCount >= 3) { heatColorHex = '#ef4444'; }
    else if (amberCount >= 6) { heatColorHex = '#f59e0b'; }
  }

  // Clustering
  const CLUSTER_DIST = 0.03;
  const visited = new Set<string>();
  const clusters: VesselStatusItem[][] = [];
  activeVessels.forEach((v, i) => {
    if (visited.has(v.id)) return;
    const posA = vesselGeo(v, i);
    const members: VesselStatusItem[] = [v];
    activeVessels.forEach((u, j) => {
      if (i === j || visited.has(u.id)) return;
      if (geoDistDeg(posA, vesselGeo(u, j)) < CLUSTER_DIST) {
        members.push(u);
        visited.add(u.id);
      }
    });
    visited.add(v.id);
    clusters.push(members);
  });

  // Get assignment info for a vessel (from optimisation assignments in heatmap berths)
  function getAssignedBerth(vid: string): string | null {
    const vessel = vessels.find(v => v.id === vid);
    return vessel?.assigned_berth_name || null;
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl bg-slate-950" style={{ height: 560 }}>
      {/* ── Leaflet Map Container ── */}
      <MapContainer
        center={[PORT_LAT, PORT_LON]}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <DynamicTileLayer darkMode={darkMode} />

        {/* ── Congestion Heatmap Layer (underneath vessel and berth markers) ── */}
        {showHeatmap && (
          <>
            {/* Regional Port Congestion Radiant Zone */}
            <Circle
              center={[PORT_LAT, PORT_LON]}
              radius={5500}
              pathOptions={{
                color: heatColorHex,
                fillColor: heatColorHex,
                fillOpacity: 0.08,
                weight: 0,
              }}
            />
            <Circle
              center={[PORT_LAT, PORT_LON]}
              radius={3200}
              pathOptions={{
                color: heatColorHex,
                fillColor: heatColorHex,
                fillOpacity: 0.14,
                weight: 0,
              }}
            />
            <Circle
              center={[PORT_LAT, PORT_LON]}
              radius={1400}
              pathOptions={{
                color: heatColorHex,
                fillColor: heatColorHex,
                fillOpacity: 0.22,
                weight: 0,
              }}
            />

            {/* Per-Berth Congestion Heatmap Halos */}
            {berths.map(b => {
              const pos = BERTH_GEO[b.id];
              if (!pos) return null;
              const bForecast = heatmapData?.berths?.find(h => h.berth_id === b.id);
              const firstHour = bForecast?.timeline?.[0];
              const isHigh = firstHour?.risk_tier === 'RED' || (b.status === 'OCCUPIED' && congestionPct > 0.7);
              const isMed = firstHour?.risk_tier === 'AMBER' || b.status === 'OCCUPIED';
              const haloColor = isHigh ? '#ef4444' : isMed ? '#f59e0b' : '#38bdf8';
              const haloRadius = isHigh ? 950 : isMed ? 650 : 380;
              const haloOpacity = isHigh ? 0.35 : isMed ? 0.22 : 0.10;

              return (
                <React.Fragment key={`heat-${b.id}`}>
                  <Circle
                    center={pos}
                    radius={haloRadius}
                    pathOptions={{
                      color: haloColor,
                      fillColor: haloColor,
                      fillOpacity: haloOpacity,
                      weight: 0,
                    }}
                  />
                  {isHigh && (
                    <Circle
                      center={pos}
                      radius={haloRadius * 1.5}
                      pathOptions={{
                        color: '#ef4444',
                        fillColor: '#ef4444',
                        fillOpacity: 0.15,
                        weight: 0,
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </>
        )}

        {/* ── Vessel trails (last 5 positions) for ANCHORED/SCHEDULED ── */}
        {showTrails && clusters.flat()
          .filter(v => v.status === 'ANCHORED' || v.status === 'SCHEDULED')
          .map(v => {
            const trail = historyRef.current[v.id] || [];
            if (trail.length < 2) return null;
            return (
              <Polyline
                key={`trail-${v.id}`}
                positions={trail}
                pathOptions={{
                  color: VESSEL_COLORS[v.status] || '#64748b',
                  weight: 1.8, opacity: 0.5, dashArray: '4 6',
                }}
              />
            );
          })}

        {/* ── Berth markers — color by occupancy + heatmap risk ── */}
        {berths.map(b => {
          const pos = BERTH_GEO[b.id];
          if (!pos) return null;
          const occupied = b.status === 'OCCUPIED';
          const congested = occupied && congestionPct > 0.7;
          const bColor = congested ? '#ef4444' : occupied ? '#22c55e' : '#38bdf8';
          const bFillOp = congested ? 0.7 : occupied ? 0.6 : 0.25;
          return (
            <CircleMarker
              key={b.id}
              center={pos}
              radius={11}
              pathOptions={{ color: bColor, fillColor: bColor, fillOpacity: bFillOp, weight: 2 }}
            >
              <Popup>
                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', minWidth: 160 }}>
                  <strong>{b.name}</strong><br />
                  Length: {b.length_m}m | Draft: {b.draft_limit_m}m<br />
                  Cranes: {b.operational_cranes}/{b.crane_slots}<br />
                  Status: <strong style={{ color: bColor }}>
                    {congested ? 'CONGESTED' : occupied ? 'OCCUPIED' : 'AVAILABLE'}
                  </strong>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* ── Clustered vessel markers ── */}
        {clusters.map((members, ci) => {
          const rep    = members[0];
          const repIdx = vessels.findIndex(v => v.id === rep.id);
          const pos    = vesselGeo(rep, repIdx);
          const isCluster = members.length > 1;
          const color  = isCluster ? '#a78bfa' : (VESSEL_COLORS[rep.status] || '#64748b');
          const radius = isCluster ? 10 + members.length : (rep.priority_flag ? 7 : 5);

          return (
            <CircleMarker
              key={isCluster ? `cluster-${ci}` : rep.id}
              center={pos}
              radius={radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: isCluster ? 0.75 : 0.9,
                weight: rep.priority_flag || isCluster ? 2.5 : 1.5,
              }}
              eventHandlers={{
                click: () => {
                  if (!isCluster) {
                    setSelectedVessel(rep);
                    if (onSelectVessel) onSelectVessel(rep.id);
                  }
                },
              }}
            >
              <Popup>
                {isCluster ? (
                  <div style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                    <strong>{members.length} vessels nearby</strong><br />
                    {members.map(m => <div key={m.id}>{m.name} ({m.status})</div>)}
                  </div>
                ) : (
                  <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', minWidth: 160 }}>
                    <strong>{rep.name}</strong><br />
                    {rep.id} | {rep.vessel_class}<br />
                    Status: <strong>{rep.status}</strong><br />
                    Draft: {rep.draft_m}m | Length: {rep.length_m}m
                    {rep.priority_flag && <><br /><span style={{ color: '#f59e0b', fontWeight: 600 }}>⚑ PRIORITY</span></>}
                  </div>
                )}
              </Popup>
            </CircleMarker>
          );
        })}

        {/* ── Berth labels ── */}
        {showLabels && berths.map(b => {
          const pos = BERTH_GEO[b.id];
          if (!pos) return null;
          return (
            <CircleMarker
              key={`lbl-${b.id}`}
              center={[pos[0] + 0.003, pos[1]]}
              radius={0}
              pathOptions={{ opacity: 0, fillOpacity: 0 }}
            >
              <Popup>
                <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: '#38bdf8' }}>{b.name}</span>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* ── Floating Controls & Legend (Positioned ON the map at the Top-Right Corner) ── */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 pointer-events-auto max-w-[210px]">
        <div className="bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-3 shadow-2xl text-xs space-y-2.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
            <span className="font-bold text-[11px] tracking-wide text-slate-200 uppercase flex items-center gap-1.5">
              <span>⚡</span> Map Layers
            </span>
            <button
              onClick={fetchData}
              className="text-[10px] text-sky-400 hover:text-sky-300 font-medium px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
              title="Refresh telemetry"
            >
              ↻ Sync
            </button>
          </div>

          {/* Toggle Options */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-slate-300 hover:text-white cursor-pointer select-none">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-0.5 bg-amber-400 rounded"></span>
                Vessel Trails
              </span>
              <input
                type="checkbox"
                checked={showTrails}
                onChange={e => setShowTrails(e.target.checked)}
                className="accent-sky-500 rounded cursor-pointer w-3.5 h-3.5"
              />
            </label>

            <label className="flex items-center justify-between text-slate-300 hover:text-white cursor-pointer select-none">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                Congestion Heatmap
              </span>
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={e => setShowHeatmap(e.target.checked)}
                className="accent-sky-500 rounded cursor-pointer w-3.5 h-3.5"
              />
            </label>

            <label className="flex items-center justify-between text-slate-300 hover:text-white cursor-pointer select-none">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                Berth Labels
              </span>
              <input
                type="checkbox"
                checked={showLabels}
                onChange={e => setShowLabels(e.target.checked)}
                className="accent-sky-500 rounded cursor-pointer w-3.5 h-3.5"
              />
            </label>
          </div>

          {/* Legend */}
          <div className="border-t border-slate-700/60 pt-2 space-y-1.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Berths
            </div>
            <div className="grid grid-cols-2 gap-x-1.5 gap-y-1 text-[10px] text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0"></span>
                Available
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                Occupied
              </div>
              <div className="flex items-center gap-1.5 col-span-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                High Risk / Congested
              </div>
            </div>

            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider pt-1">
              Vessels
            </div>
            <div className="grid grid-cols-2 gap-x-1.5 gap-y-1 text-[10px] text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                Berthed
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                Anchored
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0"></span>
                Scheduled
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0"></span>
                Cluster
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Vessel count badge (Bottom-Left Corner) ── */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-full px-3 py-1 text-xs font-semibold text-sky-400 shadow-lg flex items-center gap-2 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        {activeVessels.length} Active Vessels
      </div>

      {/* ── Vessel info slide-in panel (Overlay on Map) ── */}
      {selectedVessel && (
        <div className="absolute top-0 right-0 bottom-0 w-72 z-[1010] bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl border-l border-slate-700/80 p-4 shadow-2xl flex flex-col gap-2.5 overflow-y-auto animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between border-b border-slate-700/70 pb-2">
            <div className="font-bold text-sm text-slate-100 truncate">{selectedVessel.name}</div>
            <button
              className="text-slate-400 hover:text-white text-base leading-none p-1 rounded hover:bg-slate-800 transition-colors"
              onClick={() => setSelectedVessel(null)}
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Vessel ID</span>
            <span className="font-mono text-slate-200">{selectedVessel.id}</span>
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Class</span>
            <span className="text-slate-200">{selectedVessel.vessel_class}</span>
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Status</span>
            <span className="flex items-center gap-2 text-slate-200 font-medium">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: VESSEL_COLORS[selectedVessel.status] || '#64748b' }}
              />
              {selectedVessel.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Draft</span>
              <span className="text-slate-200">{selectedVessel.draft_m}m</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Length</span>
              <span className="text-slate-200">{selectedVessel.length_m}m</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Carrier ETA</span>
            <span className="font-mono text-[11px] text-slate-200">
              {new Date(selectedVessel.carrier_eta).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          {selectedVessel.priority_flag && (
            <div className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold flex items-center gap-1.5">
              <span>⚑</span> PRIORITY VESSEL
            </div>
          )}

          {selectedVessel.predicted_delay_hours !== undefined && (
            <div className="flex flex-col gap-1 text-xs">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Predicted Delay</span>
              <span
                className="font-semibold"
                style={{
                  color: selectedVessel.predicted_delay_hours > 12 ? '#ef4444' : selectedVessel.predicted_delay_hours > 4 ? '#f59e0b' : '#22c55e'
                }}
              >
                {selectedVessel.predicted_delay_hours}h
              </span>
            </div>
          )}

          {getAssignedBerth(selectedVessel.id) && (
            <div className="flex flex-col gap-1 text-xs">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Assigned Berth</span>
              <span className="text-sky-400 font-medium">{getAssignedBerth(selectedVessel.id)}</span>
            </div>
          )}

          {onOpenOverride && (
            <button
              onClick={() => {
                const vid = selectedVessel.id;
                setSelectedVessel(null);
                onOpenOverride(vid);
              }}
              className="mt-2 w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors shadow-md flex items-center justify-center gap-1.5"
            >
              <span>Manual Override</span>
              <span>→</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default VesselMap;
