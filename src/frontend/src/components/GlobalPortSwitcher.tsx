import React, { useState } from 'react';
import { Globe2, Wind, Waves, Gauge, ChevronDown, Check, ShieldCheck, AlertCircle } from 'lucide-react';

export interface PortTerminalSpec {
  id: string;
  name: string;
  country: string;
  flag: string;
  quayLengthM: number;
  draftLimitM: number;
  craneCount: number;
  anchorageCapacity: number;
  channelDepthM: number;
  liveWindKnots: number;
  liveWaveHeightM: number;
  liveTideHeightM: number;
  status: 'OPTIMAL' | 'MODERATE' | 'CAUTION';
}

export const PORT_TERMINALS: PortTerminalSpec[] = [
  {
    id: 'SG-TUAS',
    name: 'Singapore Tuas Gateway',
    country: 'Singapore',
    flag: '🇸🇬',
    quayLengthM: 480.0,
    draftLimitM: 17.0,
    craneCount: 5,
    anchorageCapacity: 40,
    channelDepthM: 21.0,
    liveWindKnots: 12.4,
    liveWaveHeightM: 0.8,
    liveTideHeightM: 2.6,
    status: 'OPTIMAL',
  },
  {
    id: 'NL-ROTTERDAM',
    name: 'Rotterdam World Gateway',
    country: 'Netherlands',
    flag: '🇳🇱',
    quayLengthM: 450.0,
    draftLimitM: 16.5,
    craneCount: 4,
    anchorageCapacity: 25,
    channelDepthM: 20.0,
    liveWindKnots: 18.2,
    liveWaveHeightM: 1.4,
    liveTideHeightM: 1.9,
    status: 'OPTIMAL',
  },
  {
    id: 'US-LA-400',
    name: 'Los Angeles Pier 400',
    country: 'United States',
    flag: '🇺🇸',
    quayLengthM: 440.0,
    draftLimitM: 16.0,
    craneCount: 4,
    anchorageCapacity: 30,
    channelDepthM: 18.5,
    liveWindKnots: 15.0,
    liveWaveHeightM: 1.1,
    liveTideHeightM: 1.5,
    status: 'OPTIMAL',
  },
  {
    id: 'IN-JNPA',
    name: 'Jawaharlal Nehru Port (JNPA)',
    country: 'India',
    flag: '🇮🇳',
    quayLengthM: 400.0,
    draftLimitM: 16.0,
    craneCount: 4,
    anchorageCapacity: 25,
    channelDepthM: 17.5,
    liveWindKnots: 22.5,
    liveWaveHeightM: 1.8,
    liveTideHeightM: 3.2,
    status: 'MODERATE',
  },
];

interface GlobalPortSwitcherProps {
  onSelectPort?: (port: PortTerminalSpec) => void;
}

