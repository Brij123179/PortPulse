import React, { useState } from 'react';
import { useAuth, ROLE_PROFILES, UserRole } from '../context/AuthContext';

interface GuidedTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
  onOpenLoginModal?: () => void;
  onOpenMasterData?: () => void;
}

export const GuidedTourModal: React.FC<GuidedTourModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenLoginModal,
  onOpenMasterData,
}) => {
  const { role, switchRole } = useAuth();
  const [activeTourTab, setActiveTourTab] = useState<'overview' | 'roles' | 'interventions' | 'safety'>('overview');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-4xl w-full p-6 text-slate-100 relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-2xl shadow-lg shadow-blue-500/10">
              🧭
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-white">PortPulse Operations Guide & Workflow</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Terminal Walkthrough
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Comprehensive guide to the 4-step operations workflow, role permissions, and prescriptive interventions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg p-2 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-800 pb-3 mb-4">
          <button
            onClick={() => setActiveTourTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTourTab === 'overview'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span>🔄</span> Operational Workflow (4-Steps)
          </button>
          <button
            onClick={() => setActiveTourTab('roles')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTourTab === 'roles'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span>👥</span> Role Profiles & Permissions
          </button>
          <button
            onClick={() => setActiveTourTab('interventions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTourTab === 'interventions'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span>⚡</span> Rerouting & Optimization Deep-Dive
          </button>
          <button
            onClick={() => setActiveTourTab('safety')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTourTab === 'safety'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span>🛡️</span> Physical Safety Guardrails
          </button>
        </div>

        {/* Tab Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 text-xs text-slate-300">
          {activeTourTab === 'overview' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 to-slate-900 border border-blue-900/40">
                <h3 className="text-sm font-bold text-blue-300 mb-1">What is Happening in PortPulse?</h3>
                <p className="text-slate-300 leading-relaxed">
                  PortPulse transforms container port management from reactive firefighting to predictive, cost-quantified precision.
                  The system operates continuously in a 4-step automated loop:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/70 space-y-2">
                  <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs">1</span>
                    Continuous Harbor Ingestion
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Tracks 50+ vessels across Offshore Anchorage, Fairway Channels, and 10 Quays. Continuously ingests AIS positions, carrier ETAs, yard TEU capacity, and real-time tidal/weather constraints.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/70 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <span className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">2</span>
                    72-Hour Predictive Forecaster
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Statistical forecasting engines predict berth-by-berth occupancy probabilities and categorize risk into Green (&lt;60%), Amber (60-80%), and Red (&gt;80% congestion bottlenecks) up to 72 hours in advance.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/70 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs">3</span>
                    Prescriptive Interventions Engine
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Detects bottlenecked berths and computes optimal operational interventions (Vessel Diversion, Slow-Steaming Advisories, and Resequencing) quantified by Demurrage ($), Bunker Fuel ($), and CO2 (mt) saved.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/70 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs">4</span>
                    Deterministic Constraint Optimization
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Solves berth and crane assignments using Highs Mixed-Integer Linear Programming (MILP). Hard physical constraints (vessel draft &le; berth draft, vessel length &le; quay length) are mathematically guaranteed.
                  </p>
                </div>
              </div>

              {/* Quick Navigation Action */}
              <div className="p-3 bg-slate-800/70 rounded-lg border border-slate-700 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white">Ready to explore?</span>
                  <p className="text-[11px] text-slate-400">Jump straight to the Visual Port Map or Live Queue.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateTab?.('map');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition text-xs flex items-center gap-1"
                  >
                    <span>🗺️</span> View Port Map
                  </button>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateTab?.('recommendations');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition text-xs flex items-center gap-1"
                  >
                    <span>⚡</span> View Recommendations
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTourTab === 'roles' && (
            <div className="space-y-4">
              <p className="text-slate-300">
                PortPulse enforces server-side Role-Based Access Control (RBAC). Each operational role has dedicated responsibilities and permissions:
              </p>

              {/* Role Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(ROLE_PROFILES) as UserRole[]).map((r) => {
                  const p = ROLE_PROFILES[r];
                  const isCurrent = role === r;
                  return (
                    <div
                      key={r}
                      className={`p-3.5 rounded-xl border transition ${
                        isCurrent
                          ? 'bg-blue-950/40 border-blue-500/70 ring-1 ring-blue-500/40'
                          : 'bg-slate-800/40 border-slate-700/60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-white text-sm">{p.displayName}</span>
                        {isCurrent ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500 text-white font-bold">
                            CURRENT ROLE
                          </span>
                        ) : (
                          <button
                            onClick={() => switchRole(r)}
                            className="px-2 py-0.5 rounded text-[10px] bg-slate-700 hover:bg-slate-600 text-blue-300 border border-slate-600 transition"
                          >
                            Switch to Role
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mb-2">{p.description}</div>
                      <div className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Permitted Actions:
                      </div>
                      <ul className="space-y-1 mb-3">
                        {p.allowedActions.map((action, idx) => (
                          <li key={idx} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                            <span className="text-emerald-400">✓</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="p-2 rounded bg-slate-900/70 border border-slate-800 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-400">Login: <strong className="text-slate-200">{p.username}</strong></span>
                        <span className="text-slate-400">Pass: <strong className="text-amber-300">{p.defaultPassword}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Matrix Table */}
              <div className="mt-4 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-3 bg-slate-900 border-b border-slate-800 font-bold text-white text-xs">
                  Operational Permissions Matrix
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-900/60 text-slate-400">
                      <tr>
                        <th className="p-2.5">Feature / Operational Action</th>
                        <th className="p-2.5 text-center">Admin</th>
                        <th className="p-2.5 text-center">Terminal Manager</th>
                        <th className="p-2.5 text-center">Shift Supervisor</th>
                        <th className="p-2.5 text-center">Vessel Planner</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      <tr>
                        <td className="p-2.5 font-medium text-slate-200">Provision New Berth / Delete Berth</td>
                        <td className="p-2.5 text-center text-emerald-400 font-bold">✓ Full</td>
                        <td className="p-2.5 text-center text-rose-400 font-bold">✗</td>
                        <td className="p-2.5 text-center text-rose-400 font-bold">✗</td>
                        <td className="p-2.5 text-center text-rose-400 font-bold">✗</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-slate-200">Add / Schedule Incoming Vessel</td>
                        <td className="p-2.5 text-center text-emerald-400 font-bold">✓ Full</td>
                        <td className="p-2.5 text-center text-emerald-400 font-bold">✓ Full</td>
                        <td className="p-2.5 text-center text-amber-400 font-bold">Update Only</td>
                        <td className="p-2.5 text-center text-emerald-400 font-bold">✓ Full</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-slate-200">Execute 72h MILP Optimisation Solver</td>
                        <td className="p-2.5 text-center text-emerald-400 font-bold">✓ Full</td>
                        <td className="p-2.5 text-center text-emerald-400 font-bold">✓ Full</td>
                        <td className="p-2.5 text-center text-rose-400 font-bold">✗</td>
                        <td className="p-2.5 text-center text-rose-400 font-bold">✗</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-slate-200">Approve / Reject Prescriptive Recommendation</td>
                        <td className="p-2.5 text-center text-emerald-400 font-bold">✓ Full</td>
                        <td className="p-2.5 text-center text-emerald-400 font-bold">✓ Full</td>
                        <td className="p-2.5 text-center text-emerald-400 font-bold">✓ Full</td>
                        <td className="p-2.5 text-center text-slate-500">View Only</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-slate-200">Manual Vessel-to-Berth Override</td>
                        <td className="p-2.5 text-center text-emerald-400 font-bold">✓ Guarded</td>
                        <td className="p-2.5 text-center text-emerald-400 font-bold">✓ Guarded</td>
                        <td className="p-2.5 text-center text-emerald-400 font-bold">✓ Guarded</td>
                        <td className="p-2.5 text-center text-rose-400 font-bold">✗</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-slate-200">Run What-If Operational Sandboxes</td>
                        <td className="p-2.5 text-center text-emerald-400 font-bold">✓ Full</td>
                        <td className="p-2.5 text-center text-emerald-400 font-bold">✓ Full</td>
                        <td className="p-2.5 text-center text-emerald-400 font-bold">✓ Full</td>
                        <td className="p-2.5 text-center text-emerald-400 font-bold">✓ Full</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTourTab === 'interventions' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                <h3 className="text-sm font-bold text-white">How Does Rerouting & Optimization Work?</h3>
                <p className="text-slate-300 leading-relaxed">
                  When a berth faces congestion (predicted &gt;80% occupancy) or an operational delay shock occurs (e.g. crane outage or tidal restriction), PortPulse generates prescriptive interventions with quantitative trade-offs:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-blue-500/30 space-y-2">
                  <div className="font-bold text-blue-400 text-sm flex items-center gap-1.5">
                    <span>🔀</span> Vessel Diversion
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Reassigns an incoming vessel from an overburdened berth to an underutilized adjacent quay.
                  </p>
                  <div className="p-2 rounded bg-slate-900 text-[10px] space-y-1 text-slate-400">
                    <div><strong>Benefit:</strong> Eliminates anchorage demurrage ($25k-$80k).</div>
                    <div><strong>Guardrail:</strong> Validates target berth length and draft limit before issuing advice.</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-emerald-500/30 space-y-2">
                  <div className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                    <span>🐢</span> Slow-Steaming Advisory
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Advises incoming ships to reduce open-sea transit speed (e.g. from 18 to 14.5 kts) when their assigned berth will not be clear.
                  </p>
                  <div className="p-2 rounded bg-slate-900 text-[10px] space-y-1 text-slate-400">
                    <div><strong>Benefit:</strong> Saves 15-40 mt of bunker fuel ($10k-$30k) and reduces CO2 emissions.</div>
                    <div><strong>Benefit:</strong> Enables Just-In-Time (JIT) arrival directly to the berth.</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-purple-500/30 space-y-2">
                  <div className="font-bold text-purple-400 text-sm flex items-center gap-1.5">
                    <span>⚡</span> Crane Dynamic Allocation
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Temporarily surges crane resources to high-priority vessels (e.g., refrigerated reefer cargo or express line loops).
                  </p>
                  <div className="p-2 rounded bg-slate-900 text-[10px] space-y-1 text-slate-400">
                    <div><strong>Benefit:</strong> Cuts vessel turnaround dwell time by 4-8 hours.</div>
                    <div><strong>Guardrail:</strong> Respects maximum crane slots per berth.</div>
                  </div>
                </div>
              </div>

              {/* Who can add new master data */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-bold text-white text-sm">Managing Berths & Vessels (Master Data)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-bold text-blue-300 block mb-1">Adding / Modifying Berths</span>
                    <p className="text-slate-400 mb-2">
                      Reserved for <strong>Admin</strong>. Click &ldquo;Master Data&rdquo; in the top bar to add quays with custom length (m), draft limits (m), and crane slots.
                    </p>
                    {role === 'admin' ? (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenMasterData?.();
                        }}
                        className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[10px] transition"
                      >
                        Open Berth Management
                      </button>
                    ) : (
                      <span className="text-slate-500 italic text-[10px]">Switch to Admin role to add berths</span>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-bold text-indigo-300 block mb-1">Adding / Scheduling Vessels</span>
                    <p className="text-slate-400 mb-2">
                      Permitted for <strong>Vessel Planner</strong> and <strong>Admin</strong>. Input IMO, TEU, draft, carrier, and scheduled ETA window.
                    </p>
                    {role === 'admin' || role === 'vessel_planner' ? (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenMasterData?.();
                        }}
                        className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[10px] transition"
                      >
                        Open Vessel Management
                      </button>
                    ) : (
                      <span className="text-slate-500 italic text-[10px]">Switch to Planner or Admin to add vessels</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTourTab === 'safety' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                <h3 className="text-sm font-bold text-white">Deterministic Physical Safety Boundary</h3>
                <p className="text-slate-300 leading-relaxed">
                  Unlike pure generative or unconstrained heuristics, PortPulse enforces hard physical laws that cannot be breached under any circumstances:
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/80 flex items-start gap-3">
                  <span className="text-emerald-400 text-lg">📏</span>
                  <div>
                    <strong className="text-white text-xs block">Quay Length Constraint</strong>
                    <span className="text-slate-400 text-[11px]">
                      A vessel's overall length (LOA) must be strictly less than or equal to the berth length. Any manual override or solver output assigning an oversized ship is rejected outright.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/80 flex items-start gap-3">
                  <span className="text-blue-400 text-lg">🌊</span>
                  <div>
                    <strong className="text-white text-xs block">Draft Depth Clearance</strong>
                    <span className="text-slate-400 text-[11px]">
                      Vessel laden draft must not exceed the berth's hydrodynamic draft limit minus tidal safety margins. Grounding risk is mathematically bounded to zero.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/80 flex items-start gap-3">
                  <span className="text-purple-400 text-lg">⏱️</span>
                  <div>
                    <strong className="text-white text-xs block">Non-Overlapping Berth Window &amp; Buffer</strong>
                    <span className="text-slate-400 text-[11px]">
                      Two vessels cannot occupy the same berth concurrently. A mandatory 45-minute safety buffer is enforced for unberthing and line handling.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/80 flex items-start gap-3">
                  <span className="text-amber-400 text-lg">📝</span>
                  <div>
                    <strong className="text-white text-xs block">Append-Only Audit Logging</strong>
                    <span className="text-slate-400 text-[11px]">
                      Every single decision—berth addition, vessel creation, recommendation accept/reject, or manual override attempt—is immutably recorded in the central audit trail with actor, timestamp, and correlation ID.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 mt-4 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Current Operator: <strong className="text-white">@{ROLE_PROFILES[role]?.username}</strong> ({ROLE_PROFILES[role]?.displayName})
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenLoginModal?.();
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition"
            >
              Switch Role / Credentials
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition"
            >
              Got it, let&apos;s operate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
