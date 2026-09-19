import React, { useState, useMemo } from 'react';
import {
  VesselStatusItem,
  BerthStatusItem,
  VesselDelayShockResponse,
  VesselDelayShockRequest,
  api
} from '../api/client';
import {
  Zap,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Ship,
  Compass,
  RotateCcw
} from 'lucide-react';

interface VesselDelayShockSimulatorProps {
  vessels?: VesselStatusItem[];
  berths?: BerthStatusItem[];
  onRefresh?: () => void;
  userRole?: string;
}

const PRESET_DELAYS = [
  { label: '+4 Hours', hours: 4 },
  { label: '+8 Hours', hours: 8 },
  { label: '+12 Hours', hours: 12 },
  { label: '+24 Hours', hours: 24 },
  { label: '+48 Hours', hours: 48 },
];

const DISRUPTION_REASONS = [
  { value: 'ENGINE_BREAKDOWN', label: '⚙️ Mechanical / Engine Failure' },
  { value: 'SEVERE_WEATHER', label: '🌊 Severe Weather / Rough Seas' },
  { value: 'CUSTOMS_HOLD', label: '📋 Customs & Regulatory Inspection' },
  { value: 'BUNKER_DELAY', label: '⛽ Bunker Fueling & Supply Delay' },
  { value: 'PILOT_SHORTAGE', label: '🧑‍✈️ Harbor Pilot / Tugboat Unavailability' },
  { value: 'FAIRWAY_CONGESTION', label: '⚓ Fairway Approach Channel Traffic' },
];