export const GlobalPortSwitcher: React.FC<GlobalPortSwitcherProps> = ({ onSelectPort }) => {
  const [selectedPort, setSelectedPort] = useState<PortTerminalSpec>(PORT_TERMINALS[1]); // Default Rotterdam
  const [isOpen, setIsOpen] = useState(false);
  const [showTelemetryModal, setShowTelemetryModal] = useState(false);

  const handleSelect = (p: PortTerminalSpec) => {
    setSelectedPort(p);
    setIsOpen(false);
    if (onSelectPort) onSelectPort(p);
  };

  return (
    <div className="relative">
      <div className="flex items-center space-x-1.5">
        {/* Port selector trigger */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-surface-border bg-surface-bg/70 hover:bg-surface-hover text-content-primary text-xs font-semibold transition shadow-sm"
        >
          <Globe2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="text-sm">{selectedPort.flag}</span>
          <span className="font-bold hidden md:inline">{selectedPort.name}</span>
          <span className="font-bold md:hidden">{selectedPort.id}</span>
          <ChevronDown className="w-3 h-3 text-content-muted" />
        </button>

        {/* Live Marine Telemetry Pill */}
        <button
          type="button"
          onClick={() => setShowTelemetryModal(true)}
          className="hidden lg:flex items-center space-x-2 px-2.5 py-1 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-500 dark:text-cyan-300 border border-cyan-500/30 text-[11px] font-mono transition"
          title="Click to view full oceanographic telemetry HUD"
        >
          <Wind className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span>{selectedPort.liveWindKnots} kts</span>
          <span className="text-cyan-500/40">|</span>
          <Waves className="w-3 h-3 text-blue-400" />
          <span>{selectedPort.liveWaveHeightM}m</span>
          <span className="text-cyan-500/40">|</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] uppercase font-bold text-emerald-400">FAIRWAY CLEAR</span>
        </button>
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 w-72 rounded-2xl border border-surface-border bg-surface-card shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3 py-1.5 text-[10px] font-black uppercase text-content-muted tracking-wider border-b border-surface-border mb-1">
              Select Operating Container Terminal
            </div>
            {PORT_TERMINALS.map((p) => {
              const isSelected = p.id === selectedPort.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p)}
                  className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between text-xs ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                      : 'hover:bg-surface-hover text-content-primary'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="text-base">{p.flag}</span>
                    <div>
                      <p className="font-bold leading-tight">{p.name}</p>
                      <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-blue-100' : 'text-content-muted'}`}>
                        Quay: {p.quayLengthM}m · Draft: {p.draftLimitM}m · {p.craneCount} STS Cranes
                      </p>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Oceanographic Telemetry HUD Modal */}
      {showTelemetryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-surface-card border border-surface-border rounded-3xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xl">{selectedPort.flag}</span>
                <div>
                  <h4 className="text-sm font-black text-content-primary">{selectedPort.name}</h4>
                  <p className="text-[11px] text-content-muted">Real-Time NOAA / Open-Meteo Marine Telemetry HUD</p>
                </div>
              </div>
              <button
                onClick={() => setShowTelemetryModal(false)}
                className="p-1.5 rounded-lg text-content-muted hover:text-content-primary hover:bg-surface-hover transition"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-surface-bg border border-surface-border space-y-1">
                <div className="flex items-center space-x-1.5 text-cyan-400 font-bold">
                  <Wind className="w-4 h-4" />
                  <span>Surface Wind Speed</span>
                </div>
                <p className="text-lg font-black text-content-primary font-mono">{selectedPort.liveWindKnots} kts</p>
                <p className="text-[10px] text-content-muted">Beaufort Scale 4 (Moderate Breeze)</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-bg border border-surface-border space-y-1">
                <div className="flex items-center space-x-1.5 text-blue-400 font-bold">
                  <Waves className="w-4 h-4" />
                  <span>Significant Wave Swell</span>
                </div>
                <p className="text-lg font-black text-content-primary font-mono">{selectedPort.liveWaveHeightM} m</p>
                <p className="text-[10px] text-content-muted">Safe Fairway Pilotage Window</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-bg border border-surface-border space-y-1">
                <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                  <Gauge className="w-4 h-4" />
                  <span>Tidal Height (HAT)</span>
                </div>
                <p className="text-lg font-black text-content-primary font-mono">+{selectedPort.liveTideHeightM} m</p>
                <p className="text-[10px] text-content-muted">High Tide UKC Margin Guaranteed</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-bg border border-surface-border space-y-1">
                <div className="flex items-center space-x-1.5 text-purple-400 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Channel Depth</span>
                </div>
                <p className="text-lg font-black text-content-primary font-mono">{selectedPort.channelDepthM} m</p>
                <p className="text-[10px] text-content-muted">Permissible ULCV Draft to 17.5m</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-400 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                {selectedPort.status === 'OPTIMAL' ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                )}
                <span>Navigational Condition: <strong>{selectedPort.status} HARBOR OPERATIONS</strong></span>
              </span>
              <button
                type="button"
                onClick={() => setShowTelemetryModal(false)}
                className="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
