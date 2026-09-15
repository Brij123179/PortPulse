import React, { useState, useMemo } from 'react';
import { 
  Ship, 
  Compass, 
  CheckCircle2, 
  ArrowRight,
  Zap,
  Anchor,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface QuaysideSpatialMapProps {
  assignments: any[];
  selectedShift: number | 'ALL';
  onOpenOverrideModal: (vesselId?: string) => void;
}

// 10 Standard Berths configuration
const BERTHS_CONFIG = [
  { id: 'B-01', name: 'Berth 01 Quay', maxDraft: 16.5, length: 420, suitableFor: 'ULCV / Mega-Ships' },
  { id: 'B-02', name: 'Berth 02 Quay', maxDraft: 16.0, length: 400, suitableFor: 'ULCV / Post-Panamax' },
  { id: 'B-03', name: 'Berth 03 Quay', maxDraft: 15.5, length: 380, suitableFor: 'ULCV / Post-Panamax' },
  { id: 'B-04', name: 'Berth 04 Quay', maxDraft: 14.5, length: 350, suitableFor: 'Post-Panamax / Panamax' },
  { id: 'B-05', name: 'Berth 05 Quay', maxDraft: 14.0, length: 320, suitableFor: 'Panamax' },
  { id: 'B-06', name: 'Berth 06 Quay', maxDraft: 13.5, length: 300, suitableFor: 'Panamax / Feeder' },
  { id: 'B-07', name: 'Berth 07 Quay', maxDraft: 13.0, length: 280, suitableFor: 'Panamax / Feeder' },
  { id: 'B-08', name: 'Berth 08 Quay', maxDraft: 12.0, length: 240, suitableFor: 'Feeder' },
  { id: 'B-09', name: 'Berth 09 Quay', maxDraft: 11.5, length: 220, suitableFor: 'Feeder' },
  { id: 'B-10', name: 'Berth 10 Quay', maxDraft: 11.0, length: 200, suitableFor: 'Feeder' },
];

export const QuaysideSpatialMap: React.FC<QuaysideSpatialMapProps> = ({
  assignments,
  selectedShift,
  onOpenOverrideModal,
}) => {
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [anchoragePage, setAnchoragePage] = useState<number>(1);
  const ANCHORAGE_PER_PAGE = 4;
  const berthsConfig = BERTHS_CONFIG;

  // Map assignments to berths
  const berthMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    berthsConfig.forEach((b) => {
      map[b.id] = [];
    });
    (assignments || []).forEach((a) => {
      const bId = a?.assigned_berth_id;
      if (bId && map[bId]) {
        map[bId].push(a);
      }
    });
    return map;
  }, [assignments]);

  // Vessels with high wait times (held in queue/anchorage)
  const waitingVessels = useMemo(() => {
    return (assignments || [])
      .filter((a) => (a?.wait_time_hours ?? 0) > 0)
      .sort((a, b) => (b?.wait_time_hours ?? 0) - (a?.wait_time_hours ?? 0));
  }, [assignments]);

  const totalAnchoragePages = Math.max(1, Math.ceil((waitingVessels?.length || 0) / ANCHORAGE_PER_PAGE));
  const paginatedAnchorage = useMemo(() => {
    const start = (anchoragePage - 1) * ANCHORAGE_PER_PAGE;
    return (waitingVessels || []).slice(start, start + ANCHORAGE_PER_PAGE);
  }, [waitingVessels, anchoragePage]);

  const selectedVessel = useMemo(() => {
    if (!selectedVesselId) return null;
    return (assignments || []).find((a) => a?.vessel_id === selectedVesselId) || null;
  }, [selectedVesselId, assignments]);

  return (
    <div className="space-y-4">
      {/* Map Control Bar & Congestion Legend */}
      <div className="bg-slate-900 border border-slate-700/80 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold shadow-sm">
            🗺️
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center space-x-2.5">
              <span>72-Hour Quayside Spatial Harbor Board</span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-cyan-300 font-black border border-cyan-500/30 uppercase tracking-wider">
                {selectedShift === 'ALL' ? '72h Tactical Horizon' : `Shift ${selectedShift}`}
              </span>
            </h3>
            <p className="text-xs text-slate-300">
              Interactive quayside shoreline with active berths, crane allocations, anchorage holding basins, and live congestion tracking
            </p>
          </div>
        </div>

        {/* Congestion Color Legend */}
        <div className="flex items-center space-x-4 text-xs bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800 shadow-inner">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Congestion Status:</span>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            <span className="text-xs font-semibold text-emerald-300">Direct Berth (&le;1h)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
            <span className="text-xs font-semibold text-amber-300">Minor Queue (1–5h)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.7)] animate-pulse" />
            <span className="text-xs font-bold text-rose-300">Critical Congestion (&gt;5h)</span>
          </div>
        </div>
      </div>

      {/* Main Spatial Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Offshore Anchorage Basin (Queue of Congested / Waiting Ships) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Anchor className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                    Offshore Anchorage Basin
                  </h4>
                  <p className="text-[10px] text-slate-400">Waiting basin for delayed/queued arrivals</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${
                (waitingVessels?.length || 0) > 5
                  ? 'bg-rose-950/80 text-rose-300 border-rose-500/60 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.4)]'
                  : 'bg-amber-950/80 text-amber-300 border-amber-500/60'
              }`}>
                {waitingVessels?.length || 0} In Queue
              </span>
            </div>

            {(waitingVessels?.length || 0) === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic bg-slate-950/60 rounded-xl border border-dashed border-slate-800">
                ✅ Zero queue delays detected. All scheduled vessels assigned direct berthing windows.
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedAnchorage.map((v) => {
                  const isSelected = selectedVesselId === v.vessel_id;
                  const isSevere = v.wait_time_hours > 5;
                  return (
                    <div
                      key={v.vessel_id}
                      onClick={() => setSelectedVesselId(v.vessel_id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-cyan-400 bg-blue-950/70 shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-400'
                          : isSevere
                          ? 'border-rose-500/80 bg-rose-950/30 hover:border-rose-400 hover:bg-rose-950/50 shadow-md shadow-rose-950/40'
                          : 'border-amber-500/60 bg-amber-950/20 hover:border-amber-400 hover:bg-amber-950/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-extrabold text-xs text-white flex items-center space-x-2">
                          <Ship className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{v.vessel_name}</span>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md font-mono ${
                          isSevere
                            ? 'bg-rose-900/90 text-rose-200 border border-rose-500/60 shadow-sm'
                            : 'bg-amber-900/90 text-amber-200 border border-amber-500/60'
                        }`}>
                          +{(v.wait_time_hours ?? 0).toFixed(1)}h Delay
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-300 mt-2 flex items-center justify-between">
                        <span className="font-medium">{v.vessel_class} · {v.length_m}m · {v.draft_m}m draft</span>
                        <span className="font-mono text-rose-400 font-extrabold text-xs">
                          ${Math.round(v.demurrage_cost_usd).toLocaleString()}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800 flex items-center justify-between">
                        <span>Assigned Quay: <strong className="text-cyan-300 font-bold">{v.assigned_berth_name}</strong></span>
                        <span className="text-cyan-400 font-bold hover:underline flex items-center space-x-1">
                          <span>Inspect</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Pagination for Anchorage Queue */}
                {totalAnchoragePages > 1 && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                    <span className="text-slate-400 text-[11px]">
                      Page {anchoragePage} of {totalAnchoragePages} ({waitingVessels?.length || 0} total)
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        disabled={anchoragePage === 1}
                        onClick={() => setAnchoragePage(p => Math.max(1, p - 1))}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300"
                        title="Previous Queued Vessels"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={anchoragePage === totalAnchoragePages}
                        onClick={() => setAnchoragePage(p => Math.min(totalAnchoragePages, p + 1))}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300"
                        title="Next Queued Vessels"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Approach Fairway Channel Representation */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <div className="bg-gradient-to-r from-blue-950/60 to-cyan-950/60 border border-cyan-500/30 p-3.5 rounded-xl flex items-center justify-between text-xs text-cyan-300">
                <div className="flex items-center space-x-2.5">
                  <Compass className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '10s' }} />
                  <div>
                    <span className="font-bold block text-white text-xs">Inbound Fairway Channel</span>
                    <span className="text-[10px] text-slate-400">Deepwater Navigation Channel</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-[11px] font-semibold bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-500/30">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>Pilot Active</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Quayside Berth Dockline (Berths B-01 through B-10) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-800 mb-4 gap-2">
              <div>
                <h4 className="text-sm sm:text-base font-extrabold text-white flex items-center space-x-2">
                  <span>Terminal Shoreline &amp; Deepwater Quays</span>
                  <span className="text-xs text-slate-400 font-normal">(Berths B-01 through B-10)</span>
                </h4>
                <p className="text-xs text-slate-300">
                  Continuous quayside berths with depth clearance, STS crane gantries, and allocated carrier vessels
                </p>
              </div>
              <div className="text-xs font-mono text-slate-300 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
                Quay: <strong className="text-white">3,210m</strong> · Cranes: <strong className="text-amber-400">20 STS</strong>
              </div>
            </div>

            {/* Grid of 10 Berths */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {berthsConfig.map((b) => {
                const assigned = berthMap[b.id] || [];
                const currentVessel = assigned[0];
                const hasCongestion = currentVessel && currentVessel.wait_time_hours > 5;
                const hasModerate = currentVessel && currentVessel.wait_time_hours > 1 && currentVessel.wait_time_hours <= 5;
                const isSelected = currentVessel && selectedVesselId === currentVessel.vessel_id;

                let cardStyle = 'border-slate-700/70 bg-slate-800/60 hover:border-slate-600';
                if (isSelected) {
                  cardStyle = 'border-cyan-400 bg-blue-950/80 ring-2 ring-cyan-400 shadow-xl shadow-cyan-500/20';
                } else if (hasCongestion) {
                  cardStyle = 'border-rose-500 bg-rose-950/30 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/50';
                } else if (hasModerate) {
                  cardStyle = 'border-amber-500/70 bg-amber-950/20 ring-1 ring-amber-500/40';
                } else if (currentVessel) {
                  cardStyle = 'border-emerald-500/60 bg-emerald-950/20 ring-1 ring-emerald-500/40';
                }

                return (
                  <div
                    key={b.id}
                    className={`p-4 rounded-2xl border transition-all ${cardStyle}`}
                  >
                    {/* Berth Header */}
                    <div className="flex items-start justify-between pb-2.5 border-b border-slate-700/60">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-sm text-white">{b.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-950 border border-slate-700 text-slate-300 font-bold">
                            {b.id}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 mt-1 flex items-center space-x-2">
                          <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 font-bold border border-cyan-500/40 font-mono text-[11px]">
                            {b.maxDraft}m Depth
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="font-mono text-slate-200">{b.length}m Quay</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40 font-mono">
                          {currentVessel ? `${currentVessel.allocated_cranes} STS Cranes` : '2 Cranes Idle'}
                        </span>
                      </div>
                    </div>

                    {/* Berth Content: Docked Vessel or Available */}
                    <div className="mt-3">
                      {currentVessel ? (
                        <div 
                          onClick={() => setSelectedVesselId(currentVessel.vessel_id)}
                          className="cursor-pointer space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-extrabold text-sm text-white flex items-center space-x-1.5">
                              <Ship className="w-4 h-4 text-cyan-400" />
                              <span className="hover:text-cyan-300 transition">{currentVessel.vessel_name}</span>
                            </div>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              {currentVessel.vessel_class}
                            </span>
                          </div>

                          <div className="text-xs text-slate-300 flex items-center justify-between">
                            <span>{currentVessel.length_m}m LOA × {currentVessel.draft_m}m draft</span>
                            <span className={`font-mono text-xs font-black ${
                              hasCongestion
                                ? 'text-rose-400'
                                : hasModerate
                                ? 'text-amber-300'
                                : 'text-emerald-300'
                            }`}>
                              {(currentVessel.wait_time_hours ?? 0) > 0
                                ? `+${(currentVessel.wait_time_hours ?? 0).toFixed(1)}h Delay`
                                : 'Direct Berth (0h)'}
                            </span>
                          </div>

                          {/* Berthing Schedule Window */}
                          <div className="text-xs text-slate-300 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Window:</span>
                              <span className="font-semibold text-white">
                                {new Date(currentVessel.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })},{' '}
                                {new Date(currentVessel.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {' → '}
                                {new Date(currentVessel.end_time).toLocaleDateString([], { month: 'short', day: 'numeric' })},{' '}
                                {new Date(currentVessel.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {currentVessel.demurrage_cost_usd > 0 && (
                              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-rose-400 font-black text-xs font-mono">
                                <span>Demurrage Penalty:</span>
                                <span>${Math.round(currentVessel.demurrage_cost_usd).toLocaleString()}</span>
                              </div>
                            )}
                          </div>

                          {/* Action button */}
                          <div className="pt-1 flex items-center justify-between text-xs">
                            <span className="text-emerald-400 text-[11px] font-bold flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Draft &amp; Length Fit Cleared</span>
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenOverrideModal(currentVessel.vessel_id);
                              }}
                              className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
                            >
                              Reassign
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-5 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                          <span className="text-emerald-400 font-bold text-xs">● Berth Available</span>
                          <p className="text-[11px] text-slate-500 mt-1">Clear for incoming carrier assignment</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Selected Vessel Inspection Floating Bottom Drawer */}
      {selectedVessel && (
        <div className="sticky bottom-4 z-40 bg-slate-900 border-2 border-cyan-400/80 rounded-2xl p-5 shadow-2xl shadow-cyan-950/50 animate-in slide-in-from-bottom duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-800 gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Ship className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-white flex items-center space-x-2.5">
                  <span>Vessel Dossier: {selectedVessel.vessel_name}</span>
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-blue-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                    {selectedVessel.vessel_id} · {selectedVessel.vessel_class}
                  </span>
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Assigned Quay: <strong className="text-white font-bold">{selectedVessel.assigned_berth_name}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={() => onOpenOverrideModal(selectedVessel.vessel_id)}
                className="px-4 py-2 text-xs font-extrabold rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition shadow-lg shadow-blue-600/30 flex items-center space-x-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Reassign Quay / Schedule</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedVesselId(null)}
                className="text-slate-400 hover:text-white text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 transition"
                title="Dismiss Dossier"
              >
                ✕ Close
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-400 block text-[11px] uppercase font-bold tracking-wider">Dimensions &amp; Draft</span>
              <div className="font-extrabold text-white text-base mt-1 font-mono">
                {selectedVessel.length_m}m × {selectedVessel.draft_m}m
              </div>
              <span className="text-[11px] text-emerald-400 font-semibold mt-1 block">✓ Safe UKC margin verified</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-400 block text-[11px] uppercase font-bold tracking-wider">Expected Dwell</span>
              <div className="font-extrabold text-white text-base mt-1 font-mono">
                {(selectedVessel.expected_dwell_hours ?? 24).toFixed(1)} Hours
              </div>
              <span className="text-[11px] text-amber-300 font-semibold mt-1 block">{selectedVessel.allocated_cranes} STS Cranes Ganged</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-400 block text-[11px] uppercase font-bold tracking-wider">Predicted Wait Delay</span>
              <div className={`font-extrabold text-base mt-1 font-mono ${
                (selectedVessel.wait_time_hours ?? 0) > 5
                  ? 'text-rose-400'
                  : (selectedVessel.wait_time_hours ?? 0) > 0
                  ? 'text-amber-300'
                  : 'text-emerald-300'
              }`}>
                {(selectedVessel.wait_time_hours ?? 0) > 0 ? `+${(selectedVessel.wait_time_hours ?? 0).toFixed(1)} Hours` : '0.0h (Direct)'}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">GradientBoosting ML Forecast</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-400 block text-[11px] uppercase font-bold tracking-wider">Demurrage Liability</span>
              <div className={`font-extrabold text-base mt-1 font-mono ${
                selectedVessel.demurrage_cost_usd > 0 ? 'text-rose-400' : 'text-emerald-300'
              }`}>
                ${Math.round(selectedVessel.demurrage_cost_usd).toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">BIMCO 2025 Contractual Rate</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