export const VesselDelayShockSimulator: React.FC<VesselDelayShockSimulatorProps> = ({
  vessels = [],
  berths: _berths = [],
  onRefresh: _onRefresh,
  userRole: _userRole
}) => {
  // Candidate vessels in the port system
  const candidateVessels = useMemo(() => {
    return vessels.filter(v => v.status !== 'DEPARTED');
  }, [vessels]);

  // User input fields
  const [vesselNameInput, setVesselNameInput] = useState<string>(
    candidateVessels[0]?.name || 'Ever Given'
  );
  const [delayHoursInput, setDelayHoursInput] = useState<string>('12');
  const [disruptionReason, setDisruptionReason] = useState<string>('ENGINE_BREAKDOWN');

  // Simulation state
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<VesselDelayShockResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter for affected vessels table
  const [manifestFilter, setManifestFilter] = useState<'ALL' | 'COLLATERAL' | 'PRIMARY'>('ALL');

  // Find vessel object matching input if available
  const matchedVessel = useMemo(() => {
    if (!vesselNameInput.trim()) return null;
    const lower = vesselNameInput.trim().toLowerCase();
    return candidateVessels.find(
      v => v.name.toLowerCase() === lower || v.id.toLowerCase() === lower || v.name.toLowerCase().includes(lower)
    ) || null;
  }, [candidateVessels, vesselNameInput]);

  // Run the sandbox simulation (NEVER modifies live database or predictions)
  const handleRunSimulation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!vesselNameInput.trim()) {
      setErrorMessage('Please enter a vessel name to simulate.');
      return;
    }

    const hours = parseFloat(delayHoursInput);
    if (isNaN(hours) || hours <= 0) {
      setErrorMessage('Please enter a valid positive number of delay hours (e.g., 6, 12, 24).');
      return;
    }

    try {
      setSimulating(true);
      setErrorMessage(null);

      const payload: VesselDelayShockRequest = {
        vessel_name: vesselNameInput.trim(),
        delay_hours: hours,
        delay_cause: disruptionReason,
        apply_to_database: false, // PURE SANDBOX SIMULATION - does not touch live predictions
      };

      const res = await api.simulateVesselDelayShock(payload);
      setSimulationResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Simulation error. Please check the vessel name.');
    } finally {
      setSimulating(false);
    }
  };

  const handleReset = () => {
    setSimulationResult(null);
    setErrorMessage(null);
    setVesselNameInput(candidateVessels[0]?.name || 'Ever Given');
    setDelayHoursInput('12');
  };

  const filteredAffectedVessels = useMemo(() => {
    if (!simulationResult) return [];
    if (manifestFilter === 'PRIMARY') {
      return simulationResult.affected_vessels.filter(v => v.impact_category === 'PRIMARY_SHOCK');
    }
    if (manifestFilter === 'COLLATERAL') {
      return simulationResult.affected_vessels.filter(v => v.impact_category !== 'PRIMARY_SHOCK');
    }
    return simulationResult.affected_vessels;
  }, [simulationResult, manifestFilter]);

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Simulation Sandbox Notice Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-indigo-500/10 border border-blue-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start sm:items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-500 flex items-center justify-center flex-shrink-0 shadow-inner">
            <Compass className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Pure Sandbox Simulation Mode
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Active Operations Unaffected
              </span>
            </div>
            <p className="text-xs sm:text-sm text-content-secondary leading-relaxed">
              Input a hypothetical vessel delay to predict downstream port congestion, monetary damages, and fleet chain impacts in advance so you can formulate proactive rerouting strategies.
            </p>
          </div>
        </div>

        {candidateVessels.length > 0 && (
          <span className="text-xs font-semibold text-content-muted whitespace-nowrap self-start md:self-center bg-surface-card px-3.5 py-2 rounded-xl border border-surface-border shadow-xs">
            🚢 <strong className="text-content-primary font-bold">{candidateVessels.length}</strong> Active Fleet Ships
          </span>
        )}
      </div>

      {/* INPUT FORM: Ask user for Vessel Name and Delay Hours */}
      <div className="bg-surface-card border border-surface-border p-6 sm:p-8 rounded-3xl shadow-sm space-y-7">
        <div className="border-b border-surface-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center font-bold text-sm">
              ✏️
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10px] tracking-wider uppercase border border-purple-500/20">
                  SECTION: Delay Shock Parameters &amp; Inputs
                </span>
              </div>
              <h3 className="text-base font-extrabold text-content-primary tracking-tight mt-1">
                Configure Target Vessel &amp; Simulated Delay Hours
              </h3>
              <p className="text-xs text-content-secondary mt-0.5">
                <strong className="text-content-primary">Purpose:</strong> Choose any vessel in the port system and specify a hypothetical delay duration (hours) and disruption cause to test how downstream operations and other vessels are impacted.
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-content-muted self-start sm:self-center bg-surface-bg px-3 py-1 rounded-lg border border-surface-border">
            Risk-Free Scenario Mode
          </span>
        </div>

        <form onSubmit={handleRunSimulation} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">
            {/* Input 1: Vessel Name */}
            <div className="md:col-span-5 space-y-2">
              <label htmlFor="vessel-name-input" className="text-xs sm:text-sm font-bold text-content-primary flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <Ship className="w-4 h-4 text-purple-500" />
                  <span>Vessel Name (Input):</span>
                </span>
                {matchedVessel && (
                  <span className="text-[11px] font-bold text-emerald-500 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Matched in fleet</span>
                  </span>
                )}
              </label>

              <div className="relative">
                <input
                  id="vessel-name-input"
                  type="text"
                  list="vessel-suggestions"
                  value={vesselNameInput}
                  onChange={(e) => setVesselNameInput(e.target.value)}
                  placeholder="e.g., Ever Given, Maersk Mc-Kinney Moller, MSC Oscar..."
                  className="w-full px-4 py-3 text-sm font-semibold rounded-xl bg-surface-bg border border-surface-border text-content-primary placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition shadow-xs"
                  required
                />
                <datalist id="vessel-suggestions">
                  {candidateVessels.map(v => (
                    <option key={v.id} value={v.name}>
                      {v.name} ({v.vessel_class} • {v.id})
                    </option>
                  ))}
                </datalist>
              </div>

              {/* Quick suggestion chips */}
              <div className="pt-2">
                <span className="text-[11px] font-medium text-content-muted block mb-1.5">
                  Quick select from current harbor fleet:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {candidateVessels.slice(0, 5).map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVesselNameInput(v.name)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                        vesselNameInput === v.name
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm font-bold'
                          : 'bg-surface-bg border-surface-border text-content-secondary hover:text-content-primary hover:border-surface-hover'
                      }`}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Input 2: Delay Hours */}
            <div className="md:col-span-4 space-y-2">
              <label htmlFor="delay-hours-input" className="text-xs sm:text-sm font-bold text-content-primary flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>Delay Time (Hours):</span>
                </span>
                <span className="text-sm font-extrabold text-amber-500 font-mono">
                  +{delayHoursInput || '0'} hrs
                </span>
              </label>

              <div className="relative">
                <input
                  id="delay-hours-input"
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="168"
                  value={delayHoursInput}
                  onChange={(e) => setDelayHoursInput(e.target.value)}
                  placeholder="e.g., 6, 12, 24"
                  className="w-full px-4 py-3 text-sm font-bold rounded-xl bg-surface-bg border border-surface-border text-content-primary placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition shadow-xs"
                  required
                />
              </div>

              {/* Quick preset buttons */}
              <div className="pt-2">
                <span className="text-[11px] font-medium text-content-muted block mb-1.5">
                  Preset delay increments:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_DELAYS.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setDelayHoursInput(String(p.hours))}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        delayHoursInput === String(p.hours)
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm font-bold'
                          : 'bg-surface-bg border-surface-border text-content-secondary hover:text-content-primary hover:border-surface-hover'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Input 3: Disruption Cause */}
            <div className="md:col-span-3 space-y-2">
              <label htmlFor="disruption-reason-select" className="text-xs sm:text-sm font-bold text-content-primary flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>Disruption Scenario:</span>
              </label>

              <select
                id="disruption-reason-select"
                value={disruptionReason}
                onChange={(e) => setDisruptionReason(e.target.value)}
                className="w-full px-4 py-3 text-sm font-medium rounded-xl bg-surface-bg border border-surface-border text-content-primary focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition cursor-pointer shadow-xs"
              >
                {DISRUPTION_REASONS.map(r => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>

              <p className="text-[11px] text-content-muted pt-1.5 leading-relaxed">
                Calibrates charter demurrage multipliers and priority resequencing.
              </p>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-surface-border mt-6">
            <div className="text-xs sm:text-sm text-content-muted flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>Simulation runs non-destructively. Production data remains 100% intact.</span>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              {simulationResult && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-surface-border bg-surface-bg hover:bg-surface-hover text-content-secondary transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </button>
              )}

              <button
                type="submit"
                disabled={simulating}
                className="flex-1 sm:flex-initial px-6 py-3 text-xs sm:text-sm font-extrabold rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/25 transition flex items-center justify-center space-x-2.5 disabled:opacity-50 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>{simulating ? 'Simulating Cascade Impacts...' : '⚡ Predict System Delay Impact'}</span>
              </button>
            </div>
          </div>
        </form>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-semibold flex items-center space-x-2.5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* SEPARATELY DISPLAYED SIMULATION OUTPUTS */}
      {simulationResult && (
        <div className="space-y-10 sm:space-y-12 animate-in fade-in duration-200">
          {/* Output Header Status Bar */}
          <div className="p-5 sm:p-6 rounded-2xl bg-surface-card border border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                <span className="text-sm sm:text-base font-extrabold text-content-primary">
                  Simulation Outcome: <span className="text-purple-600 dark:text-purple-400">{simulationResult.target_vessel.name}</span> delayed by <span className="text-amber-500">+{simulationResult.target_vessel.delay_hours} hours</span>
                </span>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider ${
                  simulationResult.summary_impact.severity === 'CRITICAL'
                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                }`}>
                  {simulationResult.summary_impact.severity} DISRUPTION
                </span>
              </div>
              <p className="text-xs sm:text-sm text-content-secondary">
                Scenario Cause: <strong>{simulationResult.delay_cause}</strong> • Target Berth: <strong>{simulationResult.target_vessel.assigned_berth_name || 'Berth TBD'}</strong> • Fleet Alliance: <strong>{simulationResult.target_vessel.fleet}</strong>
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs px-3 py-1.5 rounded-xl bg-surface-bg border border-surface-border text-content-muted font-mono">
                Correlation: {simulationResult.correlation_id}
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEPARATION 1: TOTAL SYSTEM IMPACT (OVERVIEW)                              */}
          {/* ========================================================================= */}
          <div className="bg-surface-card border border-surface-border p-6 sm:p-8 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center space-x-3 pb-3 border-b border-surface-border">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center font-bold text-sm">
                🌐
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] tracking-wider uppercase border border-indigo-500/20">
                    SECTION 1: Total System Impact Summary
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-extrabold text-content-primary tracking-tight mt-1">
                  High-Level Port Damage &amp; Disruption Summary
                </h4>
                <p className="text-xs text-content-secondary mt-0.5">
                  <strong className="text-content-primary">Purpose:</strong> Provides an aggregated macro overview of total financial losses, delay hours accumulated across the harbor, collateral ships impacted, and shipping alliances disrupted.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 pt-1">
              <div className="p-5 sm:p-6 rounded-2xl border border-rose-500/30 bg-rose-500/5 space-y-2 hover:shadow-md transition">
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                  Total Financial Damages
                </span>
                <div className="text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                  ${Math.round(simulationResult.summary_impact.total_monetary_damages_usd).toLocaleString()}
                </div>
                <span className="text-xs text-content-secondary block pt-1 border-t border-rose-500/20">
                  Demurrage + Bunker + Berth Overhead
                </span>
              </div>

              <div className="p-5 sm:p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-2 hover:shadow-md transition">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                  Total System Delay Incurred
                </span>
                <div className="text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                  +{simulationResult.summary_impact.total_additional_wait_hours.toFixed(1)} hrs
                </div>
                <span className="text-xs text-content-secondary block pt-1 border-t border-amber-500/20">
                  Cumulated across all waiting ships
                </span>
              </div>

              <div className="p-5 sm:p-6 rounded-2xl border border-purple-500/30 bg-purple-500/5 space-y-2 hover:shadow-md transition">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
                  Vessels Affected in Cascade
                </span>
                <div className="text-3xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
                  {simulationResult.summary_impact.total_vessels_affected} ships
                </div>
                <span className="text-xs text-content-secondary block pt-1 border-t border-purple-500/20">
                  1 Target + {simulationResult.summary_impact.total_vessels_affected - 1} Collateral Ships
                </span>
              </div>

              <div className="p-5 sm:p-6 rounded-2xl border border-blue-500/30 bg-blue-500/5 space-y-2 hover:shadow-md transition">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                  Fleets / Alliances Disrupted
                </span>
                <div className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                  {simulationResult.summary_impact.total_fleets_affected} alliances
                </div>
                <span className="text-xs text-content-secondary block pt-1 border-t border-blue-500/20">
                  Cross-fleet commercial ripple
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEPARATION 2 & 3: TIME DAMAGES & MONETARY DAMAGES (SIDE-BY-SIDE SEPARATED)*/}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* SEPARATION 2: Time Damages Caused & Time Delays */}
            <div className="bg-surface-card border border-surface-border p-6 sm:p-8 rounded-3xl shadow-sm space-y-6">
              <div className="flex items-center space-x-3 pb-3 border-b border-surface-border">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-sm">
                  ⏱️
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px] tracking-wider uppercase border border-amber-500/20">
                      SECTION 2: Temporal &amp; Operational Impact
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-extrabold text-content-primary tracking-tight mt-1">
                    Time Damages &amp; Port Delay Details
                  </h4>
                  <p className="text-xs text-content-secondary mt-0.5">
                    <strong className="text-content-primary">Purpose:</strong> Measures operational wait time spikes, isolates primary vessel delays from secondary ripple delays, and estimates the harbor stabilization horizon.
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-xs sm:text-sm">
                <div className="p-4 rounded-xl bg-surface-bg/80 border border-surface-border/70 flex items-center justify-between">
                  <span className="text-content-secondary">Harbor Average Vessel Wait Time:</span>
                  <span className="font-extrabold text-content-primary font-mono text-sm">
                    {simulationResult.summary_impact.baseline_avg_wait_hours}h ➔{' '}
                    <strong className="text-amber-500 font-black">{simulationResult.summary_impact.simulated_avg_wait_hours}h</strong>
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-surface-bg/80 border border-surface-border/70 flex items-center justify-between">
                  <span className="text-content-secondary">Average Wait Spike per Vessel:</span>
                  <span className="font-extrabold text-amber-500 font-mono text-sm">
                    +{simulationResult.summary_impact.port_average_wait_spike_hours} hours
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-surface-bg/80 border border-surface-border/70 flex items-center justify-between">
                  <span className="text-content-secondary">Direct Delay on Target Vessel:</span>
                  <span className="font-extrabold text-content-primary font-mono text-sm">
                    +{simulationResult.target_vessel.delay_hours} hours
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-surface-bg/80 border border-surface-border/70 flex items-center justify-between">
                  <span className="text-content-secondary">Secondary Ripple Delay on Other Ships:</span>
                  <span className="font-extrabold text-amber-500 font-mono text-sm">
                    +{(simulationResult.summary_impact.total_additional_wait_hours - simulationResult.target_vessel.delay_hours).toFixed(1)} hours
                  </span>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                  <span className="text-amber-600 dark:text-amber-400 font-bold">Estimated Port Stabilization Horizon:</span>
                  <span className="font-black text-amber-600 dark:text-amber-400 font-mono text-sm sm:text-base">
                    ~{simulationResult.summary_impact.recovery_horizon_hours} hours until recovery
                  </span>
                </div>
              </div>
            </div>

            {/* SEPARATION 3: Monetary Damages Caused */}
            <div className="bg-surface-card border border-surface-border p-6 sm:p-8 rounded-3xl shadow-sm space-y-6">
              <div className="flex items-center space-x-3 pb-3 border-b border-surface-border">
                <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center font-bold text-sm">
                  💰
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-[10px] tracking-wider uppercase border border-rose-500/20">
                      SECTION 3: Monetary &amp; Financial Cost Ledger
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-extrabold text-content-primary tracking-tight mt-1">
                    Monetary Damages &amp; Cost Breakdown
                  </h4>
                  <p className="text-xs text-content-secondary mt-0.5">
                    <strong className="text-content-primary">Purpose:</strong> Itemizes contractual demurrage fines, idling auxiliary bunker fuel expenditures, excess CO2 emissions, and quayside overhead losses.
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-xs sm:text-sm">
                <div className="p-4 rounded-xl bg-surface-bg/80 border border-surface-border/70 flex items-center justify-between">
                  <div>
                    <span className="text-content-primary font-bold block">Contractual Demurrage Fines</span>
                    <span className="text-[11px] text-content-muted">Based on charterparty rates by vessel class</span>
                  </div>
                  <span className="font-black text-rose-500 font-mono text-base">
                    ${Math.round(simulationResult.summary_impact.demurrage_damages_usd).toLocaleString()} USD
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-surface-bg/80 border border-surface-border/70 flex items-center justify-between">
                  <div>
                    <span className="text-content-primary font-bold block">Idling Bunker Fuel Waste</span>
                    <span className="text-[11px] text-content-muted">Auxiliary generator fuel at anchor ($650/mt)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-rose-500 font-mono text-base block">
                      ${Math.round(simulationResult.summary_impact.bunker_waste_usd).toLocaleString()} USD
                    </span>
                    <span className="text-[11px] text-content-muted">
                      ({simulationResult.summary_impact.co2_excess_tonnes} tonnes CO2)
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-surface-bg/80 border border-surface-border/70 flex items-center justify-between">
                  <div>
                    <span className="text-content-primary font-bold block">Quayside Disruption &amp; Replanning</span>
                    <span className="text-[11px] text-content-muted">Pilot dispatch, crane idling, gate re-routing</span>
                  </div>
                  <span className="font-black text-rose-500 font-mono text-base">
                    ${Math.round(simulationResult.summary_impact.berth_disruption_cost_usd).toLocaleString()} USD
                  </span>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
                  <span className="text-rose-600 dark:text-rose-400 font-extrabold text-xs sm:text-sm">Total Predicted Financial Loss:</span>
                  <span className="font-black text-rose-600 dark:text-rose-400 font-mono text-base sm:text-lg">
                    ${Math.round(simulationResult.summary_impact.total_monetary_damages_usd).toLocaleString()} USD
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEPARATION 4: AFFECTED VESSELS SPECIFICATION                              */}
          {/* ========================================================================= */}
          <div className="bg-surface-card border border-surface-border p-6 sm:p-8 rounded-3xl shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-surface-border">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center font-bold text-sm">
                  🚢
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10px] tracking-wider uppercase border border-purple-500/20">
                      SECTION 4: Affected Vessels Manifest
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-extrabold text-content-primary tracking-tight mt-1">
                    Quayside Domino Cascade &amp; Affected Vessel Ledger ({simulationResult.affected_vessels.length} Ships)
                  </h4>
                  <p className="text-xs text-content-secondary mt-0.5">
                    <strong className="text-content-primary">Purpose:</strong> Lists each vessel directly or collaterally delayed by the primary shock, identifying affected berths, delayed arrival windows, and individual demurrage liabilities.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1.5 bg-surface-bg p-1.5 rounded-xl border border-surface-border text-xs">
                <button
                  type="button"
                  onClick={() => setManifestFilter('ALL')}
                  className={`px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    manifestFilter === 'ALL'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-content-secondary hover:text-content-primary'
                  }`}
                >
                  All Ships ({simulationResult.affected_vessels.length})
                </button>
                <button
                  type="button"
                  onClick={() => setManifestFilter('COLLATERAL')}
                  className={`px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    manifestFilter === 'COLLATERAL'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-content-secondary hover:text-content-primary'
                  }`}
                >
                  Collateral Ships ({simulationResult.affected_vessels.filter(v => v.impact_category !== 'PRIMARY_SHOCK').length})
                </button>
                <button
                  type="button"
                  onClick={() => setManifestFilter('PRIMARY')}
                  className={`px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    manifestFilter === 'PRIMARY'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-content-secondary hover:text-content-primary'
                  }`}
                >
                  Primary Delayed (1)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-surface-border shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-bg text-xs font-bold text-content-muted uppercase tracking-wider border-b border-surface-border">
                    <th className="py-4 px-4">Role</th>
                    <th className="py-4 px-4">Vessel Name &amp; Fleet</th>
                    <th className="py-4 px-4">Assigned Berth</th>
                    <th className="py-4 px-4">Scheduled ➔ Delayed Window</th>
                    <th className="py-4 px-4">Added Delay</th>
                    <th className="py-4 px-4">Demurrage Penalty</th>
                    <th className="py-4 px-4">Cascade Trigger Mechanism</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border bg-surface-card">
                  {filteredAffectedVessels.map((v) => {
                    const isPrimary = v.impact_category === 'PRIMARY_SHOCK';
                    const isCollision = v.impact_category === 'BERTH_COLLISION_CASCADE';

                    return (
                      <tr
                        key={v.vessel_id}
                        className={`hover:bg-surface-hover/50 transition ${
                          isPrimary ? 'bg-rose-500/5' : isCollision ? 'bg-amber-500/5' : ''
                        }`}
                      >
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              isPrimary
                                ? 'bg-rose-500/20 text-rose-500 border-rose-500/40'
                                : isCollision
                                ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                                : 'bg-purple-500/20 text-purple-500 border-purple-500/40'
                            }`}
                          >
                            {isPrimary ? 'Primary Shock' : isCollision ? 'Berth Clash' : 'Displaced'}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-semibold text-content-primary">
                          <div className="font-bold text-sm">{v.vessel_name}</div>
                          <div className="text-xs text-content-muted mt-0.5">
                            {v.vessel_class} • <span className="text-blue-500 font-semibold">{v.fleet}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-mono">
                          <span className="px-2.5 py-1 rounded-lg bg-surface-bg border border-surface-border font-bold text-content-primary text-xs">
                            {v.assigned_berth_name || v.assigned_berth_id || 'Berth TBD'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-xs">
                          <div className="text-content-muted line-through">
                            {new Date(v.original_start_time).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="font-bold text-amber-500 flex items-center space-x-1.5 mt-0.5">
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>
                              {new Date(v.delayed_start_time).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-amber-500 text-sm">
                          +{v.wait_increase_hours.toFixed(1)}h
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-rose-500 text-sm">
                          ${Math.round(v.demurrage_impact_usd).toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-content-secondary leading-relaxed text-xs max-w-sm">
                          {v.impact_reason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEPARATION 5: CHAIN IMPACT ON MULTIPLE FLEETS                             */}
          {/* ========================================================================= */}
          <div className="bg-surface-card border border-surface-border p-6 sm:p-8 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center space-x-3 pb-3 border-b border-surface-border">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center font-bold text-sm">
                🌐
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10px] tracking-wider uppercase border border-blue-500/20">
                    SECTION 5: Multi-Fleet &amp; Alliance Network Impacts
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-extrabold text-content-primary tracking-tight mt-1">
                  Chain Impact Across Carrier Alliances
                </h4>
                <p className="text-xs text-content-secondary mt-0.5">
                  <strong className="text-content-primary">Purpose:</strong> Assesses commercial ripple across shared carrier alliances (2M, Ocean Alliance, THE Alliance) to coordinate multi-fleet mitigation.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {simulationResult.fleet_chain_impacts.map((fleet) => (
                <div
                  key={fleet.fleet_name}
                  className="p-6 rounded-2xl border border-surface-border/80 bg-surface-bg/70 space-y-4 shadow-sm hover:shadow-md hover:border-surface-hover transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-content-primary tracking-tight">
                      {fleet.fleet_name}
                    </span>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider ${
                        fleet.chain_risk_level === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
                          : fleet.chain_risk_level === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-500 border border-blue-500/30'
                      }`}
                    >
                      {fleet.chain_risk_level} RISK
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-2.5 my-1 border-y border-surface-border/60">
                    <div>
                      <span className="text-xs text-content-muted block mb-0.5">Demurrage Fine:</span>
                      <strong className="text-rose-500 font-mono text-base font-black">
                        ${Math.round(fleet.total_demurrage_usd).toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-content-muted block mb-0.5">Delay Absorbed:</span>
                      <strong className="text-amber-500 font-mono text-base font-black">
                        +{fleet.total_delay_hours.toFixed(1)} hrs
                      </strong>
                    </div>
                  </div>

                  <p className="text-xs text-content-secondary leading-relaxed">
                    {fleet.operational_note}
                  </p>

                  <div className="text-xs text-content-muted pt-2 flex items-center space-x-1.5 flex-wrap gap-y-1">
                    <span className="font-semibold text-content-primary">Vessels:</span>
                    {fleet.affected_vessels.map((vName, idx) => (
                      <span
                        key={vName}
                        className="px-2 py-0.5 rounded-md bg-surface-card border border-surface-border text-content-primary font-medium text-[11px]"
                      >
                        {vName}{idx < fleet.affected_vessels.length - 1 ? ',' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEPARATION 6: PROACTIVE REROUTING & MITIGATION RECOMMENDATIONS            */}
          {/* ========================================================================= */}
          {simulationResult.mitigation_recommendations?.length > 0 && (
            <div className="bg-surface-card border border-emerald-500/30 bg-emerald-500/5 p-6 sm:p-8 rounded-3xl shadow-sm space-y-6">
              <div className="flex items-center space-x-3 pb-3 border-b border-emerald-500/20">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-sm">
                  🔀
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-bold text-[10px] tracking-wider uppercase border border-emerald-500/30">
                      SECTION 6: Mitigation &amp; Proactive Rerouting
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mt-1">
                    Proactive Rerouting &amp; Delay Mitigation Strategies
                  </h4>
                  <p className="text-xs text-content-secondary mt-0.5">
                    <strong className="text-emerald-700 dark:text-emerald-300">Purpose:</strong> Prescribes actionable interventions (slow-steaming, alternative quay diversions) in advance to prevent collateral vessels from being delayed.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {simulationResult.mitigation_recommendations.map((action, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-surface-card border border-surface-border text-xs sm:text-sm space-y-3.5 flex flex-col justify-between shadow-sm hover:border-emerald-500/40 transition"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-content-primary">
                        <span className="text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                          {action.action_type.replace('_', ' ')}
                        </span>
                        <span className="text-content-muted font-normal text-[11px]">Target: {action.target_vessel_name}</span>
                      </div>
                      <p className="text-content-secondary text-xs leading-relaxed">
                        {action.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-surface-border flex items-center justify-between text-xs font-semibold">
                      <span className="text-emerald-500 font-extrabold font-mono text-sm">
                        Save ~${Math.round(action.potential_savings_usd).toLocaleString()}
                      </span>
                      <span className="text-content-muted font-mono">
                        Recover ~{action.potential_hours_saved.toFixed(1)}h
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
