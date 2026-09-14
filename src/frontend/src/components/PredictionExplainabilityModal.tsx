import React, { useState } from 'react';
import { 
  Brain, 
  MapPin, 
  Sparkles, 
  Cpu,
  ArrowRight
} from 'lucide-react';

interface PredictionExplainabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const PredictionExplainabilityModal: React.FC<PredictionExplainabilityModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const [activeTab, setActiveTab] = useState<'HOW' | 'WHERE'>('HOW');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-surface-card border border-surface-border rounded-2xl shadow-2xl w-full max-w-4xl text-content-primary relative max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-surface-border flex items-start justify-between bg-surface-card/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-500 font-bold">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-content-primary flex items-center space-x-2">
                <span>PortPulse Congestion Prediction &amp; AI Intelligence Engine</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-bold uppercase tracking-wider">
                  F-201 / F-202 / F-206
                </span>
              </h2>
              <p className="text-xs text-content-secondary">
                How machine learning models forecast bottlenecks 72h ahead, and where to inspect predictions across the cockpit
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-content-muted hover:text-content-primary text-lg px-2.5 py-1 rounded-lg hover:bg-surface-hover transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 px-6 pt-3 border-b border-surface-border bg-surface-bg/50 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('HOW')}
            className={`pb-2.5 px-3 border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'HOW'
                ? 'border-blue-500 text-blue-500 font-bold'
                : 'border-transparent text-content-secondary hover:text-content-primary'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>1. How Our System Predicts Congestion</span>
          </button>
          <button
            onClick={() => setActiveTab('WHERE')}
            className={`pb-2.5 px-3 border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'WHERE'
                ? 'border-blue-500 text-blue-500 font-bold'
                : 'border-transparent text-content-secondary hover:text-content-primary'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>2. Where You Can See These Predictions in the App</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {activeTab === 'HOW' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 leading-relaxed">
                <span className="font-bold">The Core Challenge:</span> Commercial container carriers systematically underreport arrival delays by 1.5 to 4.0 hours due to commercial optimism bias. Raw AIS tracking lacks quayside crane availability and tidal context, leading to surprise quayside bottlenecks.
              </div>

              {/* 4-Stage Architecture Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                
                <div className="p-4 rounded-xl border border-surface-border bg-surface-bg space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs">1</span>
                    <h3 className="font-bold text-content-primary text-xs">Feature Store &amp; Ingestion Pipeline (F-101)</h3>
                  </div>
                  <p className="text-content-secondary leading-relaxed">
                    Ingests real-time AIS positions, vessel class (ULCV, Panamax, Feeder), cargo volume (TEU), draft depth, historical carrier turnaround tendency, and wind/tide weather events.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-surface-border bg-surface-bg space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs">2</span>
                    <h3 className="font-bold text-content-primary text-xs">Gradient Boosting ETA Regressor (F-201)</h3>
                  </div>
                  <p className="text-content-secondary leading-relaxed">
                    Trained GradientBoostingRegressor corrects carrier optimism bias. Delivers <strong className="text-emerald-500">1.17h MAE</strong> vs. <strong className="text-content-muted">1.75h naive baseline</strong> (a <strong className="text-emerald-500">33.0% error reduction</strong>).
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-surface-border bg-surface-bg space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs">3</span>
                    <h3 className="font-bold text-content-primary text-xs">72h Berth Occupancy &amp; Queue Regressor (F-202)</h3>
                  </div>
                  <p className="text-content-secondary leading-relaxed">
                    Evaluates arrival overlaps across 720 discrete hourly slots (10 berths × 72 hours). Calculates queue formation in the offshore anchorage when quay demand exceeds capacity.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-surface-border bg-surface-bg space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold text-xs">4</span>
                    <h3 className="font-bold text-content-primary text-xs">SHAP Attribution &amp; MILP Mitigation (F-206 / F-305)</h3>
                  </div>
                  <p className="text-content-secondary leading-relaxed">
                    Quantifies root causes (e.g. <em>Weather/Tides: 39.7%, STS Outage: 33.7%, Cargo Dwell: 12.8%</em>). The HiGHS solver immediately computes slow-steam and diversion actions to eliminate demurrage!
                  </p>
                </div>

              </div>

              {/* Confidence Band Notice */}
              <div className="p-3.5 rounded-xl border border-surface-border bg-surface-bg flex items-center justify-between">
                <div>
                  <span className="font-bold text-content-primary block">Calibrated Uncertainty Bounds (F-207)</span>
                  <span className="text-content-secondary">Empirical 80% Confidence Interval achieves 84.4% test coverage with zero optimistic variance collapse.</span>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-500 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                  84.4% CI Calibrated
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-surface-bg border border-surface-border text-content-secondary">
                Here are the <strong className="text-content-primary">5 exact places in the PortPulse Cockpit</strong> where you can see the system's machine learning predictions in action:
              </div>

              <div className="space-y-3">
                
                {/* Location 1 */}
                <div className="p-3.5 rounded-xl border border-surface-border bg-surface-bg flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="p-1.5 rounded-md bg-blue-500/10 text-blue-500 font-bold">1</span>
                      <strong className="text-content-primary text-xs">72h Operations Plan &amp; Spatial Quayside Radar</strong>
                    </div>
                    <p className="text-content-secondary text-[11px] leading-relaxed">
                      • In the <strong>Work Manifest Table</strong>, inspect the <code className="text-blue-500 font-mono">Wait Hours</code> column (e.g. <em>+23.0h wait</em>) and <code className="text-rose-500 font-mono">Demurrage</code> column (e.g. <em>$35,881</em>).<br />
                      • In the <strong>Quayside Spatial Map</strong>, observe the red glowing congestion rings on bottlenecked berths and vessels held in the Offshore Anchorage queue.
                    </p>
                  </div>
                  {onNavigateTab && (
                    <button
                      onClick={() => {
                        onNavigateTab('plan');
                        onClose();
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition shrink-0 flex items-center space-x-1"
                    >
                      <span>Go to Tab</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Location 2 */}
                <div className="p-3.5 rounded-xl border border-surface-border bg-surface-bg flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="p-1.5 rounded-md bg-purple-500/10 text-purple-500 font-bold">2</span>
                      <strong className="text-content-primary text-xs">Congestion Heatmap Tab (F-203 &amp; F-206)</strong>
                    </div>
                    <p className="text-content-secondary text-[11px] leading-relaxed">
                      • Displays a <strong>72-hour grid</strong> (10 berths × 72 hours) color-coded into Green (&le;0.40), Amber (0.40–0.75), and Red (&gt;0.75).<br />
                      • <strong>Hover over any Red/Amber cell</strong> to inspect the tooltip showing the top 3 SHAP feature drivers (Weather/Tide, Crane Breakdown, Cargo Dwell).
                    </p>
                  </div>
                  {onNavigateTab && (
                    <button
                      onClick={() => {
                        onNavigateTab('heatmap');
                        onClose();
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded-md bg-purple-600 text-white hover:bg-purple-700 transition shrink-0 flex items-center space-x-1"
                    >
                      <span>Go to Tab</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Location 3 */}
                <div className="p-3.5 rounded-xl border border-surface-border bg-surface-bg flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500 font-bold">3</span>
                      <strong className="text-content-primary text-xs">Live Queue Manifest Tab (F-105 &amp; F-201)</strong>
                    </div>
                    <p className="text-content-secondary text-[11px] leading-relaxed">
                      • Compare the carrier's reported arrival time with the ML-corrected prediction side-by-side in the <strong>"Carrier ETA vs. Corrected ETA"</strong> column.<br />
                      • See the predicted delay difference (e.g. <em>+3.5h delay</em>) and model confidence score (e.g. <em>91% confidence</em>).
                    </p>
                  </div>
                  {onNavigateTab && (
                    <button
                      onClick={() => {
                        onNavigateTab('live');
                        onClose();
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition shrink-0 flex items-center space-x-1"
                    >
                      <span>Go to Tab</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Location 4 */}
                <div className="p-3.5 rounded-xl border border-surface-border bg-surface-bg flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="p-1.5 rounded-md bg-amber-500/10 text-amber-500 font-bold">4</span>
                      <strong className="text-content-primary text-xs">Prescriptive Actions Tab (F-301, F-302, F-407)</strong>
                    </div>
                    <p className="text-content-secondary text-[11px] leading-relaxed">
                      • The HiGHS optimizer uses the ML predicted delays to generate proactive interventions: <strong>Slow-Steaming Advisories</strong> and <strong>Vessel Diversions</strong>.<br />
                      • Review exact dollar demurrage avoided and metric tonnes of CO2 mitigated per action.
                    </p>
                  </div>
                  {onNavigateTab && (
                    <button
                      onClick={() => {
                        onNavigateTab('recommendations');
                        onClose();
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded-md bg-amber-600 text-white hover:bg-amber-700 transition shrink-0 flex items-center space-x-1"
                    >
                      <span>Go to Tab</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Location 5 */}
                <div className="p-3.5 rounded-xl border border-surface-border bg-surface-bg flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="p-1.5 rounded-md bg-zinc-500/10 text-zinc-500 font-bold">5</span>
                      <strong className="text-content-primary text-xs">Forecast Benchmarks Tab</strong>
                    </div>
                    <p className="text-content-secondary text-[11px] leading-relaxed">
                      • Transparent mathematical benchmarks comparing trained GradientBoosting models against naive AIS baselines.<br />
                      • View MAE (1.17h vs 1.75h) and calibrated 80% confidence interval graphs.
                    </p>
                  </div>
                  {onNavigateTab && (
                    <button
                      onClick={() => {
                        onNavigateTab('ml_metrics');
                        onClose();
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded-md bg-zinc-700 text-white hover:bg-zinc-800 transition shrink-0 flex items-center space-x-1"
                    >
                      <span>Go to Tab</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-border bg-surface-card/60 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[11px] text-content-secondary">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>PortPulse AI Congestion Predictor · Verified on 50 Vessels across 10 Berths</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-surface-bg border border-surface-border hover:bg-surface-hover text-content-primary transition"
          >
            Close Guide
          </button>
        </div>

      </div>
    </div>
  );
};
