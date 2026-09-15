import React, { useState, useEffect, useCallback } from 'react';
import { api, LiveStatusTableResponse, BerthStatusItem, VesselStatusItem, HeatmapResponse, BerthHeatmapTrack } from '../api/client';

interface PortMapProps {
  onSelectVessel?: (vesselId: string) => void;
  onOpenOverride?: (vesselId?: string, berthId?: string) => void;
}

export const PortMap: React.FC<PortMapProps> = ({ onSelectVessel, onOpenOverride }) => {
  const [data, setData] = useState<LiveStatusTableResponse | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBerth, setSelectedBerth] = useState<BerthStatusItem | null>(null);
  const [selectedVessel, setSelectedVessel] = useState<VesselStatusItem | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'occupied' | 'available' | 'high_risk'>('all');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [liveRes, heatRes] = await Promise.all([
        api.getLiveStatusTable(),
        api.getHeatmap(72),
      ]);
      setData(liveRes);
      setHeatmapData(heatRes);
    } catch (err) {
      console.error('Failed to load map data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="p-8 text-center text-slate-400 animate-pulse bg-slate-900 rounded-xl border border-slate-800">
        <div className="text-3xl mb-2">🗺️</div>
        <div className="text-sm font-semibold">Loading Port Terminal Radar &amp; Spatial Map...</div>
      </div>
    );
  }

  const berths = data?.berths || [];
  const vessels = data?.vessels || [];
  const anchoredVessels = vessels.filter((v) => v.status === 'ANCHORED');
  const approachingVessels = vessels.filter((v) => v.status === 'SCHEDULED');

  // Map each berth to its 72h forecast risk
  const getBerthForecast = (berthId: string): BerthHeatmapTrack | undefined => {
    return heatmapData?.berths?.find((t: BerthHeatmapTrack) => t.berth_id === berthId);
  };

  const getBerthRiskColor = (berthId: string) => {
    const track = getBerthForecast(berthId);
    if (!track || !Array.isArray(track.timeline) || track.timeline.length === 0) return 'border-slate-700 bg-slate-800/60';
    // Count red hours in next 24h
    const next24 = (track.timeline || []).slice(0, 24);
    const redCount = next24.filter((h) => h.risk_tier === 'RED').length;
    const amberCount = next24.filter((h) => h.risk_tier === 'AMBER').length;

    if (redCount >= 3) return 'border-rose-500/70 bg-rose-950/20 shadow-lg shadow-rose-900/20 ring-1 ring-rose-500/40';
    if (amberCount >= 6) return 'border-amber-500/70 bg-amber-950/20 shadow-lg shadow-amber-900/20 ring-1 ring-amber-500/40';
    return 'border-emerald-500/50 bg-emerald-950/10 shadow-lg shadow-emerald-900/10';
  };

  const filteredBerths = berths.filter((b) => {
    if (filterMode === 'occupied') return b.status === 'OCCUPIED';
    if (filterMode === 'available') return b.status === 'AVAILABLE';
    if (filterMode === 'high_risk') {
      const track = getBerthForecast(b.id);
      return Array.isArray(track?.timeline) && track.timeline.slice(0, 24).some((h) => h.risk_tier === 'RED');
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Map Toolbar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xl text-blue-400">
            🗺️
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Interactive Port Terminal &amp; Quay Basin Map</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Live AIS &amp; Berth Feed
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Spatial overview of Anchorage Basin, Fairway Channel, and Quayside Berths (B-01 to B-10)
            </p>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Filter Quays:</span>
          {(['all', 'occupied', 'available', 'high_risk'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setFilterMode(m)}
              className={`px-2.5 py-1 rounded-lg capitalize font-semibold transition ${
                filterMode === m
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {m === 'high_risk' ? '🚨 Congestion Risk' : m}
            </button>
          ))}
          <button
            onClick={fetchData}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh Map"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Terminal Layout Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Offshore Anchorage & Approaches (1 col) */}
        <div className="lg:col-span-1 space-y-4">
          {/* Offshore Anchorage Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚓</span>
                <span className="font-bold text-white text-xs uppercase tracking-wider">Offshore Anchorage</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {anchoredVessels.length} Waiting
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Vessels at open-sea waiting anchorage awaiting berth window clearance.
            </p>

            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {anchoredVessels.length === 0 ? (
                <div className="text-xs text-slate-500 italic py-4 text-center">No vessels currently at anchorage</div>
              ) : (
                anchoredVessels.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => {
                      setSelectedVessel(v);
                      onSelectVessel?.(v.id);
                    }}
                    className="p-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 cursor-pointer transition text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100">{v.name}</span>
                      {v.priority_flag && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500/20 text-rose-400 font-bold">
                          PRIORITY
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>{v.vessel_class} • {v.cargo_volume.toLocaleString()} TEU</span>
                      <span className="font-mono text-amber-400 font-semibold">{v.draft_m}m draft</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Assigned: <strong className="text-slate-300">{v.assigned_berth_name || 'Unassigned'}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Inbound Fairway Channel Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🧭</span>
                <span className="font-bold text-white text-xs uppercase tracking-wider">Inbound Approach Channel</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {approachingVessels.length} Approaching
              </span>
            </div>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {approachingVessels.slice(0, 5).map((v) => (
                <div
                  key={v.id}
                  onClick={() => {
                    setSelectedVessel(v);
                    onSelectVessel?.(v.id);
                  }}
                  className="p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 cursor-pointer transition text-xs"
                >
                  <div className="font-semibold text-slate-200">{v.name}</div>
                  <div className="text-[10px] text-slate-400 flex justify-between">
                    <span>ETA: {new Date(v.corrected_eta || v.carrier_eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-blue-300 font-medium">To {v.assigned_berth_name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 3 Columns: Visual Quayside Berths Layout (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Quayside Basin — Berths B-01 to B-10</h3>
                <p className="text-xs text-slate-400">
                  Click any quay to inspect physical specifications, berthed vessel manifest, and 72-hour congestion heat strip
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Normal Risk
                </span>
                <span className="flex items-center gap-1 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Moderate
                </span>
                <span className="flex items-center gap-1 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block animate-pulse"></span> Bottleneck
                </span>
              </div>
            </div>

            {/* Quayside Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
              {filteredBerths.map((b) => {
                const track = getBerthForecast(b.id);
                const berthedVessel = vessels.find((v) => v.assigned_berth_id === b.id && v.status === 'BERTHED');
                const riskGlow = getBerthRiskColor(b.id);
                const isSelected = selectedBerth?.id === b.id;

                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      setSelectedBerth(b);
                      if (berthedVessel) setSelectedVessel(berthedVessel);
                    }}
                    className={`p-4 rounded-xl border transition cursor-pointer relative overflow-hidden ${riskGlow} ${
                      isSelected ? 'ring-2 ring-blue-500 bg-slate-800/90' : 'hover:border-slate-500'
                    }`}
                  >
                    {/* Water background accent */}
                    <div className="absolute top-0 right-0 w-24 h-full bg-blue-500/5 pointer-events-none"></div>

                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">⚓</span>
                        <div>
                          <span className="font-bold text-white text-sm block">{b.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {b.id}</span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.status === 'OCCUPIED'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : b.status === 'AVAILABLE'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>

                    {/* Berth Specs Badges */}
                    <div className="grid grid-cols-3 gap-2 my-2 text-[11px] bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Length</span>
                        <span className="font-mono font-bold text-slate-200">{b.length_m}m</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Draft Limit</span>
                        <span className="font-mono font-bold text-blue-400">{b.draft_limit_m}m</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Cranes</span>
                        <span className="font-mono font-bold text-indigo-400">
                          {b.operational_cranes}/{b.crane_slots}
                        </span>
                      </div>
                    </div>

                    {/* Berthed Vessel or Available Notice */}
                    {berthedVessel ? (
                      <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-800/40 text-xs mt-2">
                        <div className="flex items-center justify-between text-blue-200 font-semibold mb-1">
                          <span className="flex items-center gap-1.5">
                            <span>🚢</span> {berthedVessel.name}
                          </span>
                          <span className="text-[10px] text-blue-300 font-mono">
                            {berthedVessel.cargo_volume.toLocaleString()} TEU
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex justify-between">
                          <span>Draft: {berthedVessel.draft_m}m (LOA: {berthedVessel.length_m}m)</span>
                          <span className="text-emerald-400 font-medium">Safe Fit ✓</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/30 text-xs mt-2 text-emerald-300 flex items-center justify-between">
                        <span>Quay Clear &bull; Ready for Mooring</span>
                        <span className="text-[10px] text-emerald-400 font-bold">100% Available</span>
                      </div>
                    )}

                    {/* Berth Mini-Heatmap 72h Timeline Strip */}
                    {track && Array.isArray(track.timeline) && track.timeline.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-800/80">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                          <span>72h Congestion Heatmap:</span>
                          <span className="font-mono text-slate-300">
                            {(track.timeline.filter((h) => h.risk_tier === 'RED') || []).length}h Red Risk
                          </span>
                        </div>
                        {/* Hour Blocks Strip (72 small segments grouped) */}
                        <div className="flex h-2.5 rounded overflow-hidden gap-[1px] bg-slate-950">
                          {track.timeline.map((h) => (
                            <div
                              key={`hour-offset-${h.hour_offset}`}
                              title={`Hour +${h.hour_offset}: ${h.risk_tier} (${(h.occupancy_probability * 100).toFixed(0)}% occ)`}
                              className={`flex-1 transition-all ${
                                h.risk_tier === 'RED'
                                  ? 'bg-rose-500'
                                  : h.risk_tier === 'AMBER'
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500/80'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Berth Inspection Drawer / Modal */}
      {selectedBerth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-slate-100 relative max-h-[90vh] overflow-y-auto space-y-4">
            <button
              onClick={() => setSelectedBerth(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg p-2 rounded-lg hover:bg-slate-800 transition"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-xl text-blue-400">
                ⚓
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{selectedBerth.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                    {selectedBerth.id}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">Quayside Berth Operational Specification &amp; Analysis</p>
              </div>
            </div>

            {/* Specifications Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-800/70 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Quay Length</span>
                <span className="text-base font-bold font-mono text-white">{selectedBerth.length_m} m</span>
              </div>
              <div className="p-3 bg-slate-800/70 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Max Draft Limit</span>
                <span className="text-base font-bold font-mono text-blue-400">{selectedBerth.draft_limit_m} m</span>
              </div>
              <div className="p-3 bg-slate-800/70 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Active Cranes</span>
                <span className="text-base font-bold font-mono text-indigo-400">
                  {selectedBerth.operational_cranes} / {selectedBerth.crane_slots}
                </span>
              </div>
              <div className="p-3 bg-slate-800/70 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Quay Utilization</span>
                <span className="text-base font-bold font-mono text-emerald-400">{selectedBerth.utilization_pct}%</span>
              </div>
            </div>

            {/* Currently Berthed Vessel */}
            {selectedBerth.status === 'OCCUPIED' && (
              <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-800/40 space-y-2">
                <div className="text-xs font-bold text-blue-300 flex items-center justify-between">
                  <span>Currently Berthed Vessel</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300">Moored</span>
                </div>
                {selectedVessel ? (
                  <div className="text-xs space-y-1">
                    <div className="text-sm font-bold text-white">{selectedVessel.name}</div>
                    <div className="text-slate-400 flex flex-wrap gap-x-4">
                      <span>Class: <strong className="text-slate-200">{selectedVessel.vessel_class}</strong></span>
                      <span>TEU: <strong className="text-slate-200">{selectedVessel.cargo_volume.toLocaleString()}</strong></span>
                      <span>Draft: <strong className="text-blue-300">{selectedVessel.draft_m} m</strong></span>
                      <span>Length: <strong className="text-slate-200">{selectedVessel.length_m} m</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">Loading vessel telemetry...</div>
                )}
              </div>
            )}

            {/* Detailed 72-Hour Berth Congestion Timeline */}
            {(() => {
              const track = getBerthForecast(selectedBerth.id);
              if (!track) return null;
              return (
                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">72-Hour Congestion Heatstrip (Hour-by-Hour)</span>
                    <span className="text-slate-400 text-[11px]">Hover over block for occupancy probability</span>
                  </div>
                  <div className="grid grid-cols-12 gap-1 p-3 bg-slate-950 rounded-xl border border-slate-800">
                    {track.timeline.slice(0, 48).map((h) => (
                      <div
                        key={`grid-hour-${h.hour_offset}`}
                        className={`p-1 text-center rounded text-[9px] font-mono cursor-pointer transition ${
                          h.risk_tier === 'RED'
                            ? 'bg-rose-500/30 border border-rose-500/60 text-rose-300 hover:bg-rose-500/50'
                            : h.risk_tier === 'AMBER'
                            ? 'bg-amber-500/30 border border-amber-500/60 text-amber-300 hover:bg-amber-500/50'
                            : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/40'
                        }`}
                        title={`+${h.hour_offset}h: ${(h.occupancy_probability * 100).toFixed(0)}% occupancy (${h.risk_tier})`}
                      >
                        +{h.hour_offset}h
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Quick Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedBerth(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600 transition"
              >
                Close
              </button>
              {onOpenOverride && selectedBerth.status === 'OCCUPIED' && (
                <button
                  onClick={() => {
                    const bId = selectedBerth.id;
                    const vId = selectedVessel?.id;
                    setSelectedBerth(null);
                    onOpenOverride(vId, bId);
                  }}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition flex items-center gap-1.5"
                >
                  <span>🔀</span> Reassign / Manual Override
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
