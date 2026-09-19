import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api, AuditLogEntryItem, AuditIntegrityResponse, AuditAnomaly } from '../api/client';
import { AdminApprovalsModal } from './AdminApprovalsModal';
import {
  Clock,
  Activity,
  Calendar,
  Zap,
  Ship,
  Anchor,
  Shield,
  Search,
  RotateCw,
  ListFilter,
  FileText,
  Flame,
  AlertTriangle,
  Bot,
  Sliders,
  X,
  Cpu,
  Layers,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  Globe,
  Lock,
} from 'lucide-react';

function parseUtcTimestamp(ts?: string): Date {
  if (!ts) return new Date();
  const s = ts.trim();
  if (s.endsWith('Z') || s.includes('+') || /\s[+-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s);
  }
  return new Date(s.replace(' ', 'T') + 'Z');
}

function formatRelativeTime(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const ActivityLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'ALL' | '1H' | '6H' | '24H'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntryItem | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  // Enterprise Security & Integrity States
  const [integrity, setIntegrity] = useState<AuditIntegrityResponse | null>(null);
  const [verifyingChain, setVerifyingChain] = useState<boolean>(false);
  const [anomalies, setAnomalies] = useState<AuditAnomaly[]>([]);
  const [approvalsModalOpen, setApprovalsModalOpen] = useState<boolean>(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  const currentRole = localStorage.getItem('portpulse-role') || 'shift_supervisor';
  const currentUsername = localStorage.getItem('portpulse-username') || 'supervisor';

  // Periodically refresh relative time clock every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { limit: 150, offset: 0 };
      if (selectedEntity !== 'ALL') {
        params.entity_type = selectedEntity;
      }
      const res = await api.getAuditLogs(params);
      const rawList = res?.items ?? (res as any)?.events ?? [];
      const items = Array.isArray(rawList) ? rawList : [];
      setLogs(items);
      setTotal(typeof res?.total === 'number' ? res.total : items.length);

      // Fetch cryptographic chain integrity
      try {
        const integrityData = await api.verifyAuditIntegrity();
        setIntegrity(integrityData);
      } catch (ie) {
        console.warn('Could not verify chain integrity:', ie);
      }

      // Fetch security anomalies
      try {
        const anomalyData = await api.getAuditAnomalies();
        setAnomalies(anomalyData?.anomalies || []);
      } catch (ae) {
        console.warn('Could not fetch anomalies:', ae);
      }

      // Fetch pending dual-control approvals if admin
      if (currentRole === 'admin') {
        try {
          const apprs = await api.getAdminApprovals();
          const pending = (apprs || []).filter((a) => a.status === 'PENDING');
          setPendingApprovalsCount(pending.length);
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
      setError(err.message || 'Failed to retrieve operational audit logs.');
    } finally {
      setLoading(false);
    }
  }, [selectedEntity, currentRole]);

  const handleVerifyChain = async () => {
    try {
      setVerifyingChain(true);
      const res = await api.verifyAuditIntegrity();
      setIntegrity(res);
    } catch (err) {
      console.error('Integrity verification failed:', err);
    } finally {
      setVerifyingChain(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 12000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  // Filter logs by search term and time range
  const filteredLogs = useMemo(() => {
    const safeLogs = Array.isArray(logs) ? logs : [];
    const term = searchTerm.trim().toLowerCase();

    const rangeMs =
      selectedTimeRange === '1H'
        ? 3600 * 1000
        : selectedTimeRange === '6H'
        ? 6 * 3600 * 1000
        : selectedTimeRange === '24H'
        ? 24 * 3600 * 1000
        : null;

    return safeLogs.filter((log) => {
      if (!log) return false;

      // Time Range Filter
      if (rangeMs !== null) {
        const logDate = parseUtcTimestamp(log.timestamp);
        if (now.getTime() - logDate.getTime() > rangeMs) {
          return false;
        }
      }

      // Search term filter
      if (!term) return true;
      const actor = (log.actor || '').toLowerCase();
      const action = (log.action || '').toLowerCase();
      const entityId = (log.entity_id || '').toLowerCase();
      const correlationId = (log.correlation_id || '').toLowerCase();
      const payload = (log.payload_snapshot || '').toLowerCase();

      return (
        actor.includes(term) ||
        action.includes(term) ||
        entityId.includes(term) ||
        correlationId.includes(term) ||
        payload.includes(term)
      );
    });
  }, [logs, searchTerm, selectedTimeRange, now]);

  // Group logs by day for timeline view
  const groupedTimelineLogs = useMemo(() => {
    const groups: { [dateKey: string]: AuditLogEntryItem[] } = {};
    const todayStr = new Date().toDateString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toDateString();

    filteredLogs.forEach((log) => {
      const d = parseUtcTimestamp(log.timestamp);
      const dStr = d.toDateString();
      let label = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      if (dStr === todayStr) {
        label = 'Today';
      } else if (dStr === yesterdayStr) {
        label = 'Yesterday';
      }

      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(log);
    });

    return groups;
  }, [filteredLogs]);

  const getActionBadgeColor = (action?: string) => {
    const act = (action || '').toUpperCase();
    if (act.includes('CREATE') || act.includes('ACCEPT') || act.includes('CONFIRM') || act.includes('SUCCESS')) {
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30';
    }
    if (act.includes('REJECT') || act.includes('DELETE') || act.includes('SHOCK')) {
      return 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30';
    }
    if (act.includes('OVERRIDE') || act.includes('UPDATE') || act.includes('MODIFY')) {
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30';
    }
    if (act.includes('SOLVER') || act.includes('OPTIMIS') || act.includes('CASCADE')) {
      return 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30';
    }
    if (act.includes('SIMULATION') || act.includes('WHATIF')) {
      return 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30';
    }
    if (act.includes('BRIEFING') || act.includes('QUERY') || act.includes('COPILOT')) {
      return 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30';
    }
    return 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30';
  };

  const getEventIcon = (log: AuditLogEntryItem) => {
    const act = (log.action || '').toUpperCase();
    const entity = (log.entity_type || '').toUpperCase();

    if (act.includes('SHOCK')) return <Flame className="w-4 h-4 text-rose-500" />;
    if (act.includes('SOLVER') || act.includes('OPTIMIS')) return <Zap className="w-4 h-4 text-blue-500" />;
    if (act.includes('CASCADE')) return <Activity className="w-4 h-4 text-purple-500" />;
    if (act.includes('WHATIF') || entity === 'SIMULATION') return <Sliders className="w-4 h-4 text-indigo-500" />;
    if (act.includes('BRIEFING') || act.includes('COPILOT') || entity === 'CHAT') return <Bot className="w-4 h-4 text-cyan-500" />;
    if (act.includes('OVERRIDE')) return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    if (act.includes('ACCEPT')) return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (act.includes('REJECT')) return <XCircle className="w-4 h-4 text-rose-500" />;
    if (entity === 'VESSEL') return <Ship className="w-4 h-4 text-sky-500" />;
    if (entity === 'BERTH') return <Anchor className="w-4 h-4 text-teal-500" />;
    if (entity === 'FLEET') return <Layers className="w-4 h-4 text-emerald-500" />;
    if (entity === 'AUTH') return <Shield className="w-4 h-4 text-amber-500" />;
    if (entity === 'MODEL') return <Cpu className="w-4 h-4 text-purple-500" />;
    return <FileText className="w-4 h-4 text-content-secondary" />;
  };

  const getActorBadge = (actor: string) => {
    if (actor === 'admin') return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    if (actor === 'manager') return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    if (actor === 'supervisor') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (actor === 'planner') return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    return 'bg-slate-700/50 text-slate-300 border-slate-600';
  };

  const getHumanReadableDescription = (log: AuditLogEntryItem) => {
    const action = log.action.toUpperCase();
    if (action === 'FLEET_SYNTHETIC_GENERATION') return `Regenerated port operations fleet with new random seed.`;
    if (action === 'SHOCK_EVENT_INJECTION') return `Injected operational shock perturbation (${log.entity_id}).`;
    if (action === 'WHATIF_SIMULATION') return `Simulated hypothetical what-if operational scenario.`;
    if (action === 'CASCADE_DELAY_SIMULATION') return `Evaluated cascading delay ripple for target vessel ${log.entity_id}.`;
    if (action === 'ML_MODELS_RETRAIN') return `Triggered immediate re-training of ETA and Congestion ML models.`;
    if (action === 'AI_SHIFT_BRIEFING') return `Synthesized GenAI operational shift handover briefing.`;
    if (action === 'COPILOT_QUERY') return `Queried AI Copilot for operational intelligence insights.`;
    if (action === 'RECOMMENDATION_FEEDBACK') return `Submitted operator calibration feedback on recommendation.`;
    if (action.includes('CREATE')) return `Created new ${log.entity_type.toLowerCase()} record.`;
    if (action.includes('UPDATE')) return `Modified ${log.entity_type.toLowerCase()} configuration.`;
    if (action.includes('DELETE')) return `Removed ${log.entity_type.toLowerCase()} record.`;
    if (action.includes('ACCEPT')) return `Approved system recommendation.`;
    if (action.includes('REJECT')) return `Declined system recommendation.`;
    if (action.includes('AUTO_OPTIMIZE_RUN')) return `Executed automated ML & HiGHS MILP optimization cycle.`;
    if (action.includes('AUTO_OPTIMIZE_CONFIRM')) return `Applied and deconflicted optimized operations schedule.`;
    if (action.includes('AUTO_OPTIMIZE_REJECT')) return `Dismissed pending optimized schedule proposal.`;
    if (action.includes('SOLVER') || action.includes('OPTIMISATION')) return `Executed HiGHS MILP solver algorithm.`;
    if (action.includes('CONFIRM')) return `Applied AI optimized schedule.`;
    if (action.includes('OVERRIDE')) return `Manual supervisor berth allocation override attempt.`;
    if (action === 'LOGIN_SUCCESS') return `User successfully authenticated session.`;
    if (action === 'LOGOUT') return `User terminated session.`;
    if (action.includes('MFA')) return `MFA challenge verification event.`;
    return `Executed ${log.action.toLowerCase()} operation.`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-surface-card border border-surface-border p-4 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-xl text-blue-500">
            📋
          </div>
          <div>
            <h2 className="text-base font-bold text-content-primary flex items-center gap-2">
              <span>Operational Activity &amp; Audit Trail</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-bg text-content-secondary border border-surface-border font-mono">
                {total} Total Events
              </span>
              <span className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync
              </span>
            </h2>
            <p className="text-xs text-content-secondary">
              Immutable timeline of berth allocations, fleet provisions, solver runs, what-if simulations, and supervisor overrides
            </p>
          </div>
        </div>

        {/* View Mode Switcher & Refresh */}
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex bg-surface-bg p-0.5 rounded-lg border border-surface-border text-xs">
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium transition ${
                viewMode === 'timeline'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Timeline Stream</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium transition ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Table Grid</span>
            </button>
          </div>

          {/* Time Horizon Filter */}
          <div className="flex bg-surface-bg p-0.5 rounded-lg border border-surface-border text-xs">
            {(['ALL', '1H', '6H', '24H'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setSelectedTimeRange(r)}
                className={`px-2 py-1 rounded font-medium text-[11px] transition ${
                  selectedTimeRange === r
                    ? 'bg-surface-card text-blue-400 font-bold shadow-xs'
                    : 'text-content-muted hover:text-content-primary'
                }`}
              >
                {r === 'ALL' ? 'All' : r}
              </button>
            ))}
          </div>

          {/* Cryptographic SHA-256 Hash-Chain Verification */}
          <button
            onClick={handleVerifyChain}
            disabled={verifyingChain}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
              integrity?.is_valid
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : integrity && !integrity.is_valid
                ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
            }`}
            title="Cryptographically verify SHA-256 hash chaining across all activity records"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${verifyingChain ? 'animate-spin' : ''}`} />
            <span>
              {verifyingChain
                ? 'Verifying...'
                : integrity?.is_valid
                ? `Chain Intact (${integrity.total_verified})`
                : integrity && !integrity.is_valid
                ? 'Tamper Detected!'
                : 'Verify Integrity'}
            </span>
          </button>

          {/* Dual-Control Approvals for Admins */}
          {currentRole === 'admin' && (
            <button
              onClick={() => setApprovalsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-semibold transition relative"
              title="Review dual-control administrative approval requests"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Dual-Control Approvals</span>
              {pendingApprovalsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black font-mono text-[9px] font-bold">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>
          )}

          {/* Refresh Button */}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 rounded-lg bg-surface-bg hover:bg-surface-card text-content-primary border border-surface-border transition disabled:opacity-50"
            title="Refresh Audit Logs"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Security Anomaly & Chain Tamper Alert Banner */}
      {(anomalies.length > 0 || (integrity && !integrity.is_valid)) && (
        <div className="space-y-2">
          {integrity && !integrity.is_valid && (
            <div className="p-4 bg-red-500/10 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-red-200">CRITICAL: Audit Log Cryptographic Tampering Detected</div>
                <div>{integrity.error}</div>
                <div className="font-mono text-[10px] text-red-400 mt-1">
                  Compromised Entry ID: #{integrity.compromised_entry_id} · Verified At: {integrity.verified_at}
                </div>
              </div>
            </div>
          )}
          {anomalies.map((anom, idx) => (
            <div
              key={`anom-${idx}`}
              className={`p-3.5 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                anom.severity === 'CRITICAL'
                  ? 'bg-red-500/10 border-red-500/40 text-red-300'
                  : anom.severity === 'HIGH'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  : 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold flex items-center gap-2">
                    <span>{anom.type}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold uppercase bg-black/20">
                      {anom.severity}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-content-primary">{anom.description}</p>
                </div>
              </div>
              <div className="text-right text-[10px] text-content-muted shrink-0 font-mono">
                <div>IP: {anom.client_ip || 'Internal'}</div>
                <div>{new Date(anom.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter Strip */}
      <div className="bg-surface-card border border-surface-border p-3 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Entity Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-content-muted text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 mr-1">
            <ListFilter className="w-3 h-3" /> Filter:
          </span>
          {[
            { id: 'ALL', label: 'All Activities' },
            { id: 'SOLVER', label: 'Optimization' },
            { id: 'SIMULATION', label: 'Simulations' },
            { id: 'RECOMMENDATION', label: 'Recommendations' },
            { id: 'FLEET', label: 'Fleet' },
            { id: 'VESSEL', label: 'Vessels' },
            { id: 'BERTH', label: 'Berths' },
            { id: 'BERTH_ASSIGNMENT', label: 'Overrides' },
            { id: 'REPORT', label: 'AI Briefings' },
            { id: 'AUTH', label: 'Security' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedEntity(item.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                selectedEntity === item.id
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'bg-surface-bg text-content-secondary hover:text-content-primary border border-surface-border'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-content-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search actor, action, ID..."
            className="bg-surface-bg border border-surface-border rounded-lg pl-8 pr-7 py-1.5 text-xs text-content-primary placeholder-content-muted focus:outline-none focus:border-blue-500 w-52"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1.5 text-content-muted hover:text-content-primary text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TIMELINE STREAM VIEW (Chronological Event Feed)                         */}
      {/* ========================================================================= */}
      {viewMode === 'timeline' && (
        <div className="space-y-6">
          {loading && filteredLogs.length === 0 ? (
            <div className="bg-surface-card border border-surface-border rounded-xl p-12 text-center text-content-muted flex flex-col items-center justify-center gap-2">
              <RotateCw className="w-6 h-6 animate-spin text-blue-500" />
              <span>Loading chronological operational timeline...</span>
            </div>
          ) : Object.keys(groupedTimelineLogs).length === 0 ? (
            <div className="bg-surface-card border border-surface-border rounded-xl p-12 text-center text-content-muted italic">
              No activity events found matching your filter criteria.
            </div>
          ) : (
            Object.entries(groupedTimelineLogs).map(([groupLabel, groupLogs]) => (
              <div key={groupLabel} className="space-y-3">
                {/* Date Group Header */}
                <div className="flex items-center gap-2 px-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-bold text-content-primary tracking-wide uppercase">
                    {groupLabel}
                  </span>
                  <span className="text-[10px] text-content-muted font-mono">
                    ({groupLogs.length} events)
                  </span>
                  <div className="flex-1 h-px bg-surface-border ml-2" />
                </div>

                {/* Timeline Cards Container */}
                <div className="relative pl-6 space-y-3 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-border">
                  {groupLogs.map((log, index) => {
                    const logDate = parseUtcTimestamp(log.timestamp);
                    const relTime = formatRelativeTime(logDate, now);
                    const localTimeStr = logDate.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });
                    const utcTimeStr = logDate.toISOString().slice(11, 19) + ' UTC';

                    let parsedPayload: Record<string, any> | null = null;
                    try {
                      if (log.payload_snapshot) {
                        parsedPayload = JSON.parse(log.payload_snapshot);
                      }
                    } catch {
                      parsedPayload = null;
                    }

                    return (
                      <div
                        key={log.id || `log-${index}`}
                        onClick={() => setSelectedLog(log)}
                        className="relative group bg-surface-card hover:bg-surface-card/90 border border-surface-border hover:border-blue-500/50 rounded-xl p-3.5 shadow-sm transition-all cursor-pointer"
                      >
                        {/* Timeline Node Dot */}
                        <div className="absolute -left-[1.85rem] top-4 w-4 h-4 rounded-full bg-surface-card border-2 border-blue-500 flex items-center justify-center shadow-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        </div>

                        <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                          {/* Event Icon & Action Badge */}
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded-md bg-surface-bg border border-surface-border">
                              {getEventIcon(log)}
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${getActionBadgeColor(
                                log.action
                              )}`}
                            >
                              {log.action}
                            </span>
                            <span className="text-[11px] font-semibold text-content-primary">
                              {getHumanReadableDescription(log)}
                            </span>
                          </div>

                          {/* Chronological Time Badges */}
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                              {relTime}
                            </span>
                            <span className="text-[10px] text-content-muted font-mono" title={utcTimeStr}>
                              {localTimeStr}
                            </span>
                          </div>
                        </div>

                        {/* Event Metadata Bar */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-secondary pt-1 border-t border-surface-border/50">
                          {/* Operator */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-content-muted">Operator:</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${getActorBadge(
                                log.actor
                              )}`}
                            >
                              @{log.actor || 'system'}
                            </span>
                          </div>

                          {/* Entity Target */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-content-muted">Target:</span>
                            <span className="font-mono text-[11px] font-semibold text-content-primary">
                              {log.entity_type} {log.entity_id ? `[${log.entity_id}]` : ''}
                            </span>
                          </div>

                          {/* Correlation ID */}
                          <div className="flex items-center gap-1 font-mono text-[10px] text-content-muted">
                            <span>Trace:</span>
                            <span className="truncate max-w-[100px]">{log.correlation_id}</span>
                          </div>

                          {/* Client IP */}
                          <div className="flex items-center gap-1 font-mono text-[10px] text-content-muted" title={`Client IP: ${log.client_ip || '127.0.0.1'}`}>
                            <Globe className="w-3 h-3 text-content-muted" />
                            <span>{log.client_ip || '127.0.0.1'}</span>
                          </div>

                          {/* Cryptographic SHA-256 Chain Hash */}
                          <div
                            className="flex items-center gap-1 font-mono text-[10px] text-emerald-400 bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/20"
                            title={`Previous Block: ${log.prev_hash || 'Genesis'}\nBlock Digest: ${log.entry_hash || 'Pending'}`}
                          >
                            <Lock className="w-2.5 h-2.5" />
                            <span>{log.entry_hash ? `${log.entry_hash.substring(0, 8)}...` : 'Genesis'}</span>
                          </div>

                          {/* Payload Highlights */}
                          {parsedPayload && Object.keys(parsedPayload).length > 0 && (
                            <div className="flex items-center gap-1 text-[11px] text-content-muted truncate max-w-sm">
                              <span>•</span>
                              {Object.entries(parsedPayload)
                                .slice(0, 3)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(' | ')}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TABULAR DATA VIEW (Grid with Payload Drawer)                            */}
      {/* ========================================================================= */}
      {viewMode === 'table' && (
        <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-bg text-content-secondary border-b border-surface-border">
                <tr>
                  <th className="p-3.5 font-semibold">Timeline / Time</th>
                  <th className="p-3.5 font-semibold">Operator</th>
                  <th className="p-3.5 font-semibold">IP Address</th>
                  <th className="p-3.5 font-semibold">Action</th>
                  <th className="p-3.5 font-semibold">Entity Target</th>
                  <th className="p-3.5 font-semibold">Chain Hash</th>
                  <th className="p-3.5 font-semibold">Trace ID</th>
                  <th className="p-3.5 font-semibold">Event Description &amp; Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border font-mono">
                {loading && filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-content-muted">
                      Loading audit trail...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-content-muted font-sans italic">
                      No activity logs recorded matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, index) => {
                    const logDate = parseUtcTimestamp(log.timestamp);
                    const relTime = formatRelativeTime(logDate, now);
                    const localTimeStr = logDate.toLocaleString([], {
                      month: 'short',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });

                    let formattedPayload = '';
                    try {
                      if (log.payload_snapshot) {
                        const parsed = JSON.parse(log.payload_snapshot);
                        formattedPayload = Object.entries(parsed)
                          .slice(0, 3)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' • ');
                      }
                    } catch {
                      formattedPayload = log.payload_snapshot || '';
                    }

                    const logKey = log?.id != null ? `log-${log.id}` : `log-${index}`;

                    return (
                      <tr
                        key={logKey}
                        onClick={() => setSelectedLog(log)}
                        className="hover:bg-surface-hover/60 cursor-pointer transition-colors"
                      >
                        <td className="p-3 text-content-muted text-[11px] whitespace-nowrap">
                          <div className="font-bold text-blue-600 dark:text-blue-400">{relTime}</div>
                          <div className="text-[10px] text-content-muted">{localTimeStr}</div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getActorBadge(
                              log.actor
                            )}`}
                          >
                            @{log.actor || 'system'}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap font-mono text-[11px] text-content-muted">
                          {log.client_ip || '127.0.0.1'}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action || 'EVENT'}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap font-semibold text-content-primary">
                          <span className="text-[10px] text-content-muted block font-normal">{log.entity_type || 'SYSTEM'}</span>
                          {log.entity_id || '-'}
                        </td>
                        <td className="p-3 whitespace-nowrap font-mono text-[10px] text-emerald-400">
                          <span title={`Previous Hash: ${log.prev_hash || 'Genesis'}\nEntry Hash: ${log.entry_hash || 'Pending'}`}>
                            {log.entry_hash ? `${log.entry_hash.substring(0, 8)}...` : 'Genesis'}
                          </span>
                        </td>
                        <td className="p-3 text-content-muted text-[11px] truncate max-w-[120px]" title={log.correlation_id || ''}>
                          {log.correlation_id || '-'}
                        </td>
                        <td className="p-3 text-content-secondary text-[11px] truncate max-w-[240px]" title={log.payload_snapshot || ''}>
                          <div className="font-semibold text-content-primary mb-0.5 font-sans">
                            {getHumanReadableDescription(log)}
                          </div>
                          <div className="text-content-muted">
                            {formattedPayload || <span className="italic">No extra payload</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Snapshot Drawer Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-card border border-surface-border rounded-2xl shadow-2xl max-w-lg w-full p-6 text-content-primary relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 right-4 text-content-muted hover:text-content-primary text-lg p-2 rounded-lg hover:bg-surface-hover transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-surface-border pb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-xl text-blue-500">
                {getEventIcon(selectedLog)}
              </div>
              <div>
                <h3 className="text-sm font-bold text-content-primary">Audit Event Record #{selectedLog.id}</h3>
                <div className="flex items-center gap-2 text-xs text-content-secondary">
                  <span>{parseUtcTimestamp(selectedLog.timestamp).toLocaleString()}</span>
                  <span>•</span>
                  <span className="text-blue-400 font-semibold">
                    {formatRelativeTime(parseUtcTimestamp(selectedLog.timestamp), now)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-surface-bg rounded-lg border border-surface-border">
                <span className="text-[10px] text-content-muted block">Operator (Actor)</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">@{selectedLog.actor}</span>
                {selectedLog.actor_role && (
                  <span className="text-[10px] text-content-muted block font-mono">Role: {selectedLog.actor_role}</span>
                )}
              </div>
              <div className="p-2.5 bg-surface-bg rounded-lg border border-surface-border">
                <span className="text-[10px] text-content-muted block">Action</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedLog.action}</span>
              </div>
              <div className="p-2.5 bg-surface-bg rounded-lg border border-surface-border">
                <span className="text-[10px] text-content-muted block">Entity Target</span>
                <span className="font-bold text-content-primary">{selectedLog.entity_type}</span>
              </div>
              <div className="p-2.5 bg-surface-bg rounded-lg border border-surface-border">
                <span className="text-[10px] text-content-muted block">Entity ID</span>
                <span className="font-mono font-bold text-content-primary">{selectedLog.entity_id}</span>
              </div>
            </div>

            {/* Network IP & Trace Details */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-surface-bg rounded-lg border border-surface-border">
                <span className="text-[10px] text-content-muted block">Client IP Address</span>
                <span className="font-mono font-bold text-content-primary flex items-center gap-1.5 mt-0.5">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  {selectedLog.client_ip || '127.0.0.1'}
                </span>
              </div>
              <div className="p-2.5 bg-surface-bg rounded-lg border border-surface-border">
                <span className="text-[10px] text-content-muted block">Trace Correlation ID</span>
                <span className="font-mono text-[11px] text-content-primary truncate block mt-0.5" title={selectedLog.correlation_id}>
                  {selectedLog.correlation_id}
                </span>
              </div>
            </div>

            {/* SHA-256 Cryptographic Hash Chain Block */}
            <div className="p-3 bg-surface-bg rounded-xl border border-surface-border space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                <Lock className="w-3.5 h-3.5" />
                <span>SHA-256 Cryptographic Hash Chain Block</span>
              </div>
              <div>
                <span className="text-[10px] text-content-muted block">Previous Block Digest:</span>
                <div className="font-mono text-[10px] text-content-secondary break-all bg-surface-card p-1.5 rounded border border-surface-border">
                  {selectedLog.prev_hash || 'GENESIS_PORTPULSE_INTEGRITY_CHAIN'}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-content-muted block">Current Block Digest (SHA-256):</span>
                <div className="font-mono text-[10px] text-emerald-400 break-all bg-surface-card p-1.5 rounded border border-surface-border">
                  {selectedLog.entry_hash || 'Pending Calculation'}
                </div>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-content-secondary uppercase tracking-wider block mb-1">
                Full Payload Snapshot
              </span>
              <pre className="p-3 bg-surface-bg rounded-lg border border-surface-border font-mono text-[11px] text-content-primary max-h-48 overflow-y-auto whitespace-pre-wrap">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(selectedLog.payload_snapshot || '{}'), null, 2);
                  } catch {
                    return selectedLog.payload_snapshot || 'None';
                  }
                })()}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dual-Control Admin Approvals Modal */}
      <AdminApprovalsModal
        isOpen={approvalsModalOpen}
        onClose={() => setApprovalsModalOpen(false)}
        currentUserRole={currentRole}
        currentUsername={currentUsername}
        onActionComplete={fetchLogs}
      />
    </div>
  );
};
export default ActivityLogView;
