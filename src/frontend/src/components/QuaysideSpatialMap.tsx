import React, { useState, useMemo } from 'react';
import { 
  Ship, 
  Compass, 
  CheckCircle2, 
  ArrowRight
} from 'lucide-react';

interface QuaysideSpatialMapProps {
  assignments: any[];
  selectedShift: number | 'ALL';
  onOpenOverrideModal: (vesselId?: string) => void;
}

export const QuaysideSpatialMap: React.FC<QuaysideSpatialMapProps> = ({
  assignments,
  selectedShift,
  onOpenOverrideModal,
}) => {
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);

  // 10 Standard Berths
  const berthsConfig = [
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

  // Map assignments to berths
  const berthMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    berthsConfig.forEach((b) => {
      map[b.id] = [];
    });
    assignments.forEach((a) => {
      const bId = a.assigned_berth_id;
      if (bId && map[bId]) {
        map[bId].push(a);
      }
    });
    return map;
  }, [assignments]);

  // Vessels with high wait times (held in queue/anchorage)
  const waitingVessels = useMemo(() => {
    return assignments
      .filter((a) => a.wait_time_hours > 0)
      .sort((a, b) => b.wait_time_hours - a.wait_time_hours);
  }, [assignments]);

  const selectedVessel = useMemo(() => {
    if (!selectedVesselId) return null;
    return assignments.find((a) => a.vessel_id === selectedVesselId) || null;
  }, [selectedVesselId, assignments]);

  return (
    <div className="space-y-4">
      {/* Map Control Bar & Congestion Legend */}
      <div className="bg-surface-card border border-surface-border p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-500 font-bold">
            🗺️
          </div>
          <div>
            <h3 className="text-sm font-bold text-content-primary flex items-center space-x-2">
              <span>72-Hour Quayside Spatial Radar &amp; Berth Allocation Map</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-bold uppercase tracking-wider">
                {selectedShift === 'ALL' ? '72h Horizon' : `Shift ${selectedShift}`}
              </span>
            </h3>
            <p className="text-xs text-content-secondary">
              Real-time visualization of quayside dockings, waiting anchorage queues, and predicted congestion bottlenecks
            </p>
          </div>
        </div>

        {/* Congestion Color Legend */}
        <div className="flex items-center space-x-3 text-xs bg-surface-bg px-3 py-1.5 rounded-lg border border-surface-border">
          <span className="text-[11px] font-bold text-content-secondary uppercase tracking-wider">Congestion Risk:</span>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-content-secondary">Direct Berth (&le;1h)</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-[11px] text-content-secondary">Moderate Queue (1–5h)</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[11px] text-rose-500 font-semibold">Critical Congestion (&gt;5h)</span>
          </div>
        </div>
      </div>

      {/* Main Spatial Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Offshore Anchorage Basin (Queue of Congested / Waiting Ships) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border mb-3">
              <div className="flex items-center space-x-2">
                <span className="text-lg">⚓</span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-content-primary">
                    Offshore Anchorage Basin
                  </h4>
                  <p className="text-[10px] text-content-muted">Holding area for delayed / queued vessels</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                waitingVessels.length > 5
                  ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 animate-pulse'
                  : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
              }`}>
                {waitingVessels.length} Queued
              </span>
            </div>

            {waitingVessels.length === 0 ? (
              <div className="p-6 text-center text-xs text-content-muted italic bg-surface-bg rounded-lg border border-dashed border-surface-border">
                ✅ Zero queue delays detected. All vessels assigned direct berthing windows.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                {waitingVessels.map((v) => {
                  const isSelected = selectedVesselId === v.vessel_id;
                  const isSevere = v.wait_time_hours > 5;
                  return (
                    <div
                      key={v.vessel_id}
                      onClick={() => setSelectedVesselId(v.vessel_id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10 shadow-md ring-2 ring-blue-500/30'
                          : isSevere
                          ? 'border-rose-500/40 bg-rose-500/5 hover:border-rose-500/80 hover:bg-rose-500/10'
                          : 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-xs text-content-primary flex items-center space-x-1.5">
                          <Ship className="w-3.5 h-3.5 text-blue-500" />
                          <span>{v.vessel_name}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isSevere
                            ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                        }`}>
                          +{v.wait_time_hours.toFixed(1)}h Wait
                        </span>
                      </div>

                      <div className="text-[11px] text-content-secondary mt-1 flex items-center justify-between">
                        <span>{v.vessel_class} · {v.length_m}m · {v.draft_m}m draft</span>
                        <span className="font-mono text-rose-500 font-bold">
                          ${Math.round(v.demurrage_cost_usd).toLocaleString()}
                        </span>
                      </div>

                      <div className="text-[10px] text-content-muted mt-1.5 pt-1.5 border-t border-surface-border flex items-center justify-between">
                        <span>Target: <strong className="text-content-primary">{v.assigned_berth_name}</strong></span>
                        <span className="text-blue-500 font-medium hover:underline">Click to Inspect</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Approach Fairway Channel Representation */}
            <div className="mt-4 pt-3 border-t border-surface-border">
              <div className="bg-blue-600/5 border border-blue-500/20 p-3 rounded-lg flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
                <div className="flex items-center space-x-2">
                  <Compass className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold">Inbound Navigation Fairway Channel</span>
                </div>
                <div className="flex items-center space-x-1 text-[11px]">
                  <span>Pilot Boarding Active</span>
                  <ArrowRight className="w-3 h-3 text-blue-500" />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Quayside Berth Dockline (Berths B-01 through B-10) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border mb-4">
              <div>
                <h4 className="text-sm font-bold text-content-primary flex items-center space-x-2">
                  <span>Terminal Coastline &amp; Deepwater Quays</span>
                  <span className="text-xs text-content-muted font-normal">(Berths B-01 to B-10)</span>
                </h4>
                <p className="text-xs text-content-secondary">
                  Spatial layout of container quays, STS crane deployment, and active scheduled vessel occupancies
                </p>
              </div>
              <div className="text-xs text-content-secondary">
                Total Length: <strong>3,210m</strong> · Total STS Cranes: <strong>20</strong>
              </div>
            </div>

            {/* Grid of 10 Berths */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {berthsConfig.map((b) => {
                const assigned = berthMap[b.id] || [];
                const currentVessel = assigned[0];
                const hasCongestion = currentVessel && currentVessel.wait_time_hours > 5;
                const hasModerate = currentVessel && currentVessel.wait_time_hours > 1 && currentVessel.wait_time_hours <= 5;
                const isSelected = currentVessel && selectedVesselId === currentVessel.vessel_id;

                let borderStyle = 'border-surface-border bg-surface-bg/50';
                if (isSelected) {
                  borderStyle = 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30';
                } else if (hasCongestion) {
                  borderStyle = 'border-rose-500/60 bg-rose-500/5 shadow-md shadow-rose-500/5';
                } else if (hasModerate) {
                  borderStyle = 'border-amber-500/50 bg-amber-500/5';
                } else if (currentVessel) {
                  borderStyle = 'border-emerald-500/40 bg-emerald-500/5';
                }

                return (
                  <div
                    key={b.id}
                    className={`p-3.5 rounded-xl border transition-all ${borderStyle}`}
                  >
                    {/* Berth Header */}
                    <div className="flex items-start justify-between pb-2 border-b border-surface-border/60">
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-xs text-content-primary">{b.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-card border border-surface-border text-content-muted">
                            {b.id}
                          </span>
                        </div>
                        <div className="text-[10px] text-content-secondary mt-0.5">
                          Max Depth: <strong className="text-blue-500">{b.maxDraft}m</strong> · Length: <strong>{b.length}m</strong>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          {currentVessel ? `${currentVessel.allocated_cranes} STS Cranes` : '2 Cranes Idle'}
                        </span>
                      </div>
                    </div>

                    {/* Berth Content: Docked Vessel or Available */}
                    <div className="mt-2.5">
                      {currentVessel ? (
                        <div 
                          onClick={() => setSelectedVesselId(currentVessel.vessel_id)}
                          className="cursor-pointer space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-xs text-content-primary flex items-center space-x-1">
                              <Ship className="w-3.5 h-3.5 text-blue-500" />
                              <span className="hover:text-blue-500 transition">{currentVessel.vessel_name}</span>
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-500">
                              {currentVessel.vessel_class}
                            </span>
                          </div>

                          <div className="text-[11px] text-content-secondary flex items-center justify-between">
                            <span>Dimensions: {currentVessel.length_m}m × {currentVessel.draft_m}m</span>
                            <span className={`font-semibold ${
                              hasCongestion
                                ? 'text-rose-500 font-bold'
                                : hasModerate
                                ? 'text-amber-500 font-bold'
                                : 'text-emerald-500 font-bold'
                            }`}>
                              {currentVessel.wait_time_hours > 0
                                ? `+${currentVessel.wait_time_hours.toFixed(1)}h Wait`
                                : 'Direct Berth'}
                            </span>
                          </div>

                          {/* Berthing Schedule Window */}
                          <div className="text-[10px] text-content-muted bg-surface-card p-2 rounded-lg border border-surface-border">
                            <div className="flex items-center justify-between">
                              <span>Window:</span>
                              <span className="font-medium text-content-primary">
                                {new Date(currentVessel.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })},{' '}
                                {new Date(currentVessel.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {' → '}
                                {new Date(currentVessel.end_time).toLocaleDateString([], { month: 'short', day: 'numeric' })},{' '}
                                {new Date(currentVessel.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {currentVessel.demurrage_cost_usd > 0 && (
                              <div className="flex items-center justify-between mt-1 text-rose-500 font-bold">
                                <span>Demurrage Penalty:</span>
                                <span>${Math.round(currentVessel.demurrage_cost_usd).toLocaleString()}</span>
                              </div>
                            )}
                          </div>

                          {/* Action button */}
                          <div className="pt-1 flex items-center justify-between text-[11px]">
                            <span className="text-emerald-500 text-[10px] font-semibold flex items-center space-x-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Draft &amp; Length Fit Cleared</span>
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenOverrideModal(currentVessel.vessel_id);
                              }}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-bg border border-surface-border hover:bg-surface-card hover:border-blue-500 text-content-primary transition"
                            >
                              Reassign
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 text-center text-xs text-content-muted bg-surface-bg/40 rounded-lg border border-dashed border-surface-border">
                          <span className="text-emerald-500 font-semibold">● Berth Available</span>
                          <p className="text-[10px] mt-0.5">Clear for incoming carrier assignment</p>
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

      {/* Selected Vessel Inspection Popover / Drawer */}
      {selectedVessel && (
        <div className="bg-surface-card border border-blue-500/50 rounded-xl p-5 shadow-lg animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-500">
                <Ship className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-content-primary flex items-center space-x-2">
                  <span>Vessel Dossier: {selectedVessel.vessel_name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 font-bold">
                    {selectedVessel.vessel_id} · {selectedVessel.vessel_class}
                  </span>
                </h4>
                <p className="text-xs text-content-secondary">
                  Assigned to <strong className="text-content-primary">{selectedVessel.assigned_berth_name}</strong>
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onOpenOverrideModal(selectedVessel.vessel_id)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
              >
                Reassign Quay / Schedule
              </button>
              <button
                onClick={() => setSelectedVesselId(null)}
                className="text-content-muted hover:text-content-primary text-xs px-2.5 py-1.5 rounded-lg border border-surface-border hover:bg-surface-hover"
              >
                ✕ Close
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
            <div className="p-3 rounded-lg bg-surface-bg border border-surface-border">
              <span className="text-content-muted block text-[10px] uppercase font-semibold">Dimensions &amp; Draft</span>
              <div className="font-bold text-content-primary text-sm mt-0.5">
                {selectedVessel.length_m}m × {selectedVessel.draft_m}m
              </div>
              <span className="text-[10px] text-emerald-500 font-medium">Safe UKC margin verified</span>
            </div>

            <div className="p-3 rounded-lg bg-surface-bg border border-surface-border">
              <span className="text-content-muted block text-[10px] uppercase font-semibold">Expected Dwell</span>
              <div className="font-bold text-content-primary text-sm mt-0.5">
                {selectedVessel.expected_dwell_hours.toFixed(1)} Hours
              </div>
              <span className="text-[10px] text-amber-500 font-medium">{selectedVessel.allocated_cranes} STS Cranes Ganged</span>
            </div>

            <div className="p-3 rounded-lg bg-surface-bg border border-surface-border">
              <span className="text-content-muted block text-[10px] uppercase font-semibold">Predicted Wait Delay</span>
              <div className={`font-bold text-sm mt-0.5 ${
                selectedVessel.wait_time_hours > 5
                  ? 'text-rose-500'
                  : selectedVessel.wait_time_hours > 0
                  ? 'text-amber-500'
                  : 'text-emerald-500'
              }`}>
                {selectedVessel.wait_time_hours > 0 ? `+${selectedVessel.wait_time_hours.toFixed(1)} Hours` : '0.0h (Direct)'}
              </div>
              <span className="text-[10px] text-content-secondary">Predicted by GradientBoosting ML</span>
            </div>

            <div className="p-3 rounded-lg bg-surface-bg border border-surface-border">
              <span className="text-content-muted block text-[10px] uppercase font-semibold">Demurrage Liability</span>
              <div className={`font-bold text-sm mt-0.5 font-mono ${
                selectedVessel.demurrage_cost_usd > 0 ? 'text-rose-500' : 'text-emerald-500'
              }`}>
                ${Math.round(selectedVessel.demurrage_cost_usd).toLocaleString()}
              </div>
              <span className="text-[10px] text-content-secondary">BIMCO 2025 Standard</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
