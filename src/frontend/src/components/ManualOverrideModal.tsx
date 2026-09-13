import React, { useState, useEffect } from 'react';
import {
  VesselStatusItem,
  BerthStatusItem,
  OverrideValidationResult,
  SuggestedResolution,
  api
} from '../api/client';
import {
  AlertTriangle,
  CheckCircle2,
  X,
  ShieldAlert,
  Clock,
  Zap
} from 'lucide-react';

interface ManualOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  vessels: VesselStatusItem[];
  berths: BerthStatusItem[];
  initialVesselId?: string;
  onOverrideSuccess: () => void;
}

export const ManualOverrideModal: React.FC<ManualOverrideModalProps> = ({
  isOpen,
  onClose,
  vessels,
  berths,
  initialVesselId,
  onOverrideSuccess,
}) => {
  const [selectedVesselId, setSelectedVesselId] = useState<string>('');
  const [targetBerthId, setTargetBerthId] = useState<string>('');
  const [newStartTime, setNewStartTime] = useState<string>('');
  const [reason, setReason] = useState<string>('Operational schedule re-balancing');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<OverrideValidationResult | null>(null);
  const [clientWarning, setClientWarning] = useState<string | null>(null);

  useEffect(() => {
    if (initialVesselId) {
      setSelectedVesselId(initialVesselId);
    } else if (vessels.length > 0) {
      setSelectedVesselId(vessels[0].id);
    }

    if (berths.length > 0) {
      setTargetBerthId(berths[0].id);
    }

    // Default to current time + 2 hours in local ISO format
    const now = new Date();
    now.setHours(now.getHours() + 2);
    setNewStartTime(now.toISOString().slice(0, 16));
  }, [isOpen, initialVesselId, vessels, berths]);

  // Real-time client-side pre-flight constraint check
  useEffect(() => {
    const vessel = vessels.find((v) => v.id === selectedVesselId);
    const berth = berths.find((b) => b.id === targetBerthId);

    if (vessel && berth) {
      const occupyingVessel = vessels.find(
        (v) => v.assigned_berth_id === targetBerthId && v.status === 'BERTHED' && v.id !== selectedVesselId
      );

      if (vessel.draft_m > berth.draft_limit_m) {
        setClientWarning(
          `HARD CONSTRAINT VIOLATION: Vessel draft (${vessel.draft_m}m) exceeds berth draft limit (${berth.draft_limit_m}m). Grounding risk!`
        );
      } else if (vessel.length_m > berth.length_m) {
        setClientWarning(
          `HARD CONSTRAINT VIOLATION: Vessel length (${vessel.length_m}m) exceeds berth quay length (${berth.length_m}m).`
        );
      } else if (occupyingVessel) {
        setClientWarning(
          `BERTH OCCUPANCY WARNING: '${berth.name}' is currently occupied by '${occupyingVessel.name}'. Reassigning during this window will trigger a collision rejection. Choose an available berth below or adjust docking time.`
        );
      } else {
        setClientWarning(null);
      }
    }
  }, [selectedVesselId, targetBerthId, vessels, berths]);

  if (!isOpen) return null;

  const applyResolution = (res: SuggestedResolution) => {
    if (res.target_berth_id) {
      setTargetBerthId(res.target_berth_id);
    }
    if (res.recommended_start_time) {
      try {
        const dt = new Date(res.recommended_start_time);
        if (!isNaN(dt.getTime())) {
          const tzOffset = dt.getTimezoneOffset() * 60000;
          const localISOTime = new Date(dt.getTime() - tzOffset).toISOString().slice(0, 16);
          setNewStartTime(localISOTime);
        }
      } catch {
        // preserve current time
      }
    }
    setClientWarning(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVesselId || !targetBerthId || !newStartTime) return;

    try {
      setSubmitting(true);
      setResult(null);
      const res = await api.manualOverride({
        vessel_id: selectedVesselId,
        target_berth_id: targetBerthId,
        new_start_time: new Date(newStartTime).toISOString(),
        override_reason: reason,
      });
      setResult(res);
      if (res.is_valid) {
        setTimeout(() => {
          onOverrideSuccess();
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setResult({
        correlation_id: 'err',
        is_valid: false,
        status: 'REJECTED_HARD_CONSTRAINT',
        vessel_id: selectedVesselId,
        vessel_name: 'Unknown',
        berth_id: targetBerthId,
        berth_name: 'Unknown',
        constraint_violations: [err.message || 'Server rejected override'],
        warnings: [],
        message: err.message || 'Override request failed',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-border">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-brand-500" />
            <h3 className="font-bold text-sm text-content-primary">
              Manual Supervisor Override &amp; Physical Guardrails
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-content-muted hover:text-content-primary hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Real-time Constraint Violation Warning Banner */}
          {clientWarning && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block">Safety Guardrail Alert (Sev-1):</strong>
                <span>{clientWarning}</span>
              </div>
            </div>
          )}

          {/* Backend Result Banner */}
          {result && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2.5 ${
                result.is_valid
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300'
              }`}
            >
              {result.is_valid ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
              )}
              <div>
                <strong className="font-semibold block">{result.status}</strong>
                <span>{result.message}</span>
                {result.constraint_violations.length > 0 && (
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    {result.constraint_violations.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Intelligent Collision Resolution Suggestions (Auto-computed by Optimizer) */}
          {result && !result.is_valid && result.suggested_resolutions && result.suggested_resolutions.length > 0 && (
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2.5">
              <div className="flex items-center space-x-2 text-blue-500 font-bold text-xs">
                <Zap className="w-4 h-4 flex-shrink-0" />
                <span>Collision Resolution Suggestions (Safe Alternatives)</span>
              </div>
              <p className="text-[11px] text-content-secondary">
                The solver evaluated quay capacity, vessel draft, and berth occupancy to find available options:
              </p>
              <div className="space-y-2">
                {result.suggested_resolutions.map((res, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-surface-card border border-surface-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-xs text-content-primary">
                          {res.description}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-mono uppercase">
                          {res.resolution_type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-content-muted">{res.reasoning}</p>
                      {res.recommended_start_time && (
                        <p className="text-[10px] font-mono text-emerald-500 flex items-center space-x-1">
                          <Clock className="w-3 h-3 inline mr-1" />
                          <span>Suggested Window: {new Date(res.recommended_start_time).toLocaleString()}</span>
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => applyResolution(res)}
                      className="self-end sm:self-center px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center space-x-1 shadow-sm whitespace-nowrap"
                    >
                      <Zap className="w-3 h-3" />
                      <span>Apply Resolution</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vessel Selector */}
          <div>
            <label className="block text-xs font-semibold text-content-secondary mb-1">
              Select Vessel to Reassign
            </label>
            <select
              value={selectedVesselId}
              onChange={(e) => setSelectedVesselId(e.target.value)}
              className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.id}) — {v.length_m}m · {v.draft_m}m Draft
                </option>
              ))}
            </select>
          </div>

          {/* Target Berth Selector */}
          <div>
            <label className="block text-xs font-semibold text-content-secondary mb-1">
              Target Reallocated Berth
            </label>
            <select
              value={targetBerthId}
              onChange={(e) => setTargetBerthId(e.target.value)}
              className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {berths.map((b) => {
                const berthed = vessels.find(
                  (v) => v.assigned_berth_id === b.id && v.status === 'BERTHED' && v.id !== selectedVesselId
                );
                return (
                  <option key={b.id} value={b.id}>
                    {berthed ? `[OCCUPIED by ${berthed.name}]` : '[AVAILABLE ✓]'} {b.name} ({b.id}) — Max {b.length_m}m L · {b.draft_limit_m}m D · {b.crane_slots} Cranes
                  </option>
                );
              })}
            </select>

            {/* Quick Available Alternative Pills */}
            {(() => {
              const selectedVessel = vessels.find((v) => v.id === selectedVesselId);
              const availableBerths = berths.filter((b) => {
                const isOccupied = vessels.some(
                  (v) => v.assigned_berth_id === b.id && v.status === 'BERTHED' && v.id !== selectedVesselId
                );
                const fitsDraft = selectedVessel ? selectedVessel.draft_m <= b.draft_limit_m : true;
                const fitsLength = selectedVessel ? selectedVessel.length_m <= b.length_m : true;
                return !isOccupied && fitsDraft && fitsLength;
              });

              if (availableBerths.length === 0) return null;

              return (
                <div className="mt-2 text-xs">
                  <span className="text-[11px] text-content-muted block mb-1">
                    💡 Suggested Free &amp; Compatible Berths (Safe to Assign):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {availableBerths.slice(0, 5).map((ab) => (
                      <button
                        key={ab.id}
                        type="button"
                        onClick={() => setTargetBerthId(ab.id)}
                        className={`px-2 py-1 rounded text-[11px] font-semibold border transition ${
                          targetBerthId === ab.id
                            ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                            : 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                        }`}
                      >
                        ✓ {ab.name} ({ab.id})
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-xs font-semibold text-content-secondary mb-1">
              Revised Docking Start Time
            </label>
            <input
              type="datetime-local"
              value={newStartTime}
              onChange={(e) => setNewStartTime(e.target.value)}
              className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-content-secondary mb-1">
              Operational Justification (Mandatory Audit Trail)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-surface-border flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-surface-border hover:bg-surface-hover text-xs font-semibold text-content-secondary"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || !!clientWarning}
              className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5"
            >
              {submitting ? (
                <Clock className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>Verify & Execute Override</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
