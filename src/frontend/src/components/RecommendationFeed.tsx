import React, { useState } from 'react';
import {
  RecommendationsListResponse,
  api
} from '../api/client';
import {
  ArrowRight,
  DollarSign,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  RefreshCw,
  Compass
} from 'lucide-react';

interface RecommendationFeedProps {
  recommendationsData: RecommendationsListResponse | null;
  loading: boolean;
  onRefresh: () => void;
  userRole: string;
}

export const RecommendationFeed: React.FC<RecommendationFeedProps> = ({
  recommendationsData,
  loading,
  onRefresh,
  userRole,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED'>('ALL');
  const [actingId, setActingId] = useState<string | null>(null);

  const canAct = ['admin', 'terminal_manager', 'shift_supervisor'].includes(userRole);

  const handleAction = async (recId: string, action: 'ACCEPT' | 'MODIFY' | 'REJECT') => {
    try {
      setActingId(recId);
      const notes = `Action ${action} initiated by ${userRole}`;
      await api.actOnRecommendation(recId, action, notes);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to record action: ${err.message || err.detail || 'Server error'}`);
    } finally {
      setActingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-xl p-12 text-center shadow-sm">
        <RefreshCw className="w-8 h-8 text-brand-500 animate-spin mx-auto mb-3" />
        <p className="text-xs text-content-secondary font-medium">
          Generating prescriptive routing recommendations, slow-steam advisories, and cost models...
        </p>
      </div>
    );
  }

  const recs = recommendationsData?.recommendations || [];
  const filteredRecs = recs.filter((r) => {
    if (filter === 'ALL') return true;
    return r.status === filter;
  });

  const pendingCount = recs.filter((r) => r.status === 'PENDING').length;
  const acceptedCount = recs.filter((r) => r.status === 'ACCEPTED').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & KPI Summary Bar */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Compass className="w-5 h-5 text-brand-500" />
              <h2 className="text-base font-bold text-content-primary">
                Prescriptive Operational Interventions
              </h2>
            </div>
            <p className="text-xs text-content-secondary mt-1">
              AI-generated operational interventions to clear forecasted congestion bottlenecks, quantified by demurrage ($) and carbon (CO2) impact.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-semibold">
                {pendingCount} Actionable
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
                {acceptedCount} Executed
              </span>
            </div>

            <button
              onClick={onRefresh}
              className="p-2 rounded-lg border border-surface-border hover:bg-surface-hover text-content-primary transition-colors"
              title="Refresh recommendations"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-surface-border text-xs">
          <span className="text-content-muted font-medium mr-2">Filter status:</span>
          {(['ALL', 'PENDING', 'ACCEPTED', 'REJECTED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                filter === status
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-surface-bg border border-surface-border text-content-secondary hover:text-content-primary'
              }`}
            >
              {status}
            </button>
          ))}
          {!canAct && (
            <span className="ml-auto text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              * Read-only mode for {userRole}. Supervisor/Manager authorization required to execute actions.
            </span>
          )}
        </div>
      </div>

      {/* Recommendations Cards Grid */}
      {filteredRecs.length === 0 ? (
        <div className="bg-surface-card border border-surface-border rounded-xl p-8 text-center text-xs text-content-muted">
          No prescriptive recommendations found for the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {filteredRecs.map((rec) => {
            const isPending = rec.status === 'PENDING';
            const isAccepted = rec.status === 'ACCEPTED';

            return (
              <div
                key={rec.id}
                className={`bg-surface-card border rounded-xl p-5 shadow-sm transition-all relative ${
                  isPending
                    ? 'border-brand-500/40 hover:border-brand-500'
                    : isAccepted
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-surface-border opacity-75'
                }`}
              >
                {/* Header row of card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-border pb-3">
                  <div className="flex items-center space-x-2.5">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        rec.recommendation_type === 'DIVERSION'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : rec.recommendation_type === 'SLOW_STEAM'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {rec.recommendation_type.replace('_', ' ')}
                    </span>

                    <span className="text-xs font-bold text-content-primary">
                      {rec.vessel_name}
                    </span>
                    <span className="text-[11px] font-mono text-content-muted">
                      ({rec.vessel_id})
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="text-[11px] text-content-muted font-mono">
                      Feasibility Confidence: <strong className="text-content-primary">{Math.round(rec.confidence_score * 100)}%</strong>
                    </span>

                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        isPending
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : isAccepted
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      {rec.status}
                    </span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 py-4">
                  {/* Left Column: Action & Grounded Rationale */}
                  <div className="lg:col-span-7 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-content-primary flex items-center space-x-2">
                        <span>{rec.action_summary}</span>
                      </h4>
                      <p className="text-xs text-content-secondary mt-1 leading-relaxed">
                        {rec.rationale}
                      </p>
                    </div>

                    {/* Routing Details Box */}
                    <div className="bg-surface-bg border border-surface-border rounded-lg p-3 text-xs flex flex-wrap items-center gap-4">
                      <div>
                        <span className="text-content-muted block text-[10px] uppercase font-semibold">
                          Assigned Berth
                        </span>
                        <span className="font-semibold text-content-primary">
                          {rec.source_berth_name || 'Offshore Queue'}
                        </span>
                      </div>

                      {rec.target_berth_name && (
                        <>
                          <ArrowRight className="w-4 h-4 text-brand-500" />
                          <div>
                            <span className="text-content-muted block text-[10px] uppercase font-semibold">
                              Target Reallocation
                            </span>
                            <span className="font-semibold text-content-primary">
                              {rec.target_berth_name}
                            </span>
                          </div>
                        </>
                      )}

                      {rec.speed_adjustment_knots && (
                        <div className="border-l border-surface-border pl-4">
                          <span className="text-content-muted block text-[10px] uppercase font-semibold">
                            Speed Trim
                          </span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            -{rec.speed_adjustment_knots} knots cruise
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Transparent Cost / Impact Estimator (F-304) */}
                  <div className="lg:col-span-5 bg-surface-bg/70 border border-surface-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-surface-border pb-2">
                      <span className="text-xs font-bold text-content-primary flex items-center space-x-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-brand-500" />
                        <span>Quantified Cost & Emissions Impact</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        Net: +${rec.impact.net_benefit_usd.toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-surface-card p-2 rounded-lg border border-surface-border">
                        <span className="text-[10px] text-content-muted block">Queue / Delay Avoided</span>
                        <span className="font-bold text-content-primary font-mono">
                          {rec.impact.hours_saved} hours
                        </span>
                      </div>

                      <div className="bg-surface-card p-2 rounded-lg border border-surface-border">
                        <span className="text-[10px] text-content-muted block">Demurrage Saved</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          ${rec.impact.demurrage_saved_usd.toLocaleString()}
                        </span>
                      </div>

                      {rec.impact.bunker_fuel_saved_usd > 0 && (
                        <div className="bg-surface-card p-2 rounded-lg border border-surface-border">
                          <span className="text-[10px] text-content-muted block">Bunker Fuel Saved</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            ${rec.impact.bunker_fuel_saved_usd.toLocaleString()}
                          </span>
                        </div>
                      )}

                      {rec.impact.co2_saved_mt > 0 && (
                        <div className="bg-surface-card p-2 rounded-lg border border-surface-border">
                          <span className="text-[10px] text-content-muted block">CO2 Emissions Avoided</span>
                          <span className="font-bold text-teal-600 dark:text-teal-400 font-mono">
                            {rec.impact.co2_saved_mt} mt CO2
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Action Bar & Audit Trail */}
                <div className="border-t border-surface-border pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-content-muted">
                    {rec.action_by_user ? (
                      <span className="flex items-center space-x-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>
                          Decided by <strong>{rec.action_by_user}</strong> at{' '}
                          {new Date(rec.action_timestamp || '').toLocaleTimeString()} ({rec.action_notes})
                        </span>
                      </span>
                    ) : (
                      <span>Awaiting supervisor operational sign-off</span>
                    )}
                  </div>

                  {canAct && isPending && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleAction(rec.id, 'REJECT')}
                        disabled={actingId === rec.id}
                        className="px-3 py-1.5 rounded-lg border border-rose-500/40 text-rose-600 hover:bg-rose-500/10 text-xs font-semibold transition-colors flex items-center space-x-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        onClick={() => handleAction(rec.id, 'ACCEPT')}
                        disabled={actingId === rec.id}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center space-x-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accept & Re-route</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
