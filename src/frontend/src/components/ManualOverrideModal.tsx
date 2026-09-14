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
  Zap,
  Maximize2,
  Minimize2,
  Calendar,
  ArrowRight,
  Sparkles
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
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'FORM' | 'RESOLUTIONS'>('FORM');

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
          `BERTH OCCUPANCY WARNING: '${berth.name}' is occupied by '${occupyingVessel.name}'. Direct assignment collides with current docking.`
        );
      } else {
        setClientWarning(null);
      }
    }
  }, [selectedVesselId, targetBerthId, vessels, berths]);

  // If backend returns conflict resolutions, auto-switch to RESOLUTIONS tab
  useEffect(() => {
    if (result && !result.is_valid && result.suggested_resolutions && result.suggested_resolutions.length > 0) {
      setModalTab('RESOLUTIONS');
    }
  }, [result]);

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
    setResult(null);
    setModalTab('FORM');
  };

  const handleAcceptAndReassignDirectly = async (res: SuggestedResolution) => {
    if (!selectedVesselId || !res.target_berth_id) return;
    try {
      setSubmitting(true);
      const targetTime = res.recommended_start_time
        ? new Date(res.recommended_start_time).toISOString()
        : new Date(newStartTime).toISOString();

      const overrideRes = await api.manualOverride({
        vessel_id: selectedVesselId,
        target_berth_id: res.target_berth_id,
        new_start_time: targetTime,
        override_reason: `Accepted Suggestion: ${res.description}`,
      });
      setResult(overrideRes);
      if (overrideRes.is_valid) {
        setTimeout(() => {
          onOverrideSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setResult({
        correlation_id: 'err',
        is_valid: false,
        status: 'REJECTED_HARD_CONSTRAINT',
        vessel_id: selectedVesselId,
        vessel_name: 'Unknown',
        berth_id: res.target_berth_id,
        berth_name: res.target_berth_name || 'Unknown',
        constraint_violations: [err.message || 'Direct reassignment failed'],
        warnings: [],
        message: err.message || 'Direct reassignment failed',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDirectAssignBerth = async (berthId: string) => {
    if (!selectedVesselId || !berthId) return;
    try {
      setSubmitting(true);
      const targetTime = new Date(newStartTime).toISOString();
      const overrideRes = await api.manualOverride({
        vessel_id: selectedVesselId,
        target_berth_id: berthId,
        new_start_time: targetTime,
        override_reason: `Direct Reassignment to ${berthId}`,
      });
      setResult(overrideRes);
      if (overrideRes.is_valid) {
        setTimeout(() => {
          onOverrideSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setResult({
        correlation_id: 'err',
        is_valid: false,
        status: 'REJECTED_HARD_CONSTRAINT',
        vessel_id: selectedVesselId,
        vessel_name: 'Unknown',
        berth_id: berthId,
        berth_name: 'Unknown',
        constraint_violations: [err.message || 'Direct reassignment failed'],
        warnings: [],
        message: err.message || 'Direct reassignment failed',
      });
    } finally {
      setSubmitting(false);
    }
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

  const resolutions = result?.suggested_resolutions || [];
  const hasResolutions = !!(result && !result.is_valid && resolutions.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className={`bg-slate-900 text-slate-100 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col transition-all duration-200 ${
          isFullscreen 
            ? 'w-full h-full max-w-none max-h-none rounded-none sm:rounded-2xl' 
            : 'w-full max-w-3xl max-h-[92vh]'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold shadow-sm">
              <ShieldAlert className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight flex items-center space-x-2">
                <span>Manual Supervisor Override &amp; Safety Guardrails</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/40 uppercase">
                  MILP Guardrails Active
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Safe vessel reassignment with automated collision checking and physical draft/length guardrails
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isFullscreen ? 'Restore Window Size' : 'Maximize Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Sub-Tabs */}
        <div className="flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900/90 text-xs">
          <div className="flex items-center space-x-2 py-2.5">
            <button
              type="button"
              onClick={() => setModalTab('FORM')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-2 ${
                modalTab === 'FORM'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>🎯 Reassignment Parameters</span>
            </button>

            {hasResolutions && (
              <button
                type="button"
                onClick={() => setModalTab('RESOLUTIONS')}
                className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-2 ${
                  modalTab === 'RESOLUTIONS'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                    : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 animate-pulse'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>⚡ AI Conflict Resolutions ({resolutions.length})</span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-400 hidden sm:block">
            {isFullscreen ? 'Expanded Fullscreen Mode' : 'Standard Dialog View'}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Real-time Constraint Violation Warning Banner */}
          {clientWarning && (
            <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-500/80 text-rose-200 text-xs flex items-start space-x-3 shadow-lg shadow-rose-950/40">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
              <div>
                <strong className="font-bold text-white text-xs block uppercase tracking-wide">
                  Safety Guardrail Warning (Sev-1):
                </strong>
                <span className="text-rose-200 mt-0.5 block leading-relaxed">{clientWarning}</span>
              </div>
            </div>
          )}

          {/* Backend Result Banner */}
          {result && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-start space-x-3 shadow-lg ${
                result.is_valid
                  ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200'
                  : 'bg-rose-950/70 border-rose-500 text-rose-200'
              }`}
            >
              {result.is_valid ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <strong className="font-extrabold text-white text-xs tracking-wider">
                    {result.status}
                  </strong>
                  {hasResolutions && modalTab === 'FORM' && (
                    <button
                      type="button"
                      onClick={() => setModalTab('RESOLUTIONS')}
                      className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition shadow-sm flex items-center space-x-1"
                    >
                      <span>View {resolutions.length} AI Safe Solutions</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <span className="text-slate-300 mt-1 block leading-relaxed">{result.message}</span>
                {result.constraint_violations.length > 0 && (
                  <ul className="list-disc pl-4 mt-2 space-y-1 text-rose-300 font-mono text-[11px]">
                    {result.constraint_violations.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: FORM */}
          {modalTab === 'FORM' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Top AI Recommendation Quick-Fix Banner */}
              {(() => {
                const curVessel = vessels.find((v) => v.id === selectedVesselId);
                if (!curVessel) return null;
                const topSuggestion = berths.find((b) => {
                  const isOccupied = vessels.some(
                    (v) => v.assigned_berth_id === b.id && v.status === 'BERTHED' && v.id !== curVessel.id
                  );
                  return !isOccupied && curVessel.draft_m <= b.draft_limit_m && curVessel.length_m <= b.length_m;
                });
                if (!topSuggestion) return null;
                return (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/60 to-emerald-950/60 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md">
                    <div className="flex items-center space-x-2.5">
                      <Sparkles className="w-5 h-5 text-emerald-400 flex-shrink-0 animate-pulse" />
                      <div className="text-xs">
                        <span className="font-extrabold text-white">Suggested Optimal Quay: </span>
                        <span className="text-emerald-300 font-bold">{topSuggestion.name} ({topSuggestion.id})</span>
                        <span className="text-slate-400 text-[11px] block mt-0.5">
                          Safe UKC Clearance ({topSuggestion.draft_limit_m}m depth) · 0 Quay Collisions
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleDirectAssignBerth(topSuggestion.id)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs transition flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/30 whitespace-nowrap"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-300" />
                      <span>{submitting ? 'Reassigning...' : `⚡ Reassign Directly to ${topSuggestion.id}`}</span>
                    </button>
                  </div>
                );
              })()}

              {/* Vessel Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  1. Select Vessel to Reassign
                </label>
                <select
                  value={selectedVesselId}
                  onChange={(e) => setSelectedVesselId(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
                >
                  {vessels.map((v) => (
                    <option key={v.id} value={v.id} className="bg-slate-900 text-white">
                      {v.name} ({v.id}) — {v.length_m}m LOA · {v.draft_m}m Draft · Class: {v.vessel_class}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Berth Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  2. Target Reallocated Berth
                </label>
                <select
                  value={targetBerthId}
                  onChange={(e) => setTargetBerthId(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
                >
                  {berths.map((b) => {
                    const berthed = vessels.find(
                      (v) => v.assigned_berth_id === b.id && v.status === 'BERTHED' && v.id !== selectedVesselId
                    );
                    return (
                      <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                        {berthed ? `[OCCUPIED by ${berthed.name}]` : '[AVAILABLE ✓]'} {b.name} ({b.id}) — Max {b.length_m}m L · {b.draft_limit_m}m Draft · {b.crane_slots} STS Cranes
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
                    <div className="mt-2.5 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                      <span className="text-[11px] font-semibold text-slate-300 flex items-center space-x-1 mb-2">
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                        <span>Suggested Free &amp; Dimension-Compatible Berths (Safe to Select):</span>
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {availableBerths.slice(0, 5).map((ab) => (
                          <div
                            key={ab.id}
                            className="inline-flex items-center rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-1 space-x-1 shadow-sm"
                          >
                            <button
                              type="button"
                              onClick={() => setTargetBerthId(ab.id)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                                targetBerthId === ab.id
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'text-emerald-300 hover:bg-emerald-900/60'
                              }`}
                              title="Select this berth in the form"
                            >
                              ✓ {ab.name} ({ab.id}) · {ab.draft_limit_m}m D
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleDirectAssignBerth(ab.id)}
                              className="px-2 py-1 rounded-lg text-[11px] font-black bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center space-x-1 shadow-sm disabled:opacity-50"
                              title={`Accept suggestion and reassign directly to ${ab.name}`}
                            >
                              <Zap className="w-3 h-3 text-amber-300" />
                              <span>⚡ Direct Reassign</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Start Time & Reason in 2 Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    3. Revised Docking Start Time
                  </label>
                  <input
                    type="datetime-local"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    4. Operational Justification
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    placeholder="e.g. Quay rebalancing for mega-ship draft"
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting || !!clientWarning}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-lg shadow-blue-600/30 transition-all flex items-center space-x-2"
                >
                  {submitting ? (
                    <Clock className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  )}
                  <span>Verify &amp; Execute Override</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: AI RESOLUTIONS */}
          {modalTab === 'RESOLUTIONS' && hasResolutions && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/40">
                <div className="flex items-center space-x-2 text-blue-400 font-extrabold text-sm mb-1">
                  <Zap className="w-4 h-4" />
                  <span>HiGHS Constraint Solver Solutions ({resolutions.length} Evaluated)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The optimizer evaluated current vessel draft, quayside length, crane capacity, and downstream scheduled calls. Select any resolution below to automatically apply it:
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {resolutions.map((res, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-800/90 border border-slate-700/80 hover:border-blue-400/80 transition shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-white">
                          {res.description}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-mono font-bold border border-blue-500/30 uppercase">
                          {res.resolution_type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{res.reasoning}</p>
                      {res.recommended_start_time && (
                        <p className="text-xs font-mono text-emerald-400 flex items-center space-x-1 font-semibold">
                          <Clock className="w-3.5 h-3.5 inline mr-1" />
                          <span>Suggested Window: {new Date(res.recommended_start_time).toLocaleString()}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 self-stretch sm:self-center">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleAcceptAndReassignDirectly(res)}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs transition flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/30 whitespace-nowrap"
                        title="Accept suggestion and execute reassignment immediately"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        <span>{submitting ? 'Reassigning...' : '⚡ Accept & Reassign Directly'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyResolution(res)}
                        className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs transition whitespace-nowrap"
                        title="Edit parameters in manual form"
                      >
                        Edit in Form
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-start">
                <button
                  type="button"
                  onClick={() => setModalTab('FORM')}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition flex items-center space-x-1.5"
                >
                  <span>← Return to Manual Form</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
