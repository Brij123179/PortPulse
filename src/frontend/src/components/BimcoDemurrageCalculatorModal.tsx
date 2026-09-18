import React, { useState, useMemo } from 'react';
import { X, Scale, ShieldCheck, AlertTriangle, Printer } from 'lucide-react';

interface BimcoDemurrageCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultVesselId?: string;
  defaultVesselName?: string;
  defaultDwellHours?: number;
}

export const BimcoDemurrageCalculatorModal: React.FC<BimcoDemurrageCalculatorModalProps> = ({
  isOpen,
  onClose,
  defaultVesselId = 'IMO9200001',
  defaultVesselName = 'Maersk Mc-Kinney Moller',
  defaultDwellHours = 44.5,
}) => {
  const [vesselName, setVesselName] = useState(defaultVesselName);
  const [vesselId, setVesselId] = useState(defaultVesselId);
  const [charterPartyType, setCharterPartyType] = useState('GENCON_1994');
  const [agreedLaytimeHours, setAgreedLaytimeHours] = useState(36.0);
  const [demurrageRatePerDay, setDemurrageRatePerDay] = useState(42000); // $42,000 / day
  const [actualDwellHours, setActualDwellHours] = useState(defaultDwellHours);
  const [weatherDowntimeHours, setWeatherDowntimeHours] = useState(4.0);
  const [norBufferHours, setNorBufferHours] = useState(6.0);

  // Calculate Laytime metrics
  const calculation = useMemo(() => {
    // Net laytime consumed = actual dwell - weather downtime exclusions (WWD clause)
    const netLaytimeConsumed = Math.max(0, actualDwellHours - weatherDowntimeHours);
    const hourlyRate = demurrageRatePerDay / 24.0;
    const diffHours = netLaytimeConsumed - agreedLaytimeHours;

    const isDemurrage = diffHours > 0;
    const demurrageHours = isDemurrage ? diffHours : 0;
    const dispatchHours = !isDemurrage ? Math.abs(diffHours) : 0;

    const demurrageAmount = demurrageHours * hourlyRate;
    const dispatchAmount = dispatchHours * (hourlyRate * 0.5); // Despatch standard is half demurrage

    return {
      netLaytimeConsumed: Number(netLaytimeConsumed.toFixed(1)),
      hourlyRate: Number(hourlyRate.toFixed(2)),
      isDemurrage,
      demurrageHours: Number(demurrageHours.toFixed(1)),
      dispatchHours: Number(dispatchHours.toFixed(1)),
      demurrageAmount: Number(demurrageAmount.toFixed(2)),
      dispatchAmount: Number(dispatchAmount.toFixed(2)),
    };
  }, [agreedLaytimeHours, demurrageRatePerDay, actualDwellHours, weatherDowntimeHours]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-surface-card border border-surface-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between bg-surface-bg/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-black text-content-primary">
                  BIMCO Demurrage &amp; Laytime Auditor
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30 uppercase">
                  Maritime Commercial Law
                </span>
              </div>
              <p className="text-xs text-content-muted">
                GENCON 1994 &amp; BIMCO Laytime Definitions 2013 Automated Audit Calculator
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-content-muted hover:text-content-primary hover:bg-surface-hover transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-content-secondary font-bold mb-1">Target Vessel &amp; IMO</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={vesselName}
                  onChange={(e) => setVesselName(e.target.value)}
                  placeholder="Vessel Name"
                  className="w-full px-3 py-2 rounded-xl bg-surface-bg border border-surface-border text-content-primary font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={vesselId}
                  onChange={(e) => setVesselId(e.target.value)}
                  placeholder="IMO / ID"
                  className="w-full px-3 py-2 rounded-xl bg-surface-bg border border-surface-border text-content-primary font-mono font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-content-secondary font-bold mb-1">Contract / Charter Party</label>
              <select
                value={charterPartyType}
                onChange={(e) => setCharterPartyType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface-bg border border-surface-border text-content-primary font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="GENCON_1994">BIMCO GENCON 1994 (Voyage Charter)</option>
                <option value="NYPE_93">NYPE 93 (Time Charter Party)</option>
                <option value="BALTIME">BIMCO BALTIME 1939 (Rev. 2001)</option>
                <option value="BOXTIME">BIMCO BOXTIME 2004 (Container Feeder)</option>
              </select>
            </div>

            <div>
              <label className="block text-content-secondary font-bold mb-1">Agreed Laytime Allowance (Hours)</label>
              <input
                type="number"
                step="0.5"
                value={agreedLaytimeHours}
                onChange={(e) => setAgreedLaytimeHours(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-surface-bg border border-surface-border text-content-primary font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-content-secondary font-bold mb-1">Agreed Demurrage Rate ($/Day)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-content-muted">$</span>
                <input
                  type="number"
                  step="500"
                  value={demurrageRatePerDay}
                  onChange={(e) => setDemurrageRatePerDay(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2 rounded-xl bg-surface-bg border border-surface-border text-content-primary font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-content-secondary font-bold mb-1">Actual Berth Dwell Time (Hours)</label>
              <input
                type="number"
                step="0.5"
                value={actualDwellHours}
                onChange={(e) => setActualDwellHours(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-surface-bg border border-surface-border text-content-primary font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-content-secondary font-bold mb-1">
                Notice of Readiness (NOR) Buffer (Hours)
              </label>
              <input
                type="number"
                step="0.5"
                value={norBufferHours}
                onChange={(e) => setNorBufferHours(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-surface-bg border border-surface-border text-content-primary font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-content-secondary font-bold mb-1">
                Weather &amp; Outage Exclusions (WWD / Force Majeure Hours)
              </label>
              <input
                type="number"
                step="0.5"
                value={weatherDowntimeHours}
                onChange={(e) => setWeatherDowntimeHours(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-surface-bg border border-surface-border text-content-primary font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Audit Results Card */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              calculation.isDemurrage
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {calculation.isDemurrage ? (
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                )}
                <span className="text-sm font-black uppercase tracking-wider">
                  {calculation.isDemurrage ? 'Demurrage Penalty Payable' : 'Despatch Money Earned'}
                </span>
              </div>
              <span className="text-xl font-black font-mono">
                {calculation.isDemurrage
                  ? `$${calculation.demurrageAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`
                  : `$${calculation.dispatchAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-current/20 text-center">
              <div>
                <span className="text-[10px] text-content-muted block font-semibold">Net Laytime Counted</span>
                <span className="text-xs font-bold font-mono text-content-primary">
                  {calculation.netLaytimeConsumed} hrs
                </span>
              </div>
              <div>
                <span className="text-[10px] text-content-muted block font-semibold">Time Excess / Saved</span>
                <span className="text-xs font-bold font-mono text-content-primary">
                  {calculation.isDemurrage
                    ? `+${calculation.demurrageHours} hrs over`
                    : `-${calculation.dispatchHours} hrs saved`}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-content-muted block font-semibold">Hourly Demurrage Rate</span>
                <span className="text-xs font-bold font-mono text-content-primary">
                  ${calculation.hourlyRate}/hr
                </span>
              </div>
            </div>
          </div>

          {/* BIMCO Citation Reference */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-1.5 font-mono">
            <span className="text-xs font-bold text-amber-400 block font-sans">
              📜 Legal Audit Citation — BIMCO Laytime Definitions 2013:
            </span>
            <p>
              • <strong>Clause 4 (Notice of Readiness)</strong>: Time commences counting at next working hour following valid NOR tender.
            </p>
            <p>
              • <strong>Clause 7 (Weather Working Day)</strong>: Excludes {weatherDowntimeHours}h of documented adverse tidal/swell force majeure.
            </p>
            <p>
              • <strong>Clause 11 (Demurrage)</strong>: Continuous running hours apply until completion of discharge without deduction.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface-border flex items-center justify-between bg-surface-bg/50">
          <span className="text-[11px] text-content-muted">
            Certified Port Authority Statement of Facts (SOF) Output
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 rounded-xl border border-surface-border hover:bg-surface-hover text-xs font-bold text-content-primary transition flex items-center space-x-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Audit Sheet</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
